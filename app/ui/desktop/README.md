# IskoMatic — React + TypeScript + Tauri desktop UI

This desktop UI lives under `app/ui/desktop/`. It reuses the project's existing Python repositories and services and does not create or migrate database tables. It replaces the former PyQt6 frontend; the Python backend and database scripts are preserved.

## Windows prerequisites

1. Node.js LTS: https://nodejs.org/
2. Rust stable via rustup: https://www.rust-lang.org/tools/install
3. Visual Studio Build Tools with **Desktop development with C++**: https://visualstudio.microsoft.com/visual-cpp-build-tools/
4. WebView2 Runtime (normally already installed on Windows 10/11): https://developer.microsoft.com/microsoft-edge/webview2/
5. The project's existing Python environment and dependencies. Keep the project-root `.env` configured with `DB_USER` and `DB_PASSWORD`.

Restart VS Code after installing the tools. Verify with `node -v`, `npm -v`, `rustc --version`, `cargo --version`, and `python --version`.

## Start development app

Open the project root (the folder containing `main.py`, `app/`, and `database/`) in VS Code. Activate the same Python virtual environment used by the current PyQt6 app, then run:

```powershell
cd app/ui/desktop
npm install
npm run tauri dev
```

Tauri launches a native Windows window and starts `bridge_server.py`, which binds only to `127.0.0.1:8765`. If you need to start the bridge manually for debugging, run `python app/ui/desktop/bridge_server.py` from the project root in a separate terminal, then run `npm run tauri dev` in the desktop folder. Do not start two bridge instances on the same port.

## Connected workflows

- Live dashboard and active applicant/application/interview/decision records from MySQL.
- Register an applicant and scholarship application together using `ApplicationService.register_applicant_with_application`.
- Edit applicant details and archive an applicant using the existing repository methods.
- Edit application eligibility data and change status using the existing repository/service validation.
- Run and persist AI screening through `ScreeningPersistenceService` and the saved model.
- Schedule interviews for `FOR_INTERVIEW` applications and save interview outcomes.
- Record scholarship decisions using `ScholarshipDecisionRepository.save`.

AI screening output is advisory only. The interface does not automatically award or reject scholarships.

## Build installer

```powershell
npm run tauri build
```

The Windows installer is generated under `src-tauri/target/release/bundle/`. Packaging Python, its dependencies, the model file, and local MySQL configuration for another computer is a separate deployment step. Never ship a real `.env` password inside a distributable installer.

Keep the project-root `.env` local. No database migrations or schema changes are required by this frontend replacement.

## Municipal UI adaptation and integration gaps

The existing React/TypeScript + Tauri frontend and Python services remain in place. All nine views have UI implementations using the municipal palette, original logos and photograph, shared cards, filters, pagination, detail panels, and responsive tables. Assets in public/assets are byte-for-byte copies of the supplied originals. No illustrative database records were added.

Connected workflows: applicant/application registration, editing, archiving, saved-model screening (including per-application batch results), interview scheduling/results, database records, and real aggregate dashboard metrics/monthly trends.

Unconnected features are explicitly identified in the UI:
- Staff sign-in is connected. The bridge creates `staff_accounts` and `staff_sessions` on first use (passwords are salted PBKDF2 hashes; tokens are stored as SHA-256 digests). The first account registered becomes an approved Administrator; later sign-ups stay PENDING until an Administrator approves them in Settings. Every API route except health and the sign-in/sign-up endpoints requires a signed-in session. Sign-ins, sign-outs and account reviews are written to the Activity Log. After 5 wrong passwords, sign-in pauses for 5 minutes.
- Every data change (registration, edits, archive, status changes, approval for interview, AI screening, interview scheduling/results, official decisions) is written to `audit_logs` under the signed-in staff member before it runs; a change that cannot be logged is refused. The Interviews page shows who approved each applicant for interview, who scheduled it, who recorded the result and who made the decision. The Activity Log groups actions by staff member and applicant. Official decisions can be recorded by LYDO Officials and Administrators, with remarks, and only along the allowed status transitions. Records created before sign-in existed show "Not recorded".
- Profile/security changes, notifications, session history, references, review notes, full audit history, rescheduling, and panel conflict validation remain unconnected. Local table density preferences work.
- Existing interview validation requires FOR_INTERVIEW; it was preserved. Model results add no scheduling restriction. Scheduling from every stage requires a workflow change.
- Applicant counts cover active records only. Archived totals/history are unavailable. Screening history/counts cover up to 250 loaded saved results, not the entire application population.

Workspace preferences, including compact tables and dark mode, are saved locally on the current device. Validation: `npm.cmd run build` in this folder type-checks and builds the UI. The database-free backend tests are listed in the Testing section of the project README. (A mocked bridge test file, `tests/test_desktop_bridge_safety.py`, was referenced here earlier but is not in the repository.) The other existing tests are interactive or write to MySQL and are not a complete automated suite.

Visual and live database workflow verification remains outstanding because this session has no browser/native automation surface. CSS supports 1672/1440/1280 widths with readable scrolling tables and detail panels that move below tables on narrower screens. Exact screenshot parity is not verified. Reference differences include honest unavailable states, existing interview constraints, additional real monthly trends, and unauthenticated decisions being read-only.

## Screenshot adaptation — 29 October 2026

