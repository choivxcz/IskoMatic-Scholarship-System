import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, RefreshCw, ShieldCheck, UserRoundCheck, UserRoundX, X } from "lucide-react";
import { API_BASE, StaffUser, apiFetch } from "./api";

const roleLabel = (role: string) => role === "ADMIN" ? "Administrator" : "LYDO Official";
const statusLabel = (status: string) => status[0] + status.slice(1).toLowerCase();
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

async function call<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(`${API_BASE}${path}`, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

/** Your account card, plus the approval queue for administrators. */
export default function StaffAccessPanel({ user, onToast }: { user: StaffUser; onToast: (message: string) => void }) {
  const admin = user.role === "ADMIN";
  const [accounts, setAccounts] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(admin);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [roles, setRoles] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true); setError("");
    try { setAccounts((await call<{ items: StaffUser[] }>("/auth/accounts")).items); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Staff accounts could not be loaded."); }
    finally { setLoading(false); }
  }, [admin]);
  useEffect(() => { void load(); }, [load]);

  async function review(account: StaffUser, action: "approve" | "reject" | "disable") {
    setBusyId(account.user_id);
    try {
      const { account: updated } = await call<{ account: StaffUser }>(`/auth/accounts/${account.user_id}/${action}`, { role: roles[account.user_id] || "LYDO_OFFICIAL" });
      setAccounts(list => list.map(item => item.user_id === updated.user_id ? { ...item, ...updated } : item));
      onToast(action === "approve" ? `${account.display_name} can now sign in as ${roleLabel(updated.role)}.` : `${account.display_name}'s access was ${action === "reject" ? "rejected" : "disabled"}.`);
    } catch (failure) {
      onToast(failure instanceof Error ? failure.message : "The account could not be updated.");
    } finally { setBusyId(null); }
  }

  const pending = accounts.filter(account => account.status === "PENDING");
  const visible = filter === "PENDING" ? pending : accounts;

  return <section className="panel preferences-panel staff-access-panel">
    <header><h2>Your account</h2><p>Signed-in actions are recorded under this identity.</p></header>
    <div className="staff-me">
      <span className="account-initials large">{initials(user.display_name)}</span>
      <div><strong>{user.display_name}</strong><small>@{user.username} · {user.email}</small><small>{user.position} · {user.department}</small></div>
      <span className={`staff-role ${user.role === "ADMIN" ? "admin" : ""}`}><ShieldCheck size={13} />{roleLabel(user.role)}</span>
    </div>

    {admin && <>
      <div className="staff-access-head">
        <div><h2>Staff access requests</h2><p>Approve new staff and choose their role. Rejected or disabled accounts are signed out immediately.</p></div>
        <div className="staff-access-tools">
          <div className="preference-segments compact-segments" role="tablist">
            {(["PENDING", "ALL"] as const).map(value => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "PENDING" ? `Pending${pending.length ? ` (${pending.length})` : ""}` : "All accounts"}</button>)}
          </div>
          <button className="icon-button" onClick={load} aria-label="Refresh staff accounts" title="Refresh"><RefreshCw size={15} className={loading ? "spin" : ""} /></button>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading && !accounts.length ? <div className="staff-empty"><LoaderCircle size={18} className="spin" />Loading staff accounts…</div>
        : !visible.length ? <div className="staff-empty"><UserRoundCheck size={20} />{filter === "PENDING" ? "No requests waiting for review." : "No staff accounts yet."}</div>
        : <ul className="staff-list">{visible.map(account => {
          const self = account.user_id === user.user_id;
          const busy = busyId === account.user_id;
          return <li key={account.user_id} className={`staff-item status-${account.status.toLowerCase()}`}>
            <span className="account-initials">{initials(account.display_name)}</span>
            <div className="staff-info">
              <strong>{account.display_name}{self && <em> (you)</em>}</strong>
              <small>@{account.username} · {account.email}</small>
              <small>{account.position} · {account.department}</small>
              {account.reason && <p>“{account.reason}”</p>}
            </div>
            <div className="staff-actions">
              <span className={`staff-status ${account.status.toLowerCase()}`}>{statusLabel(account.status)}{account.status === "APPROVED" ? ` · ${roleLabel(account.role)}` : ""}</span>
              {!self && account.status !== "APPROVED" && <>
                <select aria-label={`Role for ${account.display_name}`} value={roles[account.user_id] || account.role || "LYDO_OFFICIAL"} onChange={event => setRoles(current => ({ ...current, [account.user_id]: event.target.value }))} disabled={busy}>
                  <option value="LYDO_OFFICIAL">LYDO Official</option>
                  <option value="ADMIN">Administrator</option>
                </select>
                <button className="primary-button" disabled={busy} onClick={() => review(account, "approve")}>{busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Approve</button>
                {account.status === "PENDING" && <button className="button-secondary danger" disabled={busy} onClick={() => review(account, "reject")}><X size={14} />Reject</button>}
              </>}
              {!self && account.status === "APPROVED" && <button className="button-secondary danger" disabled={busy} onClick={() => review(account, "disable")}><UserRoundX size={14} />Disable</button>}
            </div>
          </li>;
        })}</ul>}
    </>}
  </section>;
}
