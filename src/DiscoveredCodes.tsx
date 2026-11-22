import { useEffect, useState } from "react";
import { loadProduction, productionChanged } from "./productionClient";
export default function DiscoveredCodes() {
  const [codes, setCodes] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await loadProduction();
        if (active)
          setCodes(
            Object.fromEntries(
              (
                [
                  "room",
                  "meal",
                  "country",
                  "source",
                  "marketCode",
                  "status",
                ] as const
              ).map((key) => [
                key,
                [
                  ...new Set(data.days.map((r) => r[key] ?? "UNAVAILABLE")),
                ].sort(),
              ]),
            ),
          );
      } catch {
        /* Configuration remains available without imported source. */
      }
    }
    void load();
    window.addEventListener(productionChanged, load);
    return () => {
      active = false;
      window.removeEventListener(productionChanged, load);
    };
  }, []);
  return (
    <details className="property-discovered-codes">
      <summary>Codes and statuses discovered in uploaded production</summary>
      <p>
        New codes are retained automatically and available in reports. This
        reference does not invent descriptions, inventory or geographic/segment
        mappings.
      </p>
      {Object.entries(codes).map(([key, values]) => (
        <p key={key}>
          <strong>{key}: </strong>
          {values.join(", ")}
        </p>
      ))}
    </details>
  );
}
