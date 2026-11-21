export type PropertyData = {
  name: string;
  address: string;
  logo: string;
  currency: string;
  villaCategories: { name: string; units: number; code?: string }[];
  mealPlans: string[];
  mealPlanCodes?: Record<string, string>;
};
export type PropertyRecord = {
  data: PropertyData;
  version: number;
  updated_at?: string;
};
export const defaultProperty: PropertyData = {
  name: "Kuda Villingili Resort Maldives",
  address: "",
  logo: "/kuda-villingili-logo.png",
  currency: "USD",
  villaCategories: [
    { name: "Sunrise Beach Villa", units: 15, code: "BVR" },
    { name: "Sunset Beach Villa", units: 16, code: "BVS" },
    { name: "Sunrise Water Villa", units: 18, code: "WVR" },
    { name: "Sunset Water Villa", units: 18, code: "WVS" },
    { name: "Two Bedroom Beach Pool", units: 1, code: "2BBP" },
    { name: "Two Bedroom Beach Residence", units: 3, code: "2BPR" },
    { name: "Three Bedroom Residence", units: 1, code: "3BR" },
    { name: "Four Bedroom Beach Pool", units: 1, code: "4BBP" },
    { name: "Three Bedroom Retreat (Suite)", units: 1, code: "3BRT" },
    { name: "Four Bedroom Beach Residence", units: 1, code: "4BRP" },
  ],
  mealPlans: [
    "Bed & Breakfast",
    "Half Board",
    "Half Board with Beverage",
    "Full Board",
    "Full Board with Beverage",
    "All Inclusive",
    "Ultra All Inclusive",
  ],
  mealPlanCodes: {
    "Bed & Breakfast": "BB",
    "Half Board": "HB",
    "Half Board with Beverage": "HBR",
    "Full Board": "FB",
    "Full Board with Beverage": "FBR",
    "All Inclusive": "AI",
    "Ultra All Inclusive": "UAI",
  },
};
export const propertyStorageKey = "business-eye-demo-property";
export function validProperty(data: PropertyData): boolean {
  return (
    !!data &&
    typeof data.name === "string" &&
    data.name.trim().length > 0 &&
    data.name.length <= 150 &&
    typeof data.address === "string" &&
    data.address.length <= 1000 &&
    typeof data.currency === "string" &&
    /^[A-Z]{3}$/.test(data.currency) &&
    typeof data.logo === "string" &&
    (data.logo === "/kuda-villingili-logo.png" ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data.logo)) &&
    data.logo.length <= 300000 &&
    Array.isArray(data.villaCategories) &&
    data.villaCategories.length > 0 &&
    data.villaCategories.length <= 50 &&
    data.villaCategories.every(
      (c) =>
        (c.code === undefined || /^[A-Z0-9]{1,10}$/.test(c.code)) &&
        typeof c.name === "string" &&
        c.name.trim().length > 0 &&
        c.name.length <= 150 &&
        Number.isInteger(c.units) &&
        c.units >= 0 &&
        c.units <= 10000,
    ) &&
    new Set(data.villaCategories.map((c) => c.name.trim().toLowerCase()))
      .size === data.villaCategories.length &&
    (!data.mealPlanCodes ||
      Object.values(data.mealPlanCodes).every((code) =>
        /^[A-Z0-9]{1,10}$/.test(code),
      )) &&
    new Set(data.villaCategories.flatMap((c) => (c.code ? [c.code] : [])))
      .size === data.villaCategories.filter((c) => c.code).length &&
    (!data.mealPlanCodes ||
      new Set(Object.values(data.mealPlanCodes)).size ===
        Object.values(data.mealPlanCodes).length) &&
    Array.isArray(data.mealPlans) &&
    data.mealPlans.length > 0 &&
    data.mealPlans.length <= 30 &&
    data.mealPlans.every(
      (p) => typeof p === "string" && p.trim().length > 0 && p.length <= 150,
    ) &&
    new Set(data.mealPlans.map((p) => p.trim().toLowerCase())).size ===
      data.mealPlans.length
  );
}
export function inventoryTotal(data: PropertyData) {
  return data.villaCategories.reduce((s, c) => s + c.units, 0);
}
