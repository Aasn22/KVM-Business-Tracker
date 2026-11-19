import type { IncomingMessage, ServerResponse } from "node:http";
// Password authentication has been retired in favor of provider-verified email links.
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 410;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      message:
        "Password login is no longer available. Request a private email sign-in link from the login page.",
    }),
  );
}
