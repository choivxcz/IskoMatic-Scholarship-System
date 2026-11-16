import { dateLocale, dateOptions } from "./datePreferences";
import StatCard from "./components/StatCard";
import Pagination from "./components/Pagination";
import AiExplanation from "./components/AiExplanation";
import { apiFetch } from "./api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ChevronDown, Info, LoaderCircle, MoreHorizontal, Pencil, RefreshCw, Search, UserRound, UserRoundPlus, Users, X } from "lucide-react";

type Row = Record<string, any>;
const fullName = (row: Row): string => [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(" ") || String(row.applicant_name || "Unnamed applicant");
const id = (row: Row) => `INB-${row.applicant_id}`;
const archived = (row: Row) => row.is_archived === true || row.is_archived === 1;
const date = (value: any) => value ? new Date(value).toLocaleDateString(dateLocale(), dateOptions()) : "—";
const nice = (value: any) => value ? String(value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "—";

export default function ApplicantsPage({ sourceRows, loading, search, setSearch, refresh, onEdit, onArchive, initialSelectedId }: {
  sourceRows: Row[]; loading: boolean; search: string; setSearch: (value: string) => void; refresh: () => void; onEdit: (row: Row) => void; onArchive: (row: Row) => void; initialSelectedId?: number | null;
}) {
  const records = sourceRows;
  useEffect(() => { if (initialSelectedId != null) setSelectedId(initialSelectedId); }, [initialSelectedId]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState("active");
  const [barangay, setBarangay] = useState("");
  const [sort, setSort] = useState("date-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tab, setTab] = useState("Overview");
  const [applications, setApplications] = useState<Row[]>([]);
  const [applicationError, setApplicationError] = useState("");
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const selected = records.find(r => r.applicant_id === selectedId);
  useEffect(() => { setPage(1); }, [search, status, barangay, sort]);
  useEffect(() => { setTab("Overview"); }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setApplications([]); setApplicationError(""); setApplicationsLoading(true);
    apiFetch("http://127.0.0.1:8765/api/applications", { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error("Linked applications could not be loaded."); return response.json(); }).then(data => setApplications((data.items || []).filter((row: Row) => row.applicant_id === selectedId))).catch(error => { if (!controller.signal.aborted) setApplicationError(error.message); }).finally(() => { if (!controller.signal.aborted) setApplicationsLoading(false); });
    return () => controller.abort();
  }, [selectedId]);
  const matches = useMemo(() => records.filter(row => `${id(row)} ${fullName(row)} ${row.email || ""} ${row.phone || ""}`.toLowerCase().includes(search.toLowerCase()) && (!status || (status === "archived") === archived(row)) && (!barangay || row.barangay === barangay)).sort((a, b) => sort === "name" ? fullName(a).localeCompare(fullName(b)) : (String(a.created_at || "").localeCompare(String(b.created_at || "")) * (sort === "date-desc" ? -1 : 1))), [records, search, status, barangay, sort]);
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = matches.slice((current - 1) * pageSize, current * pageSize);
  const linked = applications;
  const newest = linked.reduce<Row | null>((best, row) => !best || Number(row.application_id) > Number(best.application_id) ? row : best, null);
  const now = new Date();
  const month = now.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Manila" });
  const metrics = [
    { label: "Directory records", value: records.length, note: "Distinct applicant identities", icon: Users },
    { label: "Active records", value: records.filter(row => !archived(row)).length, note: "Available for new applications", icon: UserRound },
    { label: "Archived records", value: records.filter(archived).length, note: "Kept on record, not deleted", icon: Archive },
    { label: "New this month", value: records.filter(row => String(row.created_at || "").startsWith(month)).length, note: now.toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }), icon: UserRoundPlus },
  ];
  return <div className="applicants-page">
    <section className="metric-summary-grid" aria-label="Applicant directory statistics">{metrics.map(metric => <StatCard key={metric.label} label={metric.label} value={metric.value} note={metric.note} icon={metric.icon} tone="blue" loading={loading} />)}</section>
    <div className={`applicant-directory-layout ${selected ? "with-profile" : ""}`}>
      <section className="panel applicant-directory"><h2>Applicant directory</h2><p>Identity status is separate from application stage.</p>
        <div className="applicant-search-row"><label className="search-box"><Search size={16} /><input ref={searchInput} aria-label="Search applicants" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, ID or email..." /><span>⌘ K</span></label><button type="button" className="button-secondary" aria-label="Search applicants" title="Search applicants" onClick={() => searchInput.current?.focus()}><Search size={16} aria-hidden="true" /></button></div>
        <div className="applicant-filters"><select aria-label="Identity status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select><select aria-label="Barangay" value={barangay} onChange={e => setBarangay(e.target.value)}><option value="">All barangays</option>{Array.from(new Set(records.map(row => row.barangay).filter(Boolean))).sort().map(value => <option key={value}>{value}</option>)}</select><select aria-label="Sort applicants" value={sort} onChange={e => setSort(e.target.value)}><option value="date-asc">Date added</option><option value="date-desc">Newest first</option><option value="name">Name A–Z</option></select><button className="button-secondary" aria-label="Refresh applicants" onClick={refresh}><RefreshCw size={14} /></button></div>
        <div className="applicant-table-scroll" tabIndex={0} role="region" aria-label="Scholarship records"><table className="applicant-table"><thead><tr><th><span className="record-square" /> Applicant ID <ChevronDown size={9} /></th><th>Name</th><th>Contact / email</th><th>Barangay</th><th>Date added</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(row => <tr key={row.applicant_id} className={selectedId === row.applicant_id ? "is-selected" : ""}><td><input type="checkbox" aria-label={`Show profile for ${fullName(row)}`} checked={selectedId === row.applicant_id} onChange={() => setSelectedId(selectedId === row.applicant_id ? null : row.applicant_id)} /><button className="applicant-id" onClick={() => setSelectedId(row.applicant_id)}>{id(row)}</button></td><td><strong>{fullName(row)}</strong><small>{[row.municipality, row.province].filter(Boolean).join(", ")}</small></td><td>{row.phone || "—"}<small>{row.email || "—"}</small></td><td>{row.barangay || "—"}</td><td>{date(row.created_at)}</td><td><strong>{archived(row) ? "Archived" : "Active"}</strong></td><td><button className="applicant-view" onClick={() => setSelectedId(row.applicant_id)}>View <MoreHorizontal size={13} /></button></td></tr>)}</tbody></table></div>
        {loading && <div className="applicant-empty"><LoaderCircle size={20} className="spin" /> Loading applicants…</div>}{!loading && !visible.length && <div className="applicant-empty">{search || status || barangay ? "No applicants match your filters." : "No applicant records yet."}</div>}
        <Pagination total={matches.length} page={current} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} label="applicants" />
        <div className="applicant-notice"><Info size={16} /><span>Applicant identity records are separate from scholarship applications and official decisions.</span></div>
      </section>
      {selected && <aside className="panel applicant-profile" aria-label={`${fullName(selected)} profile`}><div className="applicant-profile-head"><span className="applicant-initials">{fullName(selected).split(" ").slice(0, 2).map(word => word[0]).join("")}</span><div><h2>{fullName(selected)}</h2><p>{id(selected)} · Applicant profile</p></div><button className="icon-button" aria-label="Close applicant profile" onClick={() => setSelectedId(null)}><X size={15} /></button></div>
        <div className="applicant-tabs" role="tablist">{["Overview", "Applications", "AI Prediction", "Household/Academic", "History"].map(value => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value}</button>)}</div>
        <div className="applicant-identity-state"><span className={archived(selected) ? "archived" : ""}>• {archived(selected) ? "Archived identity" : "Active identity"}</span><small>Added {date(selected.created_at)}</small></div>
        {(tab === "Overview" || tab === "Applications") && <>
          {tab === "Overview" && newest && <AiExplanation applicationId={Number(newest.application_id)} compact onMore={() => setTab("AI Prediction")} />}{tab === "Overview" && <section className="applicant-detail-section"><h3>Identity &amp; contact</h3><dl>{[["Full name", fullName(selected)], ["Date of birth", selected.birth_date ? `${date(selected.birth_date)}` : "—"], ["Sex", nice(selected.sex)], ["Address", [selected.house_no_street, selected.barangay, selected.municipality, selected.province].filter(Boolean).join(", ") || "—"], ["Mobile number", selected.phone || "—"], ["Email", selected.email || "—"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
          <section className="applicant-detail-section"><h3>Linked application{linked.length > 1 ? "s" : ""}</h3>{applicationsLoading ? <p>Loading linked applications…</p> : applicationError ? <p role="alert">{applicationError}</p> : linked.length ? linked.map(application => <dl key={application.application_id}><div><dt>Application</dt><dd>APP-{application.application_id}</dd></div><div><dt>Program / year</dt><dd>{application.scholarship_program || "—"} · {application.scholarship_year || "—"}</dd></div><div><dt>Official stage</dt><dd>{nice(application.status)}</dd></div></dl>) : <p>No linked applications available.</p>}</section>
        </>}
        {tab === "AI Prediction" && <section className="applicant-detail-section"><h3>AI prediction per application</h3>{applicationsLoading ? <p>Loading linked applications…</p> : linked.length ? linked.map(application => <div key={application.application_id}><p className="ai-application-heading">APP-{application.application_id} · {application.scholarship_program || "Application"} {application.scholarship_year || ""}</p><AiExplanation applicationId={Number(application.application_id)} /></div>) : <p>No linked applications to analyse.</p>}</section>}{tab === "Household/Academic" && <section className="applicant-detail-section"><h3>Household / academic</h3><p>Household and academic information belongs to each scholarship application.</p>{linked.map(application => <dl key={application.application_id}>{[["Application", `APP-${application.application_id}`], ["Academic average", application.academic_average ?? "Not recorded"], ["Household size", application.household_size ?? application.household ?? "Not recorded"], ["Monthly income", application.monthly_income ?? "Not recorded"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>)}{!linked.length && <p>No linked application information available.</p>}</section>}
        {tab === "History" && <section className="applicant-detail-section"><h3>Record history</h3><dl><div><dt>Added</dt><dd>{date(selected.created_at)}</dd></div>{selected.updated_at && <div><dt>Updated</dt><dd>{date(selected.updated_at)}</dd></div>}</dl><p>Full audit history is not connected.</p></section>}
        <div className="applicant-notice"><Info size={16} /><span>Identity edits do not change scholarship application decisions.</span></div><div className="applicant-profile-actions"><button className="button-secondary" disabled={archived(selected)} title={archived(selected) ? "Archived records are kept as they were and cannot be edited." : undefined} onClick={() => onEdit(selected)}><Pencil size={16} />Edit profile</button><button className="button-secondary" disabled={archived(selected)} onClick={() => onArchive(selected)}><Archive size={16} />Archive</button></div>
      </aside>}
    </div>
  </div>;
}
