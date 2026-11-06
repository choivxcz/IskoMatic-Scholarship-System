import { ReactNode } from "react";
import { useCountUp } from "../motion";

/** Shows numbers counting up when data arrives; other values render as-is. */
export default function CountUp({ value, loading, placeholder = "…" }: { value: ReactNode; loading?: boolean; placeholder?: ReactNode }) {
  const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
  const shown = useCountUp(numeric ?? null, 750);
  if (loading) return <span className="count-placeholder">{placeholder}</span>;
  if (numeric === null) return <>{value ?? "—"}</>;
  return <span className="count-up">{(shown as number).toLocaleString()}</span>;
}
