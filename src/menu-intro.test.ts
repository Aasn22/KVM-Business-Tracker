import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calendarDay,
  claimMenuIntro,
  menuIntroKey,
  startMenuIntro,
} from "./menuIntro";
afterEach(() => vi.useRealTimers());
describe("once daily nonblocking menu introduction", () => {
  it("uses local calendar dates, not UTC rollover", () => {
    expect(calendarDay(new Date(2026, 10, 20, 0, 1))).toBe("2026-11-20");
  });
  it("claims once per browser day, then allows a new day", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
    expect(claimMenuIntro(storage, "2026-11-20")).toBe(true);
    expect(values.get(menuIntroKey)).toBe("2026-11-20");
    expect(claimMenuIntro(storage, "2026-11-20")).toBe(false);
    expect(claimMenuIntro(storage, "2026-11-21")).toBe(true);
  });
  it("respects an already recorded browser date", () => {
    const storage = { getItem: () => "2026-11-22", setItem: vi.fn() };
    expect(claimMenuIntro(storage, "2026-11-22")).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("does not fail when storage is blocked", () => {
    const storage = {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: vi.fn(),
    };
    expect(claimMenuIntro(storage, "2026-11-23")).toBe(true);
    expect(claimMenuIntro(storage, "2026-11-23")).toBe(false);
  });
  it("opens then returns menu to collapsed without blocking interaction", () => {
    vi.useFakeTimers();
    const set = vi.fn();
    startMenuIntro(set);
    expect(set).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(2800);
    expect(set).toHaveBeenLastCalledWith(false);
  });
  it("manual interaction cancels auto-close without forcing state", () => {
    vi.useFakeTimers();
    const set = vi.fn();
    const cancel = startMenuIntro(set);
    cancel();
    vi.advanceTimersByTime(3000);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(true);
  });
});
