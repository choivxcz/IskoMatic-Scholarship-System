import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { API_BASE, apiFetch } from "../api";
import { useDialogFocus } from "../useDialogFocus";

type Report = { available: boolean; html?: string; updated_at?: string };

/** Shows the model evaluation report ("report card") written by ml/evaluate_ml_model.py. */
export default function ModelReportDialog({ onClose }: { onClose: () => void }) {
  const dialog = useDialogFocus(true, onClose);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`${API_BASE}/model-report`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
        setReport(data);
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "The report could not be loaded."); });
    return () => controller.abort();
  }, []);

  const updated = report?.updated_at ? new Date(report.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={node => { dialog.current = node; }} role="dialog" aria-modal="true" aria-labelledby="model-report-title" tabIndex={-1} className="modal model-report-modal">
      <div className="modal-head">
        <div>
          <h2 id="model-report-title">Model report card</h2>
          <p>How the AI screening model performed on applicants it never saw during training.{updated && ` Last generated ${updated}.`}</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
      </div>
      <div className="model-report-body">
        {error ? <div className="model-report-message"><strong>Report unavailable</strong><span>{error}</span></div>
          : !report ? <div className="model-report-message"><LoaderCircle className="spin" size={22} /><span>Loading report…</span></div>
          : !report.available ? <div className="model-report-message"><strong>No report generated yet</strong><span>Run <code>python ml/evaluate_ml_model.py</code> in the project folder, then open this again.</span></div>
          : <iframe title="Model evaluation report" sandbox="" srcDoc={report.html} />}
      </div>
    </section>
  </div>;
}
