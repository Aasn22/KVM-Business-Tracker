import { describe, it, expect, vi } from "vitest";
const sign = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ db: { auth: { signInWithOtp: sign } } }));
import { requestMagicLink, callbackType, hasCallback } from "./magicLink";
describe("one-time email login", () => {
  it("never creates new accounts and uses same-site callback", async () => {
    sign.mockResolvedValue({ error: null });
    await requestMagicLink(
      " owner@example.test ",
      "https://www.faisaa.digital",
    );
    expect(sign).toHaveBeenCalledWith({
      email: "owner@example.test",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://www.faisaa.digital/auth/confirm",
      },
    });
  });
  it("does not disclose account existence", async () => {
    sign.mockResolvedValue({ error: { status: 400, message: "not found" } });
    await expect(
      requestMagicLink("absent@example.test", "https://site.test"),
    ).resolves.toBeUndefined();
  });
  it("reports provider delivery/rate-limit failures without secrets", async () => {
    sign.mockResolvedValue({ error: { status: 429, message: "private" } });
    await expect(
      requestMagicLink("owner@example.test", "https://site.test"),
    ).rejects.toThrow("Unable to send");
  });
  it("only accepts email magic-link and invitation verification types", () => {
    expect(callbackType("email")).toBe("email");
    expect(callbackType("magiclink")).toBe("magiclink");
    expect(callbackType("invite")).toBe("invite");
    expect(callbackType("recovery")).toBeNull();
    expect(callbackType(null)).toBeNull();
  });
  it("detects token-hash, PKCE and provider session callbacks", () => {
    for (const suffix of [
      "?token_hash=fixture&type=email",
      "?code=fixture",
      "#access_token=fixture",
    ])
      expect(hasCallback(new URL("https://site.test/" + suffix))).toBe(true);
    expect(hasCallback(new URL("https://site.test/"))).toBe(false);
  });
});
