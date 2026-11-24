import { useState } from "react";
import { historyInputValue } from "./historyPaste";
import type { HistoryField } from "./history";
import { formatMoney, formatNumber } from "./format";
export default function HistoryValueInput({
  value,
  field,
  label,
  onChange,
  onPaste,
  onError,
}: {
  value: number | null;
  field: HistoryField;
  label: string;
  onChange: (n: number | null) => void;
  onPaste: (text: string) => void;
  onError: (s: string) => void;
}) {
  const [editing, setEditing] = useState(false),
    [text, setText] = useState("");
  const show =
    value === null
      ? ""
      : field.endsWith("Nights")
        ? formatNumber(value)
        : formatMoney(value);
  return (
    <input
      type="text"
      inputMode={field.endsWith("Nights") ? "numeric" : "decimal"}
      aria-label={label}
      value={editing ? text : show}
      onFocus={() => {
        setText(value === null ? "" : String(value));
        setEditing(true);
      }}
      onBlur={() => {
        setEditing(false);
        try {
          historyInputValue(text, field);
          onError("");
        } catch {
          onError(
            "Invalid value was not applied. Correct the input or paste a valid number.",
          );
        }
      }}
      onChange={(e) => {
        const s = e.target.value;
        setText(s);
        try {
          const n = historyInputValue(s, field);
          onChange(n);
          onError("");
        } catch (err) {
          onError((err as Error).message);
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        onPaste(e.clipboardData.getData("text/plain"));
        setEditing(false);
        e.currentTarget.blur();
      }}
    />
  );
}
