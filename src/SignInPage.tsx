import { useState, type FormEvent } from "react";
import { db } from "./api";
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!db) return;
    setBusy(true);
    setError("");
    try {
      const result = await db.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error) throw result.error;
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
        <div className="eyebrow">BUSINESS EYE</div>
        <h1>Welcome back.</h1>
        <p>
          Sign in to access your permitted markets. First-time users must set
          their own password through a private setup link or
          administrator-assisted reset.
        </p>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              aria-label="Sign-in email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              aria-label="Sign-in password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy || !db}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <a className="text-button" href="/forgot-password">
          Forgot password?
        </a>
        <p className="password-help">
          No public registration. Contact your Super Admin for access. Usernames
          alone never authorize password setup.
        </p>
      </section>
    </main>
  );
}
