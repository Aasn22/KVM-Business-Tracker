"use client";
import { useEffect, useRef, useState } from "react";
import { seed, type Store } from "./store";
export const STORAGE = "kvm-staff-pos-v1";
const EVENT = "calm-break-store-updated";
export function parseStore(raw: string): Store {
  const parsed = JSON.parse(raw);
  if (
    parsed.version !== 1 ||
    !["products", "supplies", "sales", "orders", "purchases"].every((k) =>
      Array.isArray(parsed[k]),
    )
  )
    throw Error("Saved demo data is invalid.");
  return parsed;
}
export function useDemoStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [now, setNow] = useState(0);
  const [warning, setWarning] = useState("");
  const [lastSynced, setLastSynced] = useState(0);
  const baseline = useRef<string | null>(null);
  useEffect(() => {
    const sync = () => {
      try {
        let raw = localStorage.getItem(STORAGE);
        if (!raw) {
          raw = JSON.stringify(seed());
          localStorage.setItem(STORAGE, raw);
        }
        const parsed = parseStore(raw);
        baseline.current = raw;
        setStore(parsed);
        setLastSynced(Date.now());
        setWarning("");
      } catch {
        setWarning(
          "Local demo storage could not be loaded. Saving is blocked; do not enter real data.",
        );
      }
    };
    const init = setTimeout(() => {
      sync();
      setNow(Date.now());
    }, 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const changed = (e: StorageEvent) => {
      if (e.key === STORAGE || e.key === null) sync();
    };
    window.addEventListener("storage", changed);
    window.addEventListener(EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      clearTimeout(init);
      clearInterval(timer);
      window.removeEventListener("storage", changed);
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  function commit(next: Store) {
    // One common store for / and /staff. Never silently overwrite an already-observed newer tab write.
    const raw = localStorage.getItem(STORAGE);
    if (raw !== baseline.current) {
      if (raw) {
        const latest = parseStore(raw);
        baseline.current = raw;
        setStore(latest);
      }
      throw Error(
        "Another platform updated the demo. Latest data loaded; review and retry your action.",
      );
    }
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(STORAGE, serialized);
    } catch {
      setWarning(
        "Save failed: browser storage is blocked or full. Your change was not saved.",
      );
      throw Error("Could not save. Free browser storage and retry.");
    }
    baseline.current = serialized;
    setStore(next);
    setLastSynced(Date.now());
    setWarning("");
    window.dispatchEvent(new Event(EVENT));
  }
  return { store, commit, now, warning, lastSynced };
}
