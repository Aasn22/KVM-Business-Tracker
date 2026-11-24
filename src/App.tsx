import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  BookOpen,
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
  LockKeyhole,
  Menu,
  Plus,
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
  type Entry,
  type MonthData,
  type Row,
} from "./model";
import { db, loadYear, loadAdminRole, saveImport, saveMonth } from "./api";
import { exportWorkbook, importWorkbook } from "./workbooks";
import TotalReview from "./TotalReview";
import ReportLibrary from "./ReportLibrary";
import { formatMoney, formatNumber, isMoneyMetric } from "./format";
import ActivityLog from "./ActivityLog";
import OperationalInput from "./OperationalInput";
import PerformanceInput from "./PerformanceInput";
import HistoryUpdate from "./HistoryUpdate";
import PageInsights from "./PageInsights";
import ProductionAnalysis from "./ProductionAnalysis";
import MarketPage from "./MarketPage";
import PulsePage from "./PulsePage";
import { useAdminName } from "./AdminIdentity";
import { recordActivity, recordPlatformVisit } from "./activity";
import BusinessInsight from "./BusinessInsight";
import { insightReviewed } from "./insightData";
import PropertySetup from "./PropertySetup";
import CountryPerformance from "./CountryPerformance";
import SignInPage from "./SignInPage";
import { loadPublicBudgets } from "./publicBudgets";
import { formatUpdate, lastSavedUpdate } from "./updateStatus";
const money = formatMoney;
const num = (n: number) => formatNumber(n, 0);
const compact = formatMoney;
type View =
  | "overview"
  | "reports"
  | "activity"
  | "setup"
  | "total"
  | "admin"
  | "property"
  | "insight";
