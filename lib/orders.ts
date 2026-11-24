import {
  checkout,
  employees,
  type Line,
  type Payment,
  type Role,
  type Store,
} from "./store";
export type ItemState =
  "Queued" | "Preparing" | "Ready" | "Dispatched" | "Delivered";
export type FulfillmentItem = Line & {
  id: string;
  state: ItemState;
  runner: string;
  readyAt?: number;
  deliveredAt?: number;
};
export type CustomerOrder = {
  id: string;
  saleId: string;
  employeeId: string;
  created: number;
  location: string;
  source: "Staff portal";
  items: FulfillmentItem[];
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  managerNote?: string;
};
export const SLA_WARNING_MINUTES = 10;
export const SLA_ESCALATION_MINUTES = 15;
export function orderState(order: CustomerOrder) {
  if (order.items.every((i) => i.state === "Delivered")) return "Completed";
  if (order.items.some((i) => i.state === "Delivered"))
    return "Partially delivered";
  if (order.items.some((i) => i.state === "Dispatched"))
    return "Out for delivery";
  return "In progress";
}
export function itemSla(
  order: CustomerOrder,
  item: FulfillmentItem,
  now: number,
) {
  const age = ((item.deliveredAt ?? now) - order.created) / 60000;
  return item.state === "Delivered"
    ? "Delivered"
    : age > SLA_ESCALATION_MINUTES
      ? "Escalated"
      : age >= SLA_WARNING_MINUTES
        ? "Warning"
        : "On time";
}
export function escalatedOrders(store: Store, now: number) {
  return (store.customerOrders ?? []).filter((o) =>
    o.items.some((i) => itemSla(o, i, now) === "Escalated"),
  );
}
export function placeOrder(
  store: Store,
  input: {
    employeeId: string;
    lines: Line[];
    payment: Payment;
    location: string;
    now: number;
    id: string;
  },
): Store {
  if (!employees.some((e) => e.id === input.employeeId))
    throw Error("Sign in with a valid demo staff account.");
  if (!["Customer Credit", "Salary Deduction"].includes(input.payment))
    throw Error("Staff portal supports demo credit or salary deduction only.");
  if (
    !["Staff Quarters", "Engineering", "Admin Block"].includes(input.location)
  )
    throw Error("Choose a staff delivery location.");
  const charged = checkout(store, {
    ...input,
    cash: 0,
    reference: "",
    cashierId: "STAFF-PORTAL",
    role: "Cashier / Barista",
  });
  const sale = charged.sales[0];
  const order: CustomerOrder = {
    id: `WEB-${input.id.slice(2)}`,
    saleId: sale.id,
    employeeId: input.employeeId,
    created: input.now,
    location: input.location,
    source: "Staff portal",
    items: sale.lines.map((l, n) => ({
      ...l,
      id: `${input.id}-${n}`,
      state: "Queued",
      runner: "",
    })),
  };
  return {
    ...charged,
    orders: charged.orders.filter((o) => o.saleId !== sale.id),
    customerOrders: [order, ...(store.customerOrders ?? [])],
  };
}
export function canFulfill(role: Role, item: FulfillmentItem) {
  return (
    role === "Store Manager / Admin" ||
    (role === "Kitchen / Café Prep"
      ? item.segment === "cafe"
      : item.segment === "shop")
  );
}
export function updateItem(
  store: Store,
  input: {
    orderId: string;
    itemId: string;
    role: Role;
    now: number;
    runner?: string;
    nextState?: ItemState;
  },
): Store {
  const order = store.customerOrders?.find((o) => o.id === input.orderId);
  const item = order?.items.find((i) => i.id === input.itemId);
  if (!order || !item) throw Error("Order item not found.");
  if (!canFulfill(input.role, item))
    throw Error(
      "You cannot manage this business segment. Switch to the assigned operator role.",
    );
  if (item.state === "Delivered")
    throw Error("This item is already delivered.");
  let updated = { ...item };
  if (input.runner !== undefined) updated.runner = input.runner;
  if (input.nextState) {
    const states: ItemState[] = [
      "Queued",
      "Preparing",
      "Ready",
      "Dispatched",
      "Delivered",
    ];
    if (states.indexOf(input.nextState) !== states.indexOf(item.state) + 1)
      throw Error("Advance one fulfillment step at a time.");
    if (input.nextState === "Dispatched" && !updated.runner.trim())
      throw Error("Assign a delivery runner before dispatch.");
    updated = {
      ...updated,
      state: input.nextState,
      ...(input.nextState === "Ready" ? { readyAt: input.now } : {}),
      ...(input.nextState === "Delivered" ? { deliveredAt: input.now } : {}),
    };
  }
  return {
    ...store,
    customerOrders: store.customerOrders!.map((o) =>
      o.id !== order.id
        ? o
        : { ...o, items: o.items.map((i) => (i.id === item.id ? updated : i)) },
    ),
  };
}
export function acknowledgeOrder(
  store: Store,
  orderId: string,
  managerId: string,
  note: string,
  now: number,
): Store {
  if (
    employees.find((e) => e.id === managerId)?.role !== "Store Manager / Admin"
  )
    throw Error("Only a manager can acknowledge escalations.");
  if (!note.trim()) throw Error("Enter a follow-up note for the customer.");
  if (!escalatedOrders(store, now).some((o) => o.id === orderId))
    throw Error("This order has no overdue items.");
  return {
    ...store,
    customerOrders: store.customerOrders!.map((o) =>
      o.id === orderId
        ? {
            ...o,
            acknowledgedAt: now,
            acknowledgedBy: managerId,
            managerNote: note.trim(),
          }
        : o,
    ),
  };
}
