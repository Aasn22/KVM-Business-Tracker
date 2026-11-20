import { useEffect, useState } from "react";
import { Clock3, History, Users } from "lucide-react";
import {
  activityEvent,
  activityKey,
  readActivity,
  type LocalActivity,
} from "./activity";
function when(at: string) {
  return `${new Date(at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`;
}
export function ActivityPanels({ rows }: { rows: LocalActivity[] }) {
  const visits = rows.filter((r) => r.kind !== "change"),
    changes = rows.filter((r) => r.kind === "change");
  return (
    <div className="activity-panels">
      <section className="panel activity-panel">
        <h2>
          <Users size={20} />
          Platform access
        </h2>
        <p>
          Visits recorded in this browser. Public visitors are anonymous; admin
          names are self-reported.
        </p>
        <ol>
          {visits.slice(0, 50).map((r) => (
            <li key={r.id}>
              <strong>{r.actor}</strong>
              <small>
                {r.kind === "admin-access"
                  ? "Admin access · self-reported"
                  : "Public visit"}
              </small>
              <time dateTime={r.at}>{when(r.at)}</time>
            </li>
          ))}
        </ol>
        {!visits.length && (
          <div className="empty">No visits recorded in this browser yet.</div>
        )}
      </section>
      <section className="panel activity-panel">
        <h2>
          <Clock3 size={20} />
          Updates by user
        </h2>
        <p>
          Who saved changes and when. Change details are omitted in this box.
        </p>
        <ol>
          {changes.slice(0, 50).map((r) => (
            <li key={r.id}>
              <strong>{r.actor}</strong>
              <small>Self-reported name · saved an update</small>
              <time dateTime={r.at}>{when(r.at)}</time>
            </li>
          ))}
        </ol>
        {!changes.length && (
          <div className="empty">No saved updates recorded yet.</div>
        )}
      </section>
      <section className="panel activity-panel">
        <h2>
          <History size={20} />
          Latest changes
        </h2>
        <p>
          What was updated, by whom and when. No previous/new financial values
          or private notes are logged.
        </p>
        <ol>
          {changes.slice(0, 50).map((r) => (
            <li key={r.id}>
              <strong>{r.summary}</strong>
              <span>{r.actor} · self-reported</span>
              <time dateTime={r.at}>{when(r.at)}</time>
            </li>
          ))}
        </ol>
        {!changes.length && (
          <div className="empty">No saved changes recorded yet.</div>
        )}
      </section>
    </div>
  );
}
export default function ActivityLog() {
  const [rows, setRows] = useState<LocalActivity[]>([]),
    [available, setAvailable] = useState(true);
  useEffect(() => {
    function refresh() {
      try {
        setRows(readActivity(localStorage));
        localStorage.getItem(activityKey);
        setAvailable(true);
      } catch {
        setAvailable(false);
      }
    }
    refresh();
    window.addEventListener(activityEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(activityEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return (
    <>
      <div className="notice activity-disclaimer">
        Browser-local activity only · Latest 200 records retained on this
        browser. Names are self-reported, not verified accounts. Other devices
        and earlier activity are not included; clearing browser data removes
        this history. Shared platform-wide logging requires shared storage.
      </div>
      {!available && (
        <p className="error" role="alert">
          Browser storage is unavailable. Activity cannot be retained here.
        </p>
      )}
      <ActivityPanels rows={rows} />
    </>
  );
}
