// Curated, dated public research. No live scraping, forecasts or property-budget data.
export const insightReviewed = "20 November 2026";
export const insightSources = {
  ministry: {
    name: "Ministry of Tourism · Daily Reports",
    url: "https://www.tourism.gov.mv/en/downloads/reports",
    type: "Official publication hub",
    period: "Retrieved 20 Nov 2026; listing available through 26 Oct 2026",
  },
  status: {
    name: "Ministry · Tourism Status Updates",
    url: "https://www.tourism.gov.mv/en/downloads/status-update",
    type: "Official publication hub",
    period: "Retrieved 20 Nov 2026; listing available through 22 Oct 2026",
  },
  annual: {
    name: "Ministry · Daily Update, 7 Jan 2026",
    url: "https://www.tourism.gov.mv/dms/document/3f76802fa2a6c468b0acb687cc99d2aa.pdf",
    type: "Primary statistical bulletin",
    period: "2024 and 2025 year-end tourist totals",
  },
  arrivals: {
    name: "Sun · Ministry figures reported 18 Nov 2026",
    url: "https://english.sun.mv/110530",
    type: "Secondary reporting of Ministry statistics",
    period: "Year to 17 Nov 2026 vs corresponding 2025 period",
  },
  receipts: {
    name: "Maldives Monetary Authority · Travel receipts",
    url: "https://database.mma.gov.mv/viya/series/246",
    type: "Primary economic statistics",
    period: "Jan–Aug 2026 monthly; 2025 year end",
  },
  global: {
    name: "UN Tourism · September 2026 Barometer",
    url: "https://www.e-unwto.org/doi/abs/10.18111/wtobarometereng.2026.24.1.3",
    type: "Primary global research",
    period: "January–June 2026; September release",
  },
  risks: {
    name: "UN Tourism · Q1 2026 and risk outlook",
    url: "https://www.untourism.int/news/international-tourism-up-2-in-q1-2026-amid-growing-uncertainty",
    type: "Primary research and expert survey",
    period: "Published 2 Jun 2026; Q1 / spring expert survey",
  },
} as const;
export type InsightSource = keyof typeof insightSources;
export const annualArrivals = [
  { label: "2024 full year", value: 2046615 },
  { label: "2025 full year", value: 2246516 },
];
export const ytdArrivals = [
  { label: "2025 to 17 Nov", value: 1961566 },
  { label: "2026 to 17 Nov", value: 1900838 },
];
export const sourceMarkets = [
  { label: "China", value: 342376 },
  { label: "Russia", value: 272052 },
  { label: "United Kingdom", value: 145464 },
];
export const travelReceipts = [
  { label: "Jan", value: 567.0 },
  { label: "Feb", value: 843.83 },
  { label: "Mar", value: 534.43 },
  { label: "Apr", value: 372.55 },
  { label: "May", value: 317.47 },
  { label: "Jun", value: 284.15 },
  { label: "Jul", value: 392.94 },
  { label: "Aug", value: 400.1 },
];
export const globalQuarters = [
  { label: "Q1 2026", value: 2 },
  { label: "Q2 2026", value: -1 },
  { label: "H1 2026", value: 0.4 },
];
export const riskSurvey = [
  { label: "Moderate negative impact", value: 43 },
  { label: "High negative impact", value: 21 },
  { label: "Little or no impact", value: 36 },
];
export function yoy(current: number, prior: number) {
  return prior > 0 ? (current / prior - 1) * 100 : null;
}
