"""Audio for the Expo video: neural voice-over plus an original music bed and sound effects.

    python scripts/make_audio.py voice   # TTS clips -> public/expo/audio/vo, writes src/expo/voiceover.ts
    python scripts/make_audio.py music   # music.wav, whoosh.wav, chime.wav fitted to src/expo/timeline.ts
    python scripts/make_audio.py all     # both, in order (`npm run audio`)

The music is fitted to the timeline, which depends on the voice clip lengths, so run it after `voice`.

The voice uses edge-tts (Microsoft's online neural voices), so the narration text below is sent to that
service. Clips are cached by text, so only changed lines are re-requested. Everything else is synthesized
locally with numpy, so there is no third-party music to license.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "expo" / "audio"
VO_DIR = AUDIO / "vo"
VO_TS = ROOT / "src" / "expo" / "voiceover.ts"
FPS = 30

VOICE = "en-US-AvaNeural"
RATE = "+4%"

# Narration, one clip per line. Where each line starts is set in src/expo/timeline.ts.
LINES: dict[str, str] = {
    "hook1": "Every scholarship slot matters.",
    "hook2": "But screening applicants by hand is slow, inconsistent, and hard to explain.",
    "title": "This is IskoMatic: AI-assisted scholarship screening for Santa Cruz, Laguna.",
    "signin": "Staff sign in with their own accounts, each one approved by an administrator.",
    "reg1": "One guided form collects every detail in six validated steps.",
    "reg2": "And the server double-checks everything. Twenty dependents in a household of six? Refused.",
    "reg3": "Correct it, and the application is registered.",
    "rules": "The office's eligibility rules always run first. The AI never overrides policy.",
    "batch": "Batch screening only re-checks what changed, so unchanged applications are skipped.",
    "explain": "Open any applicant to see their chance of qualifying, and exactly why. The AI advises. It never decides.",
    "factors": "Every factor adds up to the prediction, exactly. No black box.",
    "rank": "Eligible applicants are ranked, so staff can review the strongest first.",
    "ml1": "Under the hood, three hundred decision trees vote on every applicant.",
    "ml2": "Tested on nearly fourteen hundred applicants it had never seen, it scored over eighty-two percent accuracy.",
    "ml3": "It weighs financial need the most, and ninety-six percent of its top picks truly qualified.",
    "ml4": "And one command regenerates every number in its report card.",
    "decision": "But people make the final call. Only officials and administrators can decide, remarks are required, and every step is logged under their name.",
    "refs": "Every result is traceable, from the source records to who did what.",
    "tech": "And it all runs locally, on the office computer, with security built in.",
    "end": "IskoMatic. Fair opportunities, for a brighter Santa Cruz.",
}


# ------------------------------------------------------------------ voice


async def _speak(text: str, out: Path) -> float:
    """Writes the mp3 and returns when the last word ends (seconds), ignoring trailing silence."""
    import edge_tts

    comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    end = 0.0
    with out.open("wb") as fh:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                end = max(end, (chunk["offset"] + chunk["duration"]) / 1e7)
    if end <= 0:
        raise RuntimeError(f"no word timings returned for {out.name}")
    return end


VOICE_RMS_DB = -16.0  # loudness of speech (ignoring pauses) after levelling
FFMPEG = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"


def level_voice(mp3: Path, out: Path) -> None:
    """Decodes a clip with Remotion's ffmpeg and brings every line to the same loudness (peaks under -1 dBFS)."""
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp, "raw.wav")
        subprocess.run([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp3), str(raw)], check=True)
        with wave.open(str(raw)) as w:
            rate, x = w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), "<i2") / 32768
    speech = x[np.abs(x) > 0.01]
    gain = 10 ** (VOICE_RMS_DB / 20) / np.sqrt(np.mean(speech**2))
    gain = min(gain, 10 ** (-1 / 20) / np.max(np.abs(x)))
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((x * gain * 32767).astype("<i2").tobytes())


