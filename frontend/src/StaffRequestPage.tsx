import { API_BASE, authRequest } from "./api";
import { useShake } from "./motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Eye, EyeOff, Info, LoaderCircle, Mail, ShieldCheck, UserRound, X } from "lucide-react";

const FALLBACK_DEPARTMENTS = ["LYDO", "Office of the Mayor", "MSWDO", "HRMO", "MIS / IT Office", "Other municipal office"];
const USERNAME = /^[a-z0-9](?:[a-z0-9._-]{1,48}[a-z0-9])$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rules: { label: string; test: (value: string) => boolean }[] = [
  { label: "12+ characters", test: value => value.length >= 12 },
  { label: "Uppercase and lowercase", test: value => /[A-Z]/.test(value) && /[a-z]/.test(value) },
  { label: "Number", test: value => /\d/.test(value) },
  { label: "Symbol", test: value => /[^A-Za-z0-9]/.test(value) },
];

type Values = Record<"first_name" | "last_name" | "email" | "username" | "password" | "confirm_password" | "department" | "position" | "reason", string>;
const empty: Values = { first_name: "", last_name: "", email: "", username: "", password: "", confirm_password: "", department: "LYDO", position: "", reason: "" };

type Props = { onSwitch: () => void; onRegistered: (username: string, firstAccount: boolean) => void };

