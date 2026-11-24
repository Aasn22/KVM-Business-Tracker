import { test } from "node:test";
import assert from "node:assert/strict";
import { accountUsed, seed, type Line, type Store } from "./store";
import {
  acknowledgeOrder,
  escalatedOrders,
  itemSla,
  orderState,
  placeOrder,
  updateItem,
} from "./orders";
const now = new Date(2026, 10, 24, 12).getTime();
function line(productId: string, qty = 1): Line {
  const p = seed(now).products.find((p) => p.id === productId)!;
  return {
    productId,
    name: p.name,
    qty,
    price: p.price,
    segment: p.segment,
    modifiers: "Less sugar · Staff delivery",
  };
}
function order(
  patch: Partial<Parameters<typeof placeOrder>[1]> = {},
  store = seed(now),
) {
  return placeOrder(store, {
    id: "S-web-test",
    employeeId: "KV4106",
    lines: [line("p5"), line("p9")],
    payment: "Salary Deduction",
    location: "Engineering",
    now,
    ...patch,
  });
}
function advance(store: Store, index: number, time = now) {
  const o = store.customerOrders![0];
  const item = o.items[index];
  const states = [
    "Queued",
    "Preparing",
    "Ready",
    "Dispatched",
    "Delivered",
  ] as const;
  return updateItem(store, {
    orderId: o.id,
    itemId: item.id,
    role: item.segment === "cafe" ? "Kitchen / Café Prep" : "Cashier / Barista",
    runner: "Ravi",
    nextState: states[states.indexOf(item.state) + 1],
    now: time,
  });
}
test("existing v1 data without portal orders is compatible", () => {
  const s = seed(now);
  assert.deepEqual(escalatedOrders(s, now), []);
  assert.equal(order({}, s).customerOrders!.length, 1);
});
test("one mixed order and one bill, no duplicate café ticket", () => {
  const s = seed(now);
  const next = order({}, s);
  const o = next.customerOrders![0];
  assert.equal(next.sales.length, s.sales.length + 1);
  assert.equal(next.orders.length, s.orders.length);
  assert.equal(o.items.length, 2);
  assert.equal(o.saleId, next.sales[0].id);
  assert.equal(o.employeeId, "KV4106");
  assert.equal(next.products.find((p) => p.id === "p9")!.stock, 47);
  assert.equal(
    accountUsed(next, "KV4106", "Salary Deduction", now) -
      accountUsed(s, "KV4106", "Salary Deduction", now),
    4.75,
  );
});
test("shop item can be delivered while café item stays queued; order completes only after all delivery", () => {
  let s = order();
  const originalCafe = structuredClone(s.customerOrders![0].items[0]);
  for (let i = 0; i < 4; i++) s = advance(s, 1, now + 2 * 60000);
  assert.equal(orderState(s.customerOrders![0]), "Partially delivered");
  assert.deepEqual(s.customerOrders![0].items[0], originalCafe);
  assert.equal(s.customerOrders![0].items[1].deliveredAt, now + 2 * 60000);
  for (let i = 0; i < 4; i++) s = advance(s, 0, now + 12 * 60000);
  assert.equal(orderState(s.customerOrders![0]), "Completed");
  assert.deepEqual(escalatedOrders(s, now + 20 * 60000), []);
});
test("line IDs distinguish the same product with different modifiers", () => {
  const s = order({
    lines: [line("p5"), { ...line("p5"), modifiers: "No sugar" }],
  });
  assert.notEqual(
    s.customerOrders![0].items[0].id,
    s.customerOrders![0].items[1].id,
  );
});
test("shop-only and café-only orders both enter the unified queue", () => {
  for (const id of ["p5", "p9"]) {
    const s = order({ lines: [line(id)] });
    assert.equal(s.customerOrders![0].items.length, 1);
    assert.equal(s.customerOrders![0].items[0].productId, id);
  }
});
test("placing order validates delivery, staff ID and account methods", () => {
  for (const patch of [
    { employeeId: "KV9999" },
    { location: "Elsewhere" },
    { payment: "Cash" as const },
    { payment: "Bank Transfer" as const },
  ])
    assert.throws(() => order(patch));
});
test("account limit and stock errors do not mutate input", () => {
  const s = seed(now);
  const copy = structuredClone(s);
  assert.throws(() => order({ lines: [line("p13", 40)] }, s), /stock/);
  assert.throws(
    () => order({ lines: [line("p13", 20), line("p1", 30)] }, s),
    /limit exceeded/,
  );
  assert.throws(() => order({ lines: [] }, s));
  assert.deepEqual(s, copy);
});
test("same submission cannot charge or reserve twice", () => {
  const s = order();
  assert.throws(() => order({}, s), /already recorded/);
});
test("operator role can update only its segment; managers manage both", () => {
  const s = order();
  const o = s.customerOrders![0];
  assert.throws(
    () =>
      updateItem(s, {
        orderId: o.id,
        itemId: o.items[0].id,
        role: "Cashier / Barista",
        now,
        nextState: "Preparing",
      }),
    /cannot manage/,
  );
  assert.throws(
    () =>
      updateItem(s, {
        orderId: o.id,
        itemId: o.items[1].id,
        role: "Kitchen / Café Prep",
        now,
        nextState: "Preparing",
      }),
    /cannot manage/,
  );
  assert.equal(
    updateItem(s, {
      orderId: o.id,
      itemId: o.items[0].id,
      role: "Store Manager / Admin",
      now,
      nextState: "Preparing",
    }).customerOrders![0].items[0].state,
    "Preparing",
  );
});
test("cannot skip stages, dispatch without runner, or redeliver", () => {
  let s = order();
  const o = s.customerOrders![0];
  const args = {
    orderId: o.id,
    itemId: o.items[1].id,
    role: "Cashier / Barista" as const,
    now,
  };
  assert.throws(
    () => updateItem(s, { ...args, nextState: "Delivered" }),
    /one fulfillment step/,
  );
  s = advance(advance(s, 1), 1);
  s.customerOrders![0].items[1].runner = "";
  assert.throws(
    () => updateItem(s, { ...args, nextState: "Dispatched" }),
    /runner/,
  );
  s = advance(advance(s, 1), 1);
  assert.throws(
    () => updateItem(s, { ...args, nextState: "Delivered" }),
    /already delivered/,
  );
});
test("10-minute warning, 15-minute boundary and over-15 escalation", () => {
  const s = order();
  const o = s.customerOrders![0];
  assert.equal(itemSla(o, o.items[0], now + 599999), "On time");
  assert.equal(itemSla(o, o.items[0], now + 600000), "Warning");
  assert.equal(itemSla(o, o.items[0], now + 900000), "Warning");
  assert.equal(itemSla(o, o.items[0], now + 900001), "Escalated");
  assert.equal(escalatedOrders(s, now + 900001).length, 1);
});
test("partial delivery retains manager escalation only for late undelivered items", () => {
  let s = order();
  for (let i = 0; i < 4; i++) s = advance(s, 1);
  const o = s.customerOrders![0];
  assert.equal(itemSla(o, o.items[1], now + 1000000), "Delivered");
  assert.equal(itemSla(o, o.items[0], now + 1000000), "Escalated");
  assert.equal(escalatedOrders(s, now + 1000000).length, 1);
});
test("manager follow-up is persisted and does not resolve an incomplete order", () => {
  const s = order();
  const o = s.customerOrders![0];
  const time = now + 1000000;
  assert.throws(
    () => acknowledgeOrder(s, o.id, "KV1042", "Following up", time),
    /Only a manager/,
  );
  assert.throws(() => acknowledgeOrder(s, o.id, "KV3001", " ", time), /note/);
  assert.throws(
    () => acknowledgeOrder(s, o.id, "KV3001", "Following up", now),
    /no overdue/,
  );
  const next = acknowledgeOrder(s, o.id, "KV3001", " Prioritizing meal ", time);
  assert.equal(next.customerOrders![0].managerNote, "Prioritizing meal");
  assert.equal(next.customerOrders![0].acknowledgedBy, "KV3001");
  assert.equal(escalatedOrders(next, time).length, 1);
  assert.notEqual(orderState(next.customerOrders![0]), "Completed");
});
test("fulfillment does not post another bill or deduct stock twice", () => {
  let s = order();
  const products = structuredClone(s.products);
  const sales = structuredClone(s.sales);
  for (let i = 0; i < 4; i++) s = advance(s, 1);
  assert.deepEqual(s.products, products);
  assert.deepEqual(s.sales, sales);
});
test("delivered timestamps and manager acknowledgment survive JSON persistence", () => {
  let s = order();
  for (let i = 0; i < 4; i++) s = advance(s, 1);
  s = acknowledgeOrder(
    s,
    s.customerOrders![0].id,
    "KV3001",
    "Kitchen contacted",
    now + 1000000,
  );
  const restored = JSON.parse(JSON.stringify(s)) as Store;
  assert.equal(orderState(restored.customerOrders![0]), "Partially delivered");
  assert.equal(restored.customerOrders![0].managerNote, "Kitchen contacted");
  assert.equal(restored.customerOrders![0].items[1].deliveredAt, now);
});
