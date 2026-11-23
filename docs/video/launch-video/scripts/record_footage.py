"""Records the app footage used by the Expo video (public/expo/*.mp4 and ranking.png).

    python scripts/record_footage.py                 # record every clip, in story order (`npm run footage`)
    python scripts/record_footage.py --until batch   # stop after one step of the story, for testing

Nothing touches the real data:
- The live database is cloned into a throwaway schema (CLONE_DB), dropped again at the end.
- The Administrator account gets a temporary random password in the clone only.
- A second bridge serves the clone on BRIDGE_PORT; the browser's calls to the app's fixed
  127.0.0.1:8765 API are rerouted to it, so a bridge the user is running is never used.
- The UI is the Vite dev server on 1420 (the bridge only accepts that origin).

Each clip is driven with Playwright in Microsoft Edge (no browser download needed), filmed through
Chrome's DevTools screencast at 2304x1440 with a drawn cursor, resampled to 30 fps and encoded to
H.264 with Remotion's ffmpeg. `clips.json` next to the footage records when the key moments happen
in each clip (seconds from its start), so the rates and zooms in src/expo can be lined up with them.
The old footage is overwritten; take a copy first if you may want it back.
"""
from __future__ import annotations

import base64
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from pathlib import Path

VIDEO_ROOT = Path(__file__).resolve().parent.parent
PROJECT = VIDEO_ROOT.parent.parent.parent
DESKTOP = PROJECT / "app" / "ui" / "desktop"
OUT = VIDEO_ROOT / "public" / "expo"
FFMPEG = VIDEO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

CLONE_DB = "iskomatic_expo"
BRIDGE_PORT = 8766
UI = "http://127.0.0.1:1420"
APP_API = "http://127.0.0.1:8765/api"
ADMIN = "adminchoi"
PASSWORD = "Expo-" + secrets.token_urlsafe(9)

VIEW = {"width": 1440, "height": 900}
SCALE = 1.6  # 2304 x 1440 footage

sys.path.insert(0, str(PROJECT))
sys.path.insert(0, str(DESKTOP))


# ------------------------------------------------------------------ database clone


def _conn(database: str | None = None):
    from database.connection import get_connection

    old = os.environ.get("DB_NAME")
    if database:
        os.environ["DB_NAME"] = database
    try:
        return get_connection()
    finally:
        if database:
            if old is None:
                os.environ.pop("DB_NAME", None)
            else:
                os.environ["DB_NAME"] = old


