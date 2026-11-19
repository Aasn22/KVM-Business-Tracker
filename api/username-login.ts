import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
function reply(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    reply(res, 405, { message: "Use POST." });
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !secret) {
    reply(res, 503, {
      message: "Username login is not configured. Contact your administrator.",
    });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => !["username", "password"].includes(k))
    ) {
      reply(res, 400, { message: "Enter your username and password." });
      return;
    }
    const { username, password } = body as {
      username?: unknown;
      password?: unknown;
    };
    if (
      typeof username !== "string" ||
      !username.trim() ||
      username.length > 100 ||
      typeof password !== "string" ||
      !password ||
      password.length > 1024
    ) {
      reply(res, 400, { message: "Enter your username and password." });
      return;
    }
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const lookup = await admin.rpc("resolve_login_username", {
      p_username: username.trim(),
    });
    if (lookup.error) {
      reply(res, 503, {
        message:
          "Username login setup is incomplete. Ask your administrator to apply the username migration and link your Supabase Auth account.",
      });
      return;
    }
    const auth = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Unknown/rate-limited usernames still make a provider request; do not disclose existence.
    const result = await auth.auth.signInWithPassword({
      email:
        typeof lookup.data === "string"
          ? lookup.data
          : "unavailable@invalid.example",
      password,
    });
    if (!lookup.data || result.error || !result.data.session) {
      reply(res, 401, {
        message:
          "Invalid username or password, or too many attempts. Try again later or contact your administrator.",
      });
      return;
    }
    reply(res, 200, {
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token,
    });
  } catch {
    reply(res, 500, {
      message: "Sign-in could not be completed. Please try again later.",
    });
  }
}
