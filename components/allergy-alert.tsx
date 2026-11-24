import { AlertTriangle, ShieldAlert } from "lucide-react";
import { allergyText, type AllergyNote } from "@/lib/profiles";
export function AllergyAlert({
  note,
  label = "Order allergy note",
  changed = false,
}: {
  note?: AllergyNote;
  label?: string;
  changed?: boolean;
}) {
  const declared = note?.declaration === "Allergies declared";
  return (
    <aside
      className={`allergy-alert ${declared || changed ? "allergy-critical" : ""}`}
      role={declared || changed ? "alert" : "note"}
    >
      <div>
        {declared ? <ShieldAlert size={20} /> : <AlertTriangle size={18} />}
        <strong>
          {label}
          {changed ? " · UPDATED AFTER ORDER" : ""}
        </strong>
      </div>
      <p>{allergyText(note)}</p>
      {note?.updatedAt ? (
        <small>
          Profile revision {note.revision} ·{" "}
          {new Date(note.updatedAt).toLocaleString()}
        </small>
      ) : null}
    </aside>
  );
}