def voice() -> None:
    VO_DIR.mkdir(parents=True, exist_ok=True)
    meta_path = VO_DIR / "meta.json"
    meta = json.loads(meta_path.read_text("utf-8")) if meta_path.exists() else {}
    for stale in set(meta) - set(LINES):
        (VO_DIR / f"{stale}.mp3").unlink(missing_ok=True)
        (VO_DIR / f"{stale}.wav").unlink(missing_ok=True)
        meta.pop(stale)
    for key, text in LINES.items():
        digest = hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode()).hexdigest()
        mp3 = VO_DIR / f"{key}.mp3"
        if meta.get(key, {}).get("hash") == digest and mp3.exists():
            continue
        seconds = asyncio.run(_speak(text, mp3))
        meta[key] = {"hash": digest, "seconds": round(seconds, 3)}
        print(f"  {key:9s} {seconds:5.2f}s  {text}")
    meta_path.write_text(json.dumps(meta, indent=2), "utf-8")
    for key in LINES:
        level_voice(VO_DIR / f"{key}.mp3", VO_DIR / f"{key}.wav")

    rows = []
    for key, text in LINES.items():
        frames = math.ceil(meta[key]["seconds"] * FPS) + 2
        rows.append(f"  {key}: {{file: 'expo/audio/vo/{key}.wav', frames: {frames}, text: {json.dumps(text)}}},")
    VO_TS.write_text(
        "// Generated by scripts/make_audio.py (npm run audio). Do not edit by hand: change LINES there.\n"
        f"// Voice: {VOICE} ({RATE}). `frames` is when the last word ends, at {FPS} fps.\n"
        "export const VO = {\n" + "\n".join(rows) + "\n} as const;\n\nexport type VoId = keyof typeof VO;\n",
        "utf-8",
    )
    print(f"wrote {VO_TS.relative_to(ROOT)} ({len(LINES)} lines)")


# ------------------------------------------------------------------ synthesis helpers

SR = 48000
RNG = np.random.default_rng(7)


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def saw(freq: float, t: np.ndarray, phase: float = 0.0) -> np.ndarray:
    x = freq * t + phase
    return 2.0 * (x - np.floor(x + 0.5))


def tri(freq: float, t: np.ndarray) -> np.ndarray:
    return 2.0 * np.abs(saw(freq, t)) - 1.0


def lowpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    from scipy.signal import butter, sosfilt

    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x, axis=0)


def highpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    from scipy.signal import butter, sosfilt

    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x, axis=0)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    from scipy.signal import butter, sosfilt

    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def sweep_lowpass(x: np.ndarray, start_hz: float, end_hz: float) -> np.ndarray:
    """One-pole lowpass whose cutoff glides exponentially from start to end."""
    hz = start_hz * (end_hz / start_hz) ** np.linspace(0, 1, len(x))
    a = 1.0 - np.exp(-2 * np.pi * hz / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def adsr(n: int, a: float, r: float) -> np.ndarray:
    env = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        env[:na] = np.linspace(0, 1, na)
    if nr:
        env[n - nr :] *= np.linspace(1, 0, nr)
    return env


def reverb(x: np.ndarray, seconds: float = 2.4, wet: float = 0.3) -> np.ndarray:
    from scipy.signal import fftconvolve

    n = int(seconds * SR)
    decay = np.exp(-np.arange(n) / SR * (6.9 / seconds))
    out = np.empty_like(x)
    for ch in range(2):
        ir = lowpass(RNG.standard_normal(n), 6000) * decay
        ir /= np.sqrt(np.sum(ir**2))
        out[:, ch] = fftconvolve(x[:, ch], ir)[: len(x)]
    return x * (1 - wet) + out * wet


def place(buf: np.ndarray, start: float, sig: np.ndarray, pan: float = 0.0) -> None:
    i = int(start * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    sig = sig[: len(buf) - i]
    left, right = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    buf[i : i + len(sig), 0] += sig * left
    buf[i : i + len(sig), 1] += sig * right


def write_wav(path: Path, x: np.ndarray, peak_db: float = -1.0) -> None:
    x = np.tanh(x / (np.max(np.abs(x)) + 1e-9) * 1.2)
    x *= 10 ** (peak_db / 20) / (np.max(np.abs(x)) + 1e-9)
    pcm = (x * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"wrote {path.relative_to(ROOT)} ({len(x) / SR:.1f}s)")


# ------------------------------------------------------------------ instruments

# I-V-vi-IV in D, then vi-IV-I-V, alternating every four bars.
CHORDS = {
    "D": ([50, 57, 62, 66], 38),
    "A": ([52, 57, 61, 64], 33),
    "Bm": ([50, 54, 59, 66], 35),
    "G": ([50, 55, 59, 62], 31),
}
PROGRESSION = ["D", "A", "Bm", "G", "Bm", "G", "D", "A"]


def pad_chord(notes: list[int], seconds: float, attack: float = 0.5, release: float = 0.9) -> np.ndarray:
    t = t_axis(seconds)
    sig = np.zeros_like(t)
    for n in notes:
        for cents in (-8, 0, 8):
            sig += saw(midi(n) * 2 ** (cents / 1200), t, RNG.random())
    sig = lowpass(sig / (len(notes) * 3), 1400) + 0.25 * np.sin(2 * np.pi * midi(notes[0]) * t)
    return sig * adsr(len(t), attack, release)


def pluck(note: int, seconds: float = 0.45) -> np.ndarray:
    t = t_axis(seconds)
    f = midi(note)
    sig = 0.7 * tri(f, t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return sig * np.exp(-t * 9) * adsr(len(t), 0.003, 0.05)


def bell(note: int, seconds: float = 3.0) -> np.ndarray:
    t = t_axis(seconds)
    f = midi(note)
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 3)
    return sig * np.exp(-t * 1.6) * adsr(len(t), 0.004, 0.3)


def bass_note(note: int, seconds: float) -> np.ndarray:
    t = t_axis(seconds)
    f = midi(note)
    sig = np.sin(2 * np.pi * f * t) + 0.18 * lowpass(saw(f, t), 500)
    return sig * adsr(len(t), 0.01, 0.12) * (0.75 + 0.25 * np.exp(-t * 6))


def kick() -> np.ndarray:
    t = t_axis(0.42)
    freq = 46 + 74 * np.exp(-t * 30)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * np.exp(-t * 9) + 0.05 * RNG.standard_normal(len(t)) * np.exp(-t * 120)


def clap() -> np.ndarray:
    t = t_axis(0.25)
    return bandpass(RNG.standard_normal(len(t)), 900, 4200) * np.exp(-t * 22)


def hat(open_: bool = False) -> np.ndarray:
    t = t_axis(0.18 if open_ else 0.05)
    return highpass(RNG.standard_normal(len(t)), 7000) * np.exp(-t * (18 if open_ else 70))


def riser(seconds: float) -> np.ndarray:
    noise = RNG.standard_normal(int(seconds * SR))
    sig = sweep_lowpass(noise, 300, 9000)
    return sig * np.linspace(0, 1, len(sig)) ** 2.2


def whoosh(seconds: float = 0.7) -> np.ndarray:
    n = int(seconds * SR)
    noise = RNG.standard_normal(n)
    up = sweep_lowpass(noise, 400, 5000)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2 * np.linspace(1, 0.4, n)
    return up * env


# ------------------------------------------------------------------ music


def music(drop: float, end_start: float, total: float) -> None:
    """drop: when the groove starts (title card). end_start: drums stop, final chord. total: file length."""
    bpm = 104
    beat = 60 / bpm
    bar = beat * 4
    pad = np.zeros((int(total * SR) + SR, 2))
    arp = np.zeros_like(pad)
    drums = np.zeros_like(pad)
    bass = np.zeros_like(pad)

    # Intro over the hook: a minor-leaning swell that resolves into D at the drop.
    intro = [("Bm", 0.0), ("G", drop / 2)]
    for name, at in intro:
        length = drop / 2 + 0.9
        place(pad, at, pad_chord(CHORDS[name][0], length, attack=1.4 if at == 0 else 0.6) * 0.9, -0.2)
        place(pad, at, pad_chord(CHORDS[name][0], length, attack=1.4 if at == 0 else 0.6) * 0.9, 0.2)
    rise = min(2.2, drop)
    place(pad, drop - rise, riser(rise) * 0.22)
    place(pad, drop - 0.9, bell(74, 2.5) * 0.18, 0.3)

    # Groove from the drop until the end card.
    n_bars = math.ceil((end_start - drop) / bar)
    for b in range(n_bars):
        t0 = drop + b * bar
        name = PROGRESSION[b % len(PROGRESSION)]
        notes, root = CHORDS[name]
        stop = min(bar, end_start - t0)
        place(pad, t0, pad_chord(notes, stop + 0.9, attack=0.25) * 0.8, -0.25)
        place(pad, t0, pad_chord(notes, stop + 0.9, attack=0.25) * 0.8, 0.25)

        arp_notes = [notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[2] + 12]
        for s in range(16):
            at = t0 + s * beat / 4
            if at >= end_start:
                break
            if b < 2 and s % 2:  # sparser for the first two bars
                continue
            place(arp, at, pluck(arp_notes[s % 4] + (12 if s in (6, 14) else 0)) * (0.32 if s % 4 == 0 else 0.22), -0.5 if s % 2 else 0.5)

        if b >= 1:
            for e in range(8):
                at = t0 + e * beat / 2
                if at >= end_start:
                    break
                note = root + (12 if e in (3, 7) else 0)
                place(bass, at, bass_note(note, beat / 2 * 0.92) * (0.55 if e % 2 else 0.7))

        for q in range(4):
            at = t0 + q * beat
            if at >= end_start:
                break
            place(drums, at, kick() * (0.9 if q in (0, 2) else 0.0))
            if q in (1, 3) and b >= 2:
                place(drums, at, clap() * 0.22, 0.1)
            if b >= 1:
                place(drums, at + beat / 2, hat(open_=(q == 3)) * 0.16, 0.35)
                place(drums, at, hat() * 0.07, 0.35)
        if b % 8 == 7 and b < n_bars - 1:  # small fill into each eight-bar block
            for k in range(4):
                place(drums, t0 + 3 * beat + k * beat / 4, clap() * (0.08 + 0.04 * k), -0.1)

    # Ending over the end card: tonic chord swell, bells, ring out.
    tail = total - end_start + 1
    place(pad, end_start, pad_chord(CHORDS["D"][0] + [69], tail, attack=0.4, release=tail * 0.8) * 0.9, -0.2)
    place(pad, end_start, pad_chord(CHORDS["D"][0] + [69], tail, attack=0.4, release=tail * 0.8) * 0.9, 0.2)
    place(bass, end_start, bass_note(38, min(tail, 4.0)) * 0.7)
    place(drums, end_start, kick() * 0.9)
    for k, n in enumerate([74, 78, 81, 86]):
        place(arp, end_start + 0.15 + k * 0.16, bell(n, 3.5) * 0.25, -0.4 + k * 0.27)

    wet = reverb(pad + arp * 0.9, 2.6, 0.35)
    mix = wet * 0.75 + lowpass(bass, 900) * 0.5 + drums * 0.55
    mix = highpass(mix, 30)[: int(total * SR)]
    fade = min(len(mix), int(1.2 * SR))
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    AUDIO.mkdir(parents=True, exist_ok=True)
    write_wav(AUDIO / "music.wav", mix)

    sfx = np.zeros((int(0.9 * SR), 2))
    place(sfx, 0.0, whoosh(0.7), -0.4)
    place(sfx, 0.05, whoosh(0.7), 0.4)
    write_wav(AUDIO / "whoosh.wav", sfx, peak_db=-3)

    chime = np.zeros((int(3.0 * SR), 2))
    for k, n in enumerate([81, 86]):
        place(chime, k * 0.09, bell(n, 2.8), -0.2 + 0.4 * k)
    write_wav(AUDIO / "chime.wav", reverb(chime, 1.8, 0.3), peak_db=-3)


def timeline() -> dict:
    """Compiles src/expo/timeline.ts with the project's TypeScript and returns its TIMELINE."""
    with tempfile.TemporaryDirectory() as tmp:
        tsc = ROOT / "node_modules" / "typescript" / "bin" / "tsc"
        subprocess.run(
            ["node", str(tsc), "src/expo/timeline.ts", "--outDir", tmp, "--module", "commonjs", "--target", "ES2018", "--skipLibCheck", "--types", "node"],
            cwd=ROOT, check=True,
        )
        js = Path(tmp, "timeline.js").as_posix()
        out = subprocess.run(["node", "-e", f"console.log(JSON.stringify(require({json.dumps(js)}).TIMELINE))"], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def fitted_music() -> None:
    tl = timeline()
    start = {b["name"]: b["from"] / FPS for b in tl["beats"]}
    total = tl["total"] / FPS
    print(f"timeline: {total:.1f}s, groove from {start['Title']:.2f}s, ending from {start['End card']:.2f}s")
    music(start["Title"], start["End card"], total)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) == 2 else ""
    if cmd in ("voice", "all"):
        voice()
    if cmd in ("music", "all"):
        fitted_music()
    if cmd not in ("voice", "music", "all"):
        sys.exit(__doc__)
