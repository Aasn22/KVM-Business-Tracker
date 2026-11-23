import { describe, it, expect } from "vitest";
import { calendarPosition } from "./DatePicker";
describe("viewport-safe calendar placement", () => {
  it.each([
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [320, 568],
  ])("fits viewport %i x %i even at the bottom right", (width, height) => {
    const p = calendarPosition(
      { left: width - 30, top: height - 50, bottom: height - 6 },
      { width, height },
      330,
    );
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + p.width).toBeLessThanOrEqual(width - 8);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + Math.min(330, p.maxHeight)).toBeLessThanOrEqual(height - 8);
    expect(p.top).toBeLessThan(height - 50);
  });
  it("opens below a trigger when space exists", () => {
    expect(
      calendarPosition(
        { left: 25, top: 70, bottom: 114 },
        { width: 390, height: 844 },
        330,
      ).top,
    ).toBe(122);
  });
  it("uses visible bounds when a mobile visual viewport is offset or short", () => {
    const p = calendarPosition(
      { left: 20, top: 400, bottom: 444 },
      { width: 320, height: 240, left: 10, top: 300 },
      330,
    );
    expect(p.left).toBeGreaterThanOrEqual(18);
    expect(p.top).toBeGreaterThanOrEqual(308);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(532);
  });
});
