import { dateLocale, dateOptions } from "./datePreferences";
import PageHeader from "./components/PageHeader";
import OfficialLogos from "./components/OfficialLogos";
import { useDialogFocus } from "./useDialogFocus";
import ActivityLogPage from "./ActivityLogPage";
import { apiFetch, StaffUser } from "./api";
import { usePresence } from "./motion";
import CountUp from "./components/CountUp";
import OverviewPage from "./OverviewPage";
import DecisionsPage from "./DecisionsPage";
import SettingsPage from "./SettingsPage";
import InterviewsPage from "./InterviewsPage";
import ScreeningPage from "./ScreeningPage";
import ApplicationsPage from "./ApplicationsPage";
import ApplicantsPage from "./ApplicantsPage";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, Award, BookOpenCheck, CalendarDays,
  CheckCircle2, CircleHelp, Clock3, FileText, GraduationCap, LayoutDashboard,
  Menu, Plus, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Users, X,
  BrainCircuit, AlertCircle, LoaderCircle, Pencil, Archive, CalendarPlus,
  ClipboardCheck, UserRoundPlus, ListChecks, Bell, ChevronDown, PanelLeftClose, Eye, EyeOff, UserRound, FolderCheck, Play,
  LogOut,
} from "lucide-react";

type Row = Record<string, any>;
type PageKey = "Activity Log" | "Settings" | "Overview" | "Applicants" | "Applications" | "AI Screening" | "Interviews" | "Decisions";
type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "email" | "tel" | "select" | "checkbox" | "textarea";
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  options?: { label: string; value: string }[];
  section?: string;
  placeholder?: string;
  readOnly?: boolean;
};
type FormState = {
  mode: string;
  title: string;
  subtitle: string;
  fields: Field[];
  initial: Row;
  row?: Row;
} | null;

const requestedView = new URLSearchParams(window.location.search).get("view") || new URLSearchParams(window.location.search).get("preview");
const initialPage: PageKey = !requestedView && ["Overview", "Applicants", "Applications", "AI Screening", "Interviews", "Decisions"].includes(localStorage.getItem("iskolar-landing") || "") ? localStorage.getItem("iskolar-landing") as PageKey : requestedView === "activity" ? "Activity Log" : requestedView === "settings" ? "Settings" : requestedView === "decisions" ? "Decisions" : requestedView === "interviews" ? "Interviews" : requestedView === "screening" ? "AI Screening" : requestedView === "applications" ? "Applications" : requestedView === "applicants" ? "Applicants" : "Overview";
const API = "http://127.0.0.1:8765/api";
// Must match API_VERSION in bridge_server.py.
const REQUIRED_API_VERSION = 3;

const nav: { label: PageKey; icon: typeof LayoutDashboard; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Applicants", icon: Users, group: "WORKSPACE" },
  { label: "Applications", icon: FileText, group: "WORKSPACE" },
  { label: "AI Screening", icon: BrainCircuit, group: "WORKSPACE" },
  { label: "Interviews", icon: CalendarDays, group: "MANAGEMENT" },
  { label: "Decisions", icon: Award, group: "MANAGEMENT" },
];

const STATUSES = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "FOR_INTERVIEW", "INTERVIEWED",
  "RECOMMENDED", "APPROVED", "REJECTED", "WAITLISTED", "WITHDRAWN",
];

const nice = (v: unknown) =>
  String(v ?? "—").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const dateText = (v: unknown) => {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString(dateLocale(), dateOptions());
};

