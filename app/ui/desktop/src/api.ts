export const API_BASE = "http://127.0.0.1:8765/api";

const TOKEN_KEY = "iskolar-session";

export type StaffUser = {
  user_id: number;
  username: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  position: string;
  role: "ADMIN" | "LYDO_OFFICIAL";
  status: string;
  reason?: string | null;
  created_at?: string;
  last_login_at?: string;
};

/** "Remember this device" keeps the token in localStorage; otherwise it lasts for this window only. */
export function getToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null, remember = false) {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch { /* storage unavailable: the session simply won't persist */ }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("iskolar-session-expired"));
  }
  return response;
}

/** JSON helper for the auth screens. Throws the server's error message. */
export async function authRequest<T = any>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(`${API_BASE}${path}`, body === undefined ? undefined : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the Iskolar backend. Make sure the Python bridge is running, then try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data as T;
}
