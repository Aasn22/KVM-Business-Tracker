import { useEffect, useState, type FormEvent } from "react";
import { db } from "./api";
import { magicLinkMessage, requestMagicLink } from "./magicLink";
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);
    try {
      await requestMagicLink(email, window.location.origin);
      setSent(true);
      setWait(60);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="password-page">
      <section className="password-card">
        <img
          src="/kuda-villingili-logo.png"
          alt="Kuda Villingili"
          width={70}
          height={70}
        />
        <div className="eyebrow">BUSINESS LENSE</div>
        <h1>Sign in without a password.</h1>
        <p>
          Enter your account email. We’ll send a private, one-time link to open
          BUSINESS LENSE. No password is needed.
        </p>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              aria-label="Sign-in email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {sent && (
            <p className="notice" role="status">
              {magicLinkMessage}
            </p>
          )}
          <button className="button primary" disabled={busy || wait > 0 || !db}>
            {busy
              ? "Sending…"
              : wait > 0
                ? `Send again in ${wait}s`
                : "Email me a sign-in link"}
          </button>
        </form>
        {!db && (
          <p className="notice">
            Authentication is not configured. No message can be sent from this
            demo.
          </p>
        )}
        <p className="password-help">
          Existing accounts only. No public registration. Your current role and
          market permissions still apply. Never share your sign-in link.
        </p>
      </section>
    </main>
  );
}
