import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { db } from "./api";
import { isPasswordRoute, passwordMode } from "./password";
import PasswordPage from "./PasswordPage";
export default function AuthShell({ children }: { children: ReactNode }) {
  const initial = window.location.pathname;
  const [path, setPath] = useState(initial);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!db);
  const [checking, setChecking] = useState(false);
  const [required, setRequired] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const verifiedUser = useRef<string | null>(null);
  const callbackAttempt = useRef<ReturnType<
    NonNullable<typeof db>["auth"]["verifyOtp"]
  > | null>(null);
  useEffect(() => {
    if (!db) return;
    let active = true;
    let checkId = 0;
    async function check(s: Session | null) {
      const id = ++checkId;
      if (!active) return;
      setSession(s);
      setError("");
      setRequired(false);
      setReady(true);
      if (!s) {
        verifiedUser.current = null;
        setChecking(false);
        return;
      }
      // Token refresh/focus events must not unmount an app with unsaved forms.
      if (verifiedUser.current === s.user.id) {
        setChecking(false);
        return;
      }
      setChecking(true);
      try {
        const result = await db!.rpc("password_setup_required");
        if (result.error)
          throw Error(
            "Unable to verify first-login password setup. Contact your administrator to apply the password setup migration.",
          );
        if (active && id === checkId) {
          setRequired(result.data === true);
          if (result.data === false) verifiedUser.current = s.user.id;
        }
      } catch (e) {
        if (active && id === checkId) setError((e as Error).message);
      } finally {
        if (active && id === checkId) setChecking(false);
      }
    }
    const { data } = db.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setPath("/reset-password");
        window.history.replaceState(null, "", "/reset-password");
      }
      queueMicrotask(() => void check(s));
    });
    async function initialize() {
      const url = new URL(window.location.href);
      const type = url.searchParams.get("type");
      const hash = url.searchParams.get("token_hash");
      if (hash) {
        if (!["invite", "recovery"].includes(type ?? "")) {
          window.history.replaceState(null, "", initial);
          setError(
            "Unsupported email link. Request a new invitation or reset.",
          );
          setReady(true);
          return;
        }
        const dest = type === "invite" ? "/setup-password" : "/reset-password";
        setPath(dest);
        // StrictMode may run the effect twice: never redeem a one-use token twice.
        callbackAttempt.current ??= db!.auth.verifyOtp({
          token_hash: hash,
          type: type as "invite" | "recovery",
        });
        const result = await callbackAttempt.current;
        if (!active) return;
        if (!result.error && type === "recovery") setRecovery(true);
        window.history.replaceState(null, "", dest);
        if (result.error) {
          if (active) {
            setError(
              "Invitation or reset link is invalid or expired. Request a new link.",
            );
            setReady(true);
          }
          return;
        }
        await check(result.data.session);
      } else {
        const result = await db!.auth.getSession();
        if (result.error) {
          if (active) {
            setReady(true);
            setError(
              "Unable to validate session. Request a new invitation or reset link.",
            );
          }
          return;
        }
        await check(result.data.session);
      }
    }
    void initialize().catch(() => {
      if (active) {
        setError(
          "Unable to process sign-in link. Request a new invitation or reset.",
        );
        setReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (!ready || checking)
    return (
      <main className="password-page">
        <section className="password-card" role="status">
          Checking account security…
        </section>
      </main>
    );
  if (error)
    return (
      <main className="password-page">
        <section className="password-card">
          <h1>Account setup needs attention</h1>
          <p role="alert">{error}</p>
          <a className="button outline" href="/forgot-password">
            Request password recovery
          </a>
          <p>Ask your administrator to confirm authentication configuration.</p>
        </section>
      </main>
    );
  const route = required ? "/setup-password" : path;
  if (required || isPasswordRoute(route)) {
    const mode = passwordMode(route, required, !!session, recovery);
    return (
      <PasswordPage
        mode={mode}
        hasSession={!!session}
        onComplete={() => {
          setRequired(false);
          window.location.assign("/");
        }}
      />
    );
  }
  return children;
}
