import { describe, it, expect, vi, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import handler from "../api/public-budgets";
afterEach(() => {
  vi.unstubAllEnvs();
  factory.mockReset();
});
describe("public numeric endpoint", () => {
  it("never returns source notes, extra fields or identities", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "fixture-private");
    const row = {
      label: "Room Revenue",
      budget: 100,
      bob: 20,
      targets: [60, 25, 10, 5],
      weekly: [1, 2, 3, 4],
      manager: "private",
    };
    factory.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: [
                {
                  market_id: "asia",
                  year: 2027,
                  month: 1,
                  version: 1,
                  data: {
                    commercial: [row],
                    villas: [],
                    countries: [],
                    meals: [],
                    notes: "PRIVATE",
                    team: "PRIVATE",
                  },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    let body = "";
    const res = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: (s: string) => {
        body = s;
      },
    };
    await handler(
      {
        method: "GET",
        url: "/api/public-budgets?year=2027",
      } as IncomingMessage,
      res as unknown as ServerResponse,
    );
    expect(body).not.toContain("PRIVATE");
    expect(body).not.toContain("manager");
    expect(JSON.parse(body).entries[0].data.notes).toBe("");
  });
});
