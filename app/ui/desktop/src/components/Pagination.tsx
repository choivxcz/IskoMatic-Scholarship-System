import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange, label = "records" }: {
  total: number; page: number; pageSize: number; onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void; label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(page, pages));
  const numbers = [...new Set([1, current - 1, current, current + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  return <nav className="record-pagination" aria-label={`${label} pagination`}>
    <span>Showing {total ? (current - 1) * pageSize + 1 : 0}–{Math.min(current * pageSize, total)} of {total} {label}</span>
    <div className="record-pagination-controls">
      {onPageSizeChange && <label>Rows per page <select aria-label={`${label} per page`} value={pageSize} onChange={event => { onPageSizeChange(Number(event.target.value)); onPageChange(1); }}>{[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>}
      <button type="button" aria-label={`Previous ${label} page`} disabled={current === 1} onClick={() => onPageChange(current - 1)}><ChevronLeft size={16} /></button>
      {numbers.map((n, i) => <span className="record-page-number" key={n}>{i > 0 && n - numbers[i - 1] > 1 && <span className="record-page-gap" aria-hidden="true">…</span>}<button type="button" aria-label={`Page ${n}`} aria-current={n === current ? "page" : undefined} onClick={() => onPageChange(n)}>{n}</button></span>)}
      <button type="button" aria-label={`Next ${label} page`} disabled={current === pages} onClick={() => onPageChange(current + 1)}><ChevronRight size={16} /></button>
    </div>
  </nav>;
}
