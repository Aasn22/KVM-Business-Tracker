import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
export function calendarDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  return [
    ...Array(first).fill(null),
    ...Array.from(
      { length: new Date(year, month + 1, 0).getDate() },
      (_, i) => i + 1,
    ),
  ] as (number | null)[];
}
export default function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(() =>
    value ? new Date(value + "T12:00:00") : new Date(),
  );
  const box = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const y = shown.getFullYear(),
    m = shown.getMonth();
  return (
    <span className="calendar-control calendar-only" ref={box}>
      <button
        ref={trigger}
        type="button"
        className="calendar-open"
        aria-label={`Open calendar for ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (!open && value) setShown(new Date(value + "T12:00:00"));
          setOpen(!open);
        }}
      >
        <CalendarDays size={20} />
      </button>
      {value && (
        <span className="calendar-selected" aria-live="polite">
          {new Date(value + "T12:00:00").toLocaleDateString("en-GB")}
        </span>
      )}
      {open && (
        <span
          id={id}
          className="calendar-popover"
          role="dialog"
          aria-label={`${label} calendar`}
        >
          <span className="calendar-month">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setShown(new Date(y, m - 1, 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              <select
                aria-label={`${label} month`}
                value={m}
                onChange={(e) =>
                  setShown(new Date(y, Number(e.target.value), 1))
                }
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2026, i, 1).toLocaleString("en-GB", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${label} year`}
                value={y}
                onChange={(e) =>
                  setShown(new Date(Number(e.target.value), m, 1))
                }
              >
                {Array.from(
                  new Set([
                    ...Array.from({ length: 41 }, (_, i) => 2020 + i),
                    y,
                  ]),
                )
                  .sort((a, b) => a - b)
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setShown(new Date(y, m + 1, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </span>
          <span className="calendar-grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <small key={d}>{d}</small>
            ))}
            {calendarDays(y, m).map((d, i) =>
              d === null ? (
                <span key={`empty-${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  aria-label={`${d} ${new Date(y, m, 1).toLocaleString("en-GB", { month: "long" })} ${y}`}
                  aria-pressed={
                    value ===
                    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                  }
                  onClick={() => {
                    onChange(
                      `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
                    );
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  {d}
                </button>
              ),
            )}
          </span>
          <button
            type="button"
            className="calendar-clear"
            onClick={() => {
              onChange("");
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Clear date
          </button>
        </span>
      )}
    </span>
  );
}