type Tab = "commercial" | "villas" | "countries" | "meals" | "notes";
export default function App({
  publicDemo = false,
  localPin = false,
}: {
  publicDemo?: boolean;
  localPin?: boolean;
}) {
  const demo = localPin || (!publicDemo && !db);
  const adminName = useAdminName();
  useEffect(() => {
    if (publicDemo) recordPlatformVisit();
  }, [publicDemo]);
  const [publicUpdatedAt, setPublicUpdatedAt] = useState<string | null>(null);
  const [publicFeed, setPublicFeed] = useState(false);
  const [reportSource, setReportSource] = useState(
    "Published workbook snapshot; database status unverified",
  );
  const [year, setYear] = useState(2027);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!db);
  const [adminRole, setAdminRole] = useState<{
    userId: string;
    allowed: boolean;
  } | null>(null);
  const [roleError, setRoleError] = useState("");
  const [financialScope, setFinancialScope] = useState<string | null>(null);
  const countryOnly =
    financialScope === "india" || financialScope === "kazakhstan";
  const isAdmin =
    !!session && adminRole?.userId === session.user.id && adminRole.allowed;
  const [view, setView] = useState<View>(
    window.location.pathname === "/activity-log"
      ? "activity"
      : window.location.pathname === "/reports"
        ? "reports"
        : window.location.pathname === "/business-insight"
          ? "insight"
          : window.location.pathname === "/property-setup"
            ? "property"
            : window.location.pathname === "/admin-data-input"
              ? "admin"
              : "overview",
  );
  const canEdit = !publicDemo && view === "admin" && (demo || isAdmin);
  const [market, setMarket] = useState<string | null>(null);
  const [month, setMonth] = useState(1);
  const [tab, setTab] = useState<Tab>("commercial");
  const [draft, setDraft] = useState<MonthData | null>(null);
  const [dirty, setDirty] = useState(false);
  const liveSelection = useRef({
    dirty: false,
    market: null as string | null,
    month: 1,
  });
  useEffect(() => {
    liveSelection.current = { dirty, market, month };
  }, [dirty, market, month]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [login, setLogin] = useState(false);
  const [help, setHelp] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [marketsOpen, setMarketsOpen] = useState(false);
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!navigationOpen) return;
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNavigationOpen(false);
        navigationTrigger.current?.focus();
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [navigationOpen]);
  const [pending, setPending] = useState<Entry[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (publicDemo || localPin || !db) return;
    db.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = db.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setAdminRole(null);
      setFinancialScope(null);
      setEntries([]);
      setDraft(null);
      setPending(null);
      setDirty(false);
    });
    return () => data.subscription.unsubscribe();
  }, [publicDemo, localPin]);
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
    let active = true;
    setFinancialScope(null);
    if (demo) {
      setFinancialScope("all");
      return;
    }
    if (!session || !db) return;
    db.rpc("my_financial_scope").then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setError(
          `Financial scope unavailable: ${error.message}. Apply team/country migration.`,
        );
        setFinancialScope("unavailable");
      } else setFinancialScope(data);
    });
    return () => {
      active = false;
    };
  }, [demo, session]);
  useEffect(() => {
    const path =
      view === "activity"
        ? "/activity-log"
        : view === "reports"
          ? "/reports"
          : view === "insight"
            ? "/business-insight"
            : view === "property"
              ? "/property-setup"
              : view === "admin"
                ? "/admin-data-input"
                : "/";
    if (window.location.pathname !== path)
      window.history.pushState(null, "", path);
  }, [view]);
  useEffect(() => {
    function onPop() {
      if (busy || (dirty && !window.confirm("Discard your unsaved changes?"))) {
        window.history.pushState(
          null,
          "",
          view === "activity"
            ? "/activity-log"
            : view === "reports"
              ? "/reports"
              : view === "insight"
                ? "/business-insight"
                : view === "property"
                  ? "/property-setup"
                  : view === "admin"
                    ? "/admin-data-input"
                    : "/",
        );
        return;
      }
      setDirty(false);
      setMarket(null);
      setView(
        window.location.pathname === "/activity-log"
          ? "activity"
          : window.location.pathname === "/reports"
            ? "reports"
            : window.location.pathname === "/business-insight"
              ? "insight"
              : window.location.pathname === "/property-setup"
                ? "property"
                : window.location.pathname === "/admin-data-input"
                  ? "admin"
                  : "overview",
      );
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [busy, dirty, view]);
  useEffect(() => {
    let active = true;
    setError("");
    if (publicDemo) {
      setEntries([]);
      setLoading(true);
      setPublicUpdatedAt(null);
      setPublicFeed(false);
      async function refreshPublic() {
        try {
          const result = await loadPublicBudgets(year);
          if (active) {
            setEntries(result.entries);
            setPublicUpdatedAt(result.lastUpdatedAt);
            setPublicFeed(result.databaseAvailable);
            setReportSource(result.notice);
          }
        } catch (e) {
          if (active) {
            setError((e as Error).message);
          }
        } finally {
          if (active) setLoading(false);
        }
      }
      void refreshPublic();
      const timer = setInterval(() => void refreshPublic(), 60000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }
    if (localPin) {
      setLoading(true);
      void loadPublicBudgets(year)
        .then((result) => {
          if (!active) return;
          const stored = localStorage.getItem(`business-eye-local-${year}`);
          const edits = stored ? JSON.parse(stored) : [];
          const records = new Map(
            result.entries.map((e) => [`${e.market_id}:${e.month}`, e]),
          );
          if (Array.isArray(edits))
            edits
              .filter((e) => e.year === year && validData(e.data))
              .forEach((e) => records.set(`${e.market_id}:${e.month}`, e));
          setEntries([...records.values()]);
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
    }
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
  }, [demo, session, year, publicDemo, localPin]);
  useEffect(() => {
    const client = db;
    if (!session || !client || demo || publicDemo || localPin) return;
    let active = true;
    const channel = client
      .channel(`market-months-${session.user.id}-${year}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "market_months",
          filter: `year=eq.${year}`,
        },
        (payload) => {
          const changed = (
            payload.new && Object.keys(payload.new).length
              ? payload.new
              : payload.old
          ) as Partial<Entry>;
          const selection = liveSelection.current;
          if (selection.dirty) {
            if (
              changed.market_id === selection.market &&
              changed.month === selection.month
            )
              setError(
                "This month changed on another device. Refresh before saving your edits.",
              );
            return;
          }
          void loadYear(year)
            .then((updated) => {
              if (!active) return;
              setEntries(updated);
              setToast("Shared budgets updated from another device.");
            })
            .catch((e) => {
              if (active) setError((e as Error).message);
            });
        },
      )
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [session, year, demo, publicDemo, localPin]);
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
    setNavigationOpen(false);
    fn();
  }
  function openMarket(id: string) {
    navigate(() => {
      setMarket(id);
      setView("overview");
      setTab("commercial");
      if (!publicDemo && !demo && !session) setLogin(true);
    });
  }
  const totals = summarize(entries);
  const selected = markets.find((m) => m.id === market);
  const activeData =
    (canEdit ? draft : current?.data) ?? blank(market ?? "asia");
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
      if (demo)
        localStorage.setItem(
          localPin ? `business-eye-local-${year}` : `kvm-demo-${year}`,
          JSON.stringify(next),
        );
      if (
        localPin &&
        !recordActivity(
          "change",
          adminName ?? "Unnamed admin",
          `${markets.find((m) => m.id === market)?.name ?? market} · ${months[month - 1]} ${year} budget inputs saved`,
        )
      )
        setError(
          "Changes saved, but activity could not be recorded in browser storage.",
        );
      setEntries(next);
      setDirty(false);
      liveSelection.current.dirty = false;
      setToast(
        demo
          ? localPin
            ? "Changes saved in this browser only. Public figures unchanged."
            : "Demo changes saved in this browser."
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
      if (demo)
        localStorage.setItem(
          localPin ? `business-eye-local-${year}` : `kvm-demo-${year}`,
          JSON.stringify(next),
        );
      setEntries(next);
      setPending(null);
      if (
        localPin &&
        !recordActivity(
          "change",
          adminName ?? "Unnamed admin",
          `${markets.find((m) => m.id === market)?.name ?? market} · ${year} workbook imported (12 months)`,
        )
      )
        setError(
          "Workbook saved, but activity could not be recorded in browser storage.",
        );
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
    !loading && !!market && !entries.some((e) => e.market_id === market);
  function renderNavigation(expanded: boolean) {
    return (
      <nav
        className={expanded ? "full-name-navigation" : "icon-rail direct-rail"}
        aria-label={expanded ? "Full page navigation" : "Page navigation"}
      >
        {expanded ? (
          <header>
            <strong>Navigation</strong>
            <button
              aria-label="Close navigation"
              onClick={() => {
                setNavigationOpen(false);
                navigationTrigger.current?.focus();
              }}
            >
              <X size={20} />
            </button>
          </header>
        ) : (
          <button
            ref={navigationTrigger}
            type="button"
            aria-label="Show full navigation"
            aria-expanded={navigationOpen}
            aria-controls="full-navigation"
            onClick={() => setNavigationOpen(!navigationOpen)}
          >
            <Menu size={21} />
            <span>Menu</span>
          </button>
        )}
        <a href="/" className="rail-brand" aria-label="KVM BUSINESS LENSE home">
          <img
            src="/kuda-villingili-logo.png"
            alt="Kuda Villingili"
            width={40}
            height={40}
          />
        </a>
        {(
          [
            {
              id: "overview",
              label: "Commercial Pulse",
              short: "Pulse",
              Icon: Activity,
            },
            {
              id: "total",
              label: "Management Lense",
              short: "Lense",
              Icon: BarChart3,
            },
            {
              id: "reports",
              label: "Reports Library",
              short: "Reports",
              Icon: FileSpreadsheet,
            },
            {
              id: "insight",
              label: "Business Insight",
              short: "Insights",
              Icon: BookOpen,
            },
          ] as const
        ).map(({ id, label, short, Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={view === id && !market ? "page" : undefined}
            className={view === id && !market ? "active" : ""}
            onClick={() =>
              navigate(() => {
                setMarket(null);
                setView(id);
              })
            }
          >
            <Icon size={21} />
            <span>{expanded ? label : short}</span>
          </button>
        ))}
        <button
          type="button"
          aria-label="Markets"
          aria-expanded={expanded && marketsOpen}
          aria-controls="market-destinations"
          className={market ? "active" : ""}
          onClick={() => {
            if (expanded) setMarketsOpen(!marketsOpen);
            else {
              setNavigationOpen(true);
              setMarketsOpen(true);
            }
          }}
        >
          <Globe2 size={21} />
          <span>Markets</span>
          <ChevronRight size={14} />
        </button>
        {expanded && marketsOpen && (
          <div id="market-destinations" className="nested-markets">
            {markets.map((m) => (
              <button
                key={m.id}
                aria-label={m.name}
                aria-current={market === m.id ? "page" : undefined}
                onClick={() => openMarket(m.id)}
              >
                <Globe2 size={18} />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        )}
        {(
          [
            {
              id: "property",
              label: "Property Setup",
              short: "Property",
              path: "/property-setup",
              Icon: Building2,
            },
            {
              id: "admin",
              label: "Data Input",
              short: "Input",
              path: "/admin-data-input",
              Icon: LockKeyhole,
            },
            {
              id: "activity",
              label: "Activity Log",
              short: "Activity",
              path: "/activity-log",
              Icon: Clock3,
            },
          ] as const
        ).map(({ id, label, short, path, Icon }) =>
          publicDemo ? (
            <a key={id} href={path} title={label} aria-label={label}>
              <Icon size={21} />
              <span>{expanded ? label : short}</span>
            </a>
          ) : (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "active" : ""}
              onClick={() =>
                navigate(() => {
                  setMarket(null);
                  setView(id);
                })
              }
            >
              <Icon size={21} />
              <span>{expanded ? label : short}</span>
            </button>
          ),
        )}
      </nav>
    );
  }
  return (
    <div
      className={`app rail-layout ${view === "overview" && market ? "market-page-layout" : ""} ${["admin", "property", "activity"].includes(view) ? "administrator-layout" : ""}`}
      ref={appRef}
    >
      {renderNavigation(false)}
      {navigationOpen && (
        <>
          <button
            className="nav-dismiss"
            aria-label="Close navigation panel"
            onClick={() => setNavigationOpen(false)}
          />
          <aside id="full-navigation" className="full-navigation-panel">
            {renderNavigation(true)}
          </aside>
        </>
      )}
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            KVM Portal <ChevronRight size={13} />{" "}
            <strong>
              {selected?.name ??
                {
                  overview: "Commercial Pulse",
                  total: "Management Lense",
                  admin: "Data Input",
                  property: "Property Setup",
                  reports: "Reports Library",
                  insight: "Business Insight",
                  activity: "Activity Log",
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
                  if (publicDemo) {
                    window.location.assign("/activity-log");
                    return;
                  }
                  setMarket(null);
                  setView("activity");
                })
              }
            >
              <Bell size={19} />
            </button>
          </div>
        </header>
        <main
          className={
            view === "overview" && !market && !countryOnly
              ? "pulse-only-main"
              : undefined
          }
        >
          {view === "overview" && !market && !countryOnly ? (
            <PulsePage />
          ) : (
            <>
              <div
                className={`mode-banner ${demo ? "" : "live"} ${publicDemo || localPin ? "compact-status" : ""}`}
              >
                <div className="mode-copy">
                  <ShieldCheck size={15} />
                  {view === "insight" ? (
                    <>
                      Public hospitality research · Sources and periods cited
                      below.
                    </>
                  ) : publicDemo ? (
                    <>
                      Database manually sourced from Opera (PMS) · Maintained by
                      Revenue Director &amp; Team.
                    </>
                  ) : localPin && view === "admin" ? (
                    <>
                      <strong>Production imports</strong> · Shared reports
                      update only after a verified database save.
                    </>
                  ) : localPin ? (
                    <>
                      <strong>Local editing</strong> · Real workbook figures
                      plus this browser’s saved edits. Not synchronized or
                      published.
                    </>
                  ) : demo ? (
                    <>
                      <strong>
                        {publicDemo
                          ? "Public read-only demo"
                          : "Interactive demo"}
                      </strong>{" "}
                      · Fictional figures. No real budgets are published.
                      {!publicDemo && " Changes stay in this browser."}
                    </>
                  ) : (
                    <>
                      <strong>Private workspace</strong> ·{" "}
                      {session
                        ? "Your market permissions are enforced by the database."
                        : "Sign in to see or update budget figures."}
                    </>
                  )}
                </div>
                {view === "insight" ? (
                  <span className="last-update">
                    Reviewed: {insightReviewed} · Snapshot
                  </span>
                ) : publicDemo ? (
                  <span className="last-update" role="status">
                    <span
                      className="update-indicator animated"
                      title={
                        publicFeed
                          ? "Saved database status; not an Opera live feed"
                          : "Workbook snapshot; no live connection"
                      }
                      aria-hidden="true"
                    />
                    {formatUpdate(publicUpdatedAt)}
                  </span>
                ) : localPin && view === "admin" ? (
                  <span className="last-update">
                    Dates derived from each uploaded record
                  </span>
                ) : localPin ? (
                  <span className="last-update" role="status">
                    <span
                      className="update-indicator animated"
                      aria-hidden="true"
                    />
                    {formatUpdate(lastSavedUpdate(entries), true)}
                  </span>
                ) : demo ? (
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
              <div
                className={`page-heading ${view === "overview" && !market ? "pulse-heading" : ""}`}
              >
                <div>
                  <div className="eyebrow">
                    {selected
                      ? "MARKET PERFORMANCE"
                      : view === "overview"
                        ? "YOUR COMMERCIAL PULSE"
                        : "COMMERCIAL WORKSPACE"}
                  </div>
                  <h1>
                    {view === "insight"
                      ? "Business Insight"
                      : view === "property"
                        ? "Property Setup"
                        : view === "admin"
                          ? "Data Input"
                          : selected
                            ? selected.name
                            : view === "total"
                              ? "Management Lense"
                              : view === "overview"
                                ? "Commercial performance, from historical benchmarks to future targets."
                                : view === "reports"
                                  ? "Reports Library"
                                  : view === "activity"
                                    ? "Activity Log"
                                    : "Make it your workspace."}
                  </h1>
                  <p>
                    {view === "insight"
                      ? "Maldives tourism, global hospitality and commercial risk intelligence — with sources and reporting dates."
                      : view === "property"
                        ? "Property profile and configuration. Viewable by all signed-in users; editable only by Super Admin."
                        : view === "admin"
                          ? "The only workspace for entering numbers, importing workbooks, and updating action plans."
                          : selected
                            ? "View saved performance. All data input is managed by an administrator."
                            : view === "total"
                              ? "One automatic review of saved performance across all markets."
                              : view === "overview"
                                ? "A unified executive view of property budgets, market pace, and revenue forecasts."
                                : view === "reports"
                                  ? "Visual intelligence for leadership and revenue teams."
                                  : view === "activity"
                                    ? "Access, updates and recent changes recorded on this browser."
                                    : "Connect secure accounts and bring your spreadsheets to life."}
                  </p>
                </div>
                <div className="heading-actions">
                  {view !== "property" &&
                    view !== "activity" &&
                    view !== "admin" &&
                    view !== "reports" && (
                      <label className="year-control">
                        <span>Reporting year</span>
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
                    )}
                  {view !== "setup" &&
                    view !== "activity" &&
                    view !== "total" &&
                    view !== "insight" &&
                    view !== "reports" &&
                    view !== "admin" &&
                    view !== "property" && (
                      <button
                        className="button outline"
                        disabled={busy || !entries.length}
                        onClick={() =>
                          download(
                            selected
                              ? entries.filter((e) => e.market_id === market)
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
                  <button
                    aria-label="Dismiss error"
                    onClick={() => setError("")}
                  >
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
              {countryOnly &&
                ["overview", "reports", "total"].includes(view) && (
                  <CountryPerformance
                    key={`${session?.user.id}-${financialScope}`}
                    year={year}
                    scope={financialScope as "india" | "kazakhstan"}
                    editable={false}
                    demo={demo && !localPin}
                  />
                )}
              {!publicDemo && !localPin && view === "admin" && canEdit && (
                <CountryPerformance year={year} editable demo={demo} />
              )}
              {!publicDemo && view === "property" && (
                <PropertySetup
                  key={session?.user.id ?? "demo"}
                  demo={demo}
                  localOnly={localPin}
                  userId={session?.user.id ?? null}
                  onDirtyChange={setDirty}
                  onBusyChange={setBusy}
                />
              )}
              {view === "insight" && (
                <>
                  <ProductionAnalysis year={year} compactMoney />
                  <BusinessInsight />
                </>
              )}
              {!countryOnly &&
                ["overview", "total"].includes(view) &&
                !market && <ProductionAnalysis year={year} market={market} />}
              {!countryOnly &&
                !market &&
                ["overview", "total"].includes(view) && (
                  <div className="notice">
                    Budget planning / legacy workbook BOB below · Not the newly
                    uploaded reported-history or forecast source. Use Production
                    Analysis above for dated uploaded performance. Budget
                    figures are never replaced by actuals.
                  </div>
                )}
              {view === "total" && !countryOnly && (
                <TotalReview
                  entries={entries}
                  year={year}
                  loading={loading}
                  demo={demo && !localPin}
                />
              )}
              {view === "overview" && !market && !countryOnly && (
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
                        Market Insights{" "}
                        <span>
                          {markets.length.toString().padStart(2, "0")}
                        </span>
                      </h2>
                      <p>
                        Select a market to explore its budget and performance.
                      </p>
                    </div>
                    <span className="subtle">
                      <span className="tiny-dot" />{" "}
                      {publicDemo
                        ? "Published real figures"
                        : localPin
                          ? "Browser-local workbook figures"
                          : demo
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
                              style={{
                                color: m.color,
                                background: m.color + "16",
                              }}
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
                            <strong>
                              {data.length ? money(t.budget) : "—"}
                            </strong>
                          </div>
                          <div className="card-figures">
                            <div>
                              <span>On the books</span>
                              <b>
                                {data.length
                                  ? compact(t.bob)
                                  : publicDemo || localPin
                                    ? "Not available"
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
                              {publicDemo
                                ? "Published budget"
                                : localPin
                                  ? "Local workbook"
                                  : demo
                                    ? "Demo market"
                                    : "Secure market"}
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
                        <p>
                          Monthly budget compared with business on the books
                        </p>
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
                              summarize(
                                entries.filter((e) => e.month === j + 1),
                              ).budget,
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
                              <span
                                style={{ height: `${(t.bob / max) * 100}%` }}
                              />
                            </div>
                            <span>{m.slice(0, 3)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <div className="footer-note">
                    <ShieldCheck size={14} />{" "}
                    {publicDemo
                      ? "Published workbook figures · Manually maintained; no automated PMS feed."
                      : localPin
                        ? "Real workbook figures plus browser-local edits. Not a shared live feed."
                        : demo
                          ? "Exploring with fictional sample data. Connect your database before importing private budgets."
                          : "Figures shown only for markets assigned to your account."}
                    <span>Revenue figures shown with $</span>
                  </div>
                </>
              )}
              {localPin && view === "admin" && (
                <>
                  <HistoryUpdate
                    onDirtyChange={setDirty}
                    onBusyChange={setBusy}
                  />
                  <PerformanceInput />
                  <OperationalInput onBusyChange={setBusy} />
                </>
              )}
              {!publicDemo && !localPin && view === "admin" && (
                <section className="panel admin-access">
                  <h2>
                    {demo ? "Demo Data Input" : "Administrator workspace"}
                  </h2>
                  {demo ? (
                    <div className="notice">
                      Fictional demo only. This demonstrates admin entry without
                      authentication; edits stay in this browser and do not
                      grant live administrator access.
                    </div>
                  ) : !session ? (
                    <>
                      <p>
                        Sign in with an administrator account to enter data.
                        Market manager accounts are view-only.
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
                      Administrator access verified. All changes are versioned
                      and audit logged.
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
              {view === "overview" &&
                market &&
                !countryOnly &&
                (publicDemo || demo || session) && (
                  <>
                    <MarketPage
                      key={market + year}
                      market={market}
                      name={selected?.name ?? market}
                      year={year}
                      entries={entries}
                      onBack={() => navigate(() => setMarket(null))}
                    />
                    <details className="market-source-details">
                      <summary>
                        Uploaded completed-stay analysis · separate from budgets
                        and BOB
                      </summary>
                      <ProductionAnalysis year={year} market={market} />
                    </details>
                  </>
                )}
              {((view === "overview" &&
                market &&
                !countryOnly &&
                !publicDemo &&
                !demo &&
                !session) ||
                (view === "admin" && !localPin && canEdit && market)) && (
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
                  {!publicDemo && !demo && !session ? (
                    <section className="panel empty">
                      <LockKeyhole size={30} />
                      <h2>Your market, securely managed.</h2>
                      <p>
                        Sign in with your manager account to see{" "}
                        {selected?.name} budgets.
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
                          value={
                            noAccess
                              ? "—"
                              : compact(
                                  summarize(
                                    entries.filter(
                                      (e) => e.market_id === market,
                                    ),
                                  ).budget,
                                )
                          }
                          detail={`${selected?.name} · ${year}`}
                        />
                        <Stat
                          title="Monthly revenue budget"
                          value={
                            !current && !canEdit
                              ? "—"
                              : money(activeData.commercial[1].budget)
                          }
                          detail={`${months[month - 1]} target`}
                        />
                        <Stat
                          title="Monthly BOB revenue"
                          value={
                            !current && !canEdit
                              ? "—"
                              : money(activeData.commercial[1].bob)
                          }
                          detail={
                            !current && !canEdit
                              ? "Not available"
                              : `${percentage(activeData.commercial[1].bob, activeData.commercial[1].budget).toFixed(1)}% of budget`
                          }
                        />
                        <Stat
                          title="Revenue variance"
                          value={
                            !current && !canEdit
                              ? "—"
                              : money(
                                  activeData.commercial[1].bob -
                                    activeData.commercial[1].budget,
                                )
                          }
                          detail="BOB minus budget"
                        />
                      </section>
                      {noAccess && (
                        <div className="notice">
                          No saved data is available for this market and year.
                          An administrator must enter or import data through
                          Data Input. Missing data is not a confirmed zero
                          budget.
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
                                Read-only · Data Input manages all changes
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
                          {!current && !canEdit ? (
                            <div className="empty">
                              No figures supplied for {selected?.name} ·{" "}
                              {months[month - 1]} {year}. Enter data through
                              Data Input; missing figures are not zero.
                            </div>
                          ) : tab === "notes" ? (
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
                                  {activeData.notes ||
                                    "No action plan recorded."}
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
                                          {isMoneyMetric(r.label)
                                            ? money(r.bob - r.budget)
                                            : num(r.bob - r.budget)}
                                        </td>
                                        {r.targets.map((v, w) => (
                                          <CellPair
                                            key={w}
                                            r={r}
                                            w={w}
                                            target={v}
                                            editable={canEdit}
                                            update={(next) =>
                                              updateRow(i, next)
                                            }
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
                                      if (
                                        label?.trim() &&
                                        label.length <= 200
                                      ) {
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
                                ? "Read-only · Changes are made only in Data Input"
                                : localPin
                                  ? "Local edits stay in your browser"
                                  : demo
                                    ? "Demo admin edits stay in your browser"
                                    : "Admin changes are versioned and audit logged"}{" "}
                              · Currency: $
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
              {view === "reports" && !countryOnly && (
                <ReportLibrary
                  onYearChange={setYear}
                  entries={entries}
                  year={year}
                  loading={loading}
                  source={
                    localPin
                      ? "Browser-local saved inputs; not shared"
                      : publicDemo
                        ? reportSource
                        : demo
                          ? "Fictional demonstration data"
                          : "Saved authorized market data"
                  }
                />
              )}
              {view === "activity" && !publicDemo && <ActivityLog />}
              {!publicDemo && view === "setup" && (
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
                    The interface is ready. Live accounts and shared data
                    require a Supabase project.
                  </p>
                  <ol>
                    <li>
                      <strong>Connect a database</strong>
                      <p>
                        Run the repository’s <code>supabase/schema.sql</code> in
                        your Supabase project. It creates market tables,
                        permission policies, version checks, and an audit log.
                      </p>
                    </li>
                    <li>
                      <strong>Configure this application</strong>
                      <p>
                        Set <code>VITE_SUPABASE_URL</code> and{" "}
                        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> as project
                        environment variables, then redeploy. Never use a secret
                        or service-role key in the browser.
                      </p>
                    </li>
                    <li>
                      <strong>Invite and assign managers</strong>
                      <p>
                        Create manager accounts in Supabase Auth. A database
                        administrator assigns each account to one or more
                        markets. No self-assignment is possible. See the README
                        for SQL examples.
                      </p>
                    </li>
                    <li>
                      <strong>Import your market workbooks</strong>
                      <p>
                        An administrator uses Data Input to choose the matching
                        market and year, then Import Excel. All other pages are
                        read-only. FULL BUDGET is a reference workbook, not a
                        market import.
                      </p>
                    </li>
                  </ol>
                  <div className="notice">
                    USD is the initial reporting currency; no currency
                    conversion is applied. Confirm the currency before
                    importing. Your original workbooks have not been committed
                    or uploaded.
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
            </>
          )}
        </main>
        {!(view === "overview" && !market) && (
          <PageInsights
            view={view}
            entries={entries}
            year={year}
            market={market}
          />
        )}
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
              do not overwrite the monthly BOB. Budget revenue is shown with $
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
        {money(
          adr(data.commercial[1].targets[w], data.commercial[0].targets[w]),
        )}
      </td>
      <td>
        {money(adr(data.commercial[1].weekly[w], data.commercial[0].weekly[w]))}
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
  const display = isMoneyMetric(label) ? money(value) : num(value);
  if (!editable)
    return (
      <span className="read-only-value" aria-label={`${label}: ${display}`}>
        {display}
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
function Login({ onSuccess: _onSuccess }: { onSuccess: () => void }) {
  return <SignInPage />;
}