const nameOf = (r: Row) =>
  r.applicant_name ||
  [r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(" ") ||
  "Unnamed applicant";

const statusTone = (v: unknown) => {
  const s = String(v ?? "").toUpperCase();
  if (["APPROVED", "PASSED", "PROCEED_TO_INTERVIEW", "COMPLETED"].includes(s)) return "green";
  if (["REJECTED", "FAILED", "CANCELLED", "WITHDRAWN"].includes(s)) return "red";
  if (["WAITLISTED", "NEEDS_OFFICIAL_REVIEW", "FOR_INTERVIEW", "SCHEDULED", "RESCHEDULED", "UNDER_REVIEW"].includes(s)) return "amber";
  return "blue";
};

const statusOptions = STATUSES.map(s => ({ label: nice(s), value: s }));
// Fallback only: rows from the Decisions page carry their own `decision_choices`
// from the bridge (app/services/decision_service.py).
const DECISION_OPTIONS: Record<string, string[]> = {
  UNDER_REVIEW: ["WAITLISTED", "REJECTED"],
  INTERVIEWED: ["APPROVED", "WAITLISTED", "REJECTED"],
  RECOMMENDED: ["APPROVED", "WAITLISTED", "REJECTED"],
  WAITLISTED: ["APPROVED", "REJECTED"],
};
// Santa Cruz municipal barangay directory: https://www.sbstacruz.com/aboutUs
const barangayOptions = [
  "Alipit", "Bagumbayan", "Bubukal", "Calios", "Duhat", "Gatid", "Jasaan",
  "Labuin", "Malinao", "Oogong", "Pagsawitan", "Palasan", "Patimbao",
  "Poblacion I", "Poblacion II", "Poblacion III", "Poblacion IV", "Poblacion V",
  "San Jose", "San Juan", "San Pablo Norte", "San Pablo Sur", "Santisima Cruz",
  "Santo Angel Central", "Santo Angel Norte", "Santo Angel Sur",
].map(value => ({ label: value, value }));

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await apiFetch(`${API}${path}`, {
      ...init,
      signal: init?.signal || controller.signal,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers || {}) },
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The Python backend did not respond within 15 seconds. Check the backend log and MySQL connection.");
    throw new Error("Cannot reach the Python API at " + API + ". Check that the desktop backend is running and this UI origin is allowed. " + (error instanceof Error ? error.message : ""));
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

const post = (path: string, data: Row) =>
  request(path, { method: "POST", body: JSON.stringify(data) });

const put = (path: string, data: Row) =>
  request(path, { method: "PUT", body: JSON.stringify(data) });

const registrationFields: Field[] = [
  { key: "first_name", label: "First Name", required: true, section: "Applicant Details" },
  { key: "middle_name", label: "Middle Name", section: "Applicant Details" },
  { key: "last_name", label: "Last Name", required: true, section: "Applicant Details" },
  { key: "suffix", label: "Suffix", section: "Applicant Details" },
  { key: "birth_date", label: "Birth Date", type: "date", required: true, section: "Applicant Details" },
  {
    key: "sex", label: "Sex", type: "select", required: true,
    options: [
      { label: "Male", value: "MALE" },
      { label: "Female", value: "FEMALE" },
      { label: "Other", value: "OTHER" },
      { label: "Prefer not to say", value: "PREFER_NOT_TO_SAY" },
    ],
    section: "Applicant Details",
  },
  { key: "email", label: "Email", type: "email", required: true, placeholder: "name@example.com", section: "Contact & Address" },
  { key: "phone", label: "Phone Number", type: "tel", required: true, placeholder: "Phone number (7?15 digits)", section: "Contact & Address" },
  { key: "house_no_street", label: "House No. / Street", required: true, section: "Contact & Address" },
  { key: "barangay", label: "Barangay", type: "select", required: true, options: barangayOptions, section: "Contact & Address" },
  { key: "municipality", label: "Municipality", required: true, section: "Contact & Address" },
  { key: "province", label: "Province", required: true, section: "Contact & Address" },

  {
    key: "scholarship_program",
    label: "Scholarship Program",
    required: true,
    placeholder: "Enter scholarship program",
    section: "Application Details",
  },
  { key: "scholarship_year", label: "Scholarship Year", type: "number", required: true, min: 2000, max: 2200, section: "Application Details" },
  { key: "academic_average", label: "Academic Average (0–100)", type: "number", required: true, min: 0, max: 100, step: "0.01", placeholder: "Enter 0 to 100", section: "Application Details" },

  { key: "monthly_income", label: "Monthly Household Income (₱)", type: "number", required: true, min: 0, step: "0.01", placeholder: "Enter amount (0 or more)", section: "Household Information" },
  { key: "household", label: "Household Size", type: "number", required: true, min: 1, placeholder: "e.g. 5", section: "Household Information" },
  { key: "children_count", label: "Children Count", type: "number", required: true, min: 0, placeholder: "e.g. 2", section: "Household Information" },
  { key: "senior_count", label: "Senior Count", type: "number", required: true, min: 0, placeholder: "e.g. 1", section: "Household Information" },
  { key: "pwd_count", label: "PWD Count", type: "number", required: true, min: 0, placeholder: "e.g. 0", section: "Household Information" },
  { key: "dependents_count", label: "Number of Dependents", type: "number", min: 0, required: true, section: "Household Information" },

  { key: "solo_parent", label: "Solo Parent", type: "checkbox", section: "Eligibility" },
  { key: "four_ps_beneficiary", label: "4Ps Beneficiary", type: "checkbox", section: "Eligibility" },
  { key: "spes_beneficiary", label: "SPES Beneficiary", type: "checkbox", section: "Eligibility" },
  { key: "previous_scholarship", label: "Previously Received a Scholarship", type: "checkbox", section: "Eligibility" },
  { key: "scholars_in_family", label: "Other Scholars in Family", type: "number", required: true, min: 0, placeholder: "e.g. 1", section: "Eligibility" },
  { key: "residency", label: "Residency / Years in Municipality", required: true, placeholder: "Enter years of residency", section: "Eligibility" },

  { key: "exam_total_items", label: "Entrance Exam Total Items", type: "number", required: true, min: 1, placeholder: "e.g. 40", section: "Examination" },
  { key: "exam_raw_score", label: "Entrance Exam Raw Score", type: "number", required: true, min: 0, placeholder: "Must not exceed total items", section: "Examination" },
];

const applicantEditFields: Field[] = [
  { key: "first_name", label: "First name", required: true },
  { key: "middle_name", label: "Middle name" },
  { key: "last_name", label: "Last name", required: true },
  { key: "suffix", label: "Suffix" },
  { key: "birth_date", label: "Birth date", type: "date", required: true },
  {
    key: "sex", label: "Sex", type: "select", required: true,
    options: [
      { label: "Male", value: "MALE" },
      { label: "Female", value: "FEMALE" },
      { label: "Other", value: "OTHER" },
      { label: "Prefer not to say", value: "PREFER_NOT_TO_SAY" },
    ],
  },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone number", type: "tel", required: true },
  { key: "house_no_street", label: "House no. / street", required: true },
  { key: "barangay", label: "Barangay", type: "select", required: true, options: barangayOptions },
  { key: "municipality", label: "Municipality", required: true },
  { key: "province", label: "Province", required: true },
];

const applicationEditFields: Field[] = [
  {
    key: "scholarship_program", label: "Scholarship Program", required: true,
  },
  { key: "scholarship_year", label: "Scholarship year", type: "number", required: true, min: 2000, max: 2200 },
  { key: "academic_average", label: "Academic average", type: "number", required: true, min: 0, max: 100, step: "0.01" },
  { key: "monthly_income", label: "Monthly household income (₱)", type: "number", required: true, min: 0, step: "0.01" },
  { key: "household", label: "Household size", type: "number", required: true, min: 1 },
  { key: "children_count", label: "Children count", type: "number", required: true, min: 0 },
  { key: "senior_count", label: "Senior count", type: "number", required: true, min: 0 },
  { key: "pwd_count", label: "PWD count", type: "number", required: true, min: 0 },
  { key: "dependents_count", label: "Number of dependents", type: "number", min: 0, required: true },
  { key: "solo_parent", label: "Solo parent", type: "checkbox", required: true },
  { key: "four_ps_beneficiary", label: "4Ps beneficiary", type: "checkbox", required: true },
  { key: "spes_beneficiary", label: "SPES beneficiary", type: "checkbox", required: true },
  { key: "previous_scholarship", label: "Previous scholarship", type: "checkbox", required: true },
  { key: "scholars_in_family", label: "Other scholars in family", type: "number", required: true, min: 0 },
  { key: "residency", label: "Residency", required: true },
  { key: "exam_raw_score", label: "Exam raw score", type: "number", required: true, min: 0 },
  { key: "exam_total_items", label: "Exam total items", type: "number", required: true, min: 1 },
];

export default function App({ user, onLogout }: { user: StaffUser; onLogout: () => Promise<void> | void }) {
  const [page, setPageState] = useState<PageKey>(initialPage);
  const [mobileNav, setMobileNav] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboard, setDashboard] = useState<Row | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [applicantFocus, setApplicantFocus] = useState<number | null>(null);
  const [allApplications, setAllApplications] = useState<Row[]>([]);
  // Interviewed applications shown on the Decisions page, with the decisions each one allows.
  const [decisionQueue, setDecisionQueue] = useState<Row[]>([]);
  const [screeningFailures, setScreeningFailures] = useState<Record<string, string>>({});
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [applicationOptions, setApplicationOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [bridgeOutdated, setBridgeOutdated] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  useEffect(() => setFormError(""), [form]);
  const [toast, setToast] = useState("");
  // Clear the previous page's data in the same render as the switch, so a page never sees another page's rows.
  const setPage = (next: PageKey) => {
    if (next !== page) { setRows([]); setDashboard(null); setAllApplications([]); setDecisionQueue([]); setLoading(true); }
    setPageState(next);
  };
  const [latestBatch, setLatestBatch] = useState<{ at: string; count: number } | null>(null);
  const [shownForm, formClosing] = usePresence(form, 190);
  const [shownToast, toastClosing] = usePresence(toast, 220);
  const [shownMenu, menuClosing] = usePresence(accountMenu, 150);
  const initials = (user.display_name || user.username).split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  useEffect(() => {
    if (!accountMenu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !(event.target as HTMLElement).closest(".account-menu-wrap")) setAccountMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [accountMenu]);

  async function signOut() {
    setSigningOut(true);
    setAccountMenu(false);
    await new Promise(resolve => window.setTimeout(resolve, 280));
    await onLogout();
  }

  const load = useCallback(async () => {
    if (page === "Settings") { setLoading(false); return; }
    setRows([]); setDashboard(null); setAllApplications([]);
    setLoading(true);
    setError("");
    try {
      let health: { ok: boolean; api_version?: number } | null = null;
      let healthError: unknown = null;

      const startupDeadline = Date.now() + 30000;
      while (Date.now() < startupDeadline) {
        try {
          health = await request<{ ok: boolean; api_version?: number }>("/health", { signal: AbortSignal.timeout(1500) });
          break;
        } catch (e) {
          healthError = e;
          await new Promise(resolve => window.setTimeout(resolve, 300));
        }
      }

      if (!health) {
        throw new Error("The Python backend at 127.0.0.1:8765 did not respond within 30 seconds. Restart the desktop app and check %TEMP%/iskolar-python-bridge.log. " + (healthError instanceof Error ? healthError.message : ""));
      }

      setBridgeOnline(health.ok);
      setBridgeOutdated((health.api_version ?? 0) < REQUIRED_API_VERSION);

      if (page === "Overview") {
        const d = await request<Row>("/dashboard");
        setDashboard(d);
        setRows(d.recentApplications || []);
      } else {
        const endpoint: Record<PageKey, string> = {
          "Activity Log": "/activity",
          Settings: "/health",
          Overview: "/dashboard",
          Applicants: "/applicants",
          Applications: "/applications",
          "AI Screening": "/screening-results",
          Interviews: "/interviews",
          Decisions: "/decisions",
        };

        const result = await request<any>(endpoint[page]);
        if (page === "Decisions") setDecisionQueue(result.interviewed || []);
        setRows(
          page === "Interviews"
            ? [
                ...(result.items || []),
                ...(result.awaitingSchedule || []).map((x: Row) => ({
                  ...x,
                  status: "AWAITING SCHEDULE",
                  awaiting_schedule: true,
                })),
              ]
            : result.items || [],
        );
      }

      if (page === "Activity Log") return;
      const apps = await request<{ items: Row[] }>("/applications");
      setAllApplications(apps.items || []);
      setAcademicYears([...new Set((apps.items || []).map(a => String(a.scholarship_year || "")).filter(Boolean))].sort().reverse());
      setApplicationOptions(
        (apps.items || []).map(a => ({
          label: `${a.application_id} · ${nameOf(a)} — ${a.scholarship_program || "Scholarship"}`,
          value: String(a.application_id),
        })),
      );
    } catch (e) {
      setBridgeOnline(false);
      setError(e instanceof Error ? e.message : "Unable to connect to the Python backend.");
    } finally {
      setLoading(false);
    }
  }, [page, refreshKey]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [page]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const refresh = () => setRefreshKey(n => n + 1);
  const showError = (e: unknown) => setToast(e instanceof Error ? e.message : "The operation could not be completed.");

  function openRegistration() {
    const initial: Row = {
      municipality: "Santa Cruz",
      province: "Laguna",
      sex: "PREFER_NOT_TO_SAY",
      scholarship_program: "LYDO",
      scholarship_year: new Date().getFullYear(),
      household: "",
      children_count: "",
      senior_count: "",
      pwd_count: "",
      dependents_count: "",
      solo_parent: false,
      four_ps_beneficiary: false,
      spes_beneficiary: false,
      previous_scholarship: false,
      scholars_in_family: "",
      exam_raw_score: "",
      exam_total_items: "",
    };

    setForm({
      mode: "register",
      title: "Register applicant & application",
      subtitle: "Applicant details and scholarship information are saved together using your existing registration service.",
      fields: registrationFields,
      initial,
    });
  }

  function openApplicantEdit(row: Row) {
    setForm({
      mode: "editApplicant",
      title: "Edit applicant profile",
      subtitle: `Update contact and personal information for ${nameOf(row)}.`,
      fields: applicantEditFields,
      initial: { ...row },
      row,
    });
  }

  function openApplicationEdit(row: Row) {
    setForm({
      mode: "editApplication",
      title: "Edit application",
      subtitle: `Update application and eligibility inputs for application #${row.application_id}.`,
      fields: applicationEditFields,
      initial: { ...row },
      row,
    });
  }

  function openStatus(row: Row) {
    setForm({
      mode: "status",
      title: "Change application status",
      subtitle: "The existing ApplicationService validates allowed status transitions.",
      fields: [{ key: "status", label: "New status", type: "select", required: true, options: statusOptions.filter(s => !["APPROVED", "REJECTED", "WAITLISTED"].includes(s.value)) }],
      initial: { status: row.status },
      row,
    });
  }

  function openEndorsement(row: Row) {
    setForm({
      mode: "status",
      title: "Endorse for interview",
      subtitle: "Confirm saving this application as For Interview. It will become available for scheduling. This is a human action, not an official scholarship award or rejection.",
      fields: [{ key: "status", label: "New status", type: "select", required: true, options: [{ label: "For Interview", value: "FOR_INTERVIEW" }] }],
      initial: { status: "FOR_INTERVIEW" },
      row,
    });
  }

  function openScreening(row?: Row) {
    setForm({
      mode: "screen",
      title: "Run AI-assisted screening",
      subtitle: "Runs the existing saved Random Forest model and persists the advisory result. It never makes the final scholarship decision.",
      fields: [{ key: "application_id", label: "Application", type: "select", required: true, options: applicationOptions }],
      initial: { application_id: row?.application_id ? String(row.application_id) : "" },
      row,
    });
  }

  function openSchedule(row?: Row) {
    setForm({
      mode: "schedule",
      title: "Schedule an interview",
      subtitle: row ? `Schedule an interview for ${nameOf(row)}. Only FOR_INTERVIEW applications can be scheduled.` : "Choose an endorsed application and coordinate the schedule and venue.",
      fields: [
        ...(!row ? [{ key: "application_id", label: "Application", type: "select" as const, required: true, options: rows.filter(r => r.awaiting_schedule).map(r => ({ label: `${r.reference_no || r.application_id} - ${nameOf(r)}`, value: String(r.application_id) })) }] : []),
        { key: "scheduled_at", label: "Date & time", type: "datetime-local", required: true },
        { key: "location", label: "Location / venue" },
        { key: "remarks", label: "Notes", type: "textarea" },
      ],
      initial: {},
      row,
    });
  }

  function openInterviewResult(row: Row) {
    setForm({
      mode: "interviewResult",
      title: "Record interview result",
      subtitle: `Complete interview #${row.interview_id} and save the official interview result.`,
      fields: [
        {
          key: "result", label: "Interview result", type: "select", required: true,
          options: [
            { label: "Passed", value: "PASSED" },
            { label: "Failed", value: "FAILED" },
            { label: "For further review", value: "FOR_FURTHER_REVIEW" },
          ],
        },
        { key: "remarks", label: "Official remarks", type: "textarea", required: true },
      ],
      initial: { result: "FOR_FURTHER_REVIEW", remarks: row.remarks || "" },
      row,
    });
  }

  function openDecision(row?: Row) {
    if (user.role !== "ADMIN") {
      setToast("Only Administrators can record official decisions.");
      return;
    }
    const statusOf = (r: Row) => String(r.stage || r.application_status || r.status || "").toUpperCase();
    const choicesOf = (r: Row): string[] => Array.isArray(r.decision_choices) ? r.decision_choices : DECISION_OPTIONS[statusOf(r)] || [];
    if (row && !choicesOf(row).length) {
      setToast(["APPROVED", "REJECTED", "WITHDRAWN"].includes(statusOf(row))
        ? `${nameOf(row)} already has a final status (${nice(statusOf(row))}). It cannot be changed here.`
        : `${nameOf(row)} is ${nice(statusOf(row))}. A decision can be recorded after the interview result is saved.`);
      return;
    }
    const waiting = decisionQueue.filter(a => choicesOf(a).length);
    if (!row && !waiting.length) {
      setToast("No interviewed applicants are waiting for a decision.");
      return;
    }
    const choices = row ? choicesOf(row) : ["APPROVED", "WAITLISTED", "REJECTED"];
    const interview = (r: Row) => r.interview_result ? `interview ${nice(r.interview_result).toLowerCase()}` : "interviewed";
    setForm({
      mode: "decision",
      title: "Record official decision",
      subtitle: row
        ? `${nameOf(row)} · ${nice(statusOf(row))}, ${interview(row)}. This decision is saved under your name in the Activity Log.`
        : "Choose an interviewed applicant. This decision is saved under your name in the Activity Log.",
      fields: [
        ...(!row ? [{ key: "application_id", label: "Applicant", type: "select" as const, required: true, options: waiting.map(a => ({ label: `${a.reference_no || `APP-${a.application_id}`} · ${nameOf(a)} (${nice(statusOf(a))}, ${interview(a)})`, value: String(a.application_id) })) }] : []),
        { key: "decision", label: "Decision", type: "select", required: true, options: choices.map(value => ({ label: nice(value), value })) },
        { key: "reason", label: "Remarks / basis for the decision", type: "textarea", required: true, placeholder: "At least 10 characters. Applicants and auditors may rely on this explanation." },
      ],
      initial: { application_id: row ? String(row.application_id) : "", decision: "", reason: "" },
      row,
    });
  }

  async function submitForm(values: Row) {
    if (!form) return;
    setFormBusy(true);
    setFormError("");

    try {
      if (form.mode === "batchScreen") {
        setScreeningFailures({});
        for (const option of applicationOptions) {
          try { await post("/screening", { application_id: Number(option.value) }); }
          catch (e) { const message = e instanceof Error ? e.message : "Screening failed"; setScreeningFailures(previous => ({ ...previous, [option.value]: message })); }
        }
        setLatestBatch({ at: new Date().toISOString(), count: applicationOptions.length });
        setToast("Batch finished. Review results in the screening table.");
      } else if (form.mode === "register") {
        const applicantKeys = [
          "first_name", "middle_name", "last_name", "suffix", "birth_date", "sex",
          "email", "phone", "house_no_street", "barangay", "municipality", "province",
        ];

        const applicant: Row = {};
        applicantKeys.forEach(k => { applicant[k] = values[k] ?? ""; });

        const application: Row = {};
        [
          "scholarship_program", "scholarship_year", "academic_average", "monthly_income",
          "household", "children_count", "senior_count", "pwd_count", "dependents_count",
          "solo_parent", "four_ps_beneficiary", "spes_beneficiary", "previous_scholarship",
          "scholars_in_family", "residency", "exam_raw_score", "exam_total_items",
        ].forEach(k => { application[k] = values[k] ?? null; });

        application.status = "DRAFT";
        application.submitted_at = null;

        const result = await post("/register", { applicant, application });
        setToast(`Registered applicant #${result.applicant_id} and application #${result.application_id}.`);
      } else if (form.mode === "editApplicant") {
        await put(`/applicants/${form.row?.applicant_id}`, values);
        setToast("Applicant profile updated.");
      } else if (form.mode === "editApplication") {
        const payload: Row = { ...values };
        ["scholarship_year", "household", "children_count", "senior_count", "pwd_count", "dependents_count", "scholars_in_family", "exam_raw_score", "exam_total_items"]
          .forEach(k => {
            if (payload[k] !== undefined && payload[k] !== null && payload[k] !== "") payload[k] = Number(payload[k]);
          });
        if (payload.academic_average !== undefined) payload.academic_average = Number(payload.academic_average);
        if (payload.monthly_income !== undefined) payload.monthly_income = Number(payload.monthly_income);

        await put(`/applications/${form.row?.application_id}`, payload);
        setToast("Application updated.");
      } else if (form.mode === "status") {
        await put(`/applications/${form.row?.application_id}`, { status: values.status });
        setToast("Application status updated.");
      } else if (form.mode === "screen") {
        await post("/screening", { application_id: Number(values.application_id) });
        setScreeningFailures(previous => { const next = { ...previous }; delete next[String(values.application_id)]; return next; });
        setToast(`Screening saved for application #${values.application_id}. Advisory only; official stage unchanged.`);
        setPage("AI Screening");
      } else if (form.mode === "schedule") {
        await post("/interviews", {
          application_id: Number(form.row?.application_id ?? values.application_id),
          scheduled_at: values.scheduled_at,
          location: values.location || null,
          remarks: values.remarks || null,
        });
        setToast("Interview scheduled.");
      } else if (form.mode === "interviewResult") {
        await post(`/interviews/${form.row?.interview_id}/result`, { result: values.result, remarks: values.remarks });
        setToast("Interview result saved.");
      } else if (form.mode === "decision") {
        if (String(values.reason || "").trim().length < 10) throw new Error("Decision remarks need at least 10 characters.");
        await post("/decisions", { application_id: Number(form.row?.application_id ?? values.application_id), decision: values.decision, reason: String(values.reason).trim() });
        setToast(`Decision recorded: ${nice(values.decision)}. Logged under ${user.display_name}.`);
      } else if (form.mode === "archive") {
        await request(`/applicants/${form.row?.applicant_id}`, { method: "DELETE" });
        setToast("Applicant archived.");
      }

      setForm(null);
      refresh();
    } catch (e) {
      if (form.mode === "screen") setScreeningFailures(previous => ({ ...previous, [String(values.application_id)]: e instanceof Error ? e.message : "Screening failed" }));
      setFormError(e instanceof Error ? e.message : "Could not save. Review the details and try again.");
    } finally {
      setFormBusy(false);
    }
  }

  function archiveApplicant(row: Row) {
    setForm({ mode: "archive", title: "Archive applicant?", subtitle: `${nameOf(row)} and their linked applications will be removed from active lists. The records are retained in the database.`, fields: [], initial: {}, row });
  }


  return (
    <div className={`app-shell ${page === "Overview" || page === "Applicants" || page === "Applications" || page === "AI Screening" || page === "Interviews" ? "overview-shell" : ""} ${page === "Applicants" || page === "Applications" || page === "AI Screening" || page === "Interviews" ? "applicants-shell" : ""} ${page === "Interviews" || page === "Overview" || page === "AI Screening" ? "interviews-shell" : ""} ${page === "Overview" ? "reference-overview-shell" : ""} ${page === "AI Screening" ? "screening-reference-shell" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${signingOut ? "is-signing-out" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><OfficialLogos /><div className="brand-name">iskolar.</div><div className="brand-sub">NG BAYAN / SANTA CRUZ<br />Local Youth Development Office</div></div>
        <div className="sidebar-divider" />
        {(["WORKSPACE", "MANAGEMENT"] as const).map(group => (
          <div className="nav-group" key={group}>
            <div className="nav-caption">{group}</div>
            {nav.filter(n => n.group === group).map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  aria-label={item.label}
                  aria-current={page === item.label ? "page" : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`nav-item ${page === item.label ? "active" : ""}`}
                  onClick={() => { setPage(item.label); setSearch(""); setMobileNav(false); }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.label === "AI Screening" && <span className="nav-new">AI</span>}
                </button>
              );
            })}
          </div>
        ))}
        <div className="nav-group"><div className="nav-caption">SYSTEM</div><button className={`nav-item ${page === "Settings" ? "active" : ""}`} aria-label="Settings" title={sidebarCollapsed ? "Settings" : undefined} onClick={() => setPage("Settings")}><Settings2 size={18} /><span>Settings</span></button><button className={`nav-item ${page === "Activity Log" ? "active" : ""}`} aria-label="Activity Log" title={sidebarCollapsed ? "Activity Log" : undefined} onClick={() => { setPage("Activity Log"); setSearch(""); setMobileNav(false); }}><Activity size={18} /><span>Activity Log</span></button></div>
        <div className="sidebar-spacer" />
        <div className="municipal-tile"><strong>Investing in people, building a brighter Santa Cruz tomorrow.</strong><small>SANTA CRUZ, LAGUNA</small></div>
        {page === "AI Screening" && <button className="screening-sidebar-support" onClick={() => setToast("Contact your LYDO system administrator for help with accounts, screening, and database support.")}><CircleHelp size={25} /><span><strong>Help &amp; Support</strong><small>Get help using the scholarship workspace.</small></span></button>}
        <button className="account-link" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(v => !v)}><PanelLeftClose size={16} /> <span>{sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span></button>
      </aside>

      {mobileNav && <button className="nav-scrim is-visible" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu" aria-expanded={mobileNav}><Menu size={20} /></button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="academic-year"><CalendarDays size={16} />{academicYears.length ? `AY ${academicYears[0]}` : "Scholarship workspace"}</div>
            <button className="icon-button" title="Notifications" onClick={() => setToast("Notifications are not connected. Delivery and unread counts are unavailable.")}><Bell size={17} /></button>
            <button className="icon-button" title="Help" onClick={() => setToast("Contact your LYDO system administrator for support.")}><CircleHelp size={18} /></button>
            <div className="account-menu-wrap">
              <button className={`account-trigger ${accountMenu ? "open" : ""}`} aria-haspopup="menu" aria-expanded={accountMenu} onClick={() => setAccountMenu(v => !v)}>
                <span className="topbar-avatar account-initials">{initials}<i className={`presence-dot ${bridgeOnline ? "on" : "off"}`} /></span>
                <span className="session-label">{user.display_name}<small>{user.role === "ADMIN" ? "Administrator" : "LYDO Official"} · {bridgeOnline ? "Connected" : "Offline"}</small></span>
                <ChevronDown size={15} className="account-chevron" />
              </button>
              {shownMenu && <div className={`account-menu ${menuClosing ? "is-closing" : ""}`} role="menu">
                <div className="account-menu-head"><span className="account-initials large">{initials}</span><div><strong>{user.display_name}</strong><small>{user.email}</small><em>{user.position} · {user.department}</em></div></div>
                <button role="menuitem" onClick={() => { setAccountMenu(false); setPage("Settings"); }}><Settings2 size={15} />Settings{user.role === "ADMIN" ? " & staff access" : ""}</button>
                <button role="menuitem" onClick={() => { setAccountMenu(false); setPage("Activity Log"); }}><Activity size={15} />Activity log</button>
                <button role="menuitem" className="danger" onClick={signOut}><LogOut size={15} />Sign out</button>
              </div>}
            </div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-stage" key={page}>
          {page !== "Settings" && <PageHeader
            title={page === "Overview" ? "Scholarship overview" : page === "Decisions" ? "Scholarship Decisions" : page}
            description={page === "Overview" ? "A clear view of applications, reviews, and official decisions." : pageDescription(page)}
            banner={page === "Overview" ? <section className="overview-reference-hero"><div><h2>Fair opportunities.<br />A brighter Santa Cruz.</h2><p>Local Youth Development Office &middot; Santa Cruz, Laguna</p></div></section> : undefined}
            actions={<>
              {page === "Applicants" && <button className="primary-button" onClick={openRegistration}><Plus size={17} /> Register Applicant</button>}
              {page === "Applications" && <button className="primary-button" onClick={openRegistration}><Plus size={17} /> New Application</button>}
              {page === "AI Screening" && <button className="primary-button" disabled={loading || !applicationOptions.length || formBusy} onClick={() => { setForm({ mode: "batchScreen", title: "Run batch AI screening", subtitle: `Run and persist advisory screening for ${applicationOptions.length} existing applications? Official statuses remain unchanged. Failures will appear in the screening table.`, fields: [], initial: {} }); }}><Play size={17} />Run AI Screening</button>}
              {page === "Interviews" && <button className="primary-button" disabled={loading || !rows.some(row => row.awaiting_schedule)} onClick={() => openSchedule()}><CalendarDays size={21} />Schedule Interview</button>}
              {page === "Decisions" && <button className="primary-button" disabled={loading || user.role !== "ADMIN"} title={user.role === "ADMIN" ? "Record an official decision" : "Only Administrators can record decisions"} onClick={() => openDecision()}><Plus size={17} /> Record decision</button>}
            </>}
          /> }

          {bridgeOutdated && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <div>
                <strong>The Python backend is out of date</strong>
                <span>An older backend is still running, so staff actions are not being recorded and "Approved by" stays blank.</span>
                <small>Close the app's terminal (Ctrl+C) and run <b>python run_react_ui.py</b> again. If it keeps appearing, restart your computer.</small>
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <div>
                <strong>Could not load live data</strong>
                <span>{error}</span>
                <small>Check the Python backend first. If it is reachable, check MySQL and the project .env configuration, then retry.</small>
              </div>
              <button className="button-secondary" onClick={refresh}>Retry</button>
            </div>
          )}

          {error ? <section className="panel data-unavailable"><h2>Records unavailable</h2><p>Live records and totals could not be retrieved. Use Retry above after checking the connection. Records will appear once the connection is restored.</p></section> : page === "Settings" ? <SettingsPage user={user} onToast={setToast} onActivity={() => setPage("Activity Log")} /> : page === "Activity Log" ? <ActivityLogPage items={rows} loading={loading} refresh={refresh} /> : page === "Overview"
            ? <OverviewPage data={dashboard} loading={loading} onOpen={setPage} />
            : page === "Applicants" ? <ApplicantsPage initialSelectedId={applicantFocus} sourceRows={rows} loading={loading} search={search} setSearch={setSearch} refresh={refresh} onEdit={openApplicantEdit} onArchive={archiveApplicant} />
            : page === "Applications" ? <ApplicationsPage rows={rows} loading={loading} search={search} setSearch={setSearch} refresh={refresh} onScreen={openScreening} onSchedule={openSchedule} onEdit={openApplicationEdit} onStatus={openStatus} onProfile={applicantId => { setApplicantFocus(applicantId); setSearch(""); setPage("Applicants"); }} />
            : page === "AI Screening" ? <ScreeningPage latestBatch={latestBatch} applications={allApplications} results={rows} failures={screeningFailures} loading={loading} search={search} setSearch={setSearch} refresh={refresh} onScreen={openScreening} onSchedule={openSchedule} onReviewStage={openStatus} onEndorse={openEndorsement} />
            : page === "Interviews" ? <InterviewsPage rows={rows} applications={allApplications} loading={loading} onSchedule={openSchedule} onResult={openInterviewResult} />
            : page === "Decisions" ? <DecisionsPage decisions={rows} interviewed={decisionQueue} loading={loading} refresh={refresh} onDecision={openDecision} canDecide={user.role === "ADMIN"} />
            : <DataPage
                page={page}
                rows={rows}
                loading={loading}
                search={search}
                setSearch={setSearch}
                refresh={refresh}
                onRegister={openRegistration}
                onApplicantEdit={openApplicantEdit}
                onApplicantArchive={archiveApplicant}
                onApplicationEdit={openApplicationEdit}
                onStatus={openStatus}
                onScreen={openScreening}
                onSchedule={openSchedule}
                onInterviewResult={openInterviewResult}
                onDecision={openDecision}
              />}

          </div>
          <footer className="footer">
            <span>© {new Date().getFullYear()} Iskolar ng Bayan</span>
            <span><span className="footer-dot" /> Local desktop workspace <span className="footer-sep">·</span> Scholarship Applicant Screening & Management</span>
          </footer>
        </div>
      </main>

      {shownForm && <FormModal form={shownForm} closing={formClosing} busy={formBusy} serverError={formError} onClose={() => !formBusy && setForm(null)} onSubmit={submitForm} />}
      {shownToast && <div className={`toast ${toastClosing ? "is-closing" : ""}`} role="status" aria-live="polite"><CircleHelp size={17} />{shownToast}<i className="toast-timer" key={shownToast} /><button onClick={() => setToast("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function pageDescription(page: PageKey) {
  return ({
    "Activity Log": "Review who processed each record, what changed, and when.",
    Settings: "Your account, preferences, and workspace.",
    Overview: "A quick look at your scholarship program.",
    Applicants: "Manage applicant identity records, contact details, and household information.",
    Applications: "Track every submission from initial screening to the official scholarship decision.",
    "AI Screening": "Review model recommendations alongside verified records and professional judgment.",
    Interviews: "Schedule and manage applicant interviews for all scholarship programs. Coordinate with panel members and track interview status and results.",
    Decisions: "Record and review final scholarship decisions.",
  } as Record<PageKey, string>)[page];
}

function DataPage(props: {
  page: PageKey;
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  refresh: () => void;
  onRegister: () => void;
  onApplicantEdit: (r: Row) => void;
  onApplicantArchive: (r: Row) => void;
  onApplicationEdit: (r: Row) => void;
  onStatus: (r: Row) => void;
  onScreen: (r?: Row) => void;
  onSchedule: (r: Row) => void;
  onInterviewResult: (r: Row) => void;
  onDecision: (r?: Row) => void;
}) {
  const { page, rows: sourceRows, loading, search, setSearch, refresh, onApplicantEdit, onApplicantArchive, onApplicationEdit, onStatus, onScreen, onSchedule, onInterviewResult } = props;

  const [selected, setSelected] = useState<Row | null>(null);
  const [filter, setFilter] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setSelected(null); setFilter(""); setProgram(""); setYear(""); setCurrentPage(1); }, [page]);
  useEffect(() => { setCurrentPage(1); }, [search, filter, program, year]);
  const filterKey = page === "Applicants" ? "barangay" : page === "AI Screening" ? "predicted_class" : page === "Decisions" ? "decision" : "status";
  const matches = sourceRows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()) && (!filter || String(r[filterKey]) === filter) && (!program || String(r.scholarship_program) === program) && (!year || String(r.scholarship_year) === year));
  const pages = Math.max(1, Math.ceil(matches.length / 8));
  const rows = matches.slice((Math.min(currentPage, pages) - 1) * 8, Math.min(currentPage, pages) * 8);
  const options = (key: string) => [...new Set(sourceRows.map(r => r[key]).filter(v => v != null && v !== "").map(String))].sort();

  const columns: Record<PageKey, { key: string; label: string }[]> = {
    "Activity Log": [],
    Settings: [],
    Overview: [],
    Applicants: [
      { key: "applicant_id", label: "ID" }, { key: "name", label: "Applicant name" },
      { key: "email", label: "Email address" }, { key: "phone", label: "Phone" },
      { key: "municipality", label: "Municipality" }, { key: "created_at", label: "Date added" },
    ],
    Applications: [
      { key: "application_id", label: "Application ID" }, { key: "applicant_name", label: "Applicant" },
      { key: "scholarship_program", label: "Scholarship program" }, { key: "scholarship_year", label: "School year" },
      { key: "academic_average", label: "Average" }, { key: "status", label: "Status" },
      { key: "created_at", label: "Created" },
    ],
    "AI Screening": [
      { key: "application_id", label: "Application" }, { key: "applicant_name", label: "Applicant" },
      { key: "scholarship_program", label: "Program" }, { key: "predicted_class", label: "Screening outcome" },
      { key: "screened_at", label: "Screened at" },
    ],
    Interviews: [
      { key: "reference_no", label: "Reference" }, { key: "applicant_name", label: "Applicant" },
      { key: "scheduled_at", label: "Date & time" }, { key: "location", label: "Location" },
      { key: "status", label: "Status" }, { key: "result", label: "Result" },
    ],
    Decisions: [
      { key: "application_id", label: "Application" }, { key: "applicant_name", label: "Applicant" },
      { key: "scholarship_program", label: "Scholarship program" }, { key: "decision", label: "Decision" },
      { key: "reason", label: "Reason" }, { key: "decided_at", label: "Decision date" },
    ],
  };

  const totalApplications = new Set(sourceRows.map(r => r.application_id).filter(Boolean)).size;
  const metrics = page === "Applicants" ? [["Directory records", sourceRows.length], ["Active profiles", sourceRows.length], ["Barangays", options("barangay").length], ["Archive history", "Unavailable"]] : page === "AI Screening" ? [["Screened applications", totalApplications], ["Saved results", sourceRows.length], ["Model authority", "Advisory"], ["Review notes", "Not connected"]] : page === "Interviews" ? [["Awaiting schedule", sourceRows.filter(r => r.awaiting_schedule).length], ["Scheduled", sourceRows.filter(r => r.status === "SCHEDULED").length], ["Completed", sourceRows.filter(r => r.status === "COMPLETED").length], ["Rescheduling", "Not connected"]] : page === "Decisions" ? [["Recorded decisions", sourceRows.length], ["Approved", sourceRows.filter(r => r.decision === "APPROVED").length], ["Rejected", sourceRows.filter(r => r.decision === "REJECTED").length], ["Authorization", "Not connected"]] : [["All applications", sourceRows.length], ["Under review", sourceRows.filter(r => r.status === "UNDER_REVIEW").length], ["For interview", sourceRows.filter(r => r.status === "FOR_INTERVIEW").length], ["Final decisions", sourceRows.filter(r => ["APPROVED", "REJECTED"].includes(r.status)).length]];

  const cols = columns[page] || [];
  const intro = page === "AI Screening"
    ? "Recorded predictions are advisory and must be reviewed by an authorized official."
    : page === "Interviews"
      ? "Schedule endorsed applicants and record interview outcomes."
      : "Live records read from your existing scholarship database.";

  return (
    <><section className="stats-grid record-metrics">{metrics.map(([label, value]) => <div className="stat-card" key={label}><span className="stat-icon blue"><FileText size={18} /></span><div className="stat-label">{label}</div><div className={typeof value === "number" ? "stat-value" : "stat-unavailable"}><CountUp value={value} loading={loading} placeholder="—" /></div></div>)}</section><div className={`records-layout ${selected ? "has-detail" : ""}`}><section className="panel data-panel">
      <div className="data-toolbar">
        <div><h3>{page === "AI Screening" ? "Screening history" : `${page} records`}</h3><p>{intro}</p></div>
        <div className="toolbar-actions">
          <label className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${page.toLowerCase()}...`} /></label>
          <button className="button-secondary" onClick={refresh}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="filter-bar"><select aria-label="Filter records" value={filter} onChange={e => setFilter(e.target.value)}><option value="">{page === "Applicants" ? "All barangays" : "All statuses / recommendations"}</option>{options(filterKey).map(v => <option key={v} value={v}>{nice(v)}</option>)}</select>{page !== "Applicants" && <><select aria-label="Program" value={program} onChange={e => setProgram(e.target.value)}><option value="">All programs</option>{options("scholarship_program").map(v => <option key={v}>{v}</option>)}</select><select aria-label="Scholarship year" value={year} onChange={e => setYear(e.target.value)}><option value="">All years</option>{options("scholarship_year").map(v => <option key={v}>{v}</option>)}</select></>}</div>
      {page === "Decisions" && <div className="notice"><ShieldCheck size={17} />Official decisions are read-only. Verified staff authorization is not connected.</div>}
      {page === "AI Screening" && <div className="notice"><Sparkles size={17} /><span>Run a screening to evaluate an existing application with the saved model. Results are persisted and remain advisory, not a final award/rejection.</span></div>}

      {page === "Interviews" && <div className="notice">Existing workflow requires the For Interview stage before scheduling. Rescheduling and panel conflict validation are not connected.</div>}
      {loading ? <div className="table-loading"><LoaderCircle className="spin" size={24} /><span>Loading records…</span></div> : rows.length ? (
        <div>{(page === "Interviews" ? [{ title: "Applications for interview scheduling", items: rows.filter(r => r.awaiting_schedule) }, { title: "Scheduled interviews", items: rows.filter(r => !r.awaiting_schedule) }] : [{ title: "", items: rows }]).map(group => <section className="table-group" key={group.title}>{group.title && <h3>{group.title}</h3>}<div className="table-scroll">
          <table>
            <thead><tr>{cols.map(c => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead>
            <tbody>
              {group.items.map((r, i) => (
                <tr key={r.screening_id ?? r.interview_id ?? r.decision_id ?? r.application_id ?? r.applicant_id ?? i}>
                  {cols.map(c => <td key={c.key}>{renderCell(r, c.key, page)}</td>)}
                  <td>
                    <div className="row-actions"><button className="row-action" onClick={() => setSelected(r)}>View</button>
                      {page === "Applicants" && <>
                        <button className="row-action" title="Edit applicant" onClick={() => onApplicantEdit(r)}><Pencil size={14} /> Edit</button>
                        <button className="row-action danger" title="Archive applicant" onClick={() => onApplicantArchive(r)}><Archive size={14} /> Archive</button>
                      </>}
                      {page === "Applications" && <>
                        <button className="row-action" onClick={() => onApplicationEdit(r)}><Pencil size={14} /> Edit</button>
                        <button className="row-action" onClick={() => onStatus(r)}><ListChecks size={14} /> Status</button>
                        <button className="row-action" onClick={() => onScreen(r)}><BrainCircuit size={14} /> Screen</button>
                      </>}
                      {page === "AI Screening" && <button className="row-action" onClick={() => onScreen(r)}><BrainCircuit size={14} /> Screen application</button>}
                      {page === "Interviews" && (
                        r.awaiting_schedule
                          ? <button className="row-action" onClick={() => onSchedule(r)}><CalendarPlus size={14} /> Schedule</button>
                          : ["SCHEDULED", "RESCHEDULED"].includes(String(r.status).toUpperCase())
                            ? <button className="row-action" onClick={() => onInterviewResult(r)}><ClipboardCheck size={14} /> Record result</button>
                            : <span className="muted-action">No action</span>
                      )}
                      {page === "Decisions" && <span className="muted-action">Recorded</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>{!group.items.length && <p className="group-empty">No records on this page.</p>}
        </div></section>)}</div>
      ) : <EmptyState title={search ? "No matching records" : `No ${page.toLowerCase()} found`} text={search ? "Try another search term." : "No matching records are currently available in the database."} />}

      <div className="table-footer">
        <span>Showing <b>{rows.length}</b> of {matches.length} record{rows.length === 1 ? "" : "s"}{search ? " matching your search" : ""}</span>
        <span className="pagination"><button disabled={currentPage <= 1} onClick={() => setCurrentPage(n => n - 1)}>Previous</button><b>{Math.min(currentPage, pages)} / {pages}</b><button disabled={currentPage >= pages} onClick={() => setCurrentPage(n => n + 1)}>Next</button></span>
      </div>
    </section>{selected && <RecordDetail row={selected} page={page} onClose={() => setSelected(null)} />}</div></>
  );
}

function renderCell(row: Row, key: string, _page: PageKey) {
  if (key === "name" || key === "applicant_name") {
    return (
      <div className="person-cell">
        <div className="table-avatar">{nameOf(row).split(/\s+/).slice(0, 2).map((x: string) => x[0]).join("").toUpperCase()}</div>
        <div><strong>{nameOf(row)}</strong>{row.email && <small>{row.email}</small>}</div>
      </div>
    );
  }

  if (key === "predicted_class") return <span className="model-output">{modelLabel(row)}</span>;
  if (key === "status" || key === "decision" || key === "result" || key === "predicted_class") {
    return <span className={`status-badge ${statusTone(row[key])}`}>{nice(row[key])}</span>;
  }

  if (key === "confidence_score") {
    const n = Number(row[key]);
    return row[key] == null
      ? "—"
      : <span className="confidence"><span className="confidence-track"><i style={{ width: `${Math.max(0, Math.min(1, n <= 1 ? n : n / 100)) * 100}%` }} /></span>{`${Math.round((n <= 1 ? n : n / 100) * 100)}%`}</span>;
  }

  if (["created_at", "decided_at", "scheduled_at", "screened_at", "birth_date"].includes(key)) return dateText(row[key]);
  if (key === "application_id") return <span className="id-cell">{row.reference_no || `APP-${String(row.application_id ?? "").padStart(4, "0")}`}</span>;
  if (key === "applicant_id") return <span className="id-cell">#{row[key]}</span>;
  if (key === "reason") return <span className="reason-cell" title={String(row[key] ?? "")}>{row[key] || "—"}</span>;
  if (key === "academic_average") return row[key] == null ? "—" : `${Number(row[key]).toFixed(2)}%`;

  const value = row[key];
  return value == null || value === "" ? "—" : String(value);
}

function FormModal({ form, closing = false, busy, serverError, onClose, onSubmit }: {
  form: NonNullable<FormState>;
  closing?: boolean;
  busy: boolean;
  serverError: string;
  onClose: () => void;
  onSubmit: (values: Row) => void;
}) {
  const dialog = useDialogFocus(true, onClose, busy);
  const [values, setValues] = useState<Row>(() => ({ ...form.initial }));
  const [error, setError] = useState("");

  const grouped = useMemo(() => {
    const groups: { title: string; fields: Field[] }[] = [];
    for (const field of form.fields) {
      const title = field.section || "Details";
      let group = groups.find(g => g.title === title);
      if (!group) {
        group = { title, fields: [] };
        groups.push(group);
      }
      group.fields.push(field);
    }
    return groups;
  }, [form.fields]);

  const [step, setStep] = useState(0);
  const wizard = form.mode === "register";
  const activeGroup = grouped[Math.min(step, grouped.length - 1)];

  function validateFields(fields: Field[]) {
    for (const f of fields) {
      const value = values[f.key];

      if (f.required && (value === undefined || value === null || String(value).trim() === "")) {
        setError(`${f.label} is required.`);
        return false;
      }

      if (value !== undefined && value !== null && String(value).trim() !== "") {
        if (f.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
          setError("Enter a valid email address containing @ and a domain.");
          return false;
        }

        if (f.key === "phone" && !/^\d{7,15}$/.test(String(value).replace(/\D/g, ""))) {
          setError("Phone number must contain 7 to 15 digits.");
          return false;
        }

        if (f.type === "number") {
          const n = Number(value);
          if (!Number.isFinite(n)) {
            setError(`${f.label} must be a valid number.`);
            return false;
          }
          if (f.min !== undefined && n < f.min) {
            setError(`${f.label} must be at least ${f.min}.`);
            return false;
          }
          if (f.max !== undefined && n > f.max) {
            setError(`${f.label} must not exceed ${f.max}.`);
            return false;
          }
          if ([
            "monthly_income", "household", "children_count", "senior_count",
            "pwd_count", "dependents_count", "scholars_in_family", "exam_raw_score", "exam_total_items",
          ].includes(f.key) && n < 0) {
            setError(`${f.label} cannot be negative.`);
            return false;
          }
        }
      }
    }

    if (fields.some(f => f.key === "exam_raw_score") && Number(values.exam_raw_score) > Number(values.exam_total_items)) {
      setError("Entrance exam raw score cannot exceed the total number of items.");
      return false;
    }

    setError("");
    return true;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (wizard && step < grouped.length - 1) {
      if (validateFields(activeGroup.fields)) setStep(n => n + 1);
      return;
    }

    if (!validateFields(form.fields)) return;
    onSubmit(values);
  }

  function updateValue(key: string, value: any) {
    setValues(v => {
      const next = { ...v, [key]: value };
      if (key === "exam_total_items" && next.exam_raw_score !== "" && Number(next.exam_raw_score) > Number(value)) {
        next.exam_raw_score = value === "" ? "" : value;
      }
      return next;
    });
    setError("");
  }

  return (
    <div className={`modal-backdrop ${closing ? "is-closing" : ""}`} onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form ref={node => { dialog.current = node; }} role="dialog" aria-modal="true" aria-labelledby="workflow-title" aria-describedby="workflow-description" aria-busy={busy} tabIndex={-1} className={`modal workflow-modal ${form.mode === "register" ? "wide-modal" : ""}`} onSubmit={submit}>
        <div className="modal-head">
          <div><h2 id="workflow-title">{form.title}</h2><p id="workflow-description">{form.subtitle}</p></div>
          <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={18} /></button>
        </div>

        {wizard && (
          <div className="wizard-progress">
            <span>Step {step + 1} of {grouped.length}</span>
            <strong>{activeGroup?.title}</strong>
            <div className="wizard-track"><i style={{ width: `${((step + 1) / grouped.length) * 100}%` }} /></div>
          </div>
        )}

        <fieldset className="form-scroll workflow-fields" disabled={busy}>
          {(wizard ? (activeGroup ? [activeGroup] : []) : grouped).map(group => (
            <section className="form-section" key={group.title}>
              <h3>{group.title}</h3>
              <div className="form-grid">
                {group.fields.map(field => (
                  <label className={`field-label ${field.type === "checkbox" ? "checkbox-field" : ""} ${field.type === "textarea" ? "full-field" : ""}`} key={field.key}>
                    {field.type === "checkbox" ? (
                      <>
                        <input type="checkbox" checked={Boolean(values[field.key])} onChange={e => updateValue(field.key, e.target.checked)} />
                        <span>{field.label}{field.required ? " *" : ""}</span>
                      </>
                    ) : (
                      <>
                        {field.label}{field.required ? " *" : ""}
                        {field.type === "select" ? (
                          <select required={field.required} value={values[field.key] ?? ""} onChange={e => updateValue(field.key, e.target.value)}>
                            <option value="">Choose…</option>
                            {values[field.key] && !field.options?.some(o => o.value === String(values[field.key])) && <option value={values[field.key]}>{values[field.key]} (saved value)</option>}
                            {(field.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea required={field.required} rows={3} value={values[field.key] ?? ""} placeholder={field.placeholder} onChange={e => updateValue(field.key, e.target.value)} />
                        ) : (
                          <input
                            required={field.required}
                            type={field.type || "text"}
                            min={field.min}
                            max={field.key === "exam_raw_score" && values.exam_total_items !== "" ? Number(values.exam_total_items) : field.max}
                            step={field.step}
                            readOnly={field.readOnly}
                            inputMode={field.key === "phone" ? "tel" : undefined}
                            value={values[field.key] ?? ""}
                            placeholder={field.placeholder}
                            onChange={e => {
                              let v = e.target.value;
                              if (field.type === "number" && v !== "" && Number(v) < 0) v = v.replace(/-/g, "");
                              updateValue(field.key, v);
                            }}
                          />
                        )}
                      </>
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </fieldset>

        {(error || serverError) && <div className="form-error" role="alert">{error || serverError}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={wizard && step > 0 ? () => { setStep(n => n - 1); setError(""); } : onClose}
            disabled={busy}
          >
            {wizard && step > 0 ? "Back" : "Cancel"}
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" /> : null}
            {busy ? "Saving…" : wizard && step < grouped.length - 1 ? "Next" : ({ archive: "Archive applicant", status: "Save status", editApplicant: "Save profile", editApplication: "Save application", screen: "Run screening", batchScreen: "Run screening", schedule: "Schedule interview", interviewResult: "Save interview result", register: "Register applicant", decision: "Record decision" }[form.mode] || "Save changes")}
          </button>
        </div>

        <p className="modal-note"><ShieldCheck size={14} /> {form.fields.length ? "Fields marked * are required. Details are validated before saving." : "Review the action before confirming."}</p>
      </form>
    </div>
  );
}

function LoadingRows() {
  return <div className="loading-list">{[1, 2, 3, 4].map(n => <div key={n} className="loading-line"><i /><span /><b /></div>)}</div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div className="empty-icon"><FileText size={22} /></div><strong>{title}</strong><p>{text}</p></div>;
}


function modelLabel(row: Row) {
  let details: Row = {};
  try { details = typeof row.explanation === "string" ? JSON.parse(row.explanation) : row.explanation || {}; } catch { /* Legacy record */ }
  const value = String(details.model_prediction ?? "").toLowerCase();
  if (["1", "qualified"].includes(value)) return "Model predicts qualified";
  if (["0", "not qualified", "not_qualified"].includes(value)) return "Model predicts not qualified";
  if (value === "not_eligible") return "Fails eligibility rules";
  return row.predicted_class ? `Advisory: ${nice(row.predicted_class)}` : "Recommendation unavailable";
}
function RecordDetail({ row, page, onClose }: { row: Row; page: PageKey; onClose: () => void }) {
  const [tab, setTab] = useState("Overview");
  useEffect(() => setTab("Overview"), [row, page]);
  const keys = page === "Applicants" ? ["birth_date", "sex", "house_no_street", "barangay", "municipality", "province", "phone", "email", "created_at"] : ["application_id", "scholarship_program", "scholarship_year", "academic_average", "status", "scheduled_at", "location", "result", "decision", "reason", "decided_at", "screened_at"];
  return <aside className="panel record-detail"><div className="detail-head"><div><strong>{nameOf(row)}</strong><p>{page} · {row.reference_no || row.application_id || row.applicant_id}</p></div><button className="icon-button" aria-label="Close details" onClick={onClose}><X size={18} /></button></div><div className="detail-tabs">{["Overview", "References", "History"].map(t => <button className={tab === t ? "active" : ""} key={t} onClick={() => setTab(t)}>{t}</button>)}</div><div className="tab-panel" key={tab}>{tab === "Overview" ? <><dl>{keys.filter(k => row[k] != null).map(k => <div key={k}><dt>{nice(k)}</dt><dd>{String(row[k])}</dd></div>)}</dl>{page === "AI Screening" && <div className="model-card"><small>ADVISORY MODEL OUTPUT</small><h3>{modelLabel(row)}</h3><p>Human review remains available. This result does not change the official stage.</p></div>}{page === "Applications" && <div className="application-timeline"><h4>OFFICIAL APPLICATION TIMELINE</h4>{["Submitted", "Screening", "Interview", "Official Decision"].map(t => <div key={t}><Clock3 size={16} /><span>{t}<small>{t === "Submitted" && row.submitted_at ? dateText(row.submitted_at) : "Event history unavailable"}</small></span></div>)}</div>}<div className="notice">Identity edits and model recommendations do not record an official decision.</div></> : tab === "References" ? <EmptyState title="References not connected" text="No document integration is available for this record." /> : <><h4>Recorded history</h4>{page === "AI Screening" ? <dl><div><dt>Screened at</dt><dd>{row.screened_at || "Unavailable"}</dd></div><div><dt>Saved explanation</dt><dd>{row.explanation || "Unavailable"}</dd></div></dl> : <p>Full audit history and verified decision-maker identity are not connected.</p>}</>}</div></aside>;
}
