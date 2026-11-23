/**
 * Lagos time (WAT, UTC+1, no DST) helpers. Safe for client and server; the
 * server on Render runs in UTC so never rely on the process timezone.
 */
export const WAT_OFFSET = "+01:00";

/** "2026-11-29" + "14:30" (typed in Lagos) → Date. */
export function watToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${WAT_OFFSET}`);
}

/** "Sat 29 Nov, 2:30pm" in Lagos time. */
export function watLabel(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")}${get("dayPeriod").toLowerCase()}`;
}
