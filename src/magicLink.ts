import { db } from "./api";
export const magicLinkMessage =
  "If this email belongs to an existing account, a private sign-in link will arrive shortly. Check your inbox and spam folder.";
export async function requestMagicLink(email: string, origin: string) {
  if (!db)
    throw Error(
      "Authentication is not configured. Contact your administrator.",
    );
  const { error } = await db.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  // Do not expose whether a particular email is registered.
  if (error && error.status !== 400 && error.status !== 422)
    throw Error(
      "Unable to send a sign-in link right now. Please wait and try again, or contact your administrator.",
    );
}
export function callbackType(
  value: string | null,
): "email" | "magiclink" | "invite" | null {
  return value === "email" || value === "magiclink" || value === "invite"
    ? value
    : null;
}
export function hasCallback(url: URL) {
  return (
    url.searchParams.has("token_hash") ||
    url.searchParams.has("code") ||
    new URLSearchParams(url.hash.slice(1)).has("access_token")
  );
}
