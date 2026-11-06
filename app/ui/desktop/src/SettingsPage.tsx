import { useEffect, useState } from "react";
import { Check, Info } from "lucide-react";
import { Appearance, applyAppearance, readAppearance } from "./theme";
import { StaffUser } from "./api";
import StaffAccessPanel from "./StaffAccessPanel";

type Props = { onActivity: () => void; user: StaffUser; onToast: (message: string) => void };
const landingPages = ["Overview", "Applicants", "Applications", "AI Screening", "Interviews", "Decisions"];
export default function SettingsPage({ user, onToast }: Props) {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  const [density, setDensity] = useState(() => localStorage.getItem("iskolar-density") === "compact" ? "compact" : "comfortable");
  const [landing, setLanding] = useState(() => localStorage.getItem("iskolar-landing") || "Overview");
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem("iskolar-date-format") || "long");
  const [timeZone, setTimeZone] = useState(() => localStorage.getItem("iskolar-timezone") || "Asia/Manila");
  useEffect(() => { applyAppearance(appearance); }, [appearance]);
  useEffect(() => { document.documentElement.dataset.density = density; }, [density]);
  useEffect(() => () => {
    applyAppearance(readAppearance());
    document.documentElement.dataset.density = localStorage.getItem("iskolar-density") === "compact" ? "compact" : "comfortable";
  }, []);
  const [message, setMessage] = useState("");
  function save() {
    try {
      localStorage.setItem("iskolar-theme", appearance);
      localStorage.setItem("iskolar-density", density);
      localStorage.setItem("iskolar-landing", landing);
      localStorage.setItem("iskolar-date-format", dateFormat);
      localStorage.setItem("iskolar-timezone", timeZone);
      window.dispatchEvent(new Event("iskolar-theme-change"));
      document.documentElement.dataset.density = density;
      setMessage("Settings saved. The landing page applies the next time you open the app.");
    } catch { setMessage("Settings could not be saved. Check that local storage is available."); }
  }
  function reset() {
    setAppearance("system"); setDensity("comfortable"); setLanding("Overview"); setDateFormat("long"); setTimeZone("Asia/Manila");
    setMessage("Defaults selected. Save settings to apply.");
  }
  return <div className="settings-page preferences-page">
    <div className="settings-banner"><h1>Settings</h1><p>Notifications, appearance, and workspace preferences</p></div>
    <StaffAccessPanel user={user} onToast={onToast} />
    <div className="preferences-heading"><h2>Application preferences</h2><p>Choose how you receive updates and how the scholarship workspace looks.</p></div>
    <div className="settings-grid">
      <section className="panel preferences-panel"><header><h2>Notification preferences</h2><p>Notification delivery is not connected.</p></header>
        {[["Application updates", "New submissions and official review changes"], ["Interview scheduling", "Appointments, reschedules, and panel updates"], ["Scholarship decisions", "Officially recorded decisions"], ["Important announcements", "Office-wide notices and scholarship reminders"], ["Daily digest", "One summary at the end of the workday"]].map(([label, description]) => <label className="preference-row" key={label}><span>{label}<small>{description}</small></span><input className="preference-switch" type="checkbox" role="switch" disabled aria-label={`${label} - not connected`} /></label>)}
        <div className="preferences-notice"><Info size={16} /><span>Workspace alerts are unavailable. No messages are sent to applicants.</span></div>
      </section>
      <section className="panel preferences-panel"><header><h2>Workspace preferences</h2><p>Set your preferred display and regional formats.</p></header>
        <fieldset className="preference-choice"><legend>Appearance</legend><div className="preference-segments">{(["light", "system", "dark"] as const).map(value => <label key={value}><input type="radio" name="appearance" value={value} checked={appearance === value} onChange={() => {setAppearance(value); setMessage("");}} /><span>{value[0].toUpperCase() + value.slice(1)}{appearance === value && <Check size={12} />}</span></label>)}</div></fieldset>
        <div className="preference-form-grid">
          <label>Language<input readOnly value="English (currently supported)" aria-label="Language" /></label>
          <label>Date format<select value={dateFormat} onChange={e => {setDateFormat(e.target.value); setMessage("");}}><option value="long">DD MMM YYYY</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option><option value="iso">YYYY-MM-DD</option></select></label>
          <label>Time zone<select value={timeZone} onChange={e => {setTimeZone(e.target.value); setMessage("");}}><option value="Asia/Manila">Asia/Manila (UTC+08:00)</option><option value="system">System time zone</option><option value="UTC">UTC</option></select></label>
          <label>Default landing page<select value={landing} onChange={e => {setLanding(e.target.value); setMessage("");}}>{landingPages.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <fieldset className="preference-choice"><legend>Table density</legend><div className="preference-segments">{["comfortable", "compact"].map(value => <label key={value}><input type="radio" name="density" checked={density === value} onChange={() => {setDensity(value); setMessage("");}} /><span>{value[0].toUpperCase() + value.slice(1)}{density === value && <Check size={12} />}</span></label>)}</div></fieldset>
        <p className="preferences-footnote">Appearance and density preview immediately. Save to keep your preferences. Dates and times update after saving.</p>
      </section>
    </div>
    <footer className="preferences-footer"><p role="status">{message || "Changes apply to application preferences on this device only."}</p><div><button className="button-secondary" onClick={reset}>Reset to defaults</button><button className="primary-button" onClick={save}>Save settings</button></div></footer>
  </div>;
}
