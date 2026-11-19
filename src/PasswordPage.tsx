import { useEffect, useState, type FormEvent } from "react";
import { db } from "./api";
import { passwordError } from "./password";
type Mode = "setup" | "reset" | "change" | "forgot";
export default function PasswordPage({
  mode,
  hasSession,
  onComplete,
}: {
  mode: Mode;
  hasSession: boolean;
  onComplete: () => void;
}) {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait === 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!db) {
      setError(
        "Live authentication is not configured. No email was sent and no password was changed.",
      );
      return;
    }
    setError("");
    setMessage("");
    if (mode !== "forgot") {
      const problem = passwordError(password, confirm);
      if (problem) {
        setError(problem);
        return;
      }
      if (!hasSession) {
        setError(
          "This link has expired or is invalid. Request a new password reset or invitation.",
        );
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists for that email, you will receive a password reset link. Check your inbox and spam folder.",
        );
        setWait(60);
      } else {
        if (mode === "change") {
          const { data, error } = await db.auth.getUser();
          if (error || !data.user?.email) throw Error("Please sign in again.");
          const verified = await db.auth.signInWithPassword({
            email: data.user.email,
            password: current,
          });
          if (verified.error)
            throw Error(
              "Current password is incorrect. Use Forgot password if needed.",
            );
        }
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        const completed = await db.rpc("complete_password_change");
        if (completed.error)
          throw Error(
            "Password was updated, but setup confirmation failed. Contact your administrator; do not keep retrying the old password.",
          );
        setPassword("");
        setConfirm("");
        setCurrent("");
        onComplete();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const title = {
    setup: "Set up your password",
    reset: "Reset your password",
    change: "Change your password",
    forgot: "Forgot password?",
  }[mode];
  return (
    <main className="password-page">
      <section className="password-card">
        <img
          src="/kuda-villingili-logo.png"
          alt="Kuda Villingili"
          width={70}
          height={70}
        />
        <div className="eyebrow">BUSINESS LENSE · ACCOUNT SECURITY</div>
        <h1>{title}</h1>
        <p>
          {mode === "setup"
            ? "Create your own password before entering BUSINESS LENSE. Never use a shared team password."
            : mode === "forgot"
              ? "Enter your invited account email to receive a private reset link."
              : "Choose a password with at least 6 characters. Letters, numbers and symbols are allowed without a required mixture."}
        </p>
        {!db && (
          <div className="notice">
            Authentication is not connected in this demo. These forms cannot
            create accounts, send messages or save passwords.
          </div>
        )}
        {mode !== "forgot" && !hasSession && db && (
          <div className="notice">
            Open a valid invitation or recovery email link, or sign in before
            changing your password.
          </div>
        )}
        <form onSubmit={submit}>
          <fieldset
            disabled={busy || !db || (mode !== "forgot" && !hasSession)}
          >
            {mode === "forgot" ? (
              <label>
                Email address
                <input
                  aria-label="Recovery email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            ) : (
              <>
                {mode === "change" && (
                  <label>
                    Current password
                    <input
                      aria-label="Current password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  New password
                  <input
                    aria-label="New password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    aria-label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                <small>
                  Minimum 6 characters. No required character mixture.
                </small>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <button className="button primary" disabled={busy || wait > 0}>
              {busy
                ? "Please wait…"
                : wait > 0
                  ? `Request again in ${wait}s`
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Save password"}
            </button>
          </fieldset>
        </form>
        {mode !== "forgot" && (
          <a className="text-button" href="/forgot-password">
            Request a new reset link
          </a>
        )}
        {mode !== "setup" && (
          <a className="text-button" href="/">
            Back to system
          </a>
        )}
        <p className="password-help">
          Need an invitation or access changed? Contact your Super Admin.
          Passwords are never displayed in Property Setup.
        </p>
      </section>
    </main>
  );
}
