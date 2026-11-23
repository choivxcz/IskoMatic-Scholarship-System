export function dateOptions(): Intl.DateTimeFormatOptions {
  const format = localStorage.getItem("iskolar-date-format") || "long";
  return { day: "2-digit", month: format === "long" ? "short" : "2-digit", year: "numeric", timeZone: displayTimeZone() };
}
export function dateLocale() {
  return localStorage.getItem("iskolar-date-format") === "mdy" ? "en-US" : localStorage.getItem("iskolar-date-format") === "iso" ? "sv-SE" : "en-GB";
}
export function displayTimeZone() {
  const value = localStorage.getItem("iskolar-timezone");
  return value === "UTC" ? "UTC" : value === "system" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Manila";
}
export function timeZoneLabel() { return displayTimeZone() === "Asia/Manila" ? "PHT" : displayTimeZone(); }
