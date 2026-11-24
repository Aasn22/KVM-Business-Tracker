import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountUsed,
  advanceOrder,
  checkout,
  createPO,
  csv,
  inPeriod,
  receive,
  seed,
  total,
  type Line,
  type PO,
} from "./store";
const now = new Date(2026, 10, 24, 12).getTime();
const base = () => seed(now);
const line = (id = "p9", qty = 1): Line => {
  const p = base().products.find((p) => p.id === id)!;
  return {
    productId: p.id,
    name: p.name,
    segment: p.segment,
    price: p.price,
    qty,
    modifiers: "",
  };
};
const input = (
  patch: Partial<Parameters<typeof checkout>[1]> = {},
): Parameters<typeof checkout>[1] => ({
  lines: [line()],
  payment: "Cash",
  employeeId: "",
  cash: 100,
  reference: "",
  location: "Engineering",
  cashierId: "KV1042",
  role: "Cashier / Barista",
  now,
  id: "S-test",
  ...patch,
});
const po = (patch: Partial<PO> = {}): PO => ({
  id: "PO-test",
  segment: "shop",
  itemId: "p9",
  qty: 5,
  cost: 1,
  supplier: "Test Supplier",
  invoice: "INV-1",
  status: "Ordered",
  at: now,
  ...patch,
});
test("mixed cart deducts only retail stock and routes only café lines", () => {
  const s = base();
  const original = structuredClone(s);
  const next = checkout(s, input({ lines: [line("p9", 2), line("p5")] }));
  assert.equal(next.products.find((p) => p.id === "p9")!.stock, 46);
  assert.equal(next.products.find((p) => p.id === "p5")!.stock, 0);
  assert.equal(next.orders[0].lines.length, 1);
  assert.equal(next.orders[0].location, "Engineering");
  assert.equal(next.sales[0].lines.length, 2);
  assert.deepEqual(s, original);
});
test("retail-only sale does not create kitchen order", () => {
  const s = base();
  assert.equal(checkout(s, input()).orders.length, s.orders.length);
});
test("out-of-stock sale is blocked", () =>
  assert.throws(
    () => checkout(base(), input({ lines: [line("p14")] })),
    /stock/,
  ));
test("duplicate product lines cannot oversell stock", () =>
  assert.throws(
    () =>
      checkout(
        base(),
        input({
          lines: [line("p9", 30), { ...line("p9", 30), modifiers: "other" }],
        }),
      ),
    /stock/,
  ));
test("rejects empty cart and invalid quantity", () => {
  assert.throws(() => checkout(base(), input({ lines: [] })), /Add an item/);
  assert.throws(
    () => checkout(base(), input({ lines: [line("p9", 0.5)] })),
    /Invalid/,
  );
});
test("catalog price overrides tampered cart price", () =>
  assert.equal(
    checkout(base(), input({ lines: [{ ...line(), price: 0 }] })).sales[0]
      .lines[0].price,
    1.25,
  ));
test("cash must cover total and be finite", () => {
  assert.throws(() => checkout(base(), input({ cash: 0 })), /Cash received/);
  assert.throws(() => checkout(base(), input({ cash: NaN })), /Cash received/);
});
test("bank transfer requires nonblank reference", () => {
  assert.throws(
    () => checkout(base(), input({ payment: "Bank Transfer", reference: " " })),
    /reference/,
  );
  assert.equal(
    checkout(base(), input({ payment: "Bank Transfer", reference: " TXN-1 " }))
      .sales[0].reference,
    "TXN-1",
  );
});
test("staff payments require valid employee", () =>
  assert.throws(
    () =>
      checkout(
        base(),
        input({ payment: "Salary Deduction", employeeId: "KV9999" }),
      ),
    /valid/,
  ));
