import { villas, meals } from "./model";
export type PropertyData = {
  name: string;
  address: string;
  logo: string;
  currency: string;
  villaCategories: { name: string; units: number }[];
  mealPlans: string[];
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
  villaCategories: villas.map((name) => ({ name, units: 0 })),
  mealPlans: [...meals],
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
        typeof c.name === "string" &&
        c.name.trim().length > 0 &&
        c.name.length <= 150 &&
        Number.isInteger(c.units) &&
        c.units >= 0 &&
        c.units <= 10000,
    ) &&
    new Set(data.villaCategories.map((c) => c.name.trim().toLowerCase()))
      .size === data.villaCategories.length &&
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
