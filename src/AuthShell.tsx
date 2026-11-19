import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { db } from "./api";
import SignInPage from "./SignInPage";
import { callbackType, hasCallback } from "./magicLink";
export default function AuthShell({
  children,
  publicDashboard,
}: {
  children: ReactNode;
  publicDashboard?: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!db);
  const [error, setError] = useState("");
  const attempt = useRef<Promise<{
    data: { session: Session | null };
    error: unknown;
  }> | null>(null);
  useEffect(() => {
    if (!db) return;
    let active = true;
    let processing = hasCallback(new URL(window.location.href));
    const { data } = db.auth.onAuthStateChange((_, s) => {
      if (active && !processing) {
        setSession(s);
        setReady(true);
      }
    });
    async function initialize() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      if (
        url.searchParams.has("error") ||
        fragment.has("error") ||
        fragment.has("error_description")
      ) {
        window.history.replaceState(null, "", "/");
        throw Error(
          "This sign-in link is invalid, expired or already used. Request a new link.",
        );
      }
      const token = url.searchParams.get("token_hash");
      const code = url.searchParams.get("code");
      if (token) {
        const type = callbackType(url.searchParams.get("type"));
        if (!type) {
          window.history.replaceState(null, "", "/");
          throw Error(
            "This email link is unsupported. Request a new sign-in link.",
          );
        }
        attempt.current ??= db!.auth.verifyOtp({ token_hash: token, type });
      } else if (code) {
        attempt.current ??= db!.auth.exchangeCodeForSession(code);
      } else {
        attempt.current ??= db!.auth.getSession();
      }
      const result = await attempt.current;
      if (!active) return;
      processing = false;
      if (hasCallback(url)) window.history.replaceState(null, "", "/");
      if (result.error)
        throw Error(
          "This sign-in link is invalid, expired or already used. Request a new link.",
        );
      setSession(result.data.session);
      setReady(true);
      // Legacy password/recovery routes now return to the passwordless entry, never demand a password.
      if (
        [
          "/forgot-password",
          "/reset-password",
          "/setup-password",
          "/change-password",
          "/auth/confirm",
        ].includes(window.location.pathname)
      )
        window.history.replaceState(null, "", "/");
    }
    void initialize().catch((e) => {
      if (active) {
        processing = false;
        setError((e as Error).message);
        setReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (!ready)
    return (
      <main className="password-page">
        <section className="password-card" role="status">
          Verifying your private sign-in link…
        </section>
      </main>
    );
  if (error)
    return (
      <main className="password-page">
        <section className="password-card">
          <h1>Request a new sign-in link</h1>
          <p role="alert">{error}</p>
          <a className="button primary" href="/">
            Back to sign in
          </a>
        </section>
      </main>
    );
  if (db && !session) return publicDashboard ?? <SignInPage />;
  return children;
}