def clone_database() -> None:
    from auth_store import hash_password

    src = _conn()
    cur = src.cursor()
    cur.execute("SELECT DATABASE()")
    live = cur.fetchone()[0]
    assert live != CLONE_DB
    cur.execute(f"DROP DATABASE IF EXISTS `{CLONE_DB}`")
    cur.execute(f"CREATE DATABASE `{CLONE_DB}`")
    cur.execute("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
    tables = [r[0] for r in cur.fetchall()]
    cur.execute("SET FOREIGN_KEY_CHECKS = 0")
    for t in tables:
        cur.execute(f"CREATE TABLE `{CLONE_DB}`.`{t}` LIKE `{live}`.`{t}`")
        cur.execute(f"INSERT INTO `{CLONE_DB}`.`{t}` SELECT * FROM `{live}`.`{t}`")
    cur.execute(
        f"UPDATE `{CLONE_DB}`.staff_accounts SET password_hash = %s, failed_attempts = 0, locked_until = NULL WHERE username = %s",
        (hash_password(PASSWORD), ADMIN),
    )
    cur.execute(f"DELETE FROM `{CLONE_DB}`.staff_sessions")
    src.commit()
    src.close()
    print(f"cloned {live} -> {CLONE_DB} ({len(tables)} tables)")


def drop_clone() -> None:
    c = _conn()
    c.cursor().execute(f"DROP DATABASE IF EXISTS `{CLONE_DB}`")
    c.commit()
    c.close()
    print(f"dropped {CLONE_DB}")


# ------------------------------------------------------------------ servers


def _wait_http(url: str, seconds: float = 60) -> None:
    end = time.time() + seconds
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except Exception:
            time.sleep(0.4)
    raise RuntimeError(f"{url} did not come up")


@contextmanager
def servers():
    env = {**os.environ, "DB_NAME": CLONE_DB, "PYTHONUNBUFFERED": "1"}
    code = f"import bridge_server as b; b.PORT = {BRIDGE_PORT}; b.main()"
    log = open(Path(tempfile.gettempdir()) / "iskomatic-expo-bridge.log", "w")
    bridge = subprocess.Popen([sys.executable, "-c", code], cwd=PROJECT, env={**env, "PYTHONPATH": f"{DESKTOP}{os.pathsep}{PROJECT}"}, stdout=log, stderr=subprocess.STDOUT)
    vite = subprocess.Popen("npx vite --host 127.0.0.1 --port 1420 --strictPort", cwd=DESKTOP, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        _wait_http(f"http://127.0.0.1:{BRIDGE_PORT}/api/health")
        _wait_http(UI)
        print("bridge and UI up")
        yield
    finally:
        bridge.terminate()
        subprocess.run(f"taskkill /PID {vite.pid} /T /F", shell=True, capture_output=True)
        log.close()


def api(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    req = urllib.request.Request(
        f"http://127.0.0.1:{BRIDGE_PORT}/api{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Origin": UI, **({"Authorization": f"Bearer {token}"} if token else {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{method} {path} -> {exc.code}: {exc.read().decode(errors='replace')}") from None


# ------------------------------------------------------------------ browser

CURSOR_JS = r"""
(() => {
  const install = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style');
    st.textContent = `#__cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform}
      .__ring{position:fixed;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
      border:2px solid rgba(17,93,244,.7);background:rgba(17,93,244,.12);animation:__r .45s ease-out forwards}
      @keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.25);opacity:0}}`;
    document.documentElement.appendChild(st);
    const c = document.createElement('div');
    c.id = '__cur';
    c.innerHTML = '<svg width="24" height="28" viewBox="0 0 24 28"><path d="M2 2 L2 22 L7.2 17.2 L11 26 L14.4 24.6 L10.6 16 L17.6 16 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const p = window.__curPos || {x: -40, y: -40};
    c.style.transform = `translate(${p.x - 2}px, ${p.y - 2}px)`;
    document.documentElement.appendChild(c);
  };
  document.addEventListener('mousemove', (e) => {
    window.__curPos = {x: e.clientX, y: e.clientY};
    const c = document.getElementById('__cur');
    if (c) c.style.transform = `translate(${e.clientX - 2}px, ${e.clientY - 2}px)`;
  }, true);
  document.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.className = '__ring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
"""


def _reroute(route):
    url = route.request.url.replace(APP_API, f"http://127.0.0.1:{BRIDGE_PORT}/api")
    headers = {k: v for k, v in route.request.headers.items() if k.lower() != "host"}
    # The bridge's listen queue is short and the app fires requests in bursts: retry refused connections.
    for attempt in range(8):
        try:
            return route.fulfill(response=route.fetch(url=url, headers=headers, timeout=120000))
        except Exception as exc:
            if attempt == 7 or not any(e in str(exc) for e in ("ECONNREFUSED", "ECONNRESET")):
                raise
            time.sleep(0.15 * (attempt + 1))


class Clip:
    """One browser context, filmed with Chrome's DevTools screencast. Marks are wall-clock seconds."""

    def __init__(self, browser, name: str, token: str | None, view: str | None, record: bool = True):
        self.name = name
        self.dir = Path(tempfile.mkdtemp(prefix=f"clip-{name}-"))
        self.frames: list[tuple[float, Path]] = []
        self.ctx = browser.new_context(viewport=VIEW, device_scale_factor=SCALE, locale="en-GB", timezone_id="Asia/Manila")
        self.ctx.add_init_script(CURSOR_JS)
        if token:
            self.ctx.add_init_script(f"try {{ localStorage.setItem('iskolar-session', {json.dumps(token)}); }} catch (e) {{}}")
        self.ctx.route(f"{APP_API}/**", _reroute)
        self.page = self.ctx.new_page()
        self.marks: dict[str, float] = {}
        self.cdp = None
        if record:
            self.cdp = self.ctx.new_cdp_session(self.page)
            self.cdp.on("Page.screencastFrame", self._frame)
            self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": int(VIEW["width"] * SCALE), "maxHeight": int(VIEW["height"] * SCALE), "everyNthFrame": 1})
        self.page.goto(f"{UI}/" + (f"?view={view}" if view else ""))
        self.page.mouse.move(VIEW["width"] * 0.62, VIEW["height"] * 0.55)

    def _frame(self, event) -> None:
        path = self.dir / f"{len(self.frames):06d}.jpg"
        path.write_bytes(base64.b64decode(event["data"]))
        self.frames.append((event["metadata"]["timestamp"], path))
        try:
            self.cdp.send("Page.screencastFrameAck", {"sessionId": event["sessionId"]})
        except Exception:
            pass

    def mark(self, key: str) -> None:
        self.marks[key] = time.time()

    def wait(self, ms: int) -> None:
        self.page.wait_for_timeout(ms)

    # -- cursor helpers
    def hover(self, loc, fx: float = 0.5, fy: float = 0.5, steps: int = 22) -> None:
        loc.scroll_into_view_if_needed()
        box = loc.bounding_box()
        self.page.mouse.move(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy, steps=steps)

    def click(self, loc, fx: float = 0.5, fy: float = 0.5, steps: int = 22, pause: int = 140) -> None:
        self.hover(loc, fx, fy, steps)
        self.wait(pause)
        self.page.mouse.down()
        self.wait(70)
        self.page.mouse.up()

    def type(self, loc, text: str, delay: int = 55, fx: float = 0.3) -> None:
        self.click(loc, fx=fx)
        loc.press_sequentially(text, delay=delay)

    def box(self, loc) -> dict:
        """Element centre as fractions of the window (for zoom focus points)."""
        b = loc.bounding_box()
        return {"x": round((b["x"] + b["width"] / 2) / VIEW["width"], 3), "y": round((b["y"] + b["height"] / 2) / VIEW["height"], 3)}

    def finish(self, cuts: list[tuple[str, str, str]] | None = None) -> dict:
        """Closes the context and writes one 30 fps mp4 per (file name, start mark, end mark) cut."""
        if self.cdp:
            self.wait(300)
            self.cdp.send("Page.stopScreencast")
        self.ctx.close()
        cuts = cuts or [(self.name, "start", "end")]
        info = {}
        for name, a, b in cuts:
            start, end = self.marks[a], self.marks[b]
            info[name] = {"seconds": round(end - start, 2), "marks": {k: round(v - start, 2) for k, v in self.marks.items() if start <= v <= end}}
            if self.frames:
                self._encode(start, end, OUT / f"{name}.mp4")
            print(f"  {name}: {info[name]}")
        return info

    def _encode(self, start: float, end: float, out: Path) -> None:
        # The screencast sends a frame only when the screen changes, so for every output frame
        # (exactly 30 fps) take the latest screencast frame at or before that moment.
        times = [t for t, _ in self.frames]
        n = round((end - start) * 30)
        proc = subprocess.Popen([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-",
                                 "-vf", f"scale={int(VIEW['width'] * SCALE)}:{int(VIEW['height'] * SCALE)}", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
                                 "-pix_fmt", "yuv420p", "-an", str(out)], stdin=subprocess.PIPE)
        j, cache = 0, (None, b"")
        for k in range(n):
            t = start + k / 30
            while j + 1 < len(times) and times[j + 1] <= t:
                j += 1
            path = self.frames[j][1]
            if cache[0] != path:
                cache = (path, path.read_bytes())
            proc.stdin.write(cache[1])
        proc.stdin.close()
        if proc.wait():
            raise RuntimeError(f"ffmpeg failed for {out.name}")


# ------------------------------------------------------------------ the story, clip by clip

# Bea Reyes Santos, the fictional applicant followed through the video.
BEA = dict(first="Bea", middle="Reyes", last="Santos", birth="12042005", email="bea.santos@example.com", phone="+639000000901",
           street="14 Rizal St.", average="92.5", income="9000", household="6", children="3", seniors="1", pwd="0",
           wrong_dependents="20", dependents="4", scholars="0", residency="12 years", total="50", raw="46")


def field(scope, label: str):
    return scope.get_by_label(re.compile(rf"^\s*{re.escape(label)}")).first


def modal(page):
    return page.locator(".modal").last


def nav(page, name: str):
    return page.locator(f'button.nav-item[aria-label="{name}"]').first


def settle(c: Clip, ms: int = 1200) -> None:
    c.page.wait_for_load_state("networkidle")
    c.wait(ms)


def clip_login(browser, log: dict) -> None:
    c = Clip(browser, "login", None, None)
    p = c.page
    field(p, "Username or work email").wait_for()
    settle(c, 900)
    c.mark("start")
    c.type(field(p, "Username or work email"), ADMIN, delay=90)
    c.wait(300)
    c.type(field(p, "Password"), PASSWORD, delay=45)
    c.wait(400)
    c.click(p.get_by_role("button", name=re.compile("^Sign In")))
    p.get_by_text("Scholarship overview").wait_for(timeout=30000)
    c.mark("signed_in")
    settle(c, 1500)
    c.hover(p.get_by_text("Recent applications").first, 0.5, 2.5, steps=30)
    c.wait(1200)
    p.mouse.wheel(0, 260)
    c.wait(1800)
    c.mark("end")
    log.update(c.finish())


def clip_register(browser, token: str, log: dict) -> None:
    c = Clip(browser, "register", token, "applications")
    p = c.page
    new = p.get_by_role("button", name=re.compile("New Application"))
    new.wait_for()
    settle(c)
    c.mark("start")
    c.click(new)
    m = modal(p)
    m.wait_for()
    c.wait(500)
    b = BEA
    nxt = m.get_by_role("button", name="Next")
    c.type(field(m, "First Name"), b["first"])
    c.type(field(m, "Middle Name"), b["middle"])
    c.type(field(m, "Last Name"), b["last"])
    c.type(field(m, "Birth Date"), b["birth"], delay=80, fx=0.045)
    c.click(field(m, "Sex"))
    field(m, "Sex").select_option("FEMALE")
    c.wait(300)
    c.click(nxt); c.wait(500)

    c.type(field(m, "Email"), b["email"], delay=40)
    phone = field(m, "Phone Number")
    c.type(phone, b["phone"][len(phone.input_value()):], delay=50)
    c.type(field(m, "House No. / Street"), b["street"])
    barangay = field(m, "Barangay")
    c.click(barangay)
    labels = [o for o in barangay.locator("option").all_inner_texts() if o and not o.startswith("Choose")]
    barangay.select_option(label=next((o for o in labels if "Patimbao" in o), labels[0]))
    c.wait(300)
    for label, value in (("Municipality", "Santa Cruz"), ("Province", "Laguna")):
        if not field(m, label).input_value():
            c.type(field(m, label), value)
    c.click(nxt); c.wait(500)

    for label, value in (("Scholarship Program", "LYDO"), ("Scholarship Year", "2026")):
        if not field(m, label).input_value():
            c.type(field(m, label), value)
    c.type(field(m, "Academic Average"), b["average"])
    c.click(nxt); c.wait(500)

    for label, key in (("Monthly Household Income", "income"), ("Household Size", "household"), ("Children Count", "children"),
                       ("Senior Count", "seniors"), ("PWD Count", "pwd"), ("Number of Dependents", "wrong_dependents")):
        c.type(field(m, label), b[key], delay=70)
    c.click(nxt); c.wait(500)

    c.click(m.get_by_text("Solo Parent", exact=False).first)
    c.wait(200)
    c.type(field(m, "Other Scholars in Family"), b["scholars"])
    c.type(field(m, "Residency / Years in Municipality"), b["residency"])
    c.click(nxt); c.wait(500)

    c.type(field(m, "Entrance Exam Total Items"), b["total"], delay=80)
    c.wait(300)
    c.mark("form_end")

    # The server refuses 20 dependents in a household of 6.
    c.type(field(m, "Entrance Exam Raw Score"), b["raw"], delay=110)
    c.wait(400)
    c.click(m.get_by_role("button", name=re.compile("Register")))
    err = m.locator(".form-error")
    err.wait_for(timeout=30000)
    c.mark("error_shown")
    log["reg_error_focus"] = {"text": err.inner_text(), **c.box(err)}
    c.wait(2600)
    back = m.get_by_role("button", name="Back")
    c.click(back); c.wait(700)
    c.click(back); c.wait(900)
    c.mark("error_end")

    dep = field(m, "Number of Dependents")
    c.click(dep, fx=0.3)
    dep.press("Control+a")
    c.wait(150)
    dep.press_sequentially(b["dependents"], delay=120)
    c.wait(500)
    c.click(nxt); c.wait(600)
    c.click(nxt); c.wait(700)
    c.click(m.get_by_role("button", name=re.compile("Register")))
    toast = p.locator(".toast").first
    toast.wait_for(timeout=60000)
    c.mark("toast")
    log["reg_toast"] = {"text": toast.inner_text(), **c.box(toast)}
    c.wait(4500)
    c.mark("end")
    log.update(c.finish([("reg_form", "start", "form_end"), ("reg_error", "form_end", "error_end"), ("reg_fixed", "error_end", "end")]))


def clip_batch(browser, token: str, log: dict) -> None:
    c = Clip(browser, "batch", token, "screening")
    p = c.page
    run = p.get_by_role("button", name=re.compile("Run AI Screening"))
    run.wait_for()
    settle(c, 1500)
    c.mark("start")
    c.hover(p.locator("table").first, 0.3, 0.25, steps=25)
    c.wait(900)
    c.click(run)
    m = modal(p)
    m.wait_for()
    c.mark("modal")
    c.wait(1400)
    c.click(m.get_by_role("button", name="Run screening"))
    toast = p.locator(".toast").filter(has_text="Batch finished").first
    toast.wait_for(timeout=180000)
    c.mark("toast")
    log["batch_toast"] = {"text": toast.inner_text(), **c.box(toast)}
    c.wait(3200)
    c.mark("end")
    log.update(c.finish())


def clip_explain(browser, token: str, log: dict) -> None:
    c = Clip(browser, "explain", token, "screening")
    p = c.page
    search = p.get_by_role("textbox", name="Search screening records")
    search.wait_for()
    settle(c, 1500)
    c.mark("start")
    c.type(search, "Bea", delay=140)
    c.wait(900)
    row = p.locator("tr").filter(has_text="APP-46").first
    row.wait_for()
    c.click(row.get_by_text("Review", exact=True).first)
    c.wait(1500)
    tab = p.get_by_role("tab", name="Inputs/Analysis")
    c.click(tab)
    c.mark("analysis_tab")
    ring = p.get_by_text("Why the AI predicted this").first
    ring.wait_for(timeout=60000)
    c.mark("explained")
    log["explain_focus"] = c.box(ring)
    c.hover(ring, 0.3, 0.5, steps=30)
    c.wait(3500)
    c.mark("end")
    log.update(c.finish())


def interview_off_camera(token: str, log: dict) -> None:
    """Endorse, schedule and pass Bea's interview through the API (not filmed)."""
    from datetime import datetime, timedelta

    apps = api("GET", "/applications", token=token)
    rows = apps if isinstance(apps, list) else apps.get("applications") or apps.get("rows") or apps.get("items") or []
    bea = next(r for r in rows if "Bea" in str(r.get("first_name", "")) or "Bea" in json.dumps(r))
    app_id = int(bea["application_id"])
    api("PUT", f"/applications/{app_id}", {"status": "FOR_INTERVIEW"}, token)
    when = (datetime.now() + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M")
    made = api("POST", "/interviews", {"application_id": app_id, "scheduled_at": when, "location": "LYDO Office, Santa Cruz Municipal Hall"}, token)
    api("POST", f"/interviews/{made['interview_id']}/result", {"result": "PASSED", "remarks": "Clear goals; documents complete."}, token)
    log["interview"] = {"application_id": app_id, "interview_id": made["interview_id"]}
    print(f"  interview: APP-{app_id} endorsed, interviewed, passed")


def clip_decision(browser, token: str, log: dict) -> None:
    c = Clip(browser, "decision", token, "decisions")
    p = c.page
    row = p.locator("tr").filter(has_text="APP-46").first
    row.wait_for()
    settle(c, 1500)
    c.mark("start")
    c.hover(row, 0.2, 0.5, steps=30)
    c.wait(700)
    c.click(row.get_by_role("button", name="Decide"))
    m = modal(p)
    m.wait_for()
    c.mark("modal")
    c.wait(700)
    decision = field(m, "Decision")
    c.click(decision)
    decision.select_option("APPROVED")
    c.wait(600)
    c.type(field(m, "Remarks / basis for the decision"), "Passed interview. Strong academic record (92.5) and high household need; documents verified.", delay=38, fx=0.2)
    c.wait(700)
    c.click(m.get_by_role("button", name="Record decision"))
    toast = p.locator(".toast").first
    toast.wait_for(timeout=60000)
    c.mark("toast")
    log["decision_toast"] = {"text": toast.inner_text(), **c.box(toast)}
    c.wait(3000)
    c.click(nav(p, "Activity Log"))
    p.locator("table").get_by_text("Recorded official decision").first.wait_for(timeout=30000)
    c.mark("activity")
    c.wait(800)
    c.hover(p.locator("table").get_by_text("Recorded official decision").first, 0.5, 0.5, steps=35)
    c.wait(2500)
    c.mark("end")
    log.update(c.finish())


def still_ranking(browser, token: str, log: dict) -> None:
    c = Clip(browser, "ranking", token, "screening", record=False)
    p = c.page
    p.locator("tr").filter(has_text="APP-46").first.wait_for()
    settle(c, 2500)
    p.mouse.move(-50, -50)
    p.evaluate("document.getElementById('__cur') && document.getElementById('__cur').remove()")
    p.screenshot(path=str(OUT / "ranking.png"))
    c.ctx.close()
    print("  ranking.png")


# ------------------------------------------------------------------ run

STORY = ["login", "register", "batch", "explain", "interview", "decision", "ranking"]


def main(args: list[str]) -> None:
    from playwright.sync_api import sync_playwright

    stop_after = args[args.index("--until") + 1] if "--until" in args else STORY[-1]
    debug = Path(tempfile.gettempdir()) / "iskomatic-expo-debug.png"
    log: dict = {}
    clone_database()
    try:
        with servers(), sync_playwright() as pw:
            browser = pw.chromium.launch(channel="msedge")
            token = api("POST", "/auth/login", {"username": ADMIN, "password": PASSWORD, "remember": True})["token"]
            steps = {
                "login": lambda: clip_login(browser, log),
                "register": lambda: clip_register(browser, token, log),
                "batch": lambda: clip_batch(browser, token, log),
                "explain": lambda: clip_explain(browser, token, log),
                "interview": lambda: interview_off_camera(token, log),
                "decision": lambda: clip_decision(browser, token, log),
                "ranking": lambda: still_ranking(browser, token, log),
            }
            for name in STORY:
                print(f"recording {name}")
                try:
                    steps[name]()
                except Exception:
                    for ctx in browser.contexts:
                        for page in ctx.pages:
                            page.screenshot(path=str(debug))
                    print(f"failed in {name}; last screen saved to {debug}")
                    raise
                if name == stop_after:
                    break
            browser.close()
    finally:
        drop_clone()
        (OUT / "clips.json").write_text(json.dumps(log, indent=2), "utf-8")


if __name__ == "__main__":
    main(sys.argv[1:])
