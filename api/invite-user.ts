import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
type Request = IncomingMessage & { body?: unknown };
function reply(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ message }));
}
export default async function handler(req: Request, res: ServerResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    reply(res, 405, "Use POST.");
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const origin = process.env.BUSINESS_EYE_APP_URL;
  if (!url || !key || !secret || !origin) {
    reply(
      res,
      503,
      "Invitations are not configured. Ask the administrator to connect Supabase and configure the server invitation settings.",
    );
    return;
  }
  let base: URL;
  try {
    base = new URL(origin);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    )
      throw Error();
  } catch {
    reply(
      res,
      503,
      "Invitation redirect configuration must be an HTTPS site origin.",
    );
    return;
  }
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    reply(res, 401, "Sign in required.");
    return;
  }
  if (req.headers.origin && req.headers.origin !== base.origin) {
    reply(
      res,
      403,
      "Invitation requests must come from the configured application.",
    );
    return;
  }
  try {
    const caller = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const verified = await caller.auth.getUser(authorization.slice(7));
    if (verified.error || !verified.data.user) {
      reply(res, 401, "Sign in again.");
      return;
    }
    const role = await caller.rpc("is_super_admin");
    if (role.error || role.data !== true) {
      reply(res, 403, "Super Admin access required.");
      return;
    }
    let body: Record<string, unknown>;
    try {
      const parsed =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw Error();
      body = parsed as Record<string, unknown>;
    } catch {
      reply(res, 400, "Invalid request.");
      return;
    }
    if (Object.keys(body).some((k) => !["email", "memberId"].includes(k))) {
      reply(
        res,
        400,
        "Only an email and saved team profile are accepted. Do not submit passwords.",
      );
      return;
    }
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const id = body.memberId;
    if (
      email.length > 254 ||
      !/^\S+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(id)
    ) {
      reply(res, 400, "Enter a valid email address and saved team profile.");
      return;
    }
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const profile = await admin
      .from("team_directory")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (profile.error || !profile.data) {
      reply(res, 404, "Saved team profile not found.");
      return;
    }
    if (profile.data.user_id) {
      reply(
        res,
        409,
        "This team profile is already linked. Request a sign-in link for the existing account.",
      );
      return;
    }
    const invitation = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${base.origin}/auth/confirm`,
    });
    if (invitation.error || !invitation.data.user) {
      reply(
        res,
        400,
        "Invitation could not be sent. The email may already have an account, or email delivery is unavailable. Check Supabase Auth before retrying; no password was created here.",
      );
      return;
    }
    const linked = await caller.rpc("save_team_member", {
      p_id: id,
      p_user_id: invitation.data.user.id,
      p_data: {
        name: profile.data.name,
        position: profile.data.position,
        department: profile.data.department,
        level: profile.data.level,
        username: profile.data.username,
        role: profile.data.role,
        scope: profile.data.scope,
        markets: profile.data.markets,
      },
      p_version: profile.data.version,
    });
    if (linked.error) {
      reply(
        res,
        409,
        "Invitation was sent, but profile linking failed (possibly a concurrent edit). Do not resend. Review the invited account in Supabase Auth and link its UUID through Property Setup.",
      );
      return;
    }
    reply(
      res,
      200,
      "Invitation sent and saved team permissions linked. The user can sign in using the private email link; no password is required.",
    );
  } catch {
    reply(
      res,
      500,
      "Invitation outcome could not be confirmed. Check Supabase Auth before retrying to avoid duplicate messages.",
    );
  }
}
