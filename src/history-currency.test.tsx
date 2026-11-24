import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryValueInput from "./HistoryValueInput";
describe("history input dollar display", () => {
  it("shows dollar sign/grouping on editable revenue inputs, plain grouped whole nights", () => {
    const props = {
      onChange: () => {},
      onPaste: () => {},
      onError: () => {},
      label: "test",
    };
    const money = renderToStaticMarkup(
      <HistoryValueInput
        {...props}
        field="actualRoomRevenue"
        value={1559075}
      />,
    );
    expect(money).toContain('value="$1,559,075"');
    expect(money).toContain('inputMode="decimal"');
    const nights = renderToStaticMarkup(
      <HistoryValueInput {...props} field="actualNights" value={1846} />,
    );
    expect(nights).toContain('value="1,846"');
    expect(nights).not.toContain("$");
    const zero = renderToStaticMarkup(
      <HistoryValueInput {...props} field="budgetTotalRevenue" value={0} />,
    );
    expect(zero).toContain('value="$0"');
  });
});
