import { useEffect, useRef, useState } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Keeps the last value mounted for `ms` after it becomes empty, so a closing
 * animation can play. Returns the value to render and whether it is closing.
 */
export function usePresence<T>(value: T | null | undefined | false, ms = 200): [T | null, boolean] {
  const [shown, setShown] = useState<T | null>(value || null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (value) {
      setShown(value);
      setClosing(false);
      return;
    }
    if (!shown) return;
    if (prefersReducedMotion()) { setShown(null); return; }
    setClosing(true);
    const id = window.setTimeout(() => { setShown(null); setClosing(false); }, ms);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return [value || shown, closing && !value];
}

/** Animates a number from its previous value to `target`. Non-numbers pass through. */
export function useCountUp<T>(target: T, ms = 700): T | number {
  const numeric = typeof target === "number" && Number.isFinite(target);
  const [display, setDisplay] = useState<number>(numeric ? 0 : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!numeric) return;
    const end = target as number;
    if (prefersReducedMotion()) { setDisplay(end); from.current = end; return; }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = start + (end - start) * eased;
      setDisplay(Number.isInteger(end) ? Math.round(value) : Math.round(value * 100) / 100);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = end;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); from.current = end; };
  }, [target, numeric, ms]);
  return numeric ? display : target;
}

/** Returns a class that plays a short "no" shake, and a function to replay it. */
export function useShake(): [string, () => void] {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setActive(false), 480);
    return () => window.clearTimeout(id);
  }, [active]);
  return [active ? "shake" : "", () => { setActive(false); requestAnimationFrame(() => setActive(true)); }];
}

const RIPPLE_TARGETS = [
  "button", "a.primary-button", ".nav-item", "[role=tab]", "summary",
].join(",");

const GLOW_TARGETS = [
  ".panel", ".reference-panel", ".reference-summary-card", ".stat-card", ".metric-summary-card",
  ".screening-reference-metric", ".screening-reference-records", ".interview-table-card",
  ".auth-benefits > p",
].join(",");

/**
 * Global micro-interactions that apply to every page without touching each
 * component: a press ripple on buttons and a soft cursor glow on cards.
 */
export function installInteractions() {
  if ((window as any).__iskolarInteractions) return;
  (window as any).__iskolarInteractions = true;

  document.addEventListener("pointerdown", event => {
    if (prefersReducedMotion() || event.button !== 0) return;
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(RIPPLE_TARGETS);
    if (!target || (target as HTMLButtonElement).disabled || target.closest("[data-no-ripple]")) return;
    const rect = target.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    if (getComputedStyle(target).position === "static") target.style.position = "relative";
    const host = document.createElement("span");
    host.className = "ripple-host";
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 2.2;
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    host.appendChild(ripple);
    target.appendChild(host);
    window.setTimeout(() => host.remove(), 650);
  }, { passive: true });

  let glowing: HTMLElement | null = null;
  document.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse") return;
    const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(GLOW_TARGETS) || null;
    if (glowing && glowing !== card) glowing.classList.remove("is-glowing");
    glowing = card;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
    card.classList.add("is-glowing");
  }, { passive: true });

  document.addEventListener("pointerleave", () => { glowing?.classList.remove("is-glowing"); glowing = null; });
}
