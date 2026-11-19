import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
const cookieName = "business_eye_pin";
const lifetime = 60 * 60 * 4;
export function validSession(cookie: string, pin: string, now = Date.now()) {
  if (!pin) return false;
  const token = cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!token) return false;
  const [expiry, nonce, signature] = token.split(".");
  if (!expiry || !nonce || !signature || !/^\d+$/.test(expiry)) return false;
  if (Number(expiry) < now || Number(expiry) > now + lifetime * 1000)
    return false;
  const expected = createHmac("sha256", pin)
    .update(`${expiry}.${nonce}`)
    .digest("hex");
  return equal(expected, signature);
}
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
// A per-instance backstop, not a distributed limiter. Configure an edge rate limit for high traffic.
const attempts = new Map<string, { count: number; reset: number }>();
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const reply = (status: number, message: string, extra = {}) => {
    res.statusCode = status;
    res.end(JSON.stringify({ message, ...extra }));
  };
  const pin = process.env.BUSINESS_EYE_PIN;
  if (!pin || pin.length < 4)
    return reply(
      503,
      "PIN access is not configured. The owner must set BUSINESS_EYE_PIN (at least 4 characters) in Vercel and redeploy.",
    );
  if (req.method === "GET")
    return reply(200, "Session checked.", {
      authenticated: validSession(req.headers.cookie ?? "", pin),
    });
  if (!["POST", "DELETE"].includes(req.method ?? "")) {
    res.setHeader("Allow", "GET, POST, DELETE");
    return reply(405, "Method not allowed.");
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host || origin !== `https://${host}`)
    return reply(403, "Invalid request origin.");
  if (req.method === "DELETE") {
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    );
    return reply(200, "Locked.");
  }
  const ip = String(
    req.headers["x-vercel-forwarded-for"] ??
      req.socket?.remoteAddress ??
      "unknown",
  );
  const now = Date.now();
  for (const [key, entry] of attempts)
    if (entry.reset <= now) attempts.delete(key);
  if (attempts.size > 10000)
    return reply(429, "Please wait before trying again.");
  const attempt = attempts.get(ip) ?? { count: 0, reset: now + 15 * 60 * 1000 };
  if (++attempt.count > 5)
    return reply(429, "Too many attempts. Wait 15 minutes.");
  attempts.set(ip, attempt);
  try {
    let body = req.body;
    if (body === undefined) {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 1024)
          return reply(413, "Request too large.");
      }
      body = JSON.parse(raw);
    }
    if (typeof body === "string") body = JSON.parse(body);
    const supplied = (body as { pin?: unknown })?.pin;
    if (
      typeof supplied !== "string" ||
      supplied.length > 128 ||
      !equal(supplied, pin)
    )
      return reply(401, "Incorrect PIN.");
    const payload = `${now + lifetime * 1000}.${randomBytes(16).toString("hex")}`;
    const signature = createHmac("sha256", pin).update(payload).digest("hex");
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${lifetime}`,
    );
    attempts.delete(ip);
    return reply(200, "Unlocked.", { authenticated: true });
  } catch {
    return reply(400, "Invalid request.");
  }
}