The six user-supplied references now guide the shared sidebar and compact desktop layout: consistent municipal branding/navigation, restrained white cards, blue-gray borders, compact headings, and the original hall photograph confined to the sidebar tile and banners. The transparent source PNGs remain unchanged; the Santa Cruz wordmark sits on a light tile.

Overview now uses a recent-applications table, vertical status legend and full-width activity card. The real application trend remains below activity, an intentional addition requested in the original scope. The greeting is generic because no authenticated staff identity is available. No reference names, totals or sample records were introduced.

Decisions has a dedicated view joining existing applications to the latest returned decision per application, so applications without a decision remain visible. Summary and audit tabs show only returned records; missing maker identity and extra status history remain explicitly unavailable. Official writing remains blocked by the existing bridge authorization checks.

Settings has working section tabs, profile/security cards, unavailable notification controls, device-local table density and honest session information. Common table density now applies to all page tables. Navigation grouping and sidebar branding remain consistent when switching pages.

The supplied images cover Overview, Applicants, Applications, Interviews, Decisions and Settings. Login, staff registration and AI Screening did not have screenshot references in this message; their existing layouts remain with shared branding changes. Exact Figma inspection is still denied by file access. Visual browser/native verification is blocked because the automation inventory has no available apps or browsers and its native pipe is unavailable. Responsive CSS is implemented for 1672/1440/1280 and smaller widths, but rendered geometry and live database workflow QA must still be performed. The frontend build and the 10 mocked bridge safety, transport and dashboard checks are the automated validation used here.

### Remaining references received

The subsequent user images supplied Login, Staff Account Request and AI Screening, completing the visual references for all nine screens. Account views now use the photographed split layout, original transparent logos, compact login form and wider registration form with approval notice above submission. Direct preview routes include `?view=login`, `?view=register` and `?view=screening`. Remember-device is disabled because persistent sessions are not connected. No sample account values were copied, no accounts are created, and unavailable account endpoints do not simulate success.

AI Screening now uses existing application, completed, not-yet-screened and current-session error totals; six-row pagination; a compact search/export/table layout; and Overview, Inputs/Analysis, References and History tabs. Probability columns, average probability metrics and score-style summaries were removed to follow the reference. Export contains the same advisory fields as the table. Review notes are explicitly unavailable rather than invented. Existing stage review and scheduling rules remain enforced; the reference's unrestricted scheduling and official-review button cannot be fully reproduced without additional authorized backend workflow integration. Saved screening history is limited to returned results.

The production build and all 10 targeted backend regression tests passed after these changes. Rendered visual comparison remains unverified due to the unavailable browser/native automation surface. This implementation is an adaptation from supplied screenshots, not a verified pixel-exact Figma copy.

## Python backend startup

The desktop app uses the existing `app/services`, `app/repositories`, saved screening model and `database/connection.py`; `bridge_server.py` exposes those Python operations to React over loopback. PyQt is no longer needed for rendering the desktop screens. No new database is used.

The launcher now prefers the project's `.venv/Scripts/python.exe` on Windows (`.venv/bin/python` elsewhere), falling back to Python on PATH only when no project virtual environment exists. Python runs without a separate console window. Its unbuffered stdout/stderr and launch failures are logged to `%TEMP%/iskolar-python-bridge.log`. The UI waits up to roughly 30 seconds for initial API readiness instead of 4.5 seconds. Errors now distinguish an unreachable Python API from a possible database failure.

After changing launcher Rust code, rebuild/restart with `npm.cmd run tauri dev` from `app/ui/desktop`; refreshing the web UI alone does not update an already-running executable. An installed release also needs a rebuilt installer. Keep MySQL running and preserve the project-root `.env`. This is still a source-checkout launcher; standalone redistribution requires packaging Python and the project resources, as noted above.

Verified during the startup repair: local `/api/health` responded successfully and `/api/dashboard` completed a live MySQL read. Frontend production build and all 10 targeted backend regression checks passed.

## Staff sign-in (current behaviour)

A temporary build once opened directly to the workspace without login; that has been reverted. Sign-in is required: every API route except health and the sign-in/sign-up endpoints returns 401 without a valid staff session (bridge API version 10), and every data change is recorded in the Activity Log under the signed-in staff member. Saved screening results do not yet store the staff member who ran them (`screened_by` is empty); the Activity Log entry for each screening records who ran it.


## Upstream backend alignment — 4 November 2026

The core application repository and application service match `choivxcz/AI-Assisted-Scholarship-Applicant-Screening-and-Management-System` main. The desktop bridge retains raw exam inputs and dependent counts expected by upstream and handles its registration `(applicant_id, application_id)` return value. The connected MySQL schema must contain upstream columns `dependents_count`, `exam_raw_score`, and `exam_total_items`; no database schema was changed by this update.

Registration and profile editing share the 26 barangays listed at https://www.sbstacruz.com/aboutUs, including Poblacion I?V. Existing saved barangay values remain visible during editing. Municipality and province default to Santa Cruz, Laguna and can be edited as accepted by the backend. Scholarship programs accept required text; phone numbers must use the Philippine international mobile format, +63 followed by 10 digits starting with 9 (12 digits, e.g. +639171234567); the field accepts at most 13 characters and the backend stores the number without spaces or dashes.
