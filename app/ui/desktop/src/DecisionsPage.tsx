import { useMemo, useState } from "react";
import { Award, CheckCircle2, Clock3, Info, ListOrdered, RefreshCw, Search, ShieldCheck, X, XCircle } from "lucide-react";
import { dateLocale, dateOptions } from "./datePreferences";
import StatCard from "./components/StatCard";
import Pagination from "./components/Pagination";
import StaffStamp from "./components/StaffStamp";

type Row = Record<string, any>;
type Props = {
  /** Every saved decision record (for the audit tab). */
  decisions: Row[];
  /** Applications whose interview is completed, with their latest decision and allowed choices. */
  interviewed: Row[];
  loading: boolean;
  refresh: () => void;
  onDecision: (row: Row) => void;
  canDecide?: boolean;
};

const label = (value: unknown, empty = "Awaiting decision") => value ? String(value).replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase()) : empty;
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString(dateLocale(), dateOptions()) : "Not recorded";
const tone = (value: unknown) => value === "APPROVED" || value === "PASSED" ? "approved" : value === "REJECTED" || value === "FAILED" ? "rejected" : "review";
const choicesOf = (row: Row): string[] => Array.isArray(row.decision_choices) ? row.decision_choices : [];
const reference = (row: Row) => row.reference_no || `APP-${row.application_id}`;

