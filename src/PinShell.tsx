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
    <main className="admin-pin-page">
      <section
        className="admin-pin-entry"
        aria-label="Administrator PIN access"
      >
        <img
          className="admin-pin-logo"
          src="/kuda-villingili-logo.png"
          alt="Kuda Villingili"
          width={100}
          height={100}
        />
        <form className="admin-pin-box" onSubmit={submit}>
          <label htmlFor="admin-access-pin">PIN</label>
          <input
            id="admin-access-pin"
            aria-label="Access PIN"
            type="password"
            autoComplete="off"
            placeholder="Enter access PIN"
            maxLength={128}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {error && (
            <p className="admin-pin-error" role="alert">
              {error}
            </p>
          )}
          <button disabled={!ready || busy}>
            {!ready ? "CHECKING ACCESS…" : busy ? "UNLOCKING…" : "UNLOCK"}
          </button>
          <p className="admin-pin-restriction">
            Restricted access only for admins.
          </p>
        </form>
      </section>
    </main>
  );
}