export default function StaffRequestPage({ onSwitch, onRegistered }: Props) {
  const [values, setValues] = useState<Values>(empty);
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [show, setShow] = useState({ password: false, confirm: false });
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shakeClass, shake] = useShake();
  const [result, setResult] = useState<{ firstAccount: boolean } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/auth/options`).then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data?.departments) && data.departments.length) setDepartments(data.departments);
    }).catch(() => { /* offline: keep the built-in list */ });
  }, []);

  // Debounced username check against the server.
  useEffect(() => {
    const username = values.username.trim().toLowerCase();
    if (!username) { setAvailability("idle"); return; }
    if (!USERNAME.test(username)) { setAvailability("invalid"); return; }
    setAvailability("checking");
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/username-available?username=${encodeURIComponent(username)}`, { signal: controller.signal });
        const data = await response.json();
        setAvailability(data.available ? "available" : "taken");
      } catch { if (!controller.signal.aborted) setAvailability("idle"); }
    }, 350);
    return () => { controller.abort(); window.clearTimeout(id); };
  }, [values.username]);

  const passed = useMemo(() => rules.map(rule => rule.test(values.password)), [values.password]);
  const strength = passed.filter(Boolean).length;
  const matches = values.confirm_password !== "" && values.confirm_password === values.password;

  const set = (key: keyof Values) => (event: { target: { value: string } }) => {
    setValues(current => ({ ...current, [key]: key === "username" ? event.target.value.toLowerCase().replace(/\s/g, "") : event.target.value }));
    setError("");
  };
  const blur = (key: keyof Values) => () => setTouched(current => ({ ...current, [key]: true }));

  function problem(): string {
    if (!values.first_name.trim() || !values.last_name.trim()) return "Enter your first and last name.";
    if (!EMAIL.test(values.email.trim())) return "Enter a valid work email address.";
    if (!USERNAME.test(values.username)) return "Username must be 3–50 characters: lowercase letters, numbers, dots, dashes or underscores.";
    if (availability === "taken") return "That username is already taken.";
    if (strength < rules.length) return "Password needs " + rules.filter((_, index) => !passed[index]).map(rule => rule.label.toLowerCase()).join(", ") + ".";
    if (!matches) return "Passwords do not match.";
    if (!values.position.trim()) return "Enter your position or job title.";
    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const message = problem();
    if (message) {
      setTouched({ first_name: true, last_name: true, email: true, username: true, password: true, confirm_password: true, position: true });
      setError(message);
      shake();
      return;
    }
    setBusy(true);
    try {
      const response = await authRequest<{ first_account: boolean }>("/auth/register", { ...values, email: values.email.trim() });
      setResult({ firstAccount: response.first_account });
      onRegistered(values.username, response.first_account);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your request could not be submitted.");
      shake();
    } finally {
      setBusy(false);
    }
  }

  if (result) return <div className="auth-form auth-v2-form auth-success" role="status">
    <span className="auth-success-mark"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></span>
    <h2>{result.firstAccount ? "Administrator account ready" : "Request submitted"}</h2>
    <p className="auth-lede">{result.firstAccount
      ? "You're the first staff member in this workspace, so your account was set up as the Administrator. You can approve other staff requests from Settings."
      : `Thanks, ${values.first_name}. An administrator will review your request for “${values.username}”. You can sign in once it's approved.`}</p>
    <button type="button" className="auth-submit" onClick={onSwitch}><ArrowLeft size={16} aria-hidden="true" />Return to Sign In</button>
  </div>;

  const invalid = (key: keyof Values, bad: boolean) => touched[key] && bad ? "is-invalid" : "";

  return <form className="auth-form auth-v2-form registration-v2" onSubmit={submit} aria-busy={busy} noValidate>
    <span className="auth-pill">Authorized scholarship workspace</span>
    <h2>Request a staff account</h2>
    <p className="auth-lede">Tell us about your role at the municipal office. Your request will be reviewed before access is granted.</p>

    <fieldset className={`auth-fields auth-grid ${shakeClass}`} disabled={busy}>
      <label className="auth-field"><span>First name</span>
        <span className={`auth-input ${invalid("first_name", !values.first_name.trim())}`}><input value={values.first_name} onChange={set("first_name")} onBlur={blur("first_name")} maxLength={100} autoComplete="given-name" placeholder="Jamie" autoFocus /></span>
      </label>
      <label className="auth-field"><span>Last name</span>
        <span className={`auth-input ${invalid("last_name", !values.last_name.trim())}`}><input value={values.last_name} onChange={set("last_name")} onBlur={blur("last_name")} maxLength={100} autoComplete="family-name" placeholder="Reyes" /></span>
      </label>

      <label className="auth-field span-2"><span>Work email</span>
        <span className={`auth-input ${invalid("email", !EMAIL.test(values.email.trim()))}`}><input type="email" value={values.email} onChange={set("email")} onBlur={blur("email")} maxLength={255} autoComplete="email" placeholder="jamie.reyes@santacruz.gov.ph" /><Mail size={16} aria-hidden="true" /></span>
        <small className="auth-hint">Use your official work email address.</small>
      </label>

      <label className="auth-field span-2"><span>Username</span>
        <span className={`auth-input ${availability === "taken" || (touched.username && availability === "invalid") ? "is-invalid" : availability === "available" ? "is-valid" : ""}`}><input value={values.username} onChange={set("username")} onBlur={blur("username")} maxLength={50} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="jamie.reyes" /><UserRound size={16} aria-hidden="true" /></span>
        <small className={`auth-hint availability ${availability}`} aria-live="polite">
          {availability === "checking" && <><LoaderCircle size={12} className="spin" />Checking availability…</>}
          {availability === "available" && <><Check size={12} />Available</>}
          {availability === "taken" && <><X size={12} />Already taken — try another</>}
          {availability === "invalid" && <><CircleAlert size={12} />3–50 characters: a–z, 0–9, dot, dash or underscore</>}
          {availability === "idle" && "You'll use this to sign in."}
        </small>
      </label>

      <label className="auth-field"><span>Password</span>
        <span className={`auth-input ${invalid("password", strength < rules.length)}`}><input type={show.password ? "text" : "password"} value={values.password} onChange={set("password")} onBlur={blur("password")} maxLength={128} autoComplete="new-password" placeholder="Create a password" />
          <button type="button" className="auth-icon-button" aria-label={show.password ? "Hide password" : "Show password"} aria-pressed={show.password} onClick={() => setShow(s => ({ ...s, password: !s.password }))}>{show.password ? <Eye size={16} /> : <EyeOff size={16} />}</button></span>
      </label>
      <label className="auth-field"><span>Confirm password</span>
        <span className={`auth-input ${touched.confirm_password && !matches ? "is-invalid" : matches ? "is-valid" : ""}`}><input type={show.confirm ? "text" : "password"} value={values.confirm_password} onChange={set("confirm_password")} onBlur={blur("confirm_password")} maxLength={128} autoComplete="new-password" placeholder="Repeat the password" />
          <button type="button" className="auth-icon-button" aria-label={show.confirm ? "Hide password" : "Show password"} aria-pressed={show.confirm} onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}>{show.confirm ? <Eye size={16} /> : <EyeOff size={16} />}</button></span>
      </label>
      <div className="auth-password-meta span-2">
        <div className={`auth-strength s${values.password ? strength : 0}`} aria-hidden="true"><i /><i /><i /><i /></div>
        <ul className="auth-rules" aria-label="Password requirements">
          {rules.map((rule, index) => <li key={rule.label} className={passed[index] ? "ok" : ""}>{passed[index] ? <Check size={11} aria-hidden="true" /> : null}{rule.label}</li>)}
          {values.confirm_password && <li className={matches ? "ok" : "bad"}>{matches ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}{matches ? "Passwords match" : "Doesn't match yet"}</li>}
        </ul>
      </div>

      <label className="auth-field"><span>Department / office</span>
        <span className="auth-input auth-select"><select value={values.department} onChange={set("department")}>{departments.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></span>
      </label>
      <label className="auth-field"><span>Position / job title</span>
        <span className={`auth-input ${invalid("position", !values.position.trim())}`}><input value={values.position} onChange={set("position")} onBlur={blur("position")} maxLength={100} autoComplete="organization-title" placeholder="Program Assistant" /></span>
      </label>

      <label className="auth-field span-2"><span>Reason for requesting access (optional)</span>
        <span className="auth-input"><input value={values.reason} onChange={set("reason")} maxLength={500} placeholder="Support scholarship records and interview coordination." /></span>
      </label>
    </fieldset>

    <div className="auth-notice compact"><p><Info size={16} aria-hidden="true" />Staff account requests require administrator approval before access is granted. Roles are assigned by the authorized administrator; registration does not activate an account.</p></div>
    {error && <div className="auth-error" role="alert">{error}</div>}

    <button className="auth-submit" type="submit" disabled={busy}>
      {busy ? <><LoaderCircle className="spin" size={16} aria-hidden="true" />Submitting…</> : <>Submit Registration Request<ArrowRight size={16} aria-hidden="true" className="auth-arrow" /></>}
    </button>
    <p className="auth-switch-line">Already have an account? <button type="button" className="auth-link" onClick={onSwitch}>Return to Sign In</button></p>
    <p className="auth-footnote"><ShieldCheck size={12} aria-hidden="true" />Passwords are stored as salted hashes · never in plain text</p>
  </form>;
}
