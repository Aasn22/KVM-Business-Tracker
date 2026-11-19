import { useEffect, useState, type ReactNode } from "react";
export const entranceDuration = 3600;
export default function Entrance({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setTimeout(
      () => setVisible(false),
      media.matches ? 700 : entranceDuration,
    );
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible]);
  return (
    <>
      <div inert={visible} aria-hidden={visible || undefined}>
        {children}
      </div>
      {visible && (
        <section
          className="entrance-screen"
          aria-label="Welcome to Kuda Villingili"
        >
          <div className="entrance-halo" aria-hidden="true" />
          <div className="entrance-brand">
            <img
              className="entrance-logo"
              src="/kuda-villingili-logo.png"
              alt="Kuda Villingili"
              width="840"
              height="840"
              fetchPriority="high"
            />
            <p>BUSINESS EYE</p>
            <span className="entrance-rule" aria-hidden="true" />
          </div>
          <button
            className="entrance-skip"
            autoFocus
            onClick={() => setVisible(false)}
          >
            Enter workspace <span aria-hidden="true">→</span>
          </button>
        </section>
      )}
    </>
  );
}
