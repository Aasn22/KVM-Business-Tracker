import { it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "../api/username-login";
it("retires the legacy password endpoint without processing credentials", () => {
  let body = "";
  const response = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (value: string) => {
      body = value;
    },
  };
  handler(
    { method: "POST" } as IncomingMessage,
    response as unknown as ServerResponse,
  );
  expect(response.statusCode).toBe(410);
  expect(body).toContain("private email sign-in link");
});
