"use client";
import { useEffect, useState } from "react";
import { seed, type Store } from "./store";
export const STORAGE = "kvm-staff-pos-v1";
export function useDemoStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [now, setNow] = useState(0);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    const init = setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE);
        const parsed = saved ? JSON.parse(saved) : seed();
        if (
          parsed.version !== 1 ||
          !["products", "supplies", "sales", "orders", "purchases"].every((k) =>
            Array.isArray(parsed[k]),
          )
        )
          throw Error("Invalid data");
        setStore(parsed);
      } catch {
        setStore(seed());
        setWarning(
          "Saved data unavailable. Changes may not persist in this browser.",
        );
      }
      setNow(Date.now());
    }, 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.version === 1) setStore(parsed);
        } catch {
          setWarning("Could not sync the other demo tab.");
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      clearTimeout(init);
      clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function commit(next: Store) {
    setStore(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setWarning("");
    } catch {
      setWarning(
        "Browser storage is unavailable or full. Changes are temporary.",
      );
    }
  }
  return { store, commit, now, warning };
}
