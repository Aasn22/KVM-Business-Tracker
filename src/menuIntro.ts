export const menuIntroKey = "kvm-menu-introduction-day";
export function calendarDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
let memoryDay = "";
export function claimMenuIntro(
  storage: Pick<Storage, "getItem" | "setItem">,
  day = calendarDay(),
) {
  if (memoryDay === day) return false;
  try {
    if (storage.getItem(menuIntroKey) === day) {
      memoryDay = day;
      return false;
    }
    storage.setItem(menuIntroKey, day);
  } catch {
    /* In-memory fallback avoids repeat in this page when storage is blocked. */
  }
  memoryDay = day;
  return true;
}
export function startMenuIntro(
  setOpen: (open: boolean) => void,
  schedule: (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout> = setTimeout,
  clear: (id: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
  setOpen(true);
  const timer = schedule(() => setOpen(false), 2800);
  // Cancel without overriding an intentional manual open/close.
  return () => clear(timer);
}
