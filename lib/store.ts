import { profileFor, type StaffProfile, type AllergyNote } from "./profiles";
import type { CustomerOrder } from "./orders";
export type Segment = "cafe" | "shop";
export type Role =
  "Cashier / Barista" | "Kitchen / Café Prep" | "Store Manager / Admin";
export type Payment =
  "Cash" | "Bank Transfer" | "Customer Credit" | "Salary Deduction";
export type Employee = {
  id: string;
  name: string;
  department: string;
  role: Role;
  creditLimit: number;
  salaryLimit: number;
};
export type Product = {
  id: string;
  name: string;
  category: string;
  segment: Segment;
  price: number;
  stock: number;
  low: number;
  emoji: string;
  sku: string;
};
export type Line = {
  productId: string;
  name: string;
  segment: Segment;
  price: number;
  qty: number;
  modifiers: string;
};
export type Sale = {
  id: string;
  at: number;
  payment: Payment;
  employeeId: string;
  reference: string;
  lines: Line[];
  cashierId: string;
  allergyNote?: AllergyNote;
};
export type Order = {
  id: string;
  saleId: string;
  created: number;
  readyAt?: number;
  completedAt?: number;
  status:
    "New" | "Preparing" | "Ready" | "Out for Staff Delivery" | "Completed";
  lines: Line[];
  location: string;
  runner: string;
  employeeId?: string;
  allergyNote?: AllergyNote;
};
export type Supply = {
  id: string;
  name: string;
  stock: number;
  unit: string;
  low: number;
};
export type PO = {
  id: string;
  segment: Segment;
  itemId: string;
  qty: number;
  cost: number;
  supplier: string;
  invoice: string;
  status: "Ordered" | "Received";
  at: number;
  receivedAt?: number;
};
export type Store = {
  version: 1;
  customerOrders?: CustomerOrder[];
  staffProfiles?: StaffProfile[];
  products: Product[];
  supplies: Supply[];
  sales: Sale[];
  orders: Order[];
  purchases: PO[];
};
export const employees: Employee[] = [
  {
    id: "KV1042",
    name: "Amira Hassan",
    department: "Café",
    role: "Cashier / Barista",
    creditLimit: 150,
    salaryLimit: 500,
  },
  {
    id: "KV2088",
    name: "Daniel Silva",
    department: "Kitchen",
    role: "Kitchen / Café Prep",
    creditLimit: 100,
    salaryLimit: 400,
  },
  {
    id: "KV3001",
    name: "Maya Patel",
    department: "Administration",
    role: "Store Manager / Admin",
    creditLimit: 300,
    salaryLimit: 750,
  },
  {
    id: "KV4106",
    name: "Ibrahim Ali",
    department: "Engineering",
    role: "Cashier / Barista",
    creditLimit: 100,
    salaryLimit: 350,
  },
];
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
export const total = (lines: Line[]) =>
  Math.round(lines.reduce((n, l) => n + l.qty * l.price, 0) * 100) / 100;
