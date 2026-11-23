import { db } from "./api";
export async function usernameLogin(username: string, password: string) {
  if (!db) throw Error("Authentication is not configured.");
  const response = await fetch("/api/username-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.message || "Sign-in failed.");
  if (
    typeof result.access_token !== "string" ||
    typeof result.refresh_token !== "string"
  )
    throw Error("Invalid sign-in response.");
  const session = await db.auth.setSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
  });
  if (session.error) throw session.error;
}
