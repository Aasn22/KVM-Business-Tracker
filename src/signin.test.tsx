import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SignInPage from "./SignInPage";
describe("passwordless entry", () => {
  it("has email only, no username or password fields", () => {
    const html = renderToStaticMarkup(<SignInPage />);
    expect(html).toContain("Sign-in email");
    expect(html).toContain("Email me a sign-in link");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("Sign-in username");
    expect(html).not.toContain("Forgot password?");
    expect(html).toContain("Existing accounts only");
  });
});
