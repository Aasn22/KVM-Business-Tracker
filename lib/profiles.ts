import { employees, type Store } from "./store";
export const ALLERGENS = [
  "Peanuts",
  "Tree nuts",
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Wheat / gluten",
  "Soy",
  "Sesame",
] as const;
export type StaffProfile = {
  employeeId: string;
  allergens: string[];
  notes: string;
  declaration: "Not provided" | "No known allergies" | "Allergies declared";
  revision: number;
  updatedAt: number;
};
export type AllergyNote = StaffProfile;
export function profileFor(store: Store, employeeId: string): StaffProfile {
  return (
    store.staffProfiles?.find((p) => p.employeeId === employeeId) ?? {
      employeeId,
      allergens: [],
      notes: "",
      declaration: "Not provided",
      revision: 0,
      updatedAt: 0,
    }
  );
}
export function allergyText(profile?: AllergyNote) {
  if (!profile || profile.declaration === "Not provided")
    return "Allergy information not provided — ask the staff customer before preparation.";
  if (profile.declaration === "No known allergies")
    return "Staff declared no known allergies. Check ingredients and cross-contact procedures.";
  return `ALLERGY ALERT: ${[...profile.allergens, profile.notes].filter(Boolean).join(" · ")}. Confirm ingredients and cross-contact precautions with the customer.`;
}
export function saveProfile(
  store: Store,
  actorId: string,
  input: {
    declaration: StaffProfile["declaration"];
    allergens: string[];
    notes: string;
  },
  now: number,
): Store {
  if (!employees.some((e) => e.id === actorId))
    throw Error("Sign in to update your own profile.");
  if (
    !["Not provided", "No known allergies", "Allergies declared"].includes(
      input.declaration,
    )
  )
    throw Error("Choose an allergy declaration.");
  if (
    input.allergens.some((a) => !(ALLERGENS as readonly string[]).includes(a))
  )
    throw Error("Choose a supported allergen or use the notes field.");
  if (input.notes.trim().length > 500)
    throw Error("Keep allergy notes under 500 characters.");
  if (
    input.declaration !== "Allergies declared" &&
    (input.allergens.length || input.notes.trim())
  )
    throw Error("Choose Allergies declared to save allergens or notes.");
  if (
    input.declaration === "Allergies declared" &&
    !input.allergens.length &&
    !input.notes.trim()
  )
    throw Error("Select an allergen or add an allergy note.");
  const current = profileFor(store, actorId);
  const profile: StaffProfile = {
    employeeId: actorId,
    declaration: input.declaration,
    allergens: [...new Set(input.allergens)],
    notes: input.notes.trim(),
    revision: current.revision + 1,
    updatedAt: now,
  };
  return {
    ...store,
    staffProfiles: [
      profile,
      ...(store.staffProfiles ?? []).filter((p) => p.employeeId !== actorId),
    ],
  };
}
export function safetyRevision(store: Store, employeeId: string) {
  return profileFor(store, employeeId).revision;
}
