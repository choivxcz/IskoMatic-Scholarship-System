import {AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile} from 'remotion';
import {CLAMP} from '../theme';
import {AppScene, EndCard, ExplainPanelScene, Hook, MLScene, RefsScene, RegisterScene, RulesScene, TechStack, Title} from './scenes';
import {BeatName, EXPO_FRAMES, TIMELINE} from './timeline';

export {EXPO_FRAMES};

// Expo cut: landscape, ~2 min at 30 fps, narrated. All app footage was recorded from the running
// system (public/expo/*.mp4, *.png) against a throwaway copy of the database with fictional records,
// by scripts/record_footage.py; public/expo/clips.json lists when the key moments happen in each clip.
// Timing lives in timeline.ts; the audio comes from scripts/make_audio.py (`npm run audio`).
type Render = (d: number, parts: number[]) => React.ReactNode;

const SCENES: Record<BeatName, Render> = {
  Hook: (d) => <Hook duration={d} />,
  Title: (d) => <Title duration={d} />,
  'Sign-in': (d) => (
    <AppScene duration={d} step="01" title="Secure staff sign-in" body="Individual accounts, approved by an Administrator before first use." chip="Passwords hashed with PBKDF2"
      video="expo/login.mp4" rate={1.9} zoom={[{f: 0, s: 1, x: 0.6, y: 0.35}, {f: 115, s: 1, x: 0.6, y: 0.35}, {f: 150, s: 1.22, x: 0.62, y: 0.38}]} />
  ),
  Register: (d, parts) => <RegisterScene duration={d} parts={parts} />,
  Rules: (d) => <RulesScene duration={d} />,
  Batch: (d) => (
    <AppScene duration={d} step="04" title="Screens only what changed" body="Each result is fingerprinted with its inputs and model version, so unchanged applications are skipped." chip="1 screened · 15 already up to date"
      video="expo/batch.mp4" rate={1.5} zoom={[{f: 0, s: 1, x: 0.97, y: 0.95}, {f: 150, s: 1, x: 0.97, y: 0.95}, {f: 172, s: 1.7, x: 0.97, y: 0.95}, {f: 230, s: 1.7, x: 0.97, y: 0.95}]} />
  ),
  Explain: (d) => (
    <AppScene duration={d} step="05" title="The AI explains itself" body="Open any applicant to see the chance of qualifying and exactly why." chip="Advisory only — never a decision" chipTone="blue"
      video="expo/explain.mp4" rate={1.3} zoom={[{f: 0, s: 1, x: 1, y: 0.75}, {f: 130, s: 1, x: 1, y: 0.75}, {f: 152, s: 1.6, x: 1, y: 0.75}, {f: 225, s: 1.6, x: 1, y: 0.75}]} />
  ),
  Factors: (d) => <ExplainPanelScene duration={d} />,
  Ranking: (d) => (
    <AppScene duration={d} step="06" title="Review the strongest first" body="Eligible applicants are ranked by chance within the same program and year." chip="Top 10% → 96.4% truly qualified"
      image="expo/ranking.png" label="Screenshot of the running app" zoom={[{f: 0, s: 1, x: 0.4, y: 0.62}, {f: 25, s: 1, x: 0.4, y: 0.62}, {f: 65, s: 1.55, x: 0.4, y: 0.66}, {f: 135, s: 1.55, x: 0.4, y: 0.66}]} />
  ),
  ML: (d, parts) => <MLScene duration={d} parts={parts} />,
  Decision: (d) => (
    <AppScene duration={d} step="07" title="People make the final call" body="Only LYDO Officials and Administrators decide. Remarks are required, and every step is logged under their name." chip="Full audit trail"
      video="expo/decision.mp4" rate={1.8} zoom={[{f: 0, s: 1, x: 0.98, y: 0.95}, {f: 180, s: 1, x: 0.98, y: 0.95}, {f: 196, s: 1.7, x: 0.98, y: 0.95}, {f: 236, s: 1.7, x: 0.98, y: 0.95}, {f: 256, s: 1, x: 0.5, y: 0.5}]} />
  ),
  Traceability: (d) => <RefsScene duration={d} />,
  'Tech stack': (d) => <TechStack duration={d} />,
  'End card': (d) => <EndCard duration={d} />,
};

/* ---------------------------------------------------------------- audio mix */

const MUSIC_BED = 0.6; // music alone
const MUSIC_UNDER = 0.19; // music while the narrator speaks
const SFX = 0.3;

/** Music volume: dips smoothly around every narration line. */
const musicVolume = (f: number) => {
  let duck = 0;
  for (const c of TIMELINE.cues) {
    if (f < c.from - 10 || f > c.from + c.frames + 18) continue;
    duck = Math.max(duck, interpolate(f, [c.from - 10, c.from, c.from + c.frames, c.from + c.frames + 18], [0, 1, 1, 0], CLAMP));
  }
  const fadeIn = interpolate(f, [0, 20], [0, 1], CLAMP);
  return fadeIn * (MUSIC_BED - (MUSIC_BED - MUSIC_UNDER) * duck);
};

const Soundtrack: React.FC = () => {
  const at = (name: BeatName) => TIMELINE.beats.find((b) => b.name === name)!.from;
  // A whoosh peaks ~10 frames in, so it is started just before each cut.
  const cuts = TIMELINE.beats.filter((b) => !['Hook', 'Title', 'End card'].includes(b.name)).map((b) => b.from - 10);
  return (
    <>
      <Html5Audio src={staticFile('expo/audio/music.wav')} volume={musicVolume} />
      {TIMELINE.cues.map((c) => (
        <Sequence key={c.id} name={`VO ${c.id}`} from={c.from} durationInFrames={c.frames + 30} layout="none">
          <Html5Audio src={staticFile(c.file)} />
        </Sequence>
      ))}
      {cuts.map((from) => (
        <Sequence key={from} name="whoosh" from={from} durationInFrames={27} layout="none">
          <Html5Audio src={staticFile('expo/audio/whoosh.wav')} volume={SFX} />
        </Sequence>
      ))}
      {[at('Title'), at('End card') + 2].map((from) => (
        <Sequence key={from} name="chime" from={from} durationInFrames={90} layout="none">
          <Html5Audio src={staticFile('expo/audio/chime.wav')} volume={SFX * 1.3} />
        </Sequence>
      ))}
    </>
  );
};

export const ExpoVideo: React.FC = () => (
  <AbsoluteFill style={{background: '#061f4e'}}>
    {TIMELINE.beats.map((b) => (
      <Sequence key={b.name} name={b.name} from={b.from} durationInFrames={b.frames}>
        {SCENES[b.name](b.frames, b.parts)}
      </Sequence>
    ))}
    <Soundtrack />
  </AbsoluteFill>
);
