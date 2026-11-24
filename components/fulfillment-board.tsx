"use client";
import { AllergyAlert } from "./allergy-alert";
import { profileFor } from "@/lib/profiles";
import { useState } from "react";
import { ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { employees, type Employee, type Store } from "@/lib/store";
import {
  acknowledgeOrder,
  canFulfill,
  escalatedOrders,
  itemSla,
  orderState,
  updateItem,
  reviewAllergy,
  type ItemState,
} from "@/lib/orders";
const nextStates: Partial<Record<ItemState, ItemState>> = {
  Queued: "Preparing",
  Preparing: "Ready",
  Ready: "Dispatched",
  Dispatched: "Delivered",
};
const labels: Partial<Record<ItemState, string>> = {
  Queued: "Start preparing / packing",
  Preparing: "Mark ready",
  Ready: "Dispatch item",
  Dispatched: "Mark item delivered",
};
export function FulfillmentBoard({
  store,
  commit,
  user,
  now,
}: {
  store: Store;
  commit: (store: Store) => void;
  user: Employee;
  now: number;
}) {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [filter, setFilter] = useState("Active");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const manager = user.role === "Store Manager / Admin";
  const escalations = escalatedOrders(store, now);
  const all = store.customerOrders ?? [];
  const orders = all
    .filter(
      (o) =>
        `${o.id} ${o.employeeId} ${o.location} ${employees.find((e) => e.id === o.employeeId)?.name ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (segment === "all" ||
          o.items.some(
            (i) => i.segment === segment && i.state !== "Delivered",
          )),
    )
    .filter((o) =>
      filter === "Completed"
        ? orderState(o) === "Completed"
        : filter === "Escalated"
          ? escalations.some((e) => e.id === o.id)
          : orderState(o) !== "Completed",
    )
    .sort((a, b) => a.created - b.created);
  function apply(fn: () => Store) {
    setError("");
    try {
      commit(fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    }
  }
  return (
    <section className="fulfillment">
      <div className="section-heading">
        <div>
          <div className="eyebrow">STAFF ONLINE ORDER DEMO</div>
          <h1>Orders & item dispatch</h1>
          <p>
            One combined order. Prepare, dispatch and deliver each café or shop
            item separately.
          </p>
        </div>
      </div>
      <div className="info-banner">
        Demo sync works between tabs of this browser/origin only. Staff
        ordering: <a href="/staff">Open staff portal →</a>
      </div>
      {manager && escalations.length > 0 && (
        <div className="alert danger">
          <AlertTriangle size={18} />
          <strong>
            {escalations.length} orders need manager attention.
          </strong>{" "}
          Undelivered items have exceeded 15 minutes.
        </div>
      )}
      {error && (
        <div className="alert danger" role="alert">
          {error}
        </div>
      )}
      <div className="dispatch-summary">
        <div>
          <strong>
            {all.filter((o) => orderState(o) !== "Completed").length}
          </strong>
          <span>Active orders</span>
        </div>
        <div>
          <strong>
            {all.filter((o) => orderState(o) === "Partially delivered").length}
          </strong>
          <span>Partially delivered</span>
        </div>
        <div>
          <strong>
            {
              all.filter(
                (o) =>
                  orderState(o) !== "Completed" &&
                  (profileFor(store, o.employeeId).declaration ===
                    "Allergies declared" ||
                    o.allergyNote?.declaration === "Allergies declared") &&
                  o.safetyReviewedRevision !==
                    profileFor(store, o.employeeId).revision,
              ).length
            }
          </strong>
          <span>Allergy reviews needed</span>
        </div>
        <div>
          <strong>{escalations.length}</strong>
          <span>Overdue orders</span>
        </div>
      </div>
      <div className="dispatch-search">
        <Input
          aria-label="Search orders"
          placeholder="Search order, staff name, employee ID or destination…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Pending business segment"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
        >
          <option value="all">All business segments</option>
          <option value="cafe">Café items pending</option>
          <option value="shop">Shop items pending</option>
        </select>
      </div>
      <div className="filter-row">
        {["Active", "Escalated", "Completed"].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f}
            {f === "Escalated" ? ` (${escalations.length})` : ""}
          </Button>
        ))}
      </div>
      <p className="muted">
        Warnings begin at 10 minutes; manager escalation after 15 minutes until
        all overdue items are delivered. Acknowledgment does not close or reset
        an overdue order. In-app alerts only; no background notifications.
        Kitchen manages café lines, cashier manages shop lines, manager manages
        both.
      </p>
      <div className="fulfillment-list">
        {orders.map((o) => {
          const overdue = escalations.some((e) => e.id === o.id);
          return (
            <Card className="fulfillment-card" key={o.id}>
              <div className="portal-order-heading">
                <div>
                  <h2>{o.id}</h2>
                  <small>
                    {employees.find((e) => e.id === o.employeeId)?.name} ·{" "}
                    {o.employeeId} · {o.location}
                  </small>
                  <small>
                    Bill {o.saleId} · {new Date(o.created).toLocaleString()}
                  </small>
                </div>
                <div>
                  <span
                    className={`status-badge ${orderState(o) !== "Completed" ? "low" : ""}`}
                  >
                    {orderState(o)}
                  </span>
                  <small>
                    {o.items.filter((i) => i.state === "Delivered").length}/
                    {o.items.length} item lines delivered
                  </small>
                </div>
              </div>
              <AllergyAlert
                note={o.allergyNote}
                label="Order allergy note (at checkout)"
              />
              {orderState(o) !== "Completed" &&
                (o.allergyNote?.revision ?? 0) !==
                  profileFor(store, o.employeeId).revision && (
                  <AllergyAlert
                    note={profileFor(store, o.employeeId)}
                    changed
                    label="Current staff allergy update"
                  />
                )}
              {orderState(o) !== "Completed" &&
                (profileFor(store, o.employeeId).declaration ===
                  "Allergies declared" ||
                  o.allergyNote?.declaration === "Allergies declared") && (
                  <div className="safety-review">
                    {o.safetyReviewedRevision ===
                    profileFor(store, o.employeeId).revision ? (
                      <span>
                        Current allergy note reviewed by {o.safetyReviewedBy} ·{" "}
                        {new Date(o.safetyReviewedAt!).toLocaleTimeString()}
                      </span>
                    ) : (
                      <>
                        <strong>
                          Safety review required before preparing or dispatching
                        </strong>
                        <Button
                          variant="outline"
                          onClick={() =>
                            apply(() =>
                              reviewAllergy(store, o.id, user.id, Date.now()),
                            )
                          }
                        >
                          I have reviewed the current allergy note
                        </Button>
                      </>
                    )}
                  </div>
                )}
              {o.items.map((item) => {
                const sla = itemSla(o, item, now);
                const allowed = canFulfill(user.role, item);
                return (
                  <div className="fulfillment-item" key={item.id}>
                    <div className="fulfillment-item-title">
                      <div>
                        <strong>
                          {item.qty}× {item.name}
                        </strong>
                        <small>
                          {item.segment === "cafe" ? "Café" : "Shop"} ·{" "}
                          {item.modifiers || "Standard item"}
                        </small>
                      </div>
                      <span
                        className={`sla ${sla === "Escalated" ? "red pulse" : sla === "Warning" ? "amber" : "green"}`}
                      >
                        {sla === "Delivered" ? (
                          <CheckCircle2 size={13} />
                        ) : null}
                        {sla} ·{" "}
                        {Math.max(
                          0,
                          Math.floor(
                            ((item.deliveredAt ?? now) - o.created) / 60000,
                          ),
                        )}{" "}
                        min
                      </span>
                    </div>
                    <div className="fulfillment-controls">
                      <span className="status-badge">{item.state}</span>
                      {item.state !== "Delivered" ? (
                        allowed ? (
                          <>
                            <label className="runner-label">
                              <span>Runner for {item.name}</span>
                              <Input
                                aria-label={`Runner for ${o.id} ${item.id}`}
                                placeholder="Delivery runner"
                                value={item.runner}
                                onChange={(e) =>
                                  apply(() =>
                                    updateItem(store, {
                                      orderId: o.id,
                                      itemId: item.id,
                                      role: user.role,
                                      runner: e.target.value,
                                      now: Date.now(),
                                    }),
                                  )
                                }
                              />
                            </label>
                            <Button
                              className="primary"
                              onClick={() =>
                                apply(() =>
                                  updateItem(store, {
                                    orderId: o.id,
                                    itemId: item.id,
                                    role: user.role,
                                    nextState: nextStates[item.state],
                                    now: Date.now(),
                                  }),
                                )
                              }
                            >
                              {labels[item.state]}
                              <ArrowRight size={15} />
                            </Button>
                          </>
                        ) : (
                          <small>
                            Managed by{" "}
                            {item.segment === "cafe"
                              ? "Kitchen"
                              : "Shop cashier"}{" "}
                            / Manager
                          </small>
                        )
                      ) : (
                        <small>
                          Delivered{" "}
                          {new Date(item.deliveredAt!).toLocaleTimeString()} ·{" "}
                          {item.runner}
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
              {o.managerNote && (
                <div className="info-banner">
                  Manager {o.acknowledgedBy} ·{" "}
                  {new Date(o.acknowledgedAt!).toLocaleString()}:{" "}
                  {o.managerNote}
                </div>
              )}
              {manager && overdue && (
                <div className="escalation-note">
                  <label className="field">
                    <span>Manager follow-up (visible to staff customer)</span>
                    <Input
                      value={notes[o.id] ?? ""}
                      onChange={(e) =>
                        setNotes({ ...notes, [o.id]: e.target.value })
                      }
                      placeholder="e.g. Contacted kitchen; remaining meal is being prioritized."
                    />
                  </label>
                  <Button
                    variant="outline"
                    onClick={() =>
                      apply(() =>
                        acknowledgeOrder(
                          store,
                          o.id,
                          user.id,
                          notes[o.id] ?? "",
                          Date.now(),
                        ),
                      )
                    }
                  >
                    {o.acknowledgedAt
                      ? "Update follow-up"
                      : "Acknowledge & notify in app"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
        {!orders.length && (
          <Card className="empty">
            No {filter.toLowerCase()} staff portal orders. Place a demo order at
            /staff to test combined fulfillment.
          </Card>
        )}
      </div>
    </section>
  );
}
