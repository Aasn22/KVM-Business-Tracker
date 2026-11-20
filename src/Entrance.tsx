import { useEffect, useState, type ReactNode } from "react";
export const entranceDuration = 2400;
export function ConfidentialityNotice({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="entrance-notice">
      <svg
        className="entrance-notice-icon"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M24 5 40 12v12c0 10-16 19-16 19S8 34 8 24V12L24 5Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="17"
          y="21"
          width="14"
          height="11"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M20 21v-4a4 4 0 0 1 8 0v4"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <p className="entrance-notice-eyebrow">KVM BUSINESS LENSE</p>
      <h1>Private &amp; Confidential</h1>
      <span className="entrance-rule" aria-hidden="true" />
      <p>
        Information on this platform is confidential and intended for authorized
        business use only. Please do not copy, distribute or share it without
        permission.
      </p>
      <button className="entrance-continue" autoFocus onClick={onContinue}>
        Continue to platform <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
export default function Entrance({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<"logo" | "notice" | "done">("logo");
  const visible = stage !== "done";
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setTimeout(
      () => setStage("notice"),
      media.matches ? 700 : entranceDuration,
    );
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
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
          aria-label={
            stage === "logo"
              ? "Welcome to Kuda Villingili"
              : "Confidentiality notice"
          }
        >
          <div className="entrance-halo" aria-hidden="true" />
          {stage === "logo" ? (
            <div className="entrance-brand">
              <img
                className="entrance-logo"
                src="/kuda-villingili-logo.png"
                alt="Kuda Villingili"
                width="840"
                height="840"
                fetchPriority="high"
              />
              <p>KVM BUSINESS LENSE</p>
              <span className="entrance-rule" aria-hidden="true" />
            </div>
          ) : (
            <ConfidentialityNotice onContinue={() => setStage("done")} />
          )}
        </section>
      )}
    </>
  );
}

// The report route owns its single branded welcome; do not stack confidentiality before it.
export function RouteEntrance({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  return pathname === "/reports" ? (
    <>{children}</>
  ) : (
    <Entrance>{children}</Entrance>
  );
}
