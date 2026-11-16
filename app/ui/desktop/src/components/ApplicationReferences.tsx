import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, XCircle } from "lucide-react";
import { API_BASE, apiFetch } from "../api";
import { dateLocale, dateOptions } from "../datePreferences";

type Row = Record<string, any>;
type Rule = { rule: string; value: string; passed: boolean };
type Step = { action: string; name: string | null; role: string | null; at: string };
type References = {
  applicant: Row; application: Row; rules: Rule[];
  screening: Row | null; screening_runs: number; model: Row | null;
  interview: Row | null; decision: Row | null; trail: Step[];
};

const STEPS: Record<string, string> = {
  REGISTER_APPLICATION: "Registered the applicant and application",
  UPDATE_APPLICATION: "Edited the application",
  RUN_SCREENING: "Ran AI screening",
  ENDORSE_FOR_INTERVIEW: "Endorsed for interview",
  CHANGE_STATUS: "Changed the official stage",
  REJECT_APPLICATION: "Rejected the application at review",
  REOPEN_APPLICATION: "Reopened the application",
  SCHEDULE_INTERVIEW: "Scheduled the interview",
  RECORD_INTERVIEW_RESULT: "Recorded the interview result",
  RECORD_DECISION: "Recorded the official decision",
};
const words = (value: unknown) => value == null || value === "" ? "—" : String(value).replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
const day = (value: unknown) => value ? new Date(String(value)).toLocaleDateString(dateLocale(), dateOptions()) : "—";
const roleName = (role: string | null) => role === "ADMIN" ? "Administrator" : role === "LYDO_OFFICIAL" ? "LYDO Official" : "";
// Model metrics may be stored as fractions (0.825) or percentages (82.5).
const metric = (value: unknown) => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${(n <= 1 ? n * 100 : n).toFixed(1)}%` : String(value);
};

/** What an application's status and AI recommendation are based on: source records,
 * the eligibility rules with the values used, the model, and who recorded each step. */
export default function ApplicationReferences({ applicationId }: { applicationId: number }) {
  const [data, setData] = useState<References | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null); setError("");
    apiFetch(`${API_BASE}/applications/${applicationId}/references`)
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "The references could not be loaded.");
        if (alive) setData(body);
      })
      .catch(failure => { if (alive) setError(failure instanceof Error ? failure.message : "The references could not be loaded."); });
    return () => { alive = false; };
  }, [applicationId]);

  if (error) return <section className="screening-analysis-tab"><p className="reference-error"><AlertTriangle size={15} /> {error}</p></section>;
  if (!data) return <section className="screening-analysis-tab"><p><LoaderCircle size={15} className="spin" /> Loading references…</p></section>;

  const { applicant, application, rules, screening, model, interview, decision, trail } = data;
  const failed = rules.filter(rule => !rule.passed).length;

  return <section className="screening-analysis-tab references-tab">
    <h3>Source records</h3>
    <dl>
      <div><dt>Applicant</dt><dd>#{applicant.applicant_id} {applicant.name}{applicant.archived ? " (archived)" : ""} · registered {day(applicant.created_at)}</dd></div>
      <div><dt>Application</dt><dd>APP-{application.application_id} · {application.program || "—"} {application.year || ""} · {words(application.status)}</dd></div>
      <div><dt>Latest screening</dt><dd>{screening
        ? <>#{screening.screening_id} · {day(screening.screened_at)} · {words(screening.predicted_class)}{screening.chance_percent != null ? ` (${screening.chance_percent}% chance)` : ""}{data.screening_runs > 1 ? ` · ${data.screening_runs} runs in total` : ""}</>
        : "Not screened yet"}</dd></div>
      <div><dt>Interview</dt><dd>{interview
        ? <>#{interview.interview_id} · {day(interview.scheduled_at)}{interview.location ? ` · ${interview.location}` : ""} · {interview.result ? words(interview.result) : words(interview.status)}</>
        : "No interview yet"}</dd></div>
      <div><dt>Official decision</dt><dd>{decision
        ? <>#{decision.decision_id} · {words(decision.decision)} · {day(decision.decided_at)}</>
        : "No official decision yet"}</dd></div>
    </dl>
    {screening?.outdated && <p className="reference-warning"><AlertTriangle size={14} /> The application details changed after the latest screening. Run screening again to update the result.</p>}

    <h3>Eligibility rules checked</h3>
    <ul className="reference-rules">
      {rules.map(rule => <li key={rule.rule} className={rule.passed ? "pass" : "fail"}>
        {rule.passed ? <CheckCircle2 size={15} aria-label="Passed" /> : <XCircle size={15} aria-label="Not met" />}
        <span>{rule.rule}</span><small>{rule.value}</small>
      </li>)}
    </ul>
    <p>{failed ? `${failed} rule${failed === 1 ? "" : "s"} not met, so the AI does not score this application. Staff should confirm against the submitted documents.` : "All five rules pass, so the AI can score this application."}</p>

    <h3>Model behind the latest screening</h3>
    {model?.version_name ? <>
      <dl>
        <div><dt>Model version</dt><dd>{model.version_name}{model.is_active ? " (active)" : ""}</dd></div>
        <div><dt>Algorithm</dt><dd>{model.algorithm || "—"}</dd></div>
        <div><dt>Test accuracy</dt><dd>{metric(model.accuracy)}</dd></div>
        <div><dt>Precision / recall</dt><dd>{metric(model.precision_score)} / {metric(model.recall_score)}</dd></div>
        <div><dt>F1-score</dt><dd>{metric(model.f1_score)}</dd></div>
        <div><dt>Trained</dt><dd>{day(model.trained_at)}</dd></div>
      </dl>
      <p className="reference-note"><Info size={14} /> Advisory only. The model was trained on a synthetic dataset and should be retrained on real LYDO records before deployment.</p>
    </> : <p>No model result yet. Run screening to record one.</p>}

    <h3>Recorded by</h3>
    {trail.length ? <ol className="reference-trail">
      {trail.map((step, index) => <li key={`${step.action}-${index}`}>
        <span>{STEPS[step.action] || words(step.action)}</span>
        <small>{step.name || "Unknown staff member"}{roleName(step.role) ? ` (${roleName(step.role)})` : ""} · {day(step.at)}</small>
      </li>)}
    </ol> : <p>No staff actions are recorded for this application yet. Records created before staff sign-in was added show none.</p>}

    <h3>Supporting documents</h3>
    <p>Applicants submit their requirements in person at the LYDO office. Document upload and verification are not connected yet, so check the originals before recording an official action.</p>
  </section>;
}
