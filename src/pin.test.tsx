import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { renderToStaticMarkup } from "react-dom/server";
import handler, { validSession } from "../api/pin-session";
import PinShell from "./PinShell";
import App from "./App";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function response() {
  const headers: Record<string, string> = {};
  let body = "";
  const res = {
    statusCode: 200,
    setHeader: (key: string, val: string) => {
      headers[key] = val;
    },
    end: (text: string) => {
      body = text;
    },
  };
  return {
    res: res as unknown as ServerResponse,
    headers,
    json: () => JSON.parse(body),
  };
}
function request(
  method: string,
  body?: unknown,
  cookie = "",
  origin = "https://app.example",
) {
  return {
    method,
    body,
    headers: { host: "app.example", origin, cookie },
    socket: { remoteAddress: randomBytes(8).toString("hex") },
  } as unknown as IncomingMessage;
}
describe("PIN entry", () => {
  it("fails closed when the owner hasn't configured a private PIN", async () => {
    vi.stubEnv("BUSINESS_EYE_PIN", "");
    const r = response();
    await handler(request("GET"), r.res);
    expect(r.res.statusCode).toBe(503);
    expect(r.json().message).toContain("not configured");
  });
  it("issues a secure cookie only for the configured PIN, then validates and expires it", async () => {
    const pin = randomBytes(16).toString("hex");
    vi.stubEnv("BUSINESS_EYE_PIN", pin);
    const r = response();
    await handler(request("POST", { pin }), r.res);
    expect(r.json().authenticated).toBe(true);
    const cookie = r.headers["Set-Cookie"];
    expect(cookie).toContain("HttpOnly; Secure; SameSite=Strict");
    expect(cookie).not.toContain(pin);
    expect(validSession(cookie, pin)).toBe(true);
    expect(validSession(cookie, pin, Date.now() + 5 * 60 * 60 * 1000)).toBe(
      false,
    );
    expect(validSession(cookie + "bad", randomBytes(16).toString("hex"))).toBe(
      false,
    );
    const check = response();
    await handler(request("GET", undefined, cookie), check.res);
    expect(check.json().authenticated).toBe(true);
    const logout = response();
    await handler(request("DELETE"), logout.res);
    expect(logout.headers["Set-Cookie"]).toContain("Max-Age=0");
  });
  it("rejects invalid PINs and cross-origin submissions", async () => {
    vi.stubEnv("BUSINESS_EYE_PIN", randomBytes(16).toString("hex"));
    const r = response();
    await handler(request("POST", { pin: "not-the-pin" }), r.res);
    expect(r.res.statusCode).toBe(401);
    expect(r.headers["Set-Cookie"]).toBeUndefined();
    const x = response();
    await handler(request("POST", {}, "", "https://other.example"), x.res);
    expect(x.res.statusCode).toBe(403);
  });
  it("blocks repeated guesses", async () => {
    vi.stubEnv("BUSINESS_EYE_PIN", randomBytes(16).toString("hex"));
    const req = request("POST", { pin: "wrong" });
    for (let i = 0; i < 5; i++) await handler(req, response().res);
    const r = response();
    await handler(req, r.res);
    expect(r.res.statusCode).toBe(429);
  });
  it("hides local editor before PIN verification and asks for no email", () => {
    const html = renderToStaticMarkup(
      <PinShell>
        <div>SECRET_EDITOR</div>
      </PinShell>,
    );
    expect(html).toContain("Enter access PIN");
    expect(html).toContain('aria-label="Admin name"');
    expect(html).toContain("GO BACK");
    expect(html).toContain('href="/"');
    expect(html).toContain("Restricted access only for admins.");
    expect(html).toContain("CHECKING ACCESS…");
    expect(html).not.toContain("SECRET_EDITOR");
    expect(html).not.toContain('type="email"');
  });
  it("removes marked legacy panels while retaining the current upload controls", () => {
    vi.stubGlobal("window", { location: { pathname: "/admin-data-input" } });
    const html = renderToStaticMarkup(<App localPin />);
    expect(html).not.toContain("Data Input — local browser");
    expect(html).not.toContain("Publish previous browser uploads");
    expect(html).not.toContain("Admin market");
    expect(html).toContain("Reservation Production Spreadsheet");
    expect(html).toContain("Cancellation Data Input");
    expect(html).not.toContain("Email me a sign-in link");
    expect(html).not.toContain("Demo Admin Data Input");
    expect(html).not.toContain("Fictional demo only");
  });
});
