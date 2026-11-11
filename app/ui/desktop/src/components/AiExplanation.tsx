import { useEffect, useState } from "react";
import { AlertTriangle, BrainCircuit, ChevronDown, Info, ListChecks, LoaderCircle, TrendingDown, TrendingUp } from "lucide-react";
import { API_BASE, apiFetch } from "../api";
import { dateLocale, dateOptions } from "../datePreferences";
import CountUp from "./CountUp";

type Contribution = { feature: string; label: string; display_value: string; impact_points: number };
type Explanation = {
  available: boolean;
  error?: string;
  /** False when the applicant fails an eligibility rule; the model then gives no score. */
  eligible: boolean;
  probability_percent: number | null;
  model_prediction: "QUALIFIED" | "NOT_QUALIFIED" | "NOT_ELIGIBLE";
  recommendation: string;
  baseline_percent: number | null;
  contributions: Contribution[];
  ai_reasons: string[];
  rule_flags: string[];
  model_version?: string;
  saved: { probability_percent: number | null; screened_at: string; recommendation: string } | null;
  inputs_changed_since_saved: boolean;
};

// Small shared cache so the compact and full views don't fetch twice.
const cache = new Map<number, { at: number; data: Explanation }>();
const FRESH_MS = 30_000;

async function loadExplanation(applicationId: number): Promise<Explanation> {
  const hit = cache.get(applicationId);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.data;
  const response = await apiFetch(`${API_BASE}/applications/${applicationId}/ai-explanation`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The AI explanation could not be loaded.");
  cache.set(applicationId, { at: Date.now(), data });
  return data;
}

const pretty = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
const dateText = (value: string) => new Date(value).toLocaleDateString(dateLocale(), dateOptions());

/**
 * The model's chance of qualifying for one application and why.
 * `compact` shows the ring and top reasons; the full view adds the factor chart.
 */
export default function AiExplanation({ applicationId, compact = false, onMore }: { applicationId: number; compact?: boolean; onMore?: () => void }) {
  const [data, setData] = useState<Explanation | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(""); setShowAll(false);
    loadExplanation(applicationId).then(result => { if (alive) setData(result); }).catch(failure => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [applicationId]);

  if (error) return <div className="ai-explain ai-explain-empty" role="alert"><AlertTriangle size={16} />{error}</div>;
  if (!data) return <div className="ai-explain ai-explain-empty"><LoaderCircle size={16} className="spin" />Analysing application…</div>;
  if (!data.available) return <div className="ai-explain ai-explain-empty"><Info size={16} />{data.error}</div>;

  const savedText = data.saved
    ? <span>Last saved screening: <b>{data.saved.probability_percent == null ? "not scored (eligibility rules)" : `${data.saved.probability_percent.toFixed(1)}%`}</b> on {dateText(data.saved.screened_at)}.{data.inputs_changed_since_saved && <em> Application details changed since then — run screening again to save an updated result.</em>}</span>
    : <span>Not screened yet. This is a live preview from the current application details; run screening to save it.</span>;

  if (!data.eligible || data.probability_percent == null) {
    return <section className={`ai-explain ai-explain-ineligible ${compact ? "compact" : ""}`} aria-label="Eligibility check">
      <header className="ai-explain-head">
        <span className="ai-rule-badge" aria-hidden="true"><ListChecks size={compact ? 26 : 30} /></span>
        <div className="ai-explain-title">
          <small><BrainCircuit size={13} />ELIGIBILITY CHECK · ADVISORY</small>
          <strong>Does not pass the eligibility rules</strong>
          <span className="ai-chip review">Not scored · staff to confirm</span>
        </div>
      </header>
      <div className="ai-rules"><AlertTriangle size={14} /><div><strong>Rules not met</strong>{data.rule_flags.map(flag => <span key={flag}>{flag}</span>)}</div></div>
      <p className="ai-note ai-rule-note">The AI only scores and ranks applicants who pass every eligibility rule. This is not an official decision; the application's stage is unchanged until staff act on it.</p>
      <footer className="ai-foot">
        {savedText}
        {compact && onMore && <button type="button" className="ai-more" onClick={onMore}>See details</button>}
      </footer>
    </section>;
  }

  const percent = Math.max(0, Math.min(100, data.probability_percent));
  const leansQualified = data.model_prediction === "QUALIFIED";
  const reasons = data.ai_reasons.slice(1); // first sentence repeats the percentage
  const split = reasons.indexOf("Working the other way:");
  const toward = split === -1 ? reasons : reasons.slice(0, split);
  const against = split === -1 ? [] : reasons.slice(split + 1);
  const factors = data.contributions.filter(item => Math.abs(item.impact_points) >= 0.1);
  const shown = showAll ? factors : factors.slice(0, 6);
  const scale = Math.max(...factors.map(item => Math.abs(item.impact_points)), 1);

  return <section className={`ai-explain ${compact ? "compact" : ""}`} aria-label="AI prediction">
    <header className="ai-explain-head">
      <div className="ai-ring" style={{ ["--pct" as string]: `${percent}%` }} data-tone={leansQualified ? "good" : "low"} role="img" aria-label={`${percent.toFixed(1)} percent chance of qualifying`}>
        <span><b><CountUp value={Math.round(percent)} />%</b><small>chance</small></span>
      </div>
      <div className="ai-explain-title">
        <small><BrainCircuit size={13} />AI PREDICTION · ADVISORY</small>
        <strong>{leansQualified ? "Leans qualified" : "Leans not qualified"}</strong>
        <span className={`ai-chip ${data.recommendation.startsWith("Proceed") ? "good" : "review"}`}>{pretty(data.recommendation)}</span>
      </div>
    </header>

    <div className="ai-why">
      <h4>Why the AI predicted this</h4>
      <ul>{toward.map(line => <li key={line} className="toward">{line}</li>)}</ul>
      {!compact && against.length > 0 && <><h5>Working the other way</h5><ul>{against.map(line => <li key={line} className="against">{line}</li>)}</ul></>}
    </div>


    {!compact && <div className="ai-factors">
      <h4>How each input moved the chance</h4>
      <p className="ai-note">Starts at {(data.baseline_percent ?? 0).toFixed(1)}% (the share of qualified applicants among the eligible applicants the model learned from). Green bars raised the chance, red bars lowered it.</p>
      <ul>{shown.map((item, index) => <li key={item.feature} style={{ animationDelay: `${index * 40}ms` }}>
        <span className="ai-factor-label">{item.label}<small>{item.display_value}</small></span>
        <span className="ai-factor-track">
          <i className={item.impact_points >= 0 ? "up" : "down"} style={{ width: `${Math.abs(item.impact_points) / scale * 50}%` }} />
        </span>
        <span className={`ai-factor-points ${item.impact_points >= 0 ? "up" : "down"}`}>{item.impact_points >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{item.impact_points >= 0 ? "+" : "−"}{Math.abs(item.impact_points).toFixed(1)}</span>
      </li>)}</ul>
      {factors.length > 6 && <button type="button" className="ai-more" onClick={() => setShowAll(value => !value)}><ChevronDown size={14} className={showAll ? "open" : ""} />{showAll ? "Show fewer" : `Show all ${factors.length} inputs`}</button>}
    </div>}

    <footer className="ai-foot">
      {savedText}
      {compact && onMore && <button type="button" className="ai-more" onClick={onMore}>See full breakdown</button>}
    </footer>
  </section>;
}