export const locations = [
  "Counter pickup",
  "Dine-in",
  "Staff Quarters",
  "Engineering",
  "Admin Block",
];
export function seed(now = Date.now()): Store {
  const rows: [string, string, Segment, number, number, string][] = [
    ["Chicken rice bowl", "Hot Meals", "cafe", 6.5, 0, "🍛"],
    ["Grilled sandwich", "Hot Meals", "cafe", 4.75, 0, "🥪"],
    ["Butter croissant", "Snacks", "cafe", 2.5, 0, "🥐"],
    ["Chocolate muffin", "Snacks", "cafe", 2.75, 0, "🧁"],
    ["Cappuccino", "Coffee/Beverages", "cafe", 3.5, 0, "☕"],
    ["Iced latte", "Coffee/Beverages", "cafe", 4, 0, "🧋"],
    ["Orange sunshine", "Fresh Juices", "cafe", 3.75, 0, "🍊"],
    ["Watermelon cooler", "Fresh Juices", "cafe", 3.5, 0, "🍉"],
    ["Mineral water", "Drinks", "shop", 1.25, 48, "💧"],
    ["Sea salt crisps", "Snacks", "shop", 1.75, 6, "🥔"],
    ["Dental care kit", "Toiletries", "shop", 3.25, 18, "🪥"],
    ["Shower essentials", "Toiletries", "shop", 4.5, 12, "🧴"],
    ["Mobile top-up $10", "Phone Cards", "shop", 10, 20, "📱"],
    ["Pocket notebook", "Essentials", "shop", 2, 0, "📒"],
    ["Chocolate bar", "Snacks", "shop", 1.5, 32, "🍫"],
    ["Sparkling citrus", "Drinks", "shop", 2.25, 4, "🥤"],
  ];
  const products = rows.map(
    ([name, category, segment, price, stock, emoji], i) => ({
      id: `p${i + 1}`,
      name,
      category,
      segment,
      price,
      stock,
      emoji,
      low: 8,
      sku: `890100${String(i + 1).padStart(4, "0")}`,
    }),
  );
  const line = (i: number, qty: number, modifiers = ""): Line => ({
    productId: products[i].id,
    name: products[i].name,
    segment: products[i].segment,
    price: products[i].price,
    qty,
    modifiers,
  });
  const sales: Sale[] = [
    {
      id: "S-1001",
      at: now - 18 * 60000,
      payment: "Salary Deduction",
      employeeId: "KV4106",
      reference: "",
      cashierId: "KV1042",
      lines: [
        line(0, 1, "Takeaway · Engineering"),
        line(4, 1, "Regular sugar"),
      ],
    },
    {
      id: "S-1002",
      at: now - 12 * 60000,
      payment: "Cash",
      employeeId: "",
      reference: "",
      cashierId: "KV1042",
      lines: [line(1, 2, "Dine-in")],
    },
    {
      id: "S-1003",
      at: now - 4 * 60000,
      payment: "Bank Transfer",
      employeeId: "",
      reference: "DEMO-7281",
      cashierId: "KV1042",
      lines: [line(5, 1), line(2, 1)],
    },
    {
      id: "S-1004",
      at: now - 45 * 60000,
      payment: "Customer Credit",
      employeeId: "KV2088",
      reference: "",
      cashierId: "KV1042",
      lines: [line(8, 2), line(10, 1)],
    },
    {
      id: "S-1005",
      at: now - 70 * 60000,
      payment: "Cash",
      employeeId: "",
      reference: "",
      cashierId: "KV1042",
      lines: [line(0, 2), line(6, 2)],
    },
    {
      id: "S-1006",
      at: now - 86400000 * 3,
      payment: "Salary Deduction",
      employeeId: "KV1042",
      reference: "",
      cashierId: "KV3001",
      lines: [line(12, 1), line(7, 2)],
    },
  ];
  return {
    version: 1,
    products,
    supplies: [
      { id: "s1", name: "Arabica coffee beans", stock: 12, unit: "kg", low: 5 },
      { id: "s2", name: "Fresh milk", stock: 4, unit: "litres", low: 8 },
      { id: "s3", name: "Long grain rice", stock: 25, unit: "kg", low: 10 },
      { id: "s4", name: "Takeaway cups", stock: 180, unit: "pieces", low: 100 },
    ],
    sales,
    orders: [
      {
        id: "K-101",
        saleId: "S-1001",
        created: sales[0].at,
        status: "Preparing",
        lines: sales[0].lines,
        location: "Engineering",
        runner: "",
      },
      {
        id: "K-102",
        saleId: "S-1002",
        created: sales[1].at,
        status: "Ready",
        readyAt: now - 60000,
        lines: sales[1].lines,
        location: "Dine-in",
        runner: "",
      },
      {
        id: "K-103",
        saleId: "S-1003",
        created: sales[2].at,
        status: "New",
        lines: sales[2].lines,
        location: "Counter pickup",
        runner: "",
      },
      {
        id: "K-104",
        saleId: "S-1005",
        created: sales[4].at,
        status: "Completed",
        readyAt: sales[4].at + 7 * 60000,
        completedAt: sales[4].at + 10 * 60000,
        lines: sales[4].lines,
        location: "Staff Quarters",
        runner: "Ravi",
      },
    ],
    purchases: [
      {
        id: "PO-1001",
        segment: "shop",
        itemId: "p10",
        qty: 24,
        cost: 0.9,
        supplier: "Island Wholesale",
        invoice: "INV-00481",
        at: now - 3600000,
        status: "Ordered",
      },
    ],
  };
}
export function accountUsed(
  store: Store,
  employeeId: string,
  payment: Payment,
  now: number,
) {
  const d = new Date(now);
  return total(
    store.sales
      .filter(
        (s) =>
          s.employeeId === employeeId &&
          s.payment === payment &&
          (payment !== "Salary Deduction" ||
            (new Date(s.at).getMonth() === d.getMonth() &&
              new Date(s.at).getFullYear() === d.getFullYear())),
      )
      .flatMap((s) => s.lines),
  );
}
export function checkout(
  store: Store,
  input: {
    lines: Line[];
    payment: Payment;
    employeeId: string;
    cash: number;
    reference: string;
    location: string;
    cashierId: string;
    role: Role;
    now: number;
    id: string;
  },
): Store {
  if (input.role === "Kitchen / Café Prep")
    throw Error("Kitchen staff cannot process payments.");
  if (!input.lines.length) throw Error("Add an item before checkout.");
  const demand = new Map<string, number>();
  const lines = input.lines.map((l) => {
    const p = store.products.find((p) => p.id === l.productId);
    if (!p || !Number.isInteger(l.qty) || l.qty < 1)
      throw Error("Invalid cart item.");
    demand.set(p.id, (demand.get(p.id) ?? 0) + l.qty);
    return { ...l, price: p.price, name: p.name, segment: p.segment };
  });
  store.products.forEach((p) => {
    if (p.segment === "shop" && (demand.get(p.id) ?? 0) > p.stock)
      throw Error(`${p.name}: insufficient stock.`);
  });
  const amount = total(lines);
  if (
    input.payment === "Cash" &&
    (!Number.isFinite(input.cash) || input.cash < amount)
  )
    throw Error("Cash received must cover the total.");
  if (input.payment === "Bank Transfer" && !input.reference.trim())
    throw Error("Enter the bank transfer reference.");
  if (
    input.payment === "Customer Credit" ||
    input.payment === "Salary Deduction"
  ) {
    const employee = employees.find((e) => e.id === input.employeeId);
    if (!employee) throw Error("Select a valid KV0000 employee.");
    const limit =
      input.payment === "Customer Credit"
        ? employee.creditLimit
        : employee.salaryLimit;
    if (
      accountUsed(store, employee.id, input.payment, input.now) + amount >
      limit
    )
      throw Error(`${input.payment} limit exceeded.`);
  }
  if (store.sales.some((s) => s.id === input.id))
    throw Error("This payment was already recorded.");
  const sale: Sale = {
    id: input.id,
    at: input.now,
    payment: input.payment,
    employeeId: employees.some((e) => e.id === input.employeeId)
      ? input.employeeId
      : "",
    allergyNote: structuredClone(profileFor(store, input.employeeId)),
    reference: input.reference.trim(),
    cashierId: input.cashierId,
    lines,
  };
  const cafe = lines.filter((l) => l.segment === "cafe");
  return {
    ...store,
    products: store.products.map((p) =>
      p.segment === "shop"
        ? { ...p, stock: p.stock - (demand.get(p.id) ?? 0) }
        : p,
    ),
    sales: [sale, ...store.sales],
    orders: cafe.length
      ? [
          {
            id: `K-${input.id.slice(2)}`,
            saleId: sale.id,
            employeeId: sale.employeeId,
            allergyNote: structuredClone(sale.allergyNote),
            created: input.now,
            status: "New",
            lines: cafe,
            location: input.location,
            runner: "",
          },
          ...store.orders,
        ]
      : store.orders,
  };
}
export function receive(
  store: Store,
  id: string,
  role: Role,
  now: number,
): Store {
  if (role !== "Store Manager / Admin")
    throw Error("Only managers can receive purchases.");
  const po = store.purchases.find((p) => p.id === id);
  if (!po || po.status === "Received")
    throw Error("Purchase already received or not found.");
  return {
    ...store,
    purchases: store.purchases.map((p) =>
      p.id === id ? { ...p, status: "Received", receivedAt: now } : p,
    ),
    products: store.products.map((p) =>
      po.segment === "shop" && p.id === po.itemId
        ? { ...p, stock: p.stock + po.qty }
        : p,
    ),
    supplies: store.supplies.map((p) =>
      po.segment === "cafe" && p.id === po.itemId
        ? { ...p, stock: p.stock + po.qty }
        : p,
    ),
  };
}
export function createPO(store: Store, po: PO, role: Role): Store {
  if (role !== "Store Manager / Admin")
    throw Error("Only managers can create purchases.");
  if (
    !po.supplier.trim() ||
    !po.invoice.trim() ||
    !Number.isInteger(po.qty) ||
    po.qty <= 0 ||
    !Number.isFinite(po.cost) ||
    po.cost <= 0
  )
    throw Error(
      "Enter supplier, invoice, positive whole quantity and unit cost.",
    );
  if (
    !(
      po.segment === "shop"
        ? store.products.filter((p) => p.segment === "shop")
        : store.supplies
    ).some((p) => p.id === po.itemId)
  )
    throw Error("Choose an item in the selected business segment.");
  if (
    store.purchases.some(
      (p) =>
        p.supplier.toLowerCase() === po.supplier.trim().toLowerCase() &&
        p.invoice.toLowerCase() === po.invoice.trim().toLowerCase(),
    )
  )
    throw Error("This supplier invoice already exists.");
  return {
    ...store,
    purchases: [
      { ...po, supplier: po.supplier.trim(), invoice: po.invoice.trim() },
      ...store.purchases,
    ],
  };
}
export function advanceOrder(store: Store, id: string, now: number): Store {
  const order = store.orders.find((o) => o.id === id);
  if (!order || order.status === "Completed")
    throw Error("Order is already complete.");
  if (
    order.status === "Ready" &&
    !["Counter pickup", "Dine-in"].includes(order.location) &&
    !order.runner.trim()
  )
    throw Error("Assign a delivery runner first.");
  return {
    ...store,
    orders: store.orders.map((o) =>
      o.id !== id
        ? o
        : o.status === "New"
          ? { ...o, status: "Preparing" }
          : o.status === "Preparing"
            ? { ...o, status: "Ready", readyAt: now }
            : o.status === "Ready"
              ? {
                  ...o,
                  status: ["Counter pickup", "Dine-in"].includes(o.location)
                    ? "Completed"
                    : "Out for Staff Delivery",
                  ...(["Counter pickup", "Dine-in"].includes(o.location)
                    ? { completedAt: now }
                    : {}),
                }
              : { ...o, status: "Completed", completedAt: now },
    ),
  };
}
export function inPeriod(at: number, period: string, now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "This Week")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === "This Month") start.setDate(1);
  return at >= start.getTime() && at <= now;
}
export function csv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map(
          (v) =>
            `"${String(v)
              .replace(/^[=+@\-\t\r]/, "'$&")
              .replaceAll('"', '""')}"`,
        )
        .join(","),
    )
    .join("\r\n");
}
