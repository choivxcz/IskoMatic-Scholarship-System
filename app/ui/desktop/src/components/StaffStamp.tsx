import { dateLocale, dateOptions } from "../datePreferences";

export type Stamp = { name?: string | null; username?: string | null; role?: string | null; at?: string | null } | null | undefined;

export const roleLabel = (role?: string | null) => role === "ADMIN" ? "Administrator" : role === "LYDO_OFFICIAL" ? "LYDO Official" : "Staff";
export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();

/** "Who did this step": avatar, name, role and date, or "Not recorded" for older records. */
export default function StaffStamp({ stamp, showDate = true, emptyText = "Not recorded" }: { stamp: Stamp; showDate?: boolean; emptyText?: string }) {
  if (!stamp?.name) {
    return <span className="staff-stamp empty" title="No signed-in staff action was recorded for this step (older records were created before sign-in existed).">{emptyText}</span>;
  }
  const when = stamp.at ? new Date(String(stamp.at)) : null;
  const date = when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString(dateLocale(), dateOptions()) : "";
  return <span className="staff-stamp" title={`${stamp.name}${stamp.username ? ` (@${stamp.username})` : ""} · ${roleLabel(stamp.role)}`}>
    <span className={`staff-stamp-avatar ${stamp.role === "ADMIN" ? "admin" : ""}`}>{initialsOf(stamp.name)}</span>
    <span className="staff-stamp-text"><strong>{stamp.name}</strong><small>{roleLabel(stamp.role)}{showDate && date ? ` · ${date}` : ""}</small></span>
  </span>;
}