export default function DecisionsPage({ decisions, interviewed, loading, refresh, onDecision, canDecide = false }: Props) {
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState("");
  const [program, setProgram] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState("Summary");

  // Applicants still waiting for a decision come first, then the most recent interviews.
  const records = useMemo<Row[]>(() => [...interviewed]
    .map((row): Row => ({ ...row, application_id: Number(row.application_id) }))
    .sort((a, b) => Number(Boolean(a.decision)) - Number(Boolean(b.decision)) || String(b.interview_date || "").localeCompare(String(a.interview_date || ""))), [interviewed]);
  const matches = records.filter(row =>
    (!search || `${reference(row)} ${row.applicant_name || ""} ${row.reason || ""} ${row.decided_by || ""}`.toLowerCase().includes(search.toLowerCase()))
    && (!decision || (decision === "PENDING" ? !row.decision : row.decision === decision))
    && (!program || row.scholarship_program === program));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, pages);
  const selected = records.find(row => row.application_id === selectedId);
  const metrics = [
    { label: "Awaiting decision", value: records.filter(row => !row.decision).length, note: "Interviewed, no decision yet", Icon: Clock3, color: "amber" },
    { label: "Approved", value: records.filter(row => row.decision === "APPROVED").length, note: "Scholarship granted", Icon: CheckCircle2, color: "green" },
    { label: "Waitlisted", value: records.filter(row => row.decision === "WAITLISTED").length, note: "Can still be approved or rejected", Icon: ListOrdered, color: "blue" },
    { label: "Rejected", value: records.filter(row => row.decision === "REJECTED").length, note: "Remarks retained", Icon: XCircle, color: "red" },
  ];
  const open = (row: Row) => { setSelectedId(row.application_id); setTab("Summary"); };
  const decideButton = (row: Row, primary = false) => {
    const choices = choicesOf(row);
    const title = !canDecide ? "Only Administrators can record decisions" : choices.length ? `Record a decision: ${choices.map(value => label(value)).join(", ")}` : "This decision is final";
    return <button className={primary ? "primary-button" : "button-secondary decision-decide"} disabled={!canDecide || !choices.length} title={title} onClick={() => onDecision(row)}>
      <Award size={15} />{choices.length ? (row.decision ? "Update decision" : primary ? "Record decision" : "Decide") : "Final"}
    </button>;
  };

  return <div className="applicants-page decisions-page">
    <div className="applicant-notice decision-authority"><ShieldCheck size={16} />Human authority only. Authorized LYDO officials make final decisions. Model recommendations do not prevent review.</div>
    <section className="metric-summary-grid">{metrics.map(({ label: title, value, note, Icon, color }) => <StatCard key={title} label={title} value={value} note={note} icon={Icon} tone={color} loading={loading} />)}</section>
    <div className={`applicant-directory-layout ${selected ? "with-profile" : ""}`}>
      <section className="panel applicant-directory">
        <h2>Interviewed applicants</h2>
        <p>{canDecide ? "Applicants appear here once their interview result is saved. Record each official decision with remarks; it is logged under your name." : "Applicants appear here once their interview result is saved. Only Administrators can record decisions."}</p>
        <div className="applicant-search-row"><label className="search-box"><Search size={16} /><input aria-label="Search decision records" placeholder="Search application, applicant or decision maker…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><button className="button-secondary" onClick={refresh} aria-label="Refresh decisions"><RefreshCw size={16} /></button></div>
        <div className="applicant-filters">
          <select aria-label="Decision" value={decision} onChange={e => { setDecision(e.target.value); setPage(1); }}><option value="">All decisions</option><option value="PENDING">Awaiting decision</option><option value="APPROVED">Approved</option><option value="WAITLISTED">Waitlisted</option><option value="REJECTED">Rejected</option></select>
          <select aria-label="Decision program" value={program} onChange={e => { setProgram(e.target.value); setPage(1); }}><option value="">All programs</option>{[...new Set(records.map(row => row.scholarship_program).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select>
        </div>
        <div className="applicant-table-scroll" tabIndex={0} role="region" aria-label="Interviewed applicants and decisions">
          <table className="applicant-table decision-table">
            <thead><tr><th>Application / applicant</th><th>Program</th><th>Interview</th><th>Official decision</th><th>Maker / date</th><th>Actions</th></tr></thead>
            <tbody>{matches.slice((current - 1) * pageSize, current * pageSize).map(row => <tr key={row.application_id} className={selectedId === row.application_id ? "is-selected" : ""}>
              <td><button className="applicant-id" onClick={() => open(row)}>{reference(row)}</button><small>{row.applicant_name || "Name unavailable"}</small></td>
              <td>{row.scholarship_program || "Not recorded"}<small>{row.scholarship_year || ""}</small></td>
              <td><span className={`application-status ${tone(row.interview_result)}`}>{label(row.interview_result, "Completed")}</span><small>{date(row.interview_date)}</small></td>
              <td><span className={`application-status ${tone(row.decision)}`}>{label(row.decision)}</span></td>
              <td>{row.decision ? <><StaffStamp stamp={row.decided_by ? { name: row.decided_by, role: row.decided_by_role, at: row.decided_at } : null} />{!row.decided_by && <small>{date(row.decided_at)}</small>}</> : "—"}</td>
              <td><div className="decision-actions">{decideButton(row)}<button className="applicant-view" onClick={() => open(row)}>View ···</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {(loading || !matches.length) && <div className="applicant-empty">{loading ? "Loading interviewed applicants…" : records.length ? "No records match your filters." : "No interviewed applicants yet. Save an interview result on the Interviews page and the applicant will appear here."}</div>}
        <Pagination total={matches.length} page={current} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} label="applicants" />
      </section>
      {selected && <aside className="panel applicant-profile">
        <div className="applicant-profile-head"><span className="applicant-initials"><Award size={20} /></span><div><h2>{selected.applicant_name || "Applicant"}</h2><p>{reference(selected)} · Decision summary</p></div><button className="icon-button" aria-label="Close decision summary" onClick={() => setSelectedId(null)}><X size={16} /></button></div>
        <div className="applicant-tabs">{["Summary", "Decision history"].map(value => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value}</button>)}</div>
        {tab === "Summary"
          ? <><span className={`application-stage-badge ${tone(selected.decision)}`}>{label(selected.decision)}</span>
            <section className="applicant-detail-section"><dl>{[
              ["Program", selected.scholarship_program],
              ["Scholarship year", selected.scholarship_year],
              ["Current stage", label(selected.stage || selected.application_status, "Not recorded")],
              ["Interview date", date(selected.interview_date)],
              ["Interview result", label(selected.interview_result, "Not recorded")],
              ["Interview remarks", selected.interview_remarks || "None"],
              ["Academic average", selected.academic_average],
              ["Decision maker", selected.decided_by ? `${selected.decided_by}${selected.decided_by_role === "ADMIN" ? " (Administrator)" : ""}` : selected.decision ? "Not recorded" : "—"],
              ["Decision date", selected.decision ? date(selected.decided_at) : "—"],
              ["Decision remarks", selected.reason || "—"],
            ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value ?? "Not recorded"}</dd></div>)}</dl></section>
            <div className="applicant-notice"><Info size={16} />{choicesOf(selected).length ? `Allowed now: ${choicesOf(selected).map(value => label(value)).join(", ")}.` : "This decision is final and cannot be changed here."}</div></>
          : <section className="applicant-detail-section"><h3>Recorded decisions</h3>{decisions.filter(row => Number(row.application_id) === selectedId).map((row, index) => <dl key={row.decision_id || index}><div><dt>Decision</dt><dd>{label(row.decision)}</dd></div><div><dt>Recorded</dt><dd>{date(row.decided_at)}</dd></div><div><dt>Decision maker</dt><dd>{row.decided_by || "Not recorded"}</dd></div><div><dt>Remarks</dt><dd>{row.reason || "Not recorded"}</dd></div></dl>)}{!selected.decision && <p>No official decision recorded yet.</p>}</section>}
        {decideButton(selected, true)}
        <p>{canDecide ? "Your name, the decision and the previous stage are saved to the Activity Log." : "Read-only: only Administrators can record official decisions."}</p>
      </aside>}
    </div>
  </div>;
}
