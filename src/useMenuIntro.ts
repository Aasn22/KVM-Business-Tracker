import { useEffect, useRef } from "react";
import { claimMenuIntro, startMenuIntro } from "./menuIntro";
export function useMenuIntro(setOpen: (open: boolean) => void) {
  const appRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<null | (() => void)>(null);
  useEffect(() => {
    let disposed = false;
    const compact = window.matchMedia("(max-width: 1366px)");
    function attempt() {
      const app = appRef.current;
      if (
        disposed ||
        !app ||
        !compact.matches ||
        document.visibilityState === "hidden" ||
        app.closest('[inert], [aria-hidden="true"]')
      )
        return;
      const storage = {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) =>
          window.localStorage.setItem(key, value),
      };
      if (!claimMenuIntro(storage)) return;
      cancelRef.current = startMenuIntro(setOpen);
    }
    const observer = new MutationObserver(attempt);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["inert", "aria-hidden"],
    });
    document.addEventListener("visibilitychange", attempt);
    compact.addEventListener("change", attempt);
    // Defer the claim so React StrictMode's probe cleanup cannot consume it.
    const initial = window.setTimeout(attempt, 0);
    return () => {
      window.clearTimeout(initial);
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", attempt);
      compact.removeEventListener("change", attempt);
      cancelRef.current?.();
    };
  }, [setOpen]);
  function cancelIntro() {
    cancelRef.current?.();
    cancelRef.current = null;
  }
  return { appRef, cancelIntro };
}
