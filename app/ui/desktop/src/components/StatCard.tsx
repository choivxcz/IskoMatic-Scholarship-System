import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import CountUp from "./CountUp";

export default function StatCard({ label, value, note, icon: Icon, tone = "blue", loading }: {
  label: string; value: ReactNode; note: string; icon: LucideIcon; tone?: string; loading: boolean;
}) {
  return <div className="metric-summary-card" aria-busy={loading}>
    <span className={`metric-summary-icon ${tone}`}><Icon size={19} aria-hidden="true" /></span>
    <span className="metric-summary-label">{label}</span>
    <strong className="metric-summary-value"><CountUp value={value} loading={loading} /></strong>
    <small className="metric-summary-note">{note}</small>
  </div>;
}
