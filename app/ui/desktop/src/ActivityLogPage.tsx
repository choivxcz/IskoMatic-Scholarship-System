import { dateLocale, dateOptions } from "./datePreferences";
import { timeZoneLabel } from "./datePreferences";
import Pagination from "./components/Pagination";
import { initialsOf, roleLabel } from "./components/StaffStamp";
import { useEffect, useMemo, useState } from "react";
import { Info, LoaderCircle, RefreshCw, Search, X } from "lucide-react";

type Row = Record<string, any>;
type Props = { items: Row[]; loading: boolean; refresh: () => void };
type ActivityRow = Row & {
  audit_id?: number | string;
  created_at?: string;
  action?: string;
  entity_type?: string;
  entity_id?: number | string | null;
  actor: Row;
  actorName: string;
  actorKey: string;
  description: string;
  outcome: string;
  recovered: boolean;
};

const readable = (value: unknown): string => String(value || "Not recorded").replace(/[_.]+/g, " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const object = (value: unknown): Row => {
  if (typeof value === "string") {
    try { return object(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
};
const scalar = (value: unknown): string => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
const dateKey = (value: unknown) => String(value || "").slice(0, 10);
const dateText = (value: unknown) => {
  if (!value) return "Not recorded";
  const stamp = new Date(String(value));
  return Number.isNaN(stamp.getTime()) ? "Not recorded" : stamp.toLocaleString(dateLocale(), { ...dateOptions(), hour: "2-digit", minute: "2-digit" }) + " " + timeZoneLabel();
};

/** Plain-language names for logged actions. */
const ACTIONS: Record<string, string> = {
  REGISTER_APPLICATION: "Registered applicant & application",
  UPDATE_APPLICANT: "Updated applicant profile",
  ARCHIVE_APPLICANT: "Archived applicant",
  UPDATE_APPLICATION: "Edited application",
  ENDORSE_FOR_INTERVIEW: "Approved for interview",
  CHANGE_STATUS: "Changed application status",
  RUN_SCREENING: "Ran AI screening",
  SCHEDULE_INTERVIEW: "Scheduled interview",
  RECORD_INTERVIEW_RESULT: "Recorded interview result",
  RECORD_DECISION: "Recorded official decision",
  SIGN_IN: "Signed in",
  SIGN_OUT: "Signed out",
  ACCOUNT_APPROVE: "Approved staff account",
  ACCOUNT_REJECT: "Rejected staff account",
  ACCOUNT_DISABLE: "Disabled staff account",
};
const actionLabel = (value: unknown) => ACTIONS[scalar(value)] || readable(value);
const actionTone = (value: unknown) => {
  const action = scalar(value);
  if (action === "RECORD_DECISION") return "decision";
  if (["ENDORSE_FOR_INTERVIEW", "SCHEDULE_INTERVIEW", "RECORD_INTERVIEW_RESULT"].includes(action)) return "interview";
  if (["SIGN_IN", "SIGN_OUT"].includes(action) || action.startsWith("ACCOUNT_")) return "account";
  if (action === "ARCHIVE_APPLICANT") return "danger";
  return "record";
};

// Only workflow metadata is shown, never raw audit JSON (it could hold personal data).
const SAFE_FIELDS = new Set(["status", "scholarship_program", "scholarship_year", "academic_average", "monthly_income", "household", "children_count", "senior_count", "pwd_count", "dependents_count", "solo_parent", "four_ps_beneficiary", "spes_beneficiary", "scholars_in_family", "residency", "previous_scholarship", "exam_raw_score", "exam_total_items", "first_name", "middle_name", "last_name", "suffix", "birth_date", "sex", "email", "phone", "house_no_street", "barangay", "municipality", "province", "scheduled_at", "location", "remarks", "result", "decision"]);
function summary(details: Row): string {
  const parts: string[] = [];
  const previous = scalar(details.previous_status || details.old_status);
  const next = scalar(details.new_status);
  if (scalar(details.decision)) parts.push(`Decision: ${readable(details.decision)}`);
  if (previous && next) parts.push(`${readable(previous)} → ${readable(next)}`);
  else if (next && !scalar(details.decision)) parts.push(`Status: ${readable(next)}`);
  if (scalar(details.result)) parts.push(`Result: ${readable(details.result)}`);
  const fields: unknown[] = Array.isArray(details.fields) ? details.fields : Array.isArray(details.changed_fields) ? details.changed_fields : Object.keys(object(details.changes));
  const changed = fields.filter((key): key is string => typeof key === "string" && SAFE_FIELDS.has(key));
  if (changed.length) parts.push(`Fields: ${changed.slice(0, 6).map(readable).join(", ")}${changed.length > 6 ? ` +${changed.length - 6} more` : ""}`);
  return parts.join(" · ") || "—";
}

export default function ActivityLogPage({ items, loading, refresh }: Props) {
  const [search, setSearch] = useState("");
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [applicant, setApplicant] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);

  const records = useMemo<ActivityRow[]>(() => items.map((item): ActivityRow => {
    const details = object(item.details);
    const actor = object(details.actor);
    const actorName = scalar(actor.display_name) || scalar(actor.username) || "Not recorded";
    const actorKey = scalar(actor.user_id) || scalar(actor.username) || "__not_recorded";
    return { ...item, actor, actorName, actorKey, description: summary(details), outcome: scalar(details.outcome), recovered: details.recovered === true };
  }).sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")) || Number(right.audit_id || 0) - Number(left.audit_id || 0)), [items]);

  // One card per staff member: how many actions, approvals and decisions they made.
  const staff = useMemo(() => {
    const map = new Map<string, { key: string; name: string; username: string; role: string; total: number; approvals: number; interviews: number; decisions: number; applicants: Set<string>; last: string }>();
    records.forEach(record => {
      if (record.actorKey === "__not_recorded") return;
      const entry = map.get(record.actorKey) || { key: record.actorKey, name: record.actorName, username: scalar(record.actor.username), role: scalar(record.actor.role), total: 0, approvals: 0, interviews: 0, decisions: 0, applicants: new Set<string>(), last: "" };
      if (!["SIGN_IN", "SIGN_OUT"].includes(scalar(record.action))) entry.total += 1;
      if (record.action === "ENDORSE_FOR_INTERVIEW") entry.approvals += 1;
      if (["SCHEDULE_INTERVIEW", "RECORD_INTERVIEW_RESULT"].includes(scalar(record.action))) entry.interviews += 1;
      if (record.action === "RECORD_DECISION") entry.decisions += 1;
      if (record.applicant_id) entry.applicants.add(String(record.applicant_id));
      if (String(record.created_at || "") > entry.last) entry.last = String(record.created_at || "");
      map.set(record.actorKey, entry);
    });
    return [...map.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
  }, [records]);

  const users = [...new Map(records.map(record => [record.actorKey, record.actorName])).entries()].sort((left, right) => left[1].localeCompare(right[1]));
  const actions = [...new Set(records.map(record => scalar(record.action)).filter(Boolean))].sort((left, right) => actionLabel(left).localeCompare(actionLabel(right)));
  const entities = [...new Set(records.map(record => scalar(record.entity_type)).filter(Boolean))].sort();
  const applicants = [...new Map(records.filter(record => record.applicant_id).map(record => [String(record.applicant_id), scalar(record.applicant_name) || `Applicant #${record.applicant_id}`])).entries()].sort((left, right) => left[1].localeCompare(right[1]));
  const matches = records.filter(record => (!user || record.actorKey === user) && (!action || record.action === action) && (!entity || record.entity_type === entity) && (!applicant || String(record.applicant_id) === applicant) && (!date || dateKey(record.created_at) === date) && `${record.actorName} ${scalar(record.actor.username)} ${actionLabel(record.action)} ${readable(record.entity_type)} ${record.entity_id || ""} ${scalar(record.applicant_name)} ${record.description}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(matches.length / 10));
  const current = Math.min(page, pages);
  const visible = matches.slice((current - 1) * 10, current * 10);
  const filtered = Boolean(search || user || action || entity || applicant || date);
  useEffect(() => { setPage(1); }, [search, user, action, entity, applicant, date]);
  const selectedStaff = staff.find(entry => entry.key === user);

  return <div className="applicants-page activity-log-page">
    <section className="panel applicant-directory">
      <h2>Activity log</h2>
      <p>Every change is recorded under the staff member who made it. Pick a person to see their approvals, interview results and decisions for each applicant. Times are shown in {timeZoneLabel()}.</p>

      {staff.length > 0 && <div className="staff-activity-cards" role="list" aria-label="Activity by staff member">
        {staff.map(entry => <button key={entry.key} role="listitem" className={`staff-activity-card ${user === entry.key ? "active" : ""}`} aria-pressed={user === entry.key} onClick={() => setUser(current => current === entry.key ? "" : entry.key)}>
          <span className={`staff-stamp-avatar ${entry.role === "ADMIN" ? "admin" : ""}`}>{initialsOf(entry.name)}</span>
          <span className="staff-activity-who"><strong>{entry.name}</strong><small>{roleLabel(entry.role)}{entry.last ? ` · last active ${dateText(entry.last).split(",")[0]}` : ""}</small></span>
          <span className="staff-activity-counts">
            <span><b>{entry.total}</b>actions</span>
            <span><b>{entry.approvals}</b>approved</span>
            <span><b>{entry.interviews}</b>interview</span>
            <span><b>{entry.decisions}</b>decisions</span>
          </span>
        </button>)}
      </div>}

      <div className="applicant-search-row">
        <label className="search-box"><Search size={16} /><input aria-label="Search activity log" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search staff member, applicant, action or record..." /></label>
        <button className="button-secondary" disabled={loading} onClick={refresh}><RefreshCw size={16} />Refresh</button>
      </div>
      <div className="applicant-filters">
        <select aria-label="Filter activity by staff member" value={user} onChange={event => setUser(event.target.value)}><option value="">All staff members</option>{users.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Filter activity by applicant" value={applicant} onChange={event => setApplicant(event.target.value)}><option value="">All applicants</option>{applicants.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Filter activity by action" value={action} onChange={event => setAction(event.target.value)}><option value="">All actions</option>{actions.map(value => <option key={value} value={value}>{actionLabel(value)}</option>)}</select>
        <select aria-label="Filter activity by record type" value={entity} onChange={event => setEntity(event.target.value)}><option value="">All record types</option>{entities.map(value => <option key={value} value={value}>{readable(value)}</option>)}</select>
        <input type="date" aria-label="Filter activity by date" value={date} onChange={event => setDate(event.target.value)} />
        {filtered && <button className="button-secondary" aria-label="Clear activity filters" onClick={() => { setSearch(""); setUser(""); setAction(""); setEntity(""); setApplicant(""); setDate(""); }}><X size={14} /></button>}
      </div>
      {selectedStaff && <div className="staff-filter-note" role="status">Showing everything <strong>{selectedStaff.name}</strong> did · {selectedStaff.applicants.size} applicant{selectedStaff.applicants.size === 1 ? "" : "s"} handled · {selectedStaff.approvals} approved for interview · {selectedStaff.decisions} official decision{selectedStaff.decisions === 1 ? "" : "s"}</div>}

      <div className="applicant-table-scroll"><table className="applicant-table activity-table"><thead><tr><th>Date &amp; time</th><th>Processed by</th><th>Action</th><th>Applicant</th><th>Details</th></tr></thead><tbody>{visible.map((record, index) => <tr key={record.audit_id ?? index}>
        <td>{dateText(record.created_at)}</td>
        <td><button className="activity-person" onClick={() => setUser(record.actorKey)} title="Show everything this person did"><strong>{record.actorName}</strong><small>{record.actor.role ? roleLabel(scalar(record.actor.role)) : "Not recorded"}</small></button></td>
        <td><span className={`activity-action ${actionTone(record.action)}`}>{actionLabel(record.action)}</span>{record.outcome === "FAILED" && <span className="activity-outcome failed">Failed</span>}{record.outcome === "STARTED" && <span className="activity-outcome started">Not completed</span>}{record.recovered && <span className="activity-outcome recovered" title="Reconstructed from database timestamps. Only one staff account existed at the time, so the attribution is certain.">Recovered</span>}</td>
        <td>{record.applicant_name
          ? <button className="activity-person" onClick={() => setApplicant(String(record.applicant_id))} title="Show all activity for this applicant"><strong>{scalar(record.applicant_name)}</strong><small>{record.application_id ? `APP-${record.application_id}` : `Applicant #${record.applicant_id}`}{record.scholarship_program ? ` · ${scalar(record.scholarship_program)}` : ""}</small></button>
          : <span className="activity-muted">{record.entity_type === "staff_account" ? "Staff account" : readable(record.entity_type)}{record.entity_id != null && <small>#{scalar(record.entity_id)}</small>}</span>}</td>
        <td>{record.description}</td>
      </tr>)}</tbody></table></div>
      {loading && <div className="applicant-empty"><LoaderCircle className="spin" size={20} />Loading activity records...</div>}
      {!loading && !visible.length && <div className="applicant-empty">{filtered ? "No activity matches your filters." : "No activity has been recorded yet."}</div>}
      <Pagination total={matches.length} page={current} pageSize={10} onPageChange={setPage} label="loaded events" />
      <div className="applicant-notice"><Info size={16} /><span>Actions taken before staff sign-in existed show “Not recorded.” Staff identities are never guessed. “Failed” means the change was attempted but not saved.</span></div>
    </section>
  </div>;
}
