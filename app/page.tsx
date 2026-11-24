"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Coffee,
  ShoppingBag,
  LayoutGrid,
  ChefHat,
  Package,
  ChartNoAxesCombined,
  LogOut,
  Search,
  Plus,
  Minus,
  ArrowRight,
  Check,
  Clock3,
  Banknote,
  CreditCard,
  Wallet,
  Users,
  Download,
  CheckCircle2,
  AlertTriangle,
  Truck,
  X,
  Leaf,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  accountUsed,
  advanceOrder,
  checkout,
  createPO,
  csv,
  employees,
  inPeriod,
  locations,
  money,
  receive,
  seed,
  total,
  type Employee,
  type Line,
  type Payment,
  type Product,
  type Segment,
  type Store,
} from "@/lib/store";

const STORAGE = "kvm-staff-pos-v1";
const methods: Payment[] = [
  "Cash",
  "Bank Transfer",
  "Customer Credit",
  "Salary Deduction",
];
const paymentIcons = [Banknote, CreditCard, Wallet, Users];
type Page =
  | "Point of Sale"
  | "Kitchen Board"
  | "Inventory"
  | "Purchasing"
  | "Reports & Ledger";
const navigation: { name: Page; icon: typeof Coffee; manager?: boolean }[] = [
  { name: "Point of Sale", icon: LayoutGrid },
  { name: "Kitchen Board", icon: ChefHat },
  { name: "Inventory", icon: Package, manager: true },
  { name: "Purchasing", icon: Truck, manager: true },
  { name: "Reports & Ledger", icon: ChartNoAxesCombined, manager: true },
];
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
const options = (s: string[]) => s.map((value) => ({ value, label: value }));
function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const [store, setStore] = useState<Store | null>(null);
  const [user, setUser] = useState<Employee | null>(null);
  const [page, setPage] = useState<Page>("Point of Sale");
  const [id, setId] = useState("KV1042");
  const [pin, setPin] = useState("1234");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [now, setNow] = useState(0);
  const [shift, setShift] = useState(0);
  const [segment, setSegment] = useState<Segment>("cafe");
  const [category, setCategory] = useState("All items");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [customize, setCustomize] = useState<Product | null>(null);
  const [sugar, setSugar] = useState("Regular sugar");
  const [service, setService] = useState("Takeaway");
  const [location, setLocation] = useState("Counter pickup");
  const [payment, setPayment] = useState<Payment>("Cash");
  const [cash, setCash] = useState("");
  const [reference, setReference] = useState("");
  const [buyer, setBuyer] = useState("KV4106");
  const [receipt, setReceipt] = useState<{
    id: string;
    amount: number;
    change: number;
  } | null>(null);
  const [period, setPeriod] = useState("Today");
  const [reportSegment, setReportSegment] = useState("all");
  const [inventorySegment, setInventorySegment] = useState<Segment>("shop");
  const [poSegment, setPoSegment] = useState<Segment | "">("");
  const [poItem, setPoItem] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [qty, setQty] = useState("24");
  const [cost, setCost] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    const init = window.setTimeout(() => {
      const time = Date.now();
      let initial = seed(time);
      try {
        const saved = localStorage.getItem(STORAGE);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed.version !== 1 ||
            !["products", "supplies", "sales", "orders", "purchases"].every(
              (key) => Array.isArray(parsed[key]),
            )
          )
            throw Error("Invalid data");
          initial = parsed;
        }
      } catch {
        setStorageError(
          "Saved demo data could not be loaded. A fresh demo is available; reset to replace the unreadable copy.",
        );
      }
      setStore(initial);
      setNow(time);
    }, 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE && e.newValue) {
        try {
          const value = JSON.parse(e.newValue);
          if (value.version === 1) setStore(value);
        } catch {
          setStorageError("Another tab saved unreadable demo data.");
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      clearTimeout(init);
      clearInterval(interval);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function commit(next: Store) {
    setStore(next);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Changes last only until this page is closed.",
      );
    }
  }
  function attempt(fn: () => void) {
    setError("");
    setNotice("");
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }
  function switchUser(nextId: string) {
    const next = employees.find((e) => e.id === nextId)!;
    setUser(next);
    setId(next.id);
    setShift(Date.now());
    setPage(
      next.role === "Kitchen / Café Prep" ? "Kitchen Board" : "Point of Sale",
    );
    setCart([]);
    setReceipt(null);
    setError("");
    setNotice("");
  }
  function login() {
    attempt(() => {
      if (
        !/^KV\d{4}$/.test(id) ||
        !employees.some((e) => e.id === id) ||
        pin !== "1234"
      )
        throw Error("Use a listed demo Employee ID and PIN 1234.");
      switchUser(id);
    });
  }
  if (!store)
    return (
      <div className="loading">
        <Coffee size={40} />
        <p>Opening your workspace…</p>
      </div>
    );
  const manager = user?.role === "Store Manager / Admin";
  const kitchen = user?.role === "Kitchen / Café Prep";
  const amount = total(cart);
  const activeOrders = store.orders.filter((o) => o.status !== "Completed");
  const todaySales = store.sales.filter((s) => inPeriod(s.at, "Today", now));
  const add = (product: Product, modifiers = "") =>
    attempt(() => {
      const current = cart
        .filter((l) => l.productId === product.id)
        .reduce((n, l) => n + l.qty, 0);
      if (product.segment === "shop" && current >= product.stock)
        throw Error("No more stock available for this item.");
      const existing = cart.findIndex(
        (l) => l.productId === product.id && l.modifiers === modifiers,
      );
      setCart(
        existing >= 0
          ? cart.map((l, i) => (i === existing ? { ...l, qty: l.qty + 1 } : l))
          : [
              ...cart,
              {
                productId: product.id,
                name: product.name,
                segment: product.segment,
                price: product.price,
                qty: 1,
                modifiers,
              },
            ],
      );
      setReceipt(null);
      setCustomize(null);
    });
  const pay = () => {
    if (busy.current) return;
    busy.current = true;
    attempt(() => {
      const saleId = `S-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const next = checkout(store, {
        lines: cart,
        payment,
        employeeId: buyer,
        cash: Number(cash),
        reference,
        location,
        cashierId: user!.id,
        role: user!.role,
        now: Date.now(),
        id: saleId,
      });
      commit(next);
      setReceipt({
        id: saleId,
        amount,
        change: payment === "Cash" ? Number(cash) - amount : 0,
      });
      setCart([]);
      setCash("");
      setReference("");
      setNotice(
        cart.some((l) => l.segment === "cafe")
          ? "Payment recorded. Café items sent to the kitchen."
          : "Payment recorded. Tuck Shop stock updated.",
      );
    });
    busy.current = false;
  };
  const filteredSales = store.sales
    .filter((s) => inPeriod(s.at, period, now))
    .map((s) => ({
      ...s,
      lines: s.lines.filter(
        (l) => reportSegment === "all" || l.segment === reportSegment,
      ),
    }))
    .filter((s) => s.lines.length);
  const ledger = filteredSales.filter((s) =>
    ["Customer Credit", "Salary Deduction"].includes(s.payment),
  );
  const exportLedger = () => {
    const rows: (string | number)[][] = [
      [
        "Date",
        "Sale",
        "Employee ID",
        "Employee",
        "Payment",
        "Segment",
        "Item",
        "Modifiers",
        "Quantity",
        "Unit price USD",
        "Total USD",
      ],
    ];
    ledger.forEach((s) =>
      s.lines.forEach((l) =>
        rows.push([
          new Date(s.at).toISOString(),
          s.id,
          s.employeeId,
          employees.find((e) => e.id === s.employeeId)?.name ?? "",
          s.payment,
          l.segment,
          l.name,
          l.modifiers,
          l.qty,
          l.price,
          l.qty * l.price,
        ]),
      ),
    );
    const url = URL.createObjectURL(
      new Blob([csv(rows)], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `kvm-ledger-${period.replaceAll(" ", "-")}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const alerts = (
    <>
      {storageError && (
        <div className="alert warning" role="status">
          <AlertTriangle size={18} />
          {storageError}
        </div>
      )}
      {error && (
        <div className="alert danger" role="alert">
          <AlertTriangle size={18} />
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          <CheckCircle2 size={18} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
  if (!user)
    return (
      <main className="login-shell">
        <div className="login-story">
          <div className="brand">
            <div className="brand-icon">
              <Leaf />
            </div>
            <div>
              KVM<span>STAFF COLLECTIVE</span>
            </div>
          </div>
          <div>
            <div className="eyebrow">GOOD FOOD. EVERYDAY ESSENTIALS.</div>
            <h1>
              Two stores.
              <br />
              One seamless
              <br />
              <em>working day.</em>
            </h1>
            <p>
              Your café, your tuck shop, and everything that keeps your team
              going. All in one place.
            </p>
            <div className="login-pills">
              <span>
                <Coffee size={18} /> Staff Café
              </span>
              <span>
                <ShoppingBag size={18} /> Tuck Shop
              </span>
            </div>
          </div>
          <small>Made for the people behind the work.</small>
        </div>
        <div className="login-form">
          <Badge variant="outline">INTERACTIVE DEMO</Badge>
          <h2>Welcome to your shift</h2>
          <p>Sign in to your staff workspace.</p>
          {alerts}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <Field label="Employee ID">
              <Input
                value={id}
                onChange={(e) => setId(e.target.value.toUpperCase())}
                placeholder="KV1042"
                autoComplete="username"
              />
            </Field>
            <Field label="Demo PIN">
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Button className="primary wide" type="submit">
              Start shift <ArrowRight size={18} />
            </Button>
          </form>
          <div className="demo-note">
            Demo PIN: <strong>1234</strong> · No real credentials required.
            <br />
            Data stays in this browser. Not a secure payroll or payment system.
          </div>
          <div className="divider">OR EXPLORE A DEMO ROLE</div>
          <div className="role-list">
            {employees.slice(0, 3).map((e) => (
              <button key={e.id} onClick={() => switchUser(e.id)}>
                <span className="avatar">
                  {e.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span>
                  <strong>{e.role}</strong>
                  <small>
                    {e.name} · {e.id}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Leaf />
          </div>
          <div>
            KVM<span>STAFF COLLECTIVE</span>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {navigation
            .filter(
              (n) =>
                (!n.manager || manager) &&
                (!kitchen || n.name === "Kitchen Board"),
            )
            .map((n) => (
              <button
                key={n.name}
                aria-label={n.name}
                className={page === n.name ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setPage(n.name);
                  setError("");
                  setNotice("");
                }}
              >
                <n.icon size={20} />
                <span>{n.name}</span>
                {n.name === "Kitchen Board" && <b>{activeOrders.length}</b>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-card">
            <span className="live-dot" />
            <strong>All systems ready</strong>
            <small>Local demo workspace</small>
          </div>
          <button
            className="nav-item"
            onClick={() => {
              setUser(null);
              setCart([]);
              setError("");
            }}
          >
            <LogOut size={18} />
            End shift
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{page}</strong>
          </div>
          <div className="header-right">
            <button
              className="mobile-logout"
              aria-label="End shift"
              onClick={() => {
                setUser(null);
                setCart([]);
              }}
            >
              <LogOut size={18} />
            </button>
            <div className="shift">
              <span className="live-dot" />
              Shift active{" "}
              <small>
                {new Date(shift).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <div className="staff">
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>
                  {user.id} · {user.role.split(" / ")[0]}
                </small>
              </div>
            </div>
          </div>
        </header>
        <div className="demo-bar">
          <span>
            <strong>DEMO WORKSPACE</strong> Browser-local sample data · USD
          </span>
          <label>
            Demo role{" "}
            <select
              aria-label="Demo role switcher"
              value={user.id}
              onChange={(e) => switchUser(e.target.value)}
            >
              {employees.slice(0, 3).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.role}
                </option>
              ))}
            </select>
          </label>
        </div>
        <main className="content">
          {alerts}
          {page === "Point of Sale" && !kitchen && (
            <>
              <SectionTitle
                eyebrow="LET’S MAKE IT A GOOD SHIFT"
                title="Point of sale"
                description="Good food, daily essentials. Ready when you are."
                action={
                  <div className="date-chip">
                    <Clock3 size={16} />
                    {new Date(now).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                }
              />
              <div className="stats-strip">
                <div>
                  <span className="stat-icon">
                    <Banknote />
                  </span>
                  <div>
                    <small>Today’s sales</small>
                    <strong>
                      {money(total(todaySales.flatMap((s) => s.lines)))}
                    </strong>
                  </div>
                  <Badge variant="secondary">
                    {todaySales.length} transactions
                  </Badge>
                </div>
                <div>
                  <span className="stat-icon amber">
                    <ChefHat />
                  </span>
                  <div>
                    <small>In the kitchen</small>
                    <strong>
                      {activeOrders.length} <em>active orders</em>
                    </strong>
                  </div>
                  <span className="muted">Live</span>
                </div>
                <div>
                  <span className="stat-icon blue">
                    <Package />
                  </span>
                  <div>
                    <small>Stock alerts</small>
                    <strong>
                      {
                        store.products.filter(
                          (p) => p.segment === "shop" && p.stock <= p.low,
                        ).length
                      }{" "}
                      <em>items to restock</em>
                    </strong>
                  </div>
                </div>
              </div>
              <div className="pos-layout">
                <section className="catalog">
                  <div className="segment-toggle">
                    <button
                      className={segment === "cafe" ? "selected" : ""}
                      onClick={() => {
                        setSegment("cafe");
                        setCategory("All items");
                        setQuery("");
                      }}
                    >
                      <Coffee size={20} />
                      <span>
                        Staff Café<small>Freshly made, just for you</small>
                      </span>
                    </button>
                    <button
                      className={segment === "shop" ? "selected" : ""}
                      onClick={() => {
                        setSegment("shop");
                        setCategory("All items");
                        setQuery("");
                      }}
                    >
                      <ShoppingBag size={20} />
                      <span>
                        Tuck Shop<small>Everyday essentials</small>
                      </span>
                    </button>
                  </div>
                  <div className="search-box">
                    <Search size={19} />
                    <Input
                      aria-label="Search products or barcode"
                      placeholder="Search items, SKU or scan a barcode…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <kbd>SKU</kbd>
                  </div>
                  <div className="categories">
                    {[
                      "All items",
                      ...new Set(
                        store.products
                          .filter((p) => p.segment === segment)
                          .map((p) => p.category),
                      ),
                    ].map((c) => (
                      <button
                        key={c}
                        className={category === c ? "selected" : ""}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="catalog-title">
                    <h2>
                      {category === "All items"
                        ? segment === "cafe"
                          ? "Fresh from the café"
                          : "The everyday edit"
                        : category}
                    </h2>
                    <span>
                      {
                        store.products.filter((p) => p.segment === segment)
                          .length
                      }{" "}
                      items available
                    </span>
                  </div>
                  <div className="product-grid">
                    {store.products
                      .filter(
                        (p) =>
                          p.segment === segment &&
                          (category === "All items" ||
                            p.category === category) &&
                          `${p.name} ${p.sku}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((p) => (
                        <button
                          key={p.id}
                          className={`product-card ${p.segment === "shop" && !p.stock ? "sold-out" : ""}`}
                          disabled={p.segment === "shop" && !p.stock}
                          onClick={() =>
                            p.segment === "cafe" ? setCustomize(p) : add(p)
                          }
                        >
                          <div
                            className={`product-art art-${p.category.split("/")[0].replaceAll(" ", "-").toLowerCase()}`}
                          >
                            <span aria-hidden="true">{p.emoji}</span>
                            {p.segment === "shop" && (
                              <span
                                className={`stock-badge ${p.stock <= p.low ? "low" : ""}`}
                              >
                                {p.stock
                                  ? `${p.stock} in stock`
                                  : "Out of stock"}
                              </span>
                            )}
                            {p.segment === "cafe" && (
                              <span className="made-fresh">MADE FRESH</span>
                            )}
                          </div>
                          <div className="product-info">
                            <small>{p.category}</small>
                            <h3>{p.name}</h3>
                            <div>
                              <strong>{money(p.price)}</strong>
                              <span className="add-icon">
                                <Plus size={18} />
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                  {!store.products.some(
                    (p) =>
                      p.segment === segment &&
                      (category === "All items" || p.category === category) &&
                      `${p.name} ${p.sku}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  ) && (
                    <div className="empty">
                      No matching items. Try another name or SKU.
                    </div>
                  )}
                  <div className="catalog-footer">
                    <Leaf size={15} /> A little fuel for a great day’s work.
                  </div>
                </section>
                <Card className="cart-panel">
                  <div className="cart-heading">
                    <div>
                      <h2>
                        Current order{" "}
                        <Badge variant="secondary">
                          {cart.reduce((n, l) => n + l.qty, 0)}
                        </Badge>
                      </h2>
                      <small>Café & tuck shop · combined cart</small>
                    </div>
                    <button
                      aria-label="Clear cart"
                      onClick={() => {
                        setCart([]);
                        setReceipt(null);
                      }}
                    >
                      <RotateCcw size={17} />
                    </button>
                  </div>
                  <div className="cart-items">
                    {cart.length ? (
                      cart.map((l, i) => (
                        <div className="cart-line" key={`${l.productId}-${i}`}>
                          <div className="cart-line-head">
                            <strong>{l.name}</strong>
                            <b>{money(l.price * l.qty)}</b>
                          </div>
                          <small>
                            {l.segment === "cafe" ? "Café" : "Tuck Shop"}
                            {l.modifiers ? ` · ${l.modifiers}` : ""}
                          </small>
                          <div className="quantity">
                            <button
                              aria-label={`Remove one ${l.name}`}
                              onClick={() =>
                                setCart(
                                  cart.flatMap((c, j) =>
                                    j !== i
                                      ? [c]
                                      : c.qty > 1
                                        ? [{ ...c, qty: c.qty - 1 }]
                                        : [],
                                  ),
                                )
                              }
                            >
                              <Minus size={14} />
                            </button>
                            <span>{l.qty}</span>
                            <button
                              aria-label={`Add one ${l.name}`}
                              onClick={() =>
                                add(
                                  store.products.find(
                                    (p) => p.id === l.productId,
                                  )!,
                                  l.modifiers,
                                )
                              }
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : receipt ? (
                      <div className="receipt">
                        <CheckCircle2 size={36} />
                        <h3>Order complete</h3>
                        <p>{receipt.id}</p>
                        <strong>{money(receipt.amount)}</strong>
                        {receipt.change > 0 && (
                          <p>
                            Change due: <b>{money(receipt.change)}</b>
                          </p>
                        )}
                        <small>Recorded in this browser’s demo ledger.</small>
                      </div>
                    ) : (
                      <div className="empty-cart">
                        <ShoppingBag size={34} />
                        <h3>A fresh start</h3>
                        <p>Tap an item to start an order.</p>
                      </div>
                    )}
                  </div>
                  <div className="checkout-area">
                    {cart.some((l) => l.segment === "cafe") && (
                      <Select
                        label="Order destination"
                        value={location}
                        onChange={setLocation}
                        options={options(locations)}
                      />
                    )}
                    <div className="total-row">
                      <span>
                        Total due <small>No tax configured</small>
                      </span>
                      <strong>{money(amount)}</strong>
                    </div>
                    <span className="field-title">PAYMENT METHOD</span>
                    <div className="payment-grid">
                      {methods.map((m, i) => {
                        const Icon = paymentIcons[i];
                        return (
                          <button
                            key={m}
                            className={payment === m ? "selected" : ""}
                            onClick={() => {
                              setPayment(m);
                              setError("");
                            }}
                          >
                            <Icon size={18} />
                            {m}
                          </button>
                        );
                      })}
                    </div>
                    {payment === "Cash" && (
                      <>
                        <Field label="Cash received (USD)">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={cash}
                            onChange={(e) => setCash(e.target.value)}
                          />
                        </Field>
                        <div className="change-row">
                          <span>Change due</span>
                          <strong>
                            {money(Math.max(0, Number(cash || 0) - amount))}
                          </strong>
                        </div>
                      </>
                    )}
                    {payment === "Bank Transfer" && (
                      <Field label="Bank reference">
                        <Input
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="e.g. TXN-48291"
                        />
                      </Field>
                    )}
                    {["Customer Credit", "Salary Deduction"].includes(
                      payment,
                    ) && (
                      <>
                        <Select
                          label="Charge to employee"
                          value={buyer}
                          onChange={setBuyer}
                          options={employees.map((e) => ({
                            value: e.id,
                            label: `${e.id} · ${e.name}`,
                          }))}
                        />
                        <div className="account-info">
                          <span>
                            {payment === "Salary Deduction"
                              ? "Monthly"
                              : "Outstanding"}{" "}
                            balance:{" "}
                            {money(accountUsed(store, buyer, payment, now))}
                          </span>
                          <strong>
                            Available:{" "}
                            {money(
                              (payment === "Salary Deduction"
                                ? employees.find((e) => e.id === buyer)!
                                    .salaryLimit
                                : employees.find((e) => e.id === buyer)!
                                    .creditLimit) -
                                accountUsed(store, buyer, payment, now),
                            )}
                          </strong>
                        </div>
                      </>
                    )}
                    <Button
                      className="primary wide pay-button"
                      disabled={!cart.length}
                      onClick={pay}
                    >
                      Complete payment <span>{money(amount)}</span>
                      <ArrowRight size={17} />
                    </Button>
                    <div className="secure-note">
                      <Check size={13} />
                      Demo transaction · no real funds moved
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
          {page === "Kitchen Board" && (
            <>
              <SectionTitle
                eyebrow="CAFÉ OPERATIONS"
                title="Kitchen & dispatch"
                description="From first ticket to the last delivery. Keep every order moving."
                action={
                  <Badge variant="outline">
                    <span className="live-dot" /> Live · {activeOrders.length}{" "}
                    active
                  </Badge>
                }
              />
              <div className="sla-key">
                <span className="sla green">Under 10 min</span>
                <span className="sla amber">10–15 min</span>
                <span className="sla red">Over 15 min · delayed</span>
              </div>
              <div className="kitchen-grid">
                {["New / Preparing", "Out for Staff Delivery", "Completed"].map(
                  (column, index) => {
                    const orders = store.orders.filter((o) =>
                      index === 0
                        ? ["New", "Preparing", "Ready"].includes(o.status)
                        : o.status === column,
                    );
                    return (
                      <section className="kitchen-column" key={column}>
                        <h2>
                          <span className={`column-dot column-${index}`} />
                          {column}
                          <Badge variant="secondary">{orders.length}</Badge>
                        </h2>
                        {orders.map((o) => {
                          const elapsed = Math.floor(
                            ((o.completedAt ?? now) - o.created) / 60000,
                          );
                          const age =
                            ((o.completedAt ?? now) - o.created) / 60000;
                          const status =
                            age < 10 ? "green" : age <= 15 ? "amber" : "red";
                          return (
                            <Card key={o.id} className="order-card">
                              <div className="order-head">
                                <strong>{o.id}</strong>
                                <span
                                  className={`sla ${o.status === "Completed" ? "green" : status} ${age > 15 && o.status !== "Completed" ? "pulse" : ""}`}
                                >
                                  <Clock3 size={13} />
                                  {elapsed} min
                                  {o.status === "Completed"
                                    ? " total"
                                    : age > 15
                                      ? " · delayed"
                                      : ""}
                                </span>
                              </div>
                              <div className="order-meta">
                                <Badge variant="outline">{o.status}</Badge>
                                <span>
                                  {new Date(o.created).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <ul className="order-lines">
                                {o.lines.map((l, i) => (
                                  <li key={i}>
                                    <b>{l.qty}×</b>
                                    <div>
                                      {l.name}
                                      <small>{l.modifiers}</small>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              {o.status !== "Completed" ? (
                                <>
                                  <Select
                                    label="Destination"
                                    value={o.location}
                                    onChange={(value) =>
                                      commit({
                                        ...store,
                                        orders: store.orders.map((x) =>
                                          x.id === o.id
                                            ? { ...x, location: value }
                                            : x,
                                        ),
                                      })
                                    }
                                    options={options(locations)}
                                  />
                                  <Field label="Delivery runner">
                                    <Input
                                      value={o.runner}
                                      placeholder="Assign runner name"
                                      onChange={(e) =>
                                        commit({
                                          ...store,
                                          orders: store.orders.map((x) =>
                                            x.id === o.id
                                              ? { ...x, runner: e.target.value }
                                              : x,
                                          ),
                                        })
                                      }
                                    />
                                  </Field>
                                  <Button
                                    className="primary wide"
                                    onClick={() =>
                                      attempt(() =>
                                        commit(
                                          advanceOrder(store, o.id, Date.now()),
                                        ),
                                      )
                                    }
                                  >
                                    {o.status === "New"
                                      ? "Start preparing"
                                      : o.status === "Preparing"
                                        ? "Mark ready"
                                        : o.status === "Ready"
                                          ? [
                                              "Counter pickup",
                                              "Dine-in",
                                            ].includes(o.location)
                                            ? "Mark collected / served"
                                            : "Send for delivery"
                                          : "Mark delivered"}
                                    <ArrowRight size={16} />
                                  </Button>
                                </>
                              ) : (
                                <div className="completed-note">
                                  <CheckCircle2 size={15} />
                                  {o.location}
                                  {o.runner && ` · ${o.runner}`}
                                </div>
                              )}
                            </Card>
                          );
                        })}
                        {!orders.length && (
                          <div className="empty">
                            No orders here. You’re all caught up.
                          </div>
                        )}
                      </section>
                    );
                  },
                )}
              </div>
            </>
          )}
          {page === "Inventory" && manager && (
            <>
              <SectionTitle
                eyebrow="A PLACE FOR EVERYTHING"
                title="Inventory overview"
                description="Separate stock ledgers. One clear view of what’s on hand."
              />
              <div className="filter-row">
                <Button
                  variant={inventorySegment === "shop" ? "default" : "outline"}
                  onClick={() => setInventorySegment("shop")}
                >
                  <ShoppingBag size={17} />
                  Tuck Shop Inventory
                </Button>
                <Button
                  variant={inventorySegment === "cafe" ? "default" : "outline"}
                  onClick={() => setInventorySegment("cafe")}
                >
                  <Coffee size={17} />
                  Café Ingredients
                </Button>
              </div>
              <div className="info-banner">
                <Package size={19} />
                {inventorySegment === "shop"
                  ? "Stock is deducted automatically at checkout. Receive a purchase order to replenish."
                  : "Raw ingredients and consumables are tracked independently. Low ingredient stock never blocks café food orders."}
              </div>
              <Card className="table-card">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>SKU / Unit</th>
                        <th>On hand</th>
                        <th>Reorder at</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inventorySegment === "shop"
                        ? store.products.filter((p) => p.segment === "shop")
                        : store.supplies
                      ).map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                          </td>
                          <td>{"sku" in p ? p.sku : p.unit}</td>
                          <td className="numeric">{p.stock}</td>
                          <td>{p.low}</td>
                          <td>
                            <span
                              className={`status-badge ${p.stock <= p.low ? "low" : ""}`}
                            >
                              {p.stock === 0
                                ? "Out of stock"
                                : p.stock <= p.low
                                  ? "Low stock"
                                  : "Healthy"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
          {page === "Purchasing" && manager && (
            <>
              <SectionTitle
                eyebrow="KEEP THE GOOD THINGS COMING"
                title="Purchasing & restock"
                description="Create supplier orders and receive stock into the correct business ledger."
              />
              <div className="purchasing-layout">
                <Card className="purchase-form">
                  <h2>New purchase order</h2>
                  <p className="muted">
                    All fields required. Prices are in USD.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      attempt(() => {
                        if (!poSegment)
                          throw Error("Select a business segment.");
                        commit(
                          createPO(
                            store,
                            {
                              id: `PO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                              segment: poSegment,
                              itemId: poItem,
                              qty: Number(qty),
                              cost: Number(cost),
                              supplier,
                              invoice,
                              at: Date.now(),
                              status: "Ordered",
                            },
                            user.role,
                          ),
                        );
                        setNotice(
                          "Purchase order created. Mark it received when stock arrives.",
                        );
                        setInvoice("");
                      });
                    }}
                  >
                    <Select
                      label="Business segment *"
                      value={poSegment}
                      onChange={(s) => {
                        setPoSegment(s as Segment | "");
                        setPoItem("");
                      }}
                      options={[
                        { value: "", label: "Select business segment" },
                        { value: "cafe", label: "Café Supplies" },
                        { value: "shop", label: "Tuck Shop Stock" },
                      ]}
                    />
                    <Select
                      label="Inventory item *"
                      value={poItem}
                      onChange={setPoItem}
                      options={[
                        { value: "", label: "Choose an item" },
                        ...(poSegment
                          ? (poSegment === "shop"
                              ? store.products.filter(
                                  (p) => p.segment === "shop",
                                )
                              : store.supplies
                            ).map((p) => ({ value: p.id, label: p.name }))
                          : []),
                      ]}
                    />
                    <Field label="Supplier *">
                      <Input
                        required
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        placeholder="Island Wholesale"
                      />
                    </Field>
                    <Field label="Supplier invoice number *">
                      <Input
                        required
                        value={invoice}
                        onChange={(e) => setInvoice(e.target.value)}
                        placeholder="INV-00482"
                      />
                    </Field>
                    <div className="two-fields">
                      <Field label="Quantity *">
                        <Input
                          required
                          min="1"
                          step="1"
                          type="number"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                        />
                      </Field>
                      <Field label="Unit cost (USD) *">
                        <Input
                          required
                          min="0.01"
                          step="0.01"
                          type="number"
                          value={cost}
                          onChange={(e) => setCost(e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="change-row">
                      <span>Order total</span>
                      <strong>
                        {money(Number(qty || 0) * Number(cost || 0))}
                      </strong>
                    </div>
                    <Button type="submit" className="primary wide">
                      <Plus size={17} />
                      Create purchase order
                    </Button>
                  </form>
                </Card>
                <div className="purchase-list">
                  <h2>
                    Supplier orders{" "}
                    <Badge variant="secondary">{store.purchases.length}</Badge>
                  </h2>
                  {store.purchases.map((po) => (
                    <Card key={po.id} className="purchase-card">
                      <div className="purchase-card-head">
                        <div>
                          <Badge variant="outline">
                            {po.segment === "cafe"
                              ? "Café Supplies"
                              : "Tuck Shop Stock"}
                          </Badge>
                          <h3>{po.supplier}</h3>
                          <small>
                            {po.id} · {po.invoice}
                          </small>
                        </div>
                        <span
                          className={`status-badge ${po.status === "Ordered" ? "low" : ""}`}
                        >
                          {po.status}
                        </span>
                      </div>
                      <p>
                        {po.qty} ×{" "}
                        {
                          (po.segment === "shop"
                            ? store.products
                            : store.supplies
                          ).find((p) => p.id === po.itemId)?.name
                        }
                      </p>
                      <div className="purchase-card-foot">
                        <strong>{money(po.qty * po.cost)}</strong>
                        {po.status === "Ordered" ? (
                          <Button
                            className="primary"
                            onClick={() =>
                              attempt(() => {
                                commit(
                                  receive(store, po.id, user.role, Date.now()),
                                );
                                setNotice(
                                  `${po.id} received. ${po.segment === "shop" ? "Tuck Shop" : "Café"} stock updated.`,
                                );
                              })
                            }
                          >
                            <Check size={17} />
                            Mark received
                          </Button>
                        ) : (
                          <small>
                            Received{" "}
                            {new Date(po.receivedAt!).toLocaleDateString()}
                          </small>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
          {page === "Reports & Ledger" && manager && (
            <>
              <SectionTitle
                eyebrow="THE BIGGER PICTURE"
                title="Reports & staff ledger"
                description="Every sale accounted for. Every business segment kept separate."
                action={
                  <Button className="primary" onClick={exportLedger}>
                    <Download size={17} />
                    Export ledger CSV
                  </Button>
                }
              />
              <div className="filter-row">
                <Select
                  label="Reporting period"
                  value={period}
                  onChange={setPeriod}
                  options={options(["Today", "This Week", "This Month"])}
                />
                <Select
                  label="Business segment"
                  value={reportSegment}
                  onChange={setReportSegment}
                  options={[
                    { value: "all", label: "All segments" },
                    { value: "cafe", label: "Café Only" },
                    { value: "shop", label: "Tuck Shop Only" },
                  ]}
                />
              </div>
              <div className="report-stats">
                <Card>
                  <small>Total revenue</small>
                  <strong>
                    {money(total(filteredSales.flatMap((s) => s.lines)))}
                  </strong>
                  <span>
                    {filteredSales.length} transactions · {period.toLowerCase()}
                  </span>
                </Card>
                <Card>
                  <small>Average café prep time</small>
                  <strong>
                    {(() => {
                      if (reportSegment === "shop") return "N/A";
                      const orders = store.orders.filter(
                        (o) => o.readyAt && inPeriod(o.created, period, now),
                      );
                      return orders.length
                        ? `${(orders.reduce((n, o) => n + (o.readyAt! - o.created) / 60000, 0) / orders.length).toFixed(1)} min`
                        : "No ready orders";
                    })()}
                  </strong>
                  <span>Created to ready · ready orders only</span>
                </Card>
                <Card>
                  <small>Purchasing expenses</small>
                  <strong>
                    {money(
                      store.purchases
                        .filter(
                          (p) =>
                            p.status === "Received" &&
                            inPeriod(p.receivedAt!, period, now) &&
                            (reportSegment === "all" ||
                              p.segment === reportSegment),
                        )
                        .reduce((n, p) => n + p.qty * p.cost, 0),
                    )}
                  </strong>
                  <span>Received supplier invoices only</span>
                </Card>
              </div>
              <div className="reports-grid">
                <Card className="report-card">
                  <h2>Revenue by payment</h2>
                  {methods.map((m, i) => {
                    const amount = total(
                      filteredSales
                        .filter((s) => s.payment === m)
                        .flatMap((s) => s.lines),
                    );
                    const revenue = total(
                      filteredSales.flatMap((s) => s.lines),
                    );
                    const Icon = paymentIcons[i];
                    return (
                      <div className="payment-report" key={m}>
                        <div>
                          <span>
                            <Icon size={17} />
                            {m}
                          </span>
                          <strong>{money(amount)}</strong>
                        </div>
                        <div className="bar-track">
                          <div
                            style={{
                              width: `${revenue ? (amount / revenue) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </Card>
                <Card className="report-card">
                  <h2>Staff account balances</h2>
                  <p className="muted">
                    All-time outstanding credit / current-month salary
                    deductions, all segments. Demo has no repayment or payroll
                    settlement.
                  </p>
                  {employees.map((e) => (
                    <div className="employee-balance" key={e.id}>
                      <div>
                        <strong>{e.name}</strong>
                        <small>{e.id}</small>
                      </div>
                      <div>
                        <span>
                          Credit{" "}
                          {money(
                            accountUsed(store, e.id, "Customer Credit", now),
                          )}{" "}
                          / {money(e.creditLimit)}
                        </span>
                        <span>
                          Salary{" "}
                          {money(
                            accountUsed(store, e.id, "Salary Deduction", now),
                          )}{" "}
                          / {money(e.salaryLimit)}
                        </span>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
              <Card className="table-card">
                <div className="table-heading">
                  <h2>Salary deduction & credit ledger</h2>
                  <small>
                    {ledger.length} charges · itemized export available
                  </small>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Date / Sale</th>
                        <th>Payment method</th>
                        <th>Items</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>
                              {
                                employees.find((e) => e.id === s.employeeId)
                                  ?.name
                              }
                            </strong>
                            <small>{s.employeeId}</small>
                          </td>
                          <td>
                            {new Date(s.at).toLocaleDateString()}
                            <small>{s.id}</small>
                          </td>
                          <td>{s.payment}</td>
                          <td>
                            {s.lines.map((l, i) => (
                              <div key={i}>
                                {l.qty}× {l.name}
                                <small>
                                  {l.segment === "cafe" ? "Café" : "Tuck Shop"}
                                  {l.modifiers && ` · ${l.modifiers}`}
                                </small>
                              </div>
                            ))}
                          </td>
                          <td>
                            <strong>{money(total(s.lines))}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!ledger.length && (
                    <div className="empty">
                      No account charges in this period and segment.
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
          <footer className="page-footer">
            <span>
              KVM Staff Collective <span>·</span> Your everyday, simplified.
            </span>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Reset all demo sales, inventory and purchases in this browser?",
                  )
                ) {
                  commit(seed(Date.now()));
                  setCart([]);
                  setReceipt(null);
                  setNotice("Demo data reset.");
                  setError("");
                }
              }}
            >
              <RotateCcw size={13} />
              Reset demo data
            </button>
          </footer>
        </main>
      </div>
      {customize && (
        <div className="modal-backdrop" onClick={() => setCustomize(null)}>
          <section
            className="customize-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customize-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setCustomize(null);
              if (e.key === "Tab") {
                const controls = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button, select",
                  ),
                );
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <button
              className="close-modal"
              aria-label="Close customization"
              autoFocus
              onClick={() => setCustomize(null)}
            >
              <X />
            </button>
            <div className="modal-emoji">{customize.emoji}</div>
            <div className="eyebrow">MAKE IT YOURS</div>
            <h2 id="customize-title">{customize.name}</h2>
            <p className="muted">A little customization goes a long way.</p>
            <Select
              label="Sugar level"
              value={sugar}
              onChange={setSugar}
              options={options([
                "No sugar",
                "Less sugar",
                "Regular sugar",
                "Extra sugar",
              ])}
            />
            <Select
              label="Service style"
              value={service}
              onChange={setService}
              options={options(["Takeaway", "Dine-in", "Staff delivery"])}
            />
            <Select
              label="Delivery / pickup location"
              value={location}
              onChange={setLocation}
              options={options(locations)}
            />
            <Button
              className="primary wide"
              onClick={() =>
                add(customize, `${sugar} · ${service} · ${location}`)
              }
            >
              Add to order <span>{money(customize.price)}</span>
              <Plus size={17} />
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
