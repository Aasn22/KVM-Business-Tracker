import { useRef } from "react";
import { CalendarDays } from "lucide-react";
export default function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function open() {
    const input = ref.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.focus();
    } catch {
      input.focus();
    }
  }
  return (
    <span className="calendar-control">
      <input
        ref={ref}
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="calendar-open"
        aria-label={`Open calendar for ${label}`}
        onClick={open}
      >
        <CalendarDays size={19} />
      </button>
    </span>
  );
}
