# IskoMatic frontend

React + TypeScript interface built with Vite, running in a native Windows window through Tauri (or in a browser). It talks only to the local Python API in `backend/api/bridge_server.py` (`http://127.0.0.1:8765/api`), which handles every database and machine learning operation.

## Layout

```
frontend/
├── src/
│   ├── main.tsx              Entry point
│   ├── App.tsx               Shell: sign-in gate, navigation, dialogs and shared workflows
│   ├── *Page.tsx             One component per screen (Overview, Applicants, Applications,
│   │                         AI Screening, Interviews, Decisions, Activity Log, Settings, Login)
│   ├── components/           Shared UI pieces (stat cards, pagination, AI explanation, report card dialog)
│   ├── api.ts                API base URL, session token and authenticated fetch
│   ├── theme.ts, motion.ts   Light/dark theme and animation helpers
│   └── *.css, styles/        Stylesheets
├── public/assets/            Logos and photographs
├── src-tauri/                Tauri (Rust) desktop shell; starts the Python API on launch
├── index.html, vite.config.ts, tsconfig*.json, package.json
└── run-dev.ps1               Starts the desktop app in development mode
```

## Prerequisites (Windows)

1. Node.js LTS
2. Rust stable (rustup) and Visual Studio Build Tools with **Desktop development with C++**. Optional: without Rust, `run.py` opens the UI in your browser instead.
3. WebView2 Runtime (already installed on Windows 10/11)
4. The project's Python environment (`pip install -r requirements.txt`) and a configured `.env` in the project root

## Running

From the project root, the simplest way is:

```powershell
python run.py
```

To work on the frontend directly:

```powershell
cd frontend
npm install
npm run tauri dev     # native window; Tauri starts backend/api/bridge_server.py itself
npm run dev           # browser only; start the API separately: python backend/api/bridge_server.py
```

Start only one API instance; it binds to port 8765. With Tauri, the API's output is logged to `%TEMP%\iskolar-python-bridge.log`. Tauri prefers the project's `.venv` Python when one exists.

## Building

```powershell
npm run build         # type-check and build the web assets into dist/
npm run tauri build   # Windows installer under src-tauri/target/release/bundle/
```

The installer contains the interface only. Python, its dependencies, the model and the MySQL configuration must be set up on the target computer; set `ISKOLAR_HOME` to the project folder there. Never ship a real `.env` inside an installer.

## Notes

- The API requires a signed-in staff session for every route except health and sign-in/sign-up. `REQUIRED_API_VERSION` in `src/App.tsx` (and in `run.py`) must match `API_VERSION` in `backend/api/bridge_server.py`.
- AI screening results are advisory. The interface never awards or rejects a scholarship on its own.
- Workspace preferences (theme, density, date format, landing page) are stored locally on each device.