test("credit accumulates and blocks charges over available limit", () => {
  let s = base();
  s = checkout(
    s,
    input({
      payment: "Customer Credit",
      employeeId: "KV2088",
      lines: [line("p13", 9)],
    }),
  );
  assert.equal(accountUsed(s, "KV2088", "Customer Credit", now), 95.75);
  assert.throws(
    () =>
      checkout(
        s,
        input({
          id: "S-more",
          payment: "Customer Credit",
          employeeId: "KV2088",
          lines: [line("p13")],
        }),
      ),
    /limit exceeded/,
  );
});
test("salary monthly limits apply to combined segments and reset by month", () => {
  const s = base();
  s.sales = [
    {
      ...s.sales[0],
      at: new Date(2026, 9, 20).getTime(),
      employeeId: "KV2088",
      lines: [line("p13", 50)],
    },
  ];
  assert.equal(accountUsed(s, "KV2088", "Salary Deduction", now), 0);
  assert.doesNotThrow(() =>
    checkout(s, input({ payment: "Salary Deduction", employeeId: "KV2088" })),
  );
  s.sales[0].at = now;
  assert.throws(
    () =>
      checkout(s, input({ payment: "Salary Deduction", employeeId: "KV2088" })),
    /limit/,
  );
});
test("kitchen role cannot process payments", () =>
  assert.throws(
    () => checkout(base(), input({ role: "Kitchen / Café Prep" })),
    /cannot process/,
  ));
test("same transaction cannot be posted twice", () => {
  const s = checkout(base(), input());
  assert.throws(() => checkout(s, input()), /already recorded/);
});
test("receiving retail PO changes retail stock once and keeps supplies intact", () => {
  const s = base();
  const next = receive(s, "PO-1001", "Store Manager / Admin", now);
  assert.equal(next.products.find((p) => p.id === "p10")!.stock, 30);
  assert.deepEqual(next.supplies, s.supplies);
  assert.throws(
    () => receive(next, "PO-1001", "Store Manager / Admin", now),
    /already received/,
  );
});
test("café purchase increases ingredients without changing retail stock", () => {
  const s = createPO(
    base(),
    po({ segment: "cafe", itemId: "s1" }),
    "Store Manager / Admin",
  );
  const next = receive(s, "PO-test", "Store Manager / Admin", now);
  assert.equal(next.supplies[0].stock, 17);
  assert.deepEqual(s.products, next.products);
});
test("purchase validates segment, supplier, invoice, quantity and cost", () => {
  for (const patch of [
    { segment: "cafe" as const },
    { supplier: "" },
    { invoice: "" },
    { qty: 0 },
    { qty: 2.5 },
    { cost: -1 },
  ])
    assert.throws(() => createPO(base(), po(patch), "Store Manager / Admin"));
});
test("duplicate invoices and cashier purchasing are blocked", () => {
  const s = createPO(base(), po(), "Store Manager / Admin");
  assert.throws(
    () => createPO(s, po({ id: "PO-other" }), "Store Manager / Admin"),
    /already exists/,
  );
  assert.throws(() => createPO(base(), po(), "Cashier / Barista"), /managers/);
  assert.throws(
    () => receive(base(), "PO-1001", "Cashier / Barista", now),
    /managers/,
  );
});
test("delivery requires runner and records ready/completion times", () => {
  let s = base();
  s = advanceOrder(s, "K-101", now);
  assert.equal(s.orders[0].readyAt, now);
  assert.throws(() => advanceOrder(s, "K-101", now), /runner/);
  s.orders[0].runner = "Ravi";
  s = advanceOrder(s, "K-101", now + 60000);
  assert.equal(s.orders[0].status, "Out for Staff Delivery");
  s = advanceOrder(s, "K-101", now + 120000);
  assert.equal(s.orders[0].completedAt, now + 120000);
  assert.throws(() => advanceOrder(s, "K-101", now), /already complete/);
});
test("pickup ready order completes without a delivery runner", () => {
  const s = advanceOrder(base(), "K-102", now);
  assert.equal(s.orders.find((o) => o.id === "K-102")!.status, "Completed");
});
test("period filters use local day, Monday week and calendar month boundaries", () => {
  assert.equal(inPeriod(now - 2 * 3600000, "Today", now), true);
  assert.equal(inPeriod(now - 86400000, "Today", now), false);
  assert.equal(
    inPeriod(new Date(2026, 10, 23, 10).getTime(), "This Week", now),
    true,
  );
  assert.equal(
    inPeriod(new Date(2026, 10, 22, 10).getTime(), "This Week", now),
    false,
  );
  assert.equal(
    inPeriod(new Date(2026, 10, 1).getTime(), "This Month", now),
    true,
  );
  assert.equal(inPeriod(now + 1, "Today", now), false);
});
test("CSV quotes values, escapes quotes and neutralizes spreadsheet formulas", () =>
  assert.equal(csv([["=SUM(A1)", 'a,"b', 1]]), '"\'=SUM(A1)","a,""b","1"'));
test("totals are rounded to currency precision", () =>
  assert.equal(total([{ ...line(), price: 0.1, qty: 3 }]), 0.3));
