export const number = (n: number) =>
  n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
export const date = (
  v: string | number,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) =>
  new Date(
    typeof v === "string" && v.length === 10 ? `${v}T12:00:00Z` : v,
  ).toLocaleString("it-IT", { timeZone: "Europe/Rome", ...options });
