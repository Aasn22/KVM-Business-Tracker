"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  Coffee,
  ShoppingBag,
  ArrowRight,
  Plus,
  Minus,
  LogOut,
  ReceiptText,
  Download,
  Package,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  accountUsed,
  csv,
  employees,
  money,
  total,
  type Employee,
  type Line,
  type Payment,
  type Product,
} from "@/lib/store";
import {
  itemSla,
  orderState,
  placeOrder,
  type CustomerOrder,
} from "@/lib/orders";
import { useDemoStore } from "@/lib/use-demo-store";

export default function StaffPortal() {
  const { store, commit, now, warning } = useDemoStore();
  const [user, setUser] = useState<Employee | null>(null);
  const [id, setId] = useState("KV4106");
  const [pin, setPin] = useState("1234");
  const [tab, setTab] = useState("Order food & essentials");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [location, setLocation] = useState("Staff Quarters");
  const [payment, setPayment] = useState<Payment>("Salary Deduction");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sugar, setSugar] = useState("Regular sugar");
  const [service, setService] = useState("Staff delivery");
  const busy = useRef(false);
  function run(fn: () => void) {
    setError("");
    setMessage("");
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  }
  if (!store) return <main className="loading">Opening staff portal…</main>;
  function signIn() {
    run(() => {
      const employee = employees.find((e) => e.id === id);
      if (!employee || pin !== "1234")
        throw Error("Use a listed demo Employee ID and demo PIN 1234.");
      setUser(employee);
      setCart([]);
    });
  }
  const mine = (store.customerOrders ?? []).filter(
    (o) => o.employeeId === user?.id,
  );
  const bills = store.sales.filter((s) => s.employeeId === user?.id);
  function add(product: Product, existingModifiers?: string) {
    run(() => {
      const reserved = cart
        .filter((l) => l.productId === product.id)
        .reduce((n, l) => n + l.qty, 0);
      if (product.segment === "shop" && reserved >= product.stock)
        throw Error("No more stock available.");
      const modifiers =
        existingModifiers ??
        (product.segment === "cafe" ? `${sugar} · ${service}` : "");
      const index = cart.findIndex(
        (l) => l.productId === product.id && l.modifiers === modifiers,
      );
      setCart(
        index < 0
          ? [
              ...cart,
              {
                productId: product.id,
                name: product.name,
                segment: product.segment,
                price: product.price,
                qty: 1,
                modifiers,
              },
            ]
          : cart.map((l, n) => (n === index ? { ...l, qty: l.qty + 1 } : l)),
      );
    });
  }
  function submit() {
    if (busy.current || !user || !store) return;
    busy.current = true;
    run(() => {
      const next = placeOrder(store, {
        employeeId: user.id,
        lines: cart,
        payment,
        location,
        id: `S-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        now: Date.now(),
      });
      commit(next);
      setCart([]);
      setTab("My orders");
      setMessage(
        `Order ${next.customerOrders![0].id} placed. Both services share this order; items can arrive separately.`,
      );
    });
    busy.current = false;
  }
  function downloadBill(saleId: string) {
    const sale = bills.find((s) => s.id === saleId)!;
    const rows: (string | number)[][] = [
      [
        "Bill",
        "Date",
        "Employee",
        "Payment",
        "Segment",
        "Item",
        "Modifiers",
        "Qty",
        "Unit price USD",
        "Amount USD",
      ],
      ...sale.lines.map((l) => [
        sale.id,
        new Date(sale.at).toISOString(),
        sale.employeeId,
        sale.payment,
        l.segment,
        l.name,
        l.modifiers,
        l.qty,
        l.price,
        total([l]),
      ]),
      ["", "", "", "", "", "TOTAL USD", "", "", "", total(sale.lines)],
    ];
    const url = URL.createObjectURL(
      new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `bill-${sale.id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const alerts = (
    <>
      {warning && <div className="alert warning">{warning}</div>}
      {error && (
        <div className="alert danger" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
    </>
  );
  if (!user)
    return (
      <main className="staff-login">
        <div className="eyebrow">KVM STAFF COLLECTIVE</div>
        <h1>Your break, delivered.</h1>
        <p>Café meals and tuck shop essentials. One order, one account.</p>
        <Card className="staff-login-card">
          <h2>Staff ordering login</h2>
          <p className="muted">Demo only · no real credentials or funds.</p>
          {alerts}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
            }}
          >
            <label className="field">
              <span>Employee ID</span>
              <select value={id} onChange={(e) => setId(e.target.value)}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.id} · {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Demo PIN</span>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </label>
            <p className="muted">Public demo PIN: 1234</p>
            <Button type="submit" className="primary wide">
              Start shopping <ArrowRight size={17} />
            </Button>
          </form>
          <Link href="/">Operator POS & manager login →</Link>
        </Card>
        <div className="info-banner">
          This is the staff/customer demo portal, not a live online shop. Orders
          sync only between tabs in this same browser and origin. Different
          phones/devices do not share orders. Do not enter real financial
          information.
        </div>
      </main>
    );
  function renderOrder(o: CustomerOrder) {
    return (
      <Card key={o.id} className="portal-order">
        <div className="portal-order-heading">
          <div>
            <h2>{o.id}</h2>
            <small>
              {new Date(o.created).toLocaleString()} · {o.location}
            </small>
          </div>
          <span
            className={`status-badge ${orderState(o) !== "Completed" ? "low" : ""}`}
          >
            {orderState(o)}
          </span>
        </div>
        <p className="muted">
          Bill {o.saleId} ·{" "}
          {o.items.filter((i) => i.state === "Delivered").length}/
          {o.items.length} item lines delivered
        </p>
        {o.items.map((i) => (
          <div className="portal-tracking-item" key={i.id}>
            <div>
              <strong>
                {i.qty}× {i.name}
              </strong>
              <small>
                {i.segment === "cafe" ? "Staff Café" : "Tuck Shop"} ·{" "}
                {i.modifiers || "Standard item"}
              </small>
              <small>
                {i.runner && `Runner: ${i.runner} · `}
                {i.deliveredAt
                  ? `Delivered ${new Date(i.deliveredAt).toLocaleTimeString()}`
                  : `${Math.max(0, Math.floor((now - o.created) / 60000))} min elapsed`}
              </small>
            </div>
            <div>
              <span className="status-badge">{i.state}</span>
              {itemSla(o, i, now) === "Escalated" && (
                <small className="overdue-text">
                  Manager escalation · overdue
                </small>
              )}
            </div>
          </div>
        ))}
        {o.managerNote && (
          <div className="info-banner">Manager update: {o.managerNote}</div>
        )}
        <p className="muted">
          The order completes automatically only when every item line has been
          delivered. Items may arrive in separate deliveries.
        </p>
      </Card>
    );
  }
  return (
    <div className="staff-portal">
      <header className="portal-header">
        <Link href="/staff" className="brand">
          <div className="brand-icon">
            <Coffee />
          </div>
          <div>
            KVM<span>YOUR STAFF STORE</span>
          </div>
        </Link>
        <div>
          <strong>{user.name}</strong>
          <small>{user.id} · Staff customer</small>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setUser(null);
            setCart([]);
            setError("");
            setMessage("");
          }}
        >
          <LogOut size={16} />
          Sign out
        </Button>
      </header>
      <div className="portal-demo">
        <strong>DEMO ONLY</strong> Browser-local ordering · no real payment ·{" "}
        <Link href="/">Open operator system</Link>
      </div>
      <main className="portal-main">
        <div className="section-heading">
          <div>
            <div className="eyebrow">YOUR EVERYDAY, SIMPLIFIED</div>
            <h1>Hello, {user.name.split(" ")[0]}.</h1>
            <p>A good meal and daily essentials, all on the same page.</p>
          </div>
          <span className="status-badge">
            {mine.filter((o) => orderState(o) !== "Completed").length} active
            orders
          </span>
        </div>
        <nav className="portal-tabs">
          {["Order food & essentials", "My orders", "My account & bills"].map(
            (t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => {
                  setTab(t);
                  setError("");
                }}
              >
                {t}
              </button>
            ),
          )}
        </nav>
        {alerts}
        {tab === "Order food & essentials" && (
          <div className="portal-shop-layout">
            <section>
              <Input
                aria-label="Search food and shop items"
                placeholder="Search café meals or shop essentials…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="portal-modifiers">
                <label className="field">
                  <span>Café sugar preference (new items)</span>
                  <select
                    value={sugar}
                    onChange={(e) => setSugar(e.target.value)}
                  >
                    {[
                      "No sugar",
                      "Less sugar",
                      "Regular sugar",
                      "Extra sugar",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Café packing (new items)</span>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  >
                    {["Staff delivery", "Takeaway"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              {(["cafe", "shop"] as const).map((segment) => (
                <section key={segment} className="portal-catalog">
                  <h2>
                    {segment === "cafe" ? (
                      <Coffee size={20} />
                    ) : (
                      <ShoppingBag size={20} />
                    )}
                    {segment === "cafe" ? "Staff Café" : "Tuck Shop"}
                    <small>
                      {segment === "cafe"
                        ? "Fresh meals & drinks"
                        : "Everyday essentials"}
                    </small>
                  </h2>
                  <div className="product-grid">
                    {store.products
                      .filter(
                        (p) =>
                          p.segment === segment &&
                          `${p.name} ${p.sku}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((p) => (
                        <button
                          key={p.id}
                          className="product-card"
                          disabled={p.segment === "shop" && !p.stock}
                          onClick={() => add(p)}
                        >
                          <div className="product-art">
                            <span aria-hidden="true">{p.emoji}</span>
                            {p.segment === "shop" && (
                              <span
                                className={`stock-badge ${p.stock <= p.low ? "low" : ""}`}
                              >
                                {p.stock
                                  ? `${p.stock} available`
                                  : "Out of stock"}
                              </span>
                            )}
                          </div>
                          <div className="product-info">
                            <small>{p.category}</small>
                            <h3>{p.name}</h3>
                            <div>
                              <strong>{money(p.price)}</strong>
                              <Plus size={18} />
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                  {!store.products.some(
                    (p) =>
                      p.segment === segment &&
                      `${p.name} ${p.sku}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  ) && (
                    <p className="empty">
                      No matching {segment === "cafe" ? "café" : "shop"} items.
                    </p>
                  )}
                </section>
              ))}
            </section>
            <Card className="portal-cart">
              <h2>Your combined order</h2>
              <p className="muted">One bill. Separate item deliveries.</p>
              {cart.map((l, index) => (
                <div className="cart-line" key={`${l.productId}-${index}`}>
                  <div className="cart-line-head">
                    <strong>{l.name}</strong>
                    <b>{money(total([l]))}</b>
                  </div>
                  <small>
                    {l.segment === "cafe" ? "Café" : "Shop"} · {l.modifiers}
                  </small>
                  <div className="quantity">
                    <button
                      aria-label={`Remove one ${l.name}`}
                      onClick={() =>
                        setCart(
                          cart.flatMap((item, n) =>
                            n !== index
                              ? [item]
                              : item.qty > 1
                                ? [{ ...item, qty: item.qty - 1 }]
                                : [],
                          ),
                        )
                      }
                    >
                      <Minus size={15} />
                    </button>
                    <span>{l.qty}</span>
                    <button
                      aria-label={`Add one ${l.name}`}
                      onClick={() =>
                        add(
                          store.products.find((p) => p.id === l.productId)!,
                          l.modifiers,
                        )
                      }
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {!cart.length && (
                <div className="empty">
                  <ShoppingBag />
                  Add café and shop items above.
                </div>
              )}
              <label className="field">
                <span>Delivery location</span>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {["Staff Quarters", "Engineering", "Admin Block"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Charge my account</span>
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value as Payment)}
                >
                  <option>Salary Deduction</option>
                  <option>Customer Credit</option>
                </select>
              </label>
              <div className="account-info">
                Available{" "}
                {money(
                  (payment === "Salary Deduction"
                    ? user.salaryLimit
                    : user.creditLimit) -
                    accountUsed(store, user.id, payment, now),
                )}
                <br />
                Charged to {user.id} only. No other employee can be selected.
              </div>
              <div className="total-row">
                <span>Total USD · no tax</span>
                <strong>{money(total(cart))}</strong>
              </div>
              <Button
                className="primary wide"
                disabled={!cart.length}
                onClick={submit}
              >
                Place demo order <ArrowRight size={17} />
              </Button>
              <p className="muted">
                Shop stock is deducted and your demo account is charged when
                placed. No real funds are moved.
              </p>
            </Card>
          </div>
        )}
        {tab === "My orders" && (
          <section className="portal-orders">
            {mine.map(renderOrder)}
            {!mine.length && (
              <Card className="empty">
                <Package />
                No orders yet. Choose food and shop items to start.
              </Card>
            )}
            <div className="info-banner">
              <Clock3 size={20} />
              SLA: warning from 10 minutes; incomplete items over 15 minutes
              appear in the manager escalation queue. In-app only while the demo
              is open; no email, SMS or background notifications.
            </div>
          </section>
        )}
        {tab === "My account & bills" && (
          <>
            <div className="report-stats">
              <Card>
                <small>Outstanding customer credit</small>
                <strong>
                  {money(accountUsed(store, user.id, "Customer Credit", now))}
                </strong>
                <span>
                  Limit {money(user.creditLimit)} · all-time demo balance
                </span>
              </Card>
              <Card>
                <small>Salary deductions this month</small>
                <strong>
                  {money(accountUsed(store, user.id, "Salary Deduction", now))}
                </strong>
                <span>Monthly limit {money(user.salaryLimit)}</span>
              </Card>
              <Card>
                <small>Account owner</small>
                <strong>{user.id}</strong>
                <span>
                  {user.name} · {user.department}
                </span>
              </Card>
            </div>
            <p className="info-banner">
              Bills include portal orders and POS charges to your account. These
              are demo statements, not tax invoices. Repayments and payroll
              settlement are not implemented.
            </p>
            {bills.map((s) => (
              <Card className="portal-bill" key={s.id}>
                <div className="portal-order-heading">
                  <div>
                    <h2>
                      <ReceiptText size={18} /> {s.id}
                    </h2>
                    <small>
                      {new Date(s.at).toLocaleString()} · {s.payment}
                    </small>
                  </div>
                  <Button variant="outline" onClick={() => downloadBill(s.id)}>
                    <Download size={16} />
                    Download bill CSV
                  </Button>
                </div>
                {s.lines.map((l, index) => (
                  <div className="bill-line" key={index}>
                    <div>
                      {l.qty}× {l.name}
                      <small>
                        {l.segment === "cafe" ? "Café" : "Shop"} · {l.modifiers}
                      </small>
                    </div>
                    <strong>{money(total([l]))}</strong>
                  </div>
                ))}
                <div className="total-row">
                  <span>Total charged</span>
                  <strong>{money(total(s.lines))}</strong>
                </div>
              </Card>
            ))}
            {!bills.length && (
              <p className="empty">No bills charged to your account yet.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
