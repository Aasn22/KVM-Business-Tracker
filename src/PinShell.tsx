import { useEffect, useState, type FormEvent, type ReactNode } from "react";
export default function PinShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/pin-session", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) setError(data.message);
        setUnlocked(res.ok && data.authenticated === true);
      })
      .catch(() => {
        if (active) setError("Unable to check PIN access. Please retry.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    // Reload at session expiry; never persist an unlock flag in browser storage.
    const timer = setTimeout(
      () => window.location.reload(),
      4 * 60 * 60 * 1000,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pin-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated)
        throw Error(data.message || "Unable to unlock.");
      setPin("");
      setUnlocked(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (unlocked)
    return (
      <>
        <div className="mode-banner">
          <span>
            Local workspace · Changes stay in this browser, not shared online.
          </span>
          <button
            onClick={async () => {
              const res = await fetch("/api/pin-session", { method: "DELETE" });
              if (res.ok) window.location.reload();
              else setError("Unable to lock. Close this browser session.");
            }}
          >
            Lock workspace
          </button>
          {error && <span role="alert">{error}</span>}
        </div>
        {children}
      </>
    );
  return (
    <main className="password-page">
      <section className="password-card">
        <img
          src="/kuda-villingili-logo.png"
          alt="Kuda Villingili"
          width={70}
          height={70}
        />
        <div className="eyebrow">BUSINESS EYE</div>
        <h1>Enter your PIN</h1>
        <p>
          No username, password or email link. Unlock budget entry and property
          settings on this browser.
        </p>
        <form onSubmit={submit}>
          <label>
            PIN
            <input
              aria-label="Access PIN"
              type="password"
              autoComplete="off"
              maxLength={128}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={!ready || busy}>
            {!ready
              ? "Checking access…"
              : busy
                ? "Unlocking…"
                : "Enter workspace"}
          </button>
        </form>
        <p className="password-help">
          Browser-local editing only. Clearing browser data removes local edits.
          This PIN is a convenience gate, not encryption of local data.
          Published budgets remain publicly viewable.
        </p>
        <a href="/">View published dashboard</a>
      </section>
    </main>
  );
}
