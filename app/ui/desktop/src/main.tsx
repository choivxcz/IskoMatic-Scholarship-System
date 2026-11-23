import { initializeTheme } from "./theme";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthScreen, { AuthView } from "./LoginPage";
import OfficialLogos from "./components/OfficialLogos";
import { API_BASE, StaffUser, authRequest, getToken, setToken } from "./api";
import { installInteractions, prefersReducedMotion } from "./motion";
import "./styles.css";
import "./applicants.css";
import "./applications.css";
import "./screening.css";
import "./interviews.css";
import "./overview.css";
import "./screening-reference.css";
import "./municipal-theme.css";
import "./screening-match.css";
import "./styles/tokens.css";
import "./workspace-polish.css";
import "./styles/components.css";
import "./settings.css";
import "./tracking.css";
import "./ai-explanation.css";
import "./auth.css";
import "./motion.css";
import "./dark-icons.css";

initializeTheme();
installInteractions();
document.documentElement.dataset.density = localStorage.getItem("iskolar-density") === "compact" ? "compact" : "comfortable";

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

/** Ask the bridge who owns the saved token, retrying while the bridge starts up. */
async function restoreSession(): Promise<StaffUser | null> {
  if (!getToken()) return null;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const { user } = await authRequest<{ user: StaffUser }>("/auth/me");
      return user;
    } catch (error) {
      if (!getToken()) return null; // the bridge rejected the token (401)
      try { await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1500) }); return null; } catch { /* still starting */ }
      await wait(600);
    }
  }
  return null;
}

function Root() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [checking, setChecking] = useState(() => Boolean(getToken()));
  const [view, setView] = useState<AuthView>(() => new URLSearchParams(window.location.search).get("view") === "register" ? "register" : "login");
  const [notice, setNotice] = useState("");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!checking) return;
    restoreSession().then(found => { setUser(found); setChecking(false); });
  }, [checking]);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setView("login");
      setNotice("Your session ended. Please sign in again.");
    };
    window.addEventListener("iskolar-session-expired", expired);
    return () => window.removeEventListener("iskolar-session-expired", expired);
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    const response = await authRequest<{ token: string; user: StaffUser }>("/auth/login", { username, password, remember });
    setToken(response.token, remember);
    setNotice("");
    // Let the "Signed in" state and exit animation play before the workspace appears.
    setLeaving(true);
    await wait(prefersReducedMotion() ? 0 : 520);
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
    document.title = "IskoMatic | Scholarship Management";
    setUser(response.user);
    setLeaving(false);
  }, []);

  const logout = useCallback(async () => {
    try { await authRequest("/auth/logout", {}); } catch { /* sign out locally anyway */ }
    setToken(null);
    setView("login");
    setNotice("You have been signed out.");
    setUser(null);
  }, []);

  if (checking) return <div className="app-splash" role="status" aria-label="Restoring your session"><OfficialLogos /><strong>IskoMatic</strong><span className="app-splash-bar"><i /></span></div>;
  if (user) return <div className="workspace-enter"><App user={user} onLogout={logout} /></div>;
  return <AuthScreen view={view} onView={next => { setNotice(""); setView(next); }} onLogin={login} notice={notice} leaving={leaving} />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Root /></React.StrictMode>);
