export type Appearance = "light" | "system" | "dark";
export function readAppearance(): Appearance {
  const value = localStorage.getItem("iskolar-theme");
  return value === "light" || value === "dark" ? value : "system";
}
export function applyAppearance(appearance: Appearance) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = appearance === "system" ? (dark ? "dark" : "light") : appearance;
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
export function initializeTheme() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const preview = document.documentElement.dataset.appearance;
    applyAppearance(preview === "light" || preview === "dark" || preview === "system" ? preview : readAppearance());
  };
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("iskolar-theme-change", apply);
  window.addEventListener("storage", () => applyAppearance(readAppearance()));
}
