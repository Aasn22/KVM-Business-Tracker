import { describe, it, expect } from "vitest";
import { safeTeamImport, emptyMember } from "./team";
describe("private team roster", () => {
  it("rejects credentials before import", () => {
    expect(() =>
      safeTeamImport([{ ...emptyMember, name: "Test", password: "REJECTED" }]),
    ).toThrow("credentials");
  });
  it("allows explicit country-only readers and disallows country administrators", () => {
    expect(
      safeTeamImport([{ ...emptyMember, name: "Test", scope: "india" }])[0]
        .scope,
    ).toBe("india");
    expect(() =>
      safeTeamImport([
        { ...emptyMember, name: "Test", role: "Admin", scope: "kazakhstan" },
      ]),
    ).toThrow("Invalid");
  });
});
