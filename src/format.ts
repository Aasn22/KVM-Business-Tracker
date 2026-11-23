// Display only: source values retain their full precision for calculations/exports.
export const dollarExcelFormat = '"$"#,##0;("$"#,##0);"$"0';
export function formatNumber(value: number | null, decimals = 0): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: decimals,
      }).format(value);
}
export function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    currencySign: "accounting",
    maximumFractionDigits: 0,
  }).format(Math.round(value) === 0 ? 0 : value);
}
export function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 2,
  }).format(value);
}
export function isMoneyMetric(label: string): boolean {
  return /revenue|\bADR\b/i.test(label);
}

// Business Insight only: compact national receipt figures, rounded to whole K/M.
export function formatInsightMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const amount = new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return value < 0 ? `($${amount})` : `$${amount}`;
}
