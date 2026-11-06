"""Launch the React desktop UI (app/ui/desktop) with the Python backend.

- If Rust/Cargo is installed, it opens the native Tauri window
  (Tauri starts the Python bridge by itself).
- Otherwise it starts the Python bridge + Vite dev server and opens
  the UI in your web browser.

The old PyQt6 UI is still available through main.py.
"""
import json
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DESKTOP = ROOT / "app" / "ui" / "desktop"
UI_URL = "http://127.0.0.1:1420"
HEALTH_URL = "http://127.0.0.1:8765/api/health"
REQUIRED_API_VERSION = 2  # must match API_VERSION in bridge_server.py


def wait_for(url, seconds):
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def running_api_version():
    """Version reported by a bridge already on port 8765, or None if none is running."""
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=1) as response:
            return int(json.load(response).get("api_version") or 0)
    except (OSError, ValueError):
        return None


def main():
    npm = shutil.which("npm")
    if npm is None:
        raise SystemExit("Install Node.js and restart your terminal first.")

    if not (DESKTOP / "node_modules").exists():
        print("Installing frontend packages...")
        subprocess.check_call([npm, "ci"], cwd=DESKTOP)

    if shutil.which("cargo"):
        raise SystemExit(subprocess.call([npm, "run", "tauri", "dev"], cwd=DESKTOP))

    print("Rust not found - opening the UI in your browser instead of a native window.")
    processes = []
    try:
        version = running_api_version()
        if version is not None and version < REQUIRED_API_VERSION:
            raise SystemExit(
                "An OLDER Python bridge is still running on port 8765, so staff actions would not be recorded. "
                "Close the terminal that started it (or restart your computer), then run this again."
            )
        if version is not None:
            print("Python bridge already running on port 8765.")
        else:
            processes.append(subprocess.Popen(
                [sys.executable, "-u", str(DESKTOP / "bridge_server.py")], cwd=ROOT
            ))
            if not wait_for(HEALTH_URL, 30):
                raise SystemExit("Python bridge did not start. Check MySQL and your .env.")

        processes.append(subprocess.Popen([npm, "run", "dev"], cwd=DESKTOP))
        if wait_for(UI_URL, 30):
            webbrowser.open(UI_URL)
        print(f"UI running at {UI_URL} - press Ctrl+C to stop.")
        processes[-1].wait()
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            process.terminate()


if __name__ == "__main__":
    main()
