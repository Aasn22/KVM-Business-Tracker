import { test } from "node:test";
import assert from "node:assert/strict";
import { allergyText, profileFor, saveProfile } from "./profiles";
import { checkout, seed, type Line } from "./store";
import { placeOrder, reviewAllergy, updateItem } from "./orders";
import { parseStore } from "./use-demo-store";
const now = new Date(2026, 10, 24, 12).getTime();
const declared = {
  declaration: "Allergies declared" as const,
  allergens: ["Peanuts", "Milk"],
  notes: "Example: avoid shared utensils",
};
const noKnown = {
  declaration: "No known allergies" as const,
  allergens: [],
  notes: "",
};
function item(): Line {
  return {
    productId: "p5",
    name: "Cappuccino",
    segment: "cafe",
    price: 3.5,
    qty: 1,
    modifiers: "No sugar",
  };
}
function ordered() {
  const s = saveProfile(seed(now), "KV4106", declared, now);
  return placeOrder(s, {
    employeeId: "KV4106",
    lines: [item()],
    payment: "Salary Deduction",
    location: "Engineering",
    id: "S-allergy",
    now,
  });
}
test("missing legacy profile is explicitly unknown, never declared safe", () => {
  const p = profileFor(seed(now), "KV4106");
  assert.equal(p.declaration, "Not provided");
  assert.match(allergyText(p), /ask the staff customer/);
  assert.match(allergyText(), /not provided/);
});
test("profile persists only for the actor and never mutates another staff profile", () => {
  const base = saveProfile(seed(now), "KV1042", noKnown, now);
  const s = saveProfile(base, "KV4106", declared, now);
  assert.equal(s.staffProfiles!.length, 2);
  assert.deepEqual(profileFor(s, "KV1042"), profileFor(base, "KV1042"));
  assert.equal(profileFor(s, "KV4106").revision, 1);
  assert.equal(base.staffProfiles!.length, 1);
});
test("duplicate allergens removed, notes trimmed and revision increases", () => {
  let s = saveProfile(
    seed(now),
    "KV4106",
    { ...declared, allergens: ["Milk", "Milk"], notes: " note " },
    now,
  );
  assert.deepEqual(profileFor(s, "KV4106").allergens, ["Milk"]);
  assert.equal(profileFor(s, "KV4106").notes, "note");
  s = saveProfile(s, "KV4106", noKnown, now + 1);
  assert.equal(profileFor(s, "KV4106").revision, 2);
  assert.equal(profileFor(s, "KV4106").notes, "");
});
test("invalid or contradictory allergy declarations are rejected", () => {
  for (const invalid of [
    { ...declared, allergens: ["Unknown"] },
    { ...declared, notes: "x".repeat(501) },
    { ...noKnown, notes: "Peanuts" },
    { ...noKnown, allergens: ["Milk"] },
    { ...declared, allergens: [], notes: "" },
  ])
    assert.throws(() => saveProfile(seed(now), "KV4106", invalid, now));
  assert.throws(() => saveProfile(seed(now), "KV9999", declared, now));
});
test("one order and one bill capture independent immutable allergy snapshots", () => {
  const s = ordered();
  const before = structuredClone(s.customerOrders![0].allergyNote);
  const next = saveProfile(
    s,
    "KV4106",
    { ...declared, allergens: ["Shellfish"] },
    now + 1,
  );
  assert.deepEqual(next.customerOrders![0].allergyNote, before);
  assert.deepEqual(next.sales[0].allergyNote, before);
  assert.notEqual(
    next.customerOrders![0].allergyNote,
    next.sales[0].allergyNote,
  );
  assert.deepEqual(profileFor(next, "KV4106").allergens, ["Shellfish"]);
});
test("preparation and dispatch require current allergy review; update invalidates prior acknowledgment", () => {
  let s = ordered();
  const o = s.customerOrders![0];
  const args = {
    orderId: o.id,
    itemId: o.items[0].id,
    role: "Kitchen / Café Prep" as const,
    now,
  };
  assert.throws(
    () => updateItem(s, { ...args, nextState: "Preparing" }),
    /allergy note/,
  );
  s = reviewAllergy(s, o.id, "KV2088", now);
  assert.equal(s.customerOrders![0].safetyReviewedBy, "KV2088");
  s = updateItem(s, { ...args, nextState: "Preparing" });
  s = updateItem(s, { ...args, nextState: "Ready" });
  s = saveProfile(s, "KV4106", { ...declared, allergens: ["Eggs"] }, now + 1);
  assert.throws(
    () => updateItem(s, { ...args, runner: "Ravi", nextState: "Dispatched" }),
    /allergy note/,
  );
  s = reviewAllergy(s, o.id, "KV2088", now + 2);
  s = updateItem(s, { ...args, runner: "Ravi", nextState: "Dispatched" });
  assert.equal(s.customerOrders![0].items[0].state, "Dispatched");
});
test("removing declared allergy still requires review of changed profile before preparation", () => {
  let s = ordered();
  const o = s.customerOrders![0];
  s = saveProfile(s, "KV4106", noKnown, now + 1);
  assert.throws(
    () =>
      updateItem(s, {
        orderId: o.id,
        itemId: o.items[0].id,
        role: "Kitchen / Café Prep",
        now,
        nextState: "Preparing",
      }),
    /allergy note/,
  );
});
test("POS cash staff purchase records customer and allergy note on sale and kitchen ticket", () => {
  const s = saveProfile(seed(now), "KV4106", declared, now);
  const next = checkout(s, {
    employeeId: "KV4106",
    lines: [item()],
    payment: "Cash",
    cash: 10,
    reference: "",
    cashierId: "KV1042",
    role: "Cashier / Barista",
    id: "S-cash-allergy",
    location: "Counter pickup",
    now,
  });
  assert.equal(next.sales[0].employeeId, "KV4106");
  assert.equal(next.orders[0].employeeId, "KV4106");
  assert.deepEqual(next.orders[0].allergyNote?.allergens, ["Peanuts", "Milk"]);
});
test("walk-in customer does not inherit another employee allergy declaration", () => {
  const s = saveProfile(seed(now), "KV4106", declared, now);
  const next = checkout(s, {
    employeeId: "",
    lines: [item()],
    payment: "Cash",
    cash: 10,
    reference: "",
    cashierId: "KV1042",
    role: "Cashier / Barista",
    id: "S-walkin",
    location: "Counter pickup",
    now,
  });
  assert.equal(next.sales[0].allergyNote?.declaration, "Not provided");
});
test("saved store with new profiles survives common-store parsing and legacy remains supported", () => {
  const s = ordered();
  const restored = parseStore(JSON.stringify(s));
  assert.deepEqual(restored, s);
  assert.equal(parseStore(JSON.stringify(seed(now))).version, 1);
  assert.throws(() => parseStore("{broken"));
  assert.throws(() => parseStore('{"version":1}'));
});
