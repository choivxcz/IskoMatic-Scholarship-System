import OfficialLogos from "./components/OfficialLogos";
import StaffRequestPage from "./StaffRequestPage";
import { API_BASE } from "./api";
import { FormEvent, KeyboardEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { useShake } from "./motion";
import { ArrowRight, Check, Eye, EyeOff, FolderCheck, LoaderCircle, ShieldCheck, UserRound, Users } from "lucide-react";

export type AuthView = "login" | "register";

type LoginProps = {
  onLogin: (username: string, password: string, remember: boolean) => Promise<void>;
  onSwitch: () => void;
  prefill?: string;
  notice?: string;
};

export function LoginForm({ onLogin, onSwitch, prefill = "", notice = "" }: LoginProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [shakeClass, shake] = useShake();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || done) return;
    setError("");
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    if (!username || !password) {
      setError("Enter your username or work email and your password.");
      shake();
      return;
    }
    setBusy(true);
    try {
      await onLogin(username, password, data.get("remember") === "on");
      setDone(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in could not be completed. Please try again.");
      shake();
    } finally {
      setBusy(false);
    }
  }

  const caps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return <form className="auth-form auth-v2-form" onSubmit={submit} aria-busy={busy} noValidate>
    <span className="auth-pill">Authorized scholarship workspace</span>
    <h2>Welcome back</h2>
    <p className="auth-lede">Sign in to support the next generation of Santa Cruz scholars.</p>
    {notice && <div className="auth-banner" role="status">{notice}</div>}

    <div className={`auth-fields ${shakeClass}`}>
      <label className="auth-field">
        <span>Username or work email</span>
        <span className="auth-input">
          <input name="username" defaultValue={prefill} required maxLength={255} autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={busy || done} placeholder="Enter your username or work email" autoFocus={!prefill} />
          <UserRound size={16} aria-hidden="true" />
        </span>
      </label>
      <label className="auth-field">
        <span>Password</span>
        <span className="auth-input">
          <input name="password" required autoComplete="current-password" disabled={busy || done} type={visible ? "text" : "password"} placeholder="Enter your password" onKeyUp={caps} onKeyDown={caps} autoFocus={!!prefill} />
          <button type="button" className="auth-icon-button" disabled={busy || done} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
            {visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </span>
        {capsLock && <small className="auth-hint warn">Caps Lock is on</small>}
      </label>
    </div>

    <div className="auth-row">
      <label className="auth-check"><input type="checkbox" name="remember" disabled={busy || done} /><span>Remember this device</span></label>
      <button type="button" className="auth-link" aria-expanded={help} onClick={() => setHelp(value => !value)}>Need sign-in help?</button>
    </div>
    {help && <div className="auth-banner info" role="note">Forgot your password or locked out? Ask your LYDO administrator to review your account. After 5 wrong attempts, sign-in pauses for 5 minutes.</div>}
    {error && <div className="auth-error" role="alert">{error}</div>}

    <button className={`auth-submit ${done ? "is-done" : ""}`} type="submit" disabled={busy || done}>
      {busy ? <><LoaderCircle className="spin" size={16} aria-hidden="true" />Signing in…</>
        : done ? <><Check size={17} aria-hidden="true" />Signed in</>
        : <>Sign In<ArrowRight size={16} aria-hidden="true" className="auth-arrow" /></>}
    </button>

    <p className="auth-switch-line">New to the workspace? <button type="button" className="auth-link" onClick={onSwitch}>Request a staff account</button></p>

    <div className="auth-notice">
      <strong><ShieldCheck size={16} aria-hidden="true" />For authorized LYDO personnel only</strong>
      <p>Access is reviewed by an administrator. Please use your individual account to keep scholarship actions accountable.</p>
    </div>
    <BackendStatus />
  </form>;
}

/** Live connection indicator so staff know whether sign-in can work. */
function BackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
        if (alive) setOnline(response.ok);
      } catch { if (alive) setOnline(false); }
    };
    void check();
    const id = window.setInterval(check, 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);
  return <p className="auth-footnote" role="status">
    <i className={`auth-dot ${online === null ? "" : online ? "on" : "off"}`} />
    {online === null ? "Checking workspace connection…" : online ? "Workspace connected · Actions are recorded under your account" : "Workspace offline · Start the Python bridge to sign in"}
  </p>;
}

export function AuthBrand() {
  return <section className="auth-brand auth-v2-brand">
    <div className="auth-brand-glow" aria-hidden="true" />
    <div className="auth-brand-inner">
      <OfficialLogos />
      <div className="brand-name">iskolar.</div>
      <small>NG BAYAN &middot; SCHOLARSHIP MANAGEMENT</small>
      <p className="auth-office">LOCAL YOUTH DEVELOPMENT OFFICE</p>
      <h1>Fair opportunities.<br />A brighter Santa Cruz.</h1>
      <p className="auth-brand-lede">An organized, transparent workspace for scholarship applications, thoughtful review, and accountable decisions for the youth of Santa Cruz.</p>
      <div className="auth-benefits">
        <p><FolderCheck size={20} aria-hidden="true" /><span><strong>Organized records</strong><small>One shared workspace, accountable individual actions.</small></span></p>
        <p><ShieldCheck size={20} aria-hidden="true" /><span><strong>Fair and official</strong><small>Final decisions remain with authorized LYDO officials.</small></span></p>
        <p><Users size={20} aria-hidden="true" /><span><strong>Better collaboration</strong><small>Coordinate screening, interviews, and scholarship review.</small></span></p>
      </div>
    </div>
    <footer>Investing in people, building a brighter Santa Cruz tomorrow.<br /><span>Santa Cruz, Laguna · Philippines</span></footer>
  </section>;
}

type ScreenProps = {
  view: AuthView;
  onView: (view: AuthView) => void;
  onLogin: LoginProps["onLogin"];
  notice?: string;
  leaving?: boolean;
};

/** Brand panel + the active form. Switching forms slides the form area only. */
export default function AuthScreen({ view, onView, onLogin, notice, leaving }: ScreenProps) {
  const shell = useRef<HTMLElement>(null);
  const [prefill, setPrefill] = useState("");
  const [registered, setRegistered] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
    document.title = view === "login" ? "Sign in | Iskolar ng Bayan" : "Request access | Iskolar ng Bayan";
  }, [view]);

  // Cursor parallax on the town hall photo and the soft light that follows the pointer.
  function track(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || !shell.current) return;
    const rect = shell.current.getBoundingClientRect();
    shell.current.style.setProperty("--px", ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
    shell.current.style.setProperty("--py", ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
    shell.current.style.setProperty("--cx", `${event.clientX - rect.left}px`);
    shell.current.style.setProperty("--cy", `${event.clientY - rect.top}px`);
  }

  return <main ref={shell} onPointerMove={track} className={`auth-shell auth-v2 auth-${view === "login" ? "login" : "registration"} ${leaving ? "is-leaving" : ""}`}>
    <AuthBrand />
    <section className="auth-form-area">
      <div className={`auth-stage auth-stage-${view}`} key={view}>
        {view === "login"
          ? <LoginForm onLogin={onLogin} onSwitch={() => onView("register")} prefill={prefill} notice={registered || notice} />
          : <StaffRequestPage onSwitch={() => onView("login")} onRegistered={(username, firstAccount) => {
              setPrefill(username);
              setRegistered(firstAccount
                ? "Your administrator account is ready. Sign in to open the workspace."
                : "Request submitted. You can sign in once an administrator approves it.");
            }} />}
      </div>
    </section>
  </main>;
}
