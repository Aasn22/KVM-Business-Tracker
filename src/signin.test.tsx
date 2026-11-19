import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SignInPage from "./SignInPage";
describe("public sign-in gate", () => {
  it("asks for credentials without exposing demo budgets or username claim flow", () => {
    const html = renderToStaticMarkup(<SignInPage />);
    expect(html).toContain("BUSINESS EYE");
    expect(html).toContain("Sign-in username");
    expect(html).not.toContain('type="email"');
    expect(html).toContain("Sign-in password");
    expect(html).toContain("Forgot password?");
    expect(html).not.toContain("Try Super Admin");
    expect(html).not.toContain("Total revenue budget");
  });
});
