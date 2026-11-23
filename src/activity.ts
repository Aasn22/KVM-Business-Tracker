export type LocalActivity = {
  id: string;
  kind: "visit" | "admin-access" | "change";
  actor: string;
  at: string;
  summary: string;
};
export const activityKey = "kvm-browser-activity-v1";
export const activityEvent = "kvm-activity-updated";
export function cleanActor(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name))
    throw Error("Enter your name (1–80 characters).");
  return name;
}
export function readActivity(
  storage: Pick<Storage, "getItem">,
): LocalActivity[] {
  try {
    const rows = JSON.parse(storage.getItem(activityKey) ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        (r) =>
          r &&
          ["visit", "admin-access", "change"].includes(r.kind) &&
          typeof r.actor === "string" &&
          r.actor.length <= 80 &&
          typeof r.id === "string" &&
          Number.isFinite(Date.parse(r.at)) &&
          typeof r.summary === "string" &&
          r.summary.length <= 240,
      )
      .slice(0, 200);
  } catch {
    return [];
  }
}
export function appendActivity(
  event: Omit<LocalActivity, "id" | "at">,
  storage: Pick<Storage, "getItem" | "setItem">,
  now = new Date().toISOString(),
): LocalActivity {
  const next = {
    ...event,
    actor: cleanActor(event.actor),
    summary: event.summary.slice(0, 240),
    id: crypto.randomUUID(),
    at: now,
  };
  storage.setItem(
    activityKey,
    JSON.stringify([next, ...readActivity(storage)].slice(0, 200)),
  );
  return next;
}
export function recordActivity(
  kind: LocalActivity["kind"],
  actor: string,
  summary: string,
): boolean {
  try {
    appendActivity({ kind, actor, summary }, localStorage);
    window.dispatchEvent(new Event(activityEvent));
    return true;
  } catch {
    return false;
  }
}
// One visit per full document, independent of React StrictMode's effect probe.
let visitRecorded = false;
export function recordPlatformVisit() {
  if (visitRecorded) return;
  visitRecorded = true;
  recordActivity("visit", "Anonymous visitor", "Platform opened");
}
