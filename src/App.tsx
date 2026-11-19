import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileSpreadsheet,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Printer,
  Save,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  adr,
  budgetYears,
  blank,
  makeDemo,
  restoreDemo,
  markets,
  months,
  percentage,
  row,
  summarize,
  validData,
  type Audit,
  type Entry,
  type MonthData,
  type Row,
} from "./model";
import { db, loadYear, loadAdminRole, saveImport, saveMonth } from "./api";
import { exportWorkbook, importWorkbook } from "./workbooks";
import TotalReview from "./TotalReview";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const num = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
const compact = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}m` : money(n);
type View = "overview" | "reports" | "activity" | "setup" | "total" | "admin";
type Tab = "commercial" | "villas" | "countries" | "meals" | "notes";
export default function App() {
  const demo = !db;
  const [year, setYear] = useState(2027);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!db);
  const [adminRole, setAdminRole] = useState<{
    userId: string;
    allowed: boolean;
  } | null>(null);
  const [roleError, setRoleError] = useState("");
  const isAdmin =
    !!session && adminRole?.userId === session.user.id && adminRole.allowed;
  const [view, setView] = useState<View>(
    window.location.pathname === "/admin-data-input" ? "admin" : "overview",
  );
  const canEdit = view === "admin" && (demo || isAdmin);
  const [market, setMarket] = useState<string | null>(null);
  const [month, setMonth] = useState(1);
  const [tab, setTab] = useState<Tab>("commercial");
  const [draft, setDraft] = useState<MonthData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [login, setLogin] = useState(false);
  const [help, setHelp] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [pending, setPending] = useState<Entry[] | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [reportMarket, setReportMarket] = useState("all");
  const [period, setPeriod] = useState("year");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = db.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setAdminRole(null);
      setEntries([]);
      setDraft(null);
      setPending(null);
      setAudit([]);
      setDirty(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setAdminRole(null);
    setRoleError("");
    if (!session || !db) return;
    const userId = session.user.id;
    loadAdminRole()
      .then((allowed) => {
        if (active) setAdminRole({ userId, allowed });
      })
      .catch((e) => {
        if (active) {
          setRoleError(
            `Unable to verify administrator access: ${e.message}. Apply the admin-only database migration before enabling live entry.`,
          );
          setAdminRole({ userId, allowed: false });
        }
      });
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => {
    const path = view === "admin" ? "/admin-data-input" : "/";
    if (window.location.pathname !== path)
      window.history.pushState(null, "", path);
  }, [view]);
  useEffect(() => {
    function onPop() {
      if (busy || (dirty && !window.confirm("Discard your unsaved changes?"))) {
        window.history.pushState(
          null,
          "",
          view === "admin" ? "/admin-data-input" : "/",
        );
        return;
      }
      setDirty(false);
      setMarket(null);
      setView(
        window.location.pathname === "/admin-data-input" ? "admin" : "overview",
      );
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [busy, dirty, view]);
  useEffect(() => {
    let active = true;
    setError("");
    if (demo) {
      try {
        const stored = localStorage.getItem(`kvm-demo-${year}`);
        const data = stored ? JSON.parse(stored) : null;
        setEntries(restoreDemo(year, data));
      } catch {
        setEntries(makeDemo(year));
      }
      return;
    }
    setEntries([]);
    if (!session) return;
    setLoading(true);
    loadYear(year)
      .then((d) => {
        if (active) setEntries(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo, session, year]);
  const current = entries.find(
    (e) => e.market_id === market && e.month === month,
  );
  const version = current?.version ?? 0;
  useEffect(() => {
    setDraft(market ? structuredClone(current?.data ?? blank(market)) : null);
    setDirty(false);
  }, [market, month, current, year, view]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let active = true;
    if (view === "activity" && db && session) {
      db.from("audit_log")
        .select("id,market_id,year,month,changed_at,actor")
        .order("changed_at", { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
          if (!active) return;
          if (error) setError(error.message);
          else setAudit(data as Audit[]);
        });
    }
    return () => {
      active = false;
    };
  }, [view, session]);
  useEffect(() => {
    if (!login && !help && !pending) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) ?? [],
      );
    controls()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setLogin(false);
        setHelp(false);
        setPending(null);
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [login, help, pending, busy]);

  function navigate(fn: () => void) {
    if (busy) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setDirty(false);
    setError("");
    fn();
    setSidebar(false);
  }
  function openMarket(id: string) {
    navigate(() => {
      setMarket(id);
      setView("overview");
      setTab("commercial");
      if (!demo && !session) setLogin(true);
    });
  }
  const totals = summarize(entries);
  const selected = markets.find((m) => m.id === market);
  const activeData =
    (canEdit ? draft : current?.data) ?? blank(market ?? "asia");
  const scoped = entries.filter(
    (e) =>
      (reportMarket === "all" || e.market_id === reportMarket) &&
      (period === "year" ||
        (period.startsWith("q")
          ? Math.ceil(e.month / 3) === Number(period.slice(1))
          : e.month === Number(period))),
  );
  async function save() {
    if (!canEdit || !draft || !market) return;
    if (!validData(draft)) {
      setError(
        "Enter valid, non-negative numbers. Values must be below 1 trillion.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const nextVersion = demo
        ? version + 1
        : await saveMonth(market, year, month, draft, version);
      const entry = {
        market_id: market,
        year,
        month,
        data: draft,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      };
      const next = [
        ...entries.filter((e) => e.market_id !== market || e.month !== month),
        entry,
      ];
      if (demo) localStorage.setItem(`kvm-demo-${year}`, JSON.stringify(next));
      setEntries(next);
      setDirty(false);
      setToast(
        demo
          ? "Demo changes saved in this browser."
          : "Changes saved securely.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (busy) return;
    navigate(() => {
      if (demo) {
        setDraft(structuredClone(current?.data ?? blank(market ?? "asia")));
        return;
      }
      setLoading(true);
      loadYear(year)
        .then(setEntries)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
  }
  async function importFile(file?: File) {
    if (!canEdit || !file || !market) return;
    if (dirty) {
      setError("Save or discard your changes before importing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setPending(await importWorkbook(file, market, year, entries));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function applyImport() {
    if (!canEdit || !pending) return;
    setBusy(true);
    try {
      if (!demo) await saveImport(pending);
      const next = demo
        ? [
            ...entries.filter((e) => e.market_id !== market),
            ...pending.map((e) => ({ ...e, version: e.version + 1 })),
          ]
        : await loadYear(year);
      if (demo) localStorage.setItem(`kvm-demo-${year}`, JSON.stringify(next));
      setEntries(next);
      setPending(null);
      setToast("12 monthly sheets imported.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(data: Entry[], name: string) {
    setBusy(true);
    setError("");
    try {
      await exportWorkbook(data, name);
      setToast("Excel report generated from saved data.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function updateRow(index: number, next: Row) {
    if (!canEdit || tab === "notes" || !draft) return;
    setDraft({
      ...draft,
      [tab]: draft[tab].map((r, i) => (i === index ? next : r)),
    });
    setDirty(true);
  }
  const visibleMarkets = markets;
  const noAccess =
    !!session && !loading && !entries.some((e) => e.market_id === market);
  return (
    <div className="app">
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate(() => {
              setMarket(null);
              setView("overview");
            });
          }}
        >
          <span className="brand-icon">
            K<span>V</span>M
          </span>
          <span>
            BUSINESS TRACKER<small>Commercial intelligence</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <Building2 size={20} />
          </span>
          <div>
            Kuda Villingili<small>Resort Maldives</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {(
            [
              ["overview", LayoutDashboard, "Overview"],
              ["reports", BarChart3, "Reports"],
              ["activity", Clock3, "Activity log"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={view === id && !market ? "active" : ""}
              onClick={() =>
                navigate(() => {
                  setView(id);
                  setMarket(null);
                })
              }
            >
              <Icon size={18} />
              {label}
              {id === "overview" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="nav-label market-label">
          YOUR MARKETS <span>{markets.length.toString().padStart(2, "0")}</span>
        </div>
        <nav>
          {visibleMarkets.map((m) => (
            <button
              key={m.id}
              className={view === "overview" && market === m.id ? "active" : ""}
              onClick={() => openMarket(m.id)}
            >
              <span className="market-dot" style={{ background: m.color }} />
              {m.name}
              <ChevronRight size={14} />
            </button>
          ))}
        </nav>
        <nav className="total-nav">
          <button
            className={view === "total" ? "active" : ""}
            onClick={() =>
              navigate(() => {
                setMarket(null);
                setView("total");
              })
            }
          >
            <BarChart3 size={18} />
            Total Budget Review
          </button>
        </nav>
        <nav className="admin-nav">
          <button
            className={view === "admin" ? "active" : ""}
            onClick={() =>
              navigate(() => {
                setMarket(null);
                setView("admin");
              })
            }
          >
            <LockKeyhole size={18} />
            Admin Data Input
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="secure">
            <ShieldCheck size={20} />
            <div>
              One source of truth<small>Built for your commercial team</small>
            </div>
          </div>
          <button
            className="settings-nav"
            onClick={() =>
              navigate(() => {
                setMarket(null);
                setView("setup");
              })
            }
          >
            <Settings2 size={17} />
            Setup & access
          </button>
          <div className="profile">
            <span>
              {demo ? "D" : (session?.user.email?.[0] ?? "G").toUpperCase()}
            </span>
            <div>
              {demo ? "Demo workspace" : (session?.user.email ?? "Guest")}
              <small>
                {demo
                  ? "Sample data only"
                  : session
                    ? "Signed in securely"
                    : "Sign in to your market"}
              </small>
            </div>
            {session && (
              <button
                aria-label="Sign out"
                onClick={() =>
                  navigate(() => {
                    void db!.auth.signOut().then(({ error }) => {
                      if (error) setError(error.message);
                      else {
                        setMarket(null);
                        setView("overview");
                      }
                    });
                  })
                }
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            onClick={() => setSidebar(!sidebar)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />{" "}
            <strong>
              {selected?.name ??
                {
                  overview: "Overview",
                  total: "Total Budget Review",
                  admin: "Admin Data Input",
                  reports: "Reports",
                  activity: "Activity log",
                  setup: "Setup & access",
                }[view]}
            </strong>
          </div>
          <div className="top-actions">
            <span className="property">
              <span />
              Kuda Villingili Resort
            </span>
            <button
              className="icon-button"
              aria-label="Help and definitions"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="View recent activity"
              onClick={() =>
                navigate(() => {
                  setMarket(null);
                  setView("activity");
                })
              }
            >
              <Bell size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className={`mode-banner ${demo ? "" : "live"}`}>
            <span>
              <ShieldCheck size={15} />
              {demo ? (
                <>
                  <strong>Interactive demo</strong> · Fictional figures. Changes
                  stay in this browser. No real budgets are published.
                </>
              ) : (
                <>
                  <strong>Private workspace</strong> ·{" "}
                  {session
                    ? "Your market permissions are enforced by the database."
                    : "Sign in to see or update budget figures."}
                </>
              )}
            </span>
            {demo ? (
              <button
                onClick={() =>
                  navigate(() => {
                    setMarket(null);
                    setView("setup");
                  })
                }
              >
                Connect live data <ArrowUpRight size={13} />
              </button>
            ) : (
              !session && (
                <button onClick={() => setLogin(true)}>
                  Sign in <ArrowUpRight size={13} />
                </button>
              )
            )}
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {selected
                  ? "MARKET PERFORMANCE"
                  : view === "overview"
                    ? "YOUR COMMERCIAL PULSE"
                    : "COMMERCIAL WORKSPACE"}
              </div>
              <h1>
                {view === "admin"
                  ? "Admin Data Input"
                  : selected
                    ? selected.name
                    : view === "total"
                      ? "Total Budget Review"
                      : view === "overview"
                        ? "Every market. One clear view."
                        : view === "reports"
                          ? "Reports & insights"
                          : view === "activity"
                            ? "A record of every change."
                            : "Make it your workspace."}
              </h1>
              <p>
                {view === "admin"
                  ? "The only workspace for entering numbers, importing workbooks, and updating action plans."
                  : selected
                    ? "View saved performance. All data input is managed by an administrator."
                    : view === "total"
                      ? "One automatic review of saved performance across the five markets."
                      : view === "overview"
                        ? "Keep your team aligned and your performance in focus."
                        : view === "reports"
                          ? "Turn market performance into clear, shareable reports."
                          : view === "activity"
                            ? "Traceable updates across your connected markets."
                            : "Connect secure accounts and bring your spreadsheets to life."}
              </p>
            </div>
            <div className="heading-actions">
              <label className="year-control">
                <span>Budget year</span>
                <select
                  aria-label="Budget year"
                  disabled={busy}
                  value={year}
                  onChange={(e) =>
                    navigate(() => setYear(Number(e.target.value)))
                  }
                >
                  {budgetYears.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              {view !== "setup" &&
                view !== "activity" &&
                view !== "total" &&
                view !== "admin" && (
                  <button
                    className="button outline"
                    disabled={busy || !entries.length}
                    onClick={() =>
                      download(
                        selected
                          ? entries.filter((e) => e.market_id === market)
                          : view === "reports"
                            ? scoped
                            : entries,
                        `KVM-${selected?.id ?? "all-markets"}-${year}`,
                      )
                    }
                  >
                    <ArrowDownToLine size={16} />
                    Export report
                  </button>
                )}
            </div>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {toast && (
            <div role="status" className="toast">
              <Check size={16} />
              {toast}
            </div>
          )}
          {loading && (
            <div role="status" className="loading">
              Loading your market data…
            </div>
          )}
          {view === "total" && (
            <TotalReview
              entries={entries}
              year={year}
              loading={loading}
              demo={demo}
            />
          )}
          {view === "overview" && !market && (
            <>
              <section className="stats-grid">
                <Stat
                  title="Total revenue budget"
                  value={compact(totals.budget)}
                  detail={`${year} annual target`}
                  icon={<Globe2 size={19} />}
                  accent
                />
                <Stat
                  title="Business on the books"
                  value={compact(totals.bob)}
                  detail="Revenue secured to date"
                  icon={<TrendingUp size={19} />}
                />
                <Stat
                  title="Budget achievement"
                  value={`${percentage(totals.bob, totals.budget).toFixed(1)}%`}
                  detail={`${compact(Math.max(0, totals.budget - totals.bob))} remaining to target`}
                  icon={<BarChart3 size={19} />}
                />
                <Stat
                  title="Room nights on books"
                  value={num(totals.booked)}
                  detail={`of ${num(totals.nights)} budgeted nights`}
                  icon={<Building2 size={19} />}
                />
              </section>
              <div className="section-heading">
                <div>
                  <h2>
                    Your markets{" "}
                    <span>{markets.length.toString().padStart(2, "0")}</span>
                  </h2>
                  <p>Select a market to explore its budget and performance.</p>
                </div>
                <span className="subtle">
                  <span className="tiny-dot" />{" "}
                  {demo
                    ? "Sample performance"
                    : session
                      ? "Your accessible markets"
                      : "Sign-in required"}
                </span>
              </div>
              <section className="market-grid">
                {visibleMarkets.map((m) => {
                  const data = entries.filter((e) => e.market_id === m.id);
                  const t = summarize(data);
                  const progress = percentage(t.bob, t.budget);
                  return (
                    <button
                      key={m.id}
                      className="market-card"
                      onClick={() => openMarket(m.id)}
                    >
                      <div className="card-top">
                        <span
                          className="market-badge"
                          style={{ color: m.color, background: m.color + "16" }}
                        >
                          {m.tag}
                        </span>
                        <span className="card-arrow">
                          <ArrowUpRight size={19} />
                        </span>
                      </div>
                      <h3>{m.name}</h3>
                      <p>{m.region}</p>
                      <div className="card-budget">
                        <span>Annual revenue budget</span>
                        <strong>{data.length ? money(t.budget) : "—"}</strong>
                      </div>
                      <div className="card-figures">
                        <div>
                          <span>On the books</span>
                          <b>
                            {data.length
                              ? compact(t.bob)
                              : "Sign in for access"}
                          </b>
                        </div>
                        <div>
                          <span>Achievement</span>
                          <b style={{ color: m.color }}>
                            {progress.toFixed(1)}%
                          </b>
                        </div>
                      </div>
                      <div className="progress">
                        <span
                          style={{
                            width: `${Math.min(100, progress)}%`,
                            background: m.color,
                          }}
                        />
                      </div>
                      <footer>
                        <span>
                          <span
                            className="tiny-dot"
                            style={{ background: m.color }}
                          />
                          {demo ? "Demo market" : "Secure market"}
                        </span>
                        <span>
                          View market <ChevronRight size={13} />
                        </span>
                      </footer>
                    </button>
                  );
                })}
              </section>
              <section className="panel performance">
                <div className="section-heading">
                  <div>
                    <h2>Revenue at a glance</h2>
                    <p>Monthly budget compared with business on the books</p>
                  </div>
                  <div className="legend">
                    <span>
                      <i />
                      Budget
                    </span>
                    <span>
                      <i />
                      BOB
                    </span>
                  </div>
                </div>
                <div
                  className="chart"
                  role="img"
                  aria-label="Monthly revenue budget and business on books bar chart"
                >
                  {months.map((m, i) => {
                    const t = summarize(
                      entries.filter((e) => e.month === i + 1),
                    );
                    const max = Math.max(
                      ...months.map(
                        (_, j) =>
                          summarize(entries.filter((e) => e.month === j + 1))
                            .budget,
                      ),
                      1,
                    );
                    return (
                      <div className="chart-column" key={m}>
                        <div
                          className="bars"
                          title={`${m}: budget ${money(t.budget)}, BOB ${money(t.bob)}`}
                        >
                          <span
                            style={{ height: `${(t.budget / max) * 100}%` }}
                          />
                          <span style={{ height: `${(t.bob / max) * 100}%` }} />
                        </div>
                        <span>{m.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
              <div className="footer-note">
                <ShieldCheck size={14} />{" "}
                {demo
                  ? "Exploring with fictional sample data. Connect your database before importing private budgets."
                  : "Figures shown only for markets assigned to your account."}
                <span>All revenue values in USD</span>
              </div>
            </>
          )}
          {view === "admin" && (
            <section className="panel admin-access">
              <h2>
                {demo ? "Demo Admin Data Input" : "Administrator workspace"}
              </h2>
              {demo ? (
                <div className="notice">
                  Fictional demo only. This demonstrates admin entry without
                  authentication; edits stay in this browser and do not grant
                  live administrator access.
                </div>
              ) : !session ? (
                <>
                  <p>
                    Sign in with an administrator account to enter data. Market
                    manager accounts are view-only.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setLogin(true)}
                  >
                    Sign in as administrator
                  </button>
                </>
              ) : !adminRole ? (
                <p role="status">Verifying administrator access…</p>
              ) : !isAdmin ? (
                <p role="alert">
                  {roleError ||
                    "Administrator access required. You can view assigned markets and generate reports, but only an administrator may enter or import data."}
                </p>
              ) : (
                <p>
                  Administrator access verified. All changes are versioned and
                  audit logged.
                </p>
              )}
              {canEdit && (
                <label className="admin-market-label">
                  Market for data input
                  <select
                    aria-label="Admin market"
                    value={market ?? ""}
                    disabled={busy || loading}
                    onChange={(e) =>
                      navigate(() => {
                        setMarket(e.target.value || null);
                        setTab("commercial");
                      })
                    }
                  >
                    <option value="" disabled>
                      Select a market
                    </option>
                    {markets.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          )}
          {((view === "overview" && market) ||
            (view === "admin" && canEdit && market)) && (
            <>
              <button
                className="back-link"
                onClick={() =>
                  navigate(() => {
                    setMarket(null);
                    setView("overview");
                  })
                }
              >
                <ArrowLeft size={14} />
                All markets
              </button>
              {!demo && !session ? (
                <section className="panel empty">
                  <LockKeyhole size={30} />
                  <h2>Your market, securely managed.</h2>
                  <p>
                    Sign in with your manager account to see {selected?.name}{" "}
                    budgets.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => setLogin(true)}
                  >
                    Sign in to market
                  </button>
                </section>
              ) : (
                <>
                  <section className="stats-grid market-stats">
                    <Stat
                      title="Annual revenue budget"
                      value={compact(
                        summarize(entries.filter((e) => e.market_id === market))
                          .budget,
                      )}
                      detail={`${selected?.name} · ${year}`}
                    />
                    <Stat
                      title="Monthly revenue budget"
                      value={money(activeData.commercial[1].budget)}
                      detail={`${months[month - 1]} target`}
                    />
                    <Stat
                      title="Monthly BOB revenue"
                      value={money(activeData.commercial[1].bob)}
                      detail={`${percentage(activeData.commercial[1].bob, activeData.commercial[1].budget).toFixed(1)}% of budget`}
                    />
                    <Stat
                      title="Revenue variance"
                      value={money(
                        activeData.commercial[1].bob -
                          activeData.commercial[1].budget,
                      )}
                      detail="BOB minus budget"
                    />
                  </section>
                  {noAccess && (
                    <div className="notice">
                      No saved data is available for this market and year. An
                      administrator must enter or import data through Admin Data
                      Input. Missing data is not a confirmed zero budget.
                    </div>
                  )}
                  <section className="panel editor">
                    <fieldset disabled={busy || loading}>
                      <div className="editor-heading">
                        <div>
                          <h2>Monthly performance</h2>
                          <p>
                            BOB = business on the books. ADR is calculated
                            automatically.
                          </p>
                        </div>
                        {canEdit ? (
                          <div className="editor-actions">
                            <button
                              className="button outline"
                              disabled={busy}
                              onClick={() => fileRef.current?.click()}
                            >
                              <Upload size={15} />
                              Import Excel
                            </button>
                            <input
                              ref={fileRef}
                              type="file"
                              hidden
                              accept=".xlsx"
                              aria-label="Import market workbook"
                              onChange={(e) =>
                                void importFile(e.target.files?.[0])
                              }
                            />
                            <button
                              className="button primary"
                              disabled={busy || !dirty || loading}
                              onClick={save}
                            >
                              <Save size={15} />
                              {busy ? "Working…" : "Save changes"}
                            </button>
                          </div>
                        ) : (
                          <span className="read-only-badge">
                            <LockKeyhole size={14} />
                            Read-only · Admin Data Input manages all changes
                          </span>
                        )}
                      </div>
                      <div className="month-tabs">
                        {months.map((m, i) => (
                          <button
                            key={m}
                            disabled={busy}
                            className={month === i + 1 ? "active" : ""}
                            onClick={() => navigate(() => setMonth(i + 1))}
                          >
                            {m.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                      <div className="editor-subheader">
                        <div className="detail-tabs">
                          {(
                            [
                              ["commercial", "Commercial targets"],
                              ["villas", "Villa types"],
                              ["countries", "Countries"],
                              ["meals", "Meal plans"],
                              ["notes", "Action plan"],
                            ] as const
                          ).map(([id, label]) => (
                            <button
                              key={id}
                              className={tab === id ? "active" : ""}
                              onClick={() => setTab(id)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <span className="save-status">
                          {!canEdit
                            ? "Read-only"
                            : dirty
                              ? "Unsaved changes"
                              : current
                                ? "Saved"
                                : "Not yet saved"}
                        </span>
                      </div>
                      {tab === "notes" ? (
                        <div className="notes">
                          <label htmlFor="notes">
                            Performance review & corrective actions
                          </label>
                          <p>
                            {canEdit
                              ? "Record reasons for variance, next steps, and owners."
                              : "Saved by an administrator."}
                          </p>
                          {canEdit ? (
                            <textarea
                              id="notes"
                              maxLength={10000}
                              value={activeData.notes}
                              onChange={(e) => {
                                setDraft({
                                  ...activeData,
                                  notes: e.target.value,
                                });
                                setDirty(true);
                              }}
                              placeholder="What will help this market reach its target?"
                            />
                          ) : (
                            <p className="read-only-notes">
                              {activeData.notes || "No action plan recorded."}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="table-scroll">
                            <table className="editable-table">
                              <thead>
                                <tr>
                                  <th>
                                    {tab === "commercial"
                                      ? "KPI"
                                      : tab === "villas"
                                        ? "Villa category"
                                        : tab === "countries"
                                          ? "Country"
                                          : "Meal plan"}
                                  </th>
                                  <th>Budget</th>
                                  <th>BOB to date</th>
                                  <th>Variance</th>
                                  {[1, 2, 3, 4].map((w) => (
                                    <th key={w} colSpan={2}>
                                      Week {w === 4 ? "4/5" : w}
                                    </th>
                                  ))}
                                </tr>
                                <tr className="subhead">
                                  <th />
                                  <th />
                                  <th />
                                  <th />
                                  {[1, 2, 3, 4].map((w) => (
                                    <FragmentPair key={w} />
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {activeData[tab].map((r, i) => (
                                  <tr key={i}>
                                    <th>{r.label}</th>
                                    <td>
                                      <Numeric
                                        editable={canEdit}
                                        label={`${r.label} budget`}
                                        value={r.budget}
                                        onChange={(v) =>
                                          updateRow(i, { ...r, budget: v })
                                        }
                                      />
                                    </td>
                                    <td>
                                      <Numeric
                                        editable={canEdit}
                                        label={`${r.label} BOB`}
                                        value={r.bob}
                                        onChange={(v) =>
                                          updateRow(i, { ...r, bob: v })
                                        }
                                      />
                                    </td>
                                    <td
                                      className={
                                        r.bob - r.budget < 0
                                          ? "negative"
                                          : "positive"
                                      }
                                    >
                                      {num(r.bob - r.budget)}
                                    </td>
                                    {r.targets.map((v, w) => (
                                      <CellPair
                                        key={w}
                                        r={r}
                                        w={w}
                                        target={v}
                                        editable={canEdit}
                                        update={(next) => updateRow(i, next)}
                                      />
                                    ))}
                                  </tr>
                                ))}
                                {tab === "commercial" && (
                                  <tr className="derived">
                                    <th>
                                      ADR <span>calculated</span>
                                    </th>
                                    <td>
                                      {money(
                                        adr(
                                          activeData.commercial[1].budget,
                                          activeData.commercial[0].budget,
                                        ),
                                      )}
                                    </td>
                                    <td>
                                      {money(
                                        adr(
                                          activeData.commercial[1].bob,
                                          activeData.commercial[0].bob,
                                        ),
                                      )}
                                    </td>
                                    <td>—</td>
                                    {[0, 1, 2, 3].map((w) => (
                                      <AdrPair
                                        key={w}
                                        data={activeData}
                                        w={w}
                                      />
                                    ))}
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          {canEdit && tab !== "commercial" && (
                            <div className="add-row">
                              <button
                                className="text-button"
                                onClick={() => {
                                  const label = window.prompt(
                                    "Name of the new category",
                                  );
                                  if (label?.trim() && label.length <= 200) {
                                    setDraft({
                                      ...activeData,
                                      [tab]: [
                                        ...activeData[tab],
                                        row(label.trim()),
                                      ],
                                    });
                                    setDirty(true);
                                  }
                                }}
                              >
                                <Plus size={14} />
                                Add category
                              </button>
                              <span>
                                Breakdown figures are independent; reconcile
                                them with commercial totals.
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="editor-footer">
                        <span>
                          <LockKeyhole size={13} />
                          {!canEdit
                            ? "Read-only · Changes are made only in Admin Data Input"
                            : demo
                              ? "Demo admin edits stay in your browser"
                              : "Admin changes are versioned and audit logged"}{" "}
                          · Currency: USD
                        </span>
                        {canEdit && (
                          <button className="text-button" onClick={refresh}>
                            Discard & reload
                          </button>
                        )}
                      </div>
                    </fieldset>
                  </section>
                </>
              )}
            </>
          )}
          {view === "reports" && (
            <>
              <section className="panel report-filters">
                <label>
                  Market
                  <select
                    value={reportMarket}
                    onChange={(e) => setReportMarket(e.target.value)}
                  >
                    <option value="all">All accessible markets</option>
                    {markets.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reporting period
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="year">Full year</option>
                    {[1, 2, 3, 4].map((q) => (
                      <option key={q} value={`q${q}`}>
                        Quarter {q}
                      </option>
                    ))}
                    {months.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button outline"
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  Print / Save PDF
                </button>
              </section>
              <section className="stats-grid">
                <Stat
                  title="Revenue budget"
                  value={money(summarize(scoped).budget)}
                  detail="Selected reporting period"
                />
                <Stat
                  title="Revenue on books"
                  value={money(summarize(scoped).bob)}
                  detail="Selected reporting period"
                />
                <Stat
                  title="Variance to budget"
                  value={money(
                    summarize(scoped).bob - summarize(scoped).budget,
                  )}
                  detail="BOB minus budget"
                />
                <Stat
                  title="Weighted BOB ADR"
                  value={money(
                    adr(summarize(scoped).bob, summarize(scoped).booked),
                  )}
                  detail="Revenue ÷ room nights"
                />
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Market performance report · {year}</h2>
                    <p>
                      {demo
                        ? "Fictional sample data"
                        : "Authorized markets only"}{" "}
                      · USD ·{" "}
                      {period === "year"
                        ? "Full year"
                        : period.startsWith("q")
                          ? `Quarter ${period.slice(1)}`
                          : months[Number(period) - 1]}
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Market</th>
                        <th>Budget</th>
                        <th>On books</th>
                        <th>Variance</th>
                        <th>Achievement</th>
                        <th>BOB nights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markets
                        .filter((m) => scoped.some((e) => e.market_id === m.id))
                        .map((m) => {
                          const t = summarize(
                            scoped.filter((e) => e.market_id === m.id),
                          );
                          return (
                            <tr key={m.id}>
                              <th>{m.name}</th>
                              <td>{money(t.budget)}</td>
                              <td>{money(t.bob)}</td>
                              <td
                                className={
                                  t.bob < t.budget ? "negative" : "positive"
                                }
                              >
                                {money(t.bob - t.budget)}
                              </td>
                              <td>{percentage(t.bob, t.budget).toFixed(1)}%</td>
                              <td>{num(t.booked)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {!scoped.length && (
                    <div className="empty">
                      No accessible data for this period. Sign in or import a
                      workbook first.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          {view === "activity" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Recent updates</h2>
                  <p>Latest 50 changes visible to your account</p>
                </div>
                <Clock3 size={22} />
              </div>
              {demo ? (
                <div className="empty">
                  <Clock3 size={30} />
                  <h3>A clear trail, from day one.</h3>
                  <p>
                    Live saves and workbook imports create immutable audit
                    records.
                    <br />
                    Demo changes are local and are not audit logged.
                  </p>
                </div>
              ) : !session ? (
                <div className="empty">Sign in to see your activity log.</div>
              ) : audit.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Market</th>
                        <th>Period</th>
                        <th>Changed at</th>
                        <th>Actor ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => (
                        <tr key={a.id}>
                          <th>
                            {markets.find((m) => m.id === a.market_id)?.name}
                          </th>
                          <td>
                            {months[a.month - 1]} {a.year}
                          </td>
                          <td>{new Date(a.changed_at).toLocaleString()}</td>
                          <td>{a.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">No changes recorded yet.</div>
              )}
            </section>
          )}
          {view === "setup" && (
            <section className="panel setup">
              <div className="setup-icon">
                <ShieldCheck size={27} />
              </div>
              <h2>
                {demo
                  ? "Ready for your real numbers."
                  : "Your secure workspace."}
              </h2>
              <p>
                The interface is ready. Live accounts and shared data require a
                Supabase project.
              </p>
              <ol>
                <li>
                  <strong>Connect a database</strong>
                  <p>
                    Run the repository’s <code>supabase/schema.sql</code> in
                    your Supabase project. It creates market tables, permission
                    policies, version checks, and an audit log.
                  </p>
                </li>
                <li>
                  <strong>Configure this application</strong>
                  <p>
                    Set <code>VITE_SUPABASE_URL</code> and{" "}
                    <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> as project
                    environment variables, then redeploy. Never use a secret or
                    service-role key in the browser.
                  </p>
                </li>
                <li>
                  <strong>Invite and assign managers</strong>
                  <p>
                    Create manager accounts in Supabase Auth. A database
                    administrator assigns each account to one or more markets.
                    No self-assignment is possible. See the README for SQL
                    examples.
                  </p>
                </li>
                <li>
                  <strong>Import your market workbooks</strong>
                  <p>
                    An administrator uses Admin Data Input to choose the
                    matching market and year, then Import Excel. All other pages
                    are read-only. FULL BUDGET is a reference workbook, not a
                    market import.
                  </p>
                </li>
              </ol>
              <div className="notice">
                USD is the initial reporting currency; no currency conversion is
                applied. Confirm the currency before importing. Your original
                workbooks have not been committed or uploaded.
              </div>
              <a
                className="button primary"
                href="https://github.com/Aasn22/KVM-Business-Tracker#readme"
                target="_blank"
                rel="noreferrer"
              >
                Read setup guide <ArrowUpRight size={16} />
              </a>
            </section>
          )}
        </main>
      </div>
      {login && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close sign in"
              onClick={() => setLogin(false)}
            >
              <X size={20} />
            </button>
            <LockKeyhole size={27} />
            <h2 id="login-title">Welcome to your market.</h2>
            <p>Sign in with the account provided by your administrator.</p>
            <Login onSuccess={() => setLogin(false)} />
            {!authReady && <p>Checking session…</p>}
          </section>
        </div>
      )}
      {pending && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <FileSpreadsheet size={28} />
            <h2 id="import-title">Review workbook import</h2>
            <p>
              {selected?.name} · {year} · 12 monthly sheets
            </p>
            <div className="import-summary">
              <span>
                Revenue budget <b>{money(summarize(pending).budget)}</b>
              </span>
              <span>
                Revenue BOB <b>{money(summarize(pending).bob)}</b>
              </span>
            </div>
            <div className="notice">
              This replaces all numeric monthly targets and BOB values for this
              market and year. Existing action plans are preserved.{" "}
              {demo
                ? "Demo only: do not import private figures on a shared device."
                : "Import is atomic and audit logged."}
            </div>
            <div className="modal-actions">
              <button
                className="button outline"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={applyImport}
              >
                {busy ? "Importing…" : "Confirm import"}
              </button>
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <CircleHelp size={28} />
            <h2 id="help-title">A little clarity.</h2>
            <p>
              <strong>BOB</strong> means business on the books, not realized
              revenue.
            </p>
            <p>
              <strong>ADR</strong> = room revenue ÷ room nights. Annual ADR uses
              weighted totals, never a mean of monthly ADRs.
            </p>
            <p>
              <strong>Variance</strong> = BOB − budget. Negative means below
              target.
            </p>
            <p>
              Weekly targets and BOB are independently editable snapshots; they
              do not overwrite the monthly BOB. Budget revenue is shown in USD
              with no conversion.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function FragmentPair() {
  return (
    <>
      <th>Target</th>
      <th>BOB</th>
    </>
  );
}
function CellPair({
  r,
  w,
  target,
  editable,
  update,
}: {
  r: Row;
  w: number;
  target: number;
  editable: boolean;
  update: (r: Row) => void;
}) {
  return (
    <>
      <td>
        <Numeric
          editable={editable}
          label={`${r.label} week ${w + 1} target`}
          value={target}
          onChange={(v) =>
            update({
              ...r,
              targets: r.targets.map((n, i) => (i === w ? v : n)),
            })
          }
        />
      </td>
      <td>
        <Numeric
          editable={editable}
          label={`${r.label} week ${w + 1} BOB`}
          value={r.weekly[w]}
          onChange={(v) =>
            update({ ...r, weekly: r.weekly.map((n, i) => (i === w ? v : n)) })
          }
        />
      </td>
    </>
  );
}
function AdrPair({ data, w }: { data: MonthData; w: number }) {
  return (
    <>
      <td>
        {num(adr(data.commercial[1].targets[w], data.commercial[0].targets[w]))}
      </td>
      <td>
        {num(adr(data.commercial[1].weekly[w], data.commercial[0].weekly[w]))}
      </td>
    </>
  );
}
export function Numeric({
  editable,
  label,
  value,
  onChange,
}: {
  editable: boolean;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  if (!editable)
    return (
      <span className="read-only-value" aria-label={`${label}: ${num(value)}`}>
        {num(value)}
      </span>
    );
  return (
    <input
      type="number"
      aria-label={label}
      min={0}
      max={1e12}
      step="any"
      value={Number.isNaN(value) ? "" : Number(value.toFixed(4))}
      onChange={(e) =>
        onChange(e.target.value === "" ? NaN : Number(e.target.value))
      }
    />
  );
}
function Stat({
  title,
  value,
  detail,
  icon,
  accent = false,
}: {
  title: string;
  value: string;
  detail: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={`stat ${accent ? "accent" : ""}`}>
      <div>
        <span>{title}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!db) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        Email address
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy || !db}>
        {busy ? "Signing in…" : "Sign in securely"}
      </button>
      <small>
        Need an account or password reset? Contact your administrator.
      </small>
    </form>
  );
}
