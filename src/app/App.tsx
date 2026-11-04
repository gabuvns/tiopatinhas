import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coins,
  Download,
  FileDown,
  FileUp,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LineChart,
  LockKeyhole,
  Menu,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  activeEvents,
  buildPortfolio,
  planContribution,
  formatDate,
  formatNumber,
  makeEvent,
  projectWealth,
  summarizeMonth,
  today,
  type AssetClass,
  type Currency,
  type Geography,
  type IlliquidClass,
  type LedgerEvent,
  type Position,
  type TradeEvent,
  type OpeningPositionEvent,
} from "../domain/domain";
import {
  setStorageScope,
  type Pocket,
  exportBackup,
  emptyData,
  loadData,
  saveData,
  restoreBackup,
  validateData,
  type AppData,
} from "../infrastructure/store";
import Pockets, { defaultPockets } from "../features/pockets/Pockets";
import { demoData } from "../features/demo/demo";
import ImportGuide from "../features/import/ImportGuide";
import WealthHistory from "../features/history/WealthHistory";
import AllocationPie from "../shared/charts/AllocationPie";
import EmergencyReserve from "../features/portfolio/EmergencyReserve";
import ForecastPage from "../features/planning/ForecastPage";
import { savingsBaseline } from "../domain/planning";
import {
  CurrencySwitch,
  DisplayCurrencyContext,
  useDisplayCurrency,
} from "../shared/DisplayCurrency";
import { moneyDisplay } from "../domain/money";
import {
  LiquidAssetGroups,
  IlliquidAssetGroups,
} from "../features/portfolio/PortfolioAssets";

type View = "overview" | "activity" | "portfolio" | "rebalance" | "forecast";
type EntryKind =
  | "income"
  | "expense"
  | "salary_change"
  | "trade"
  | "target"
  | "illiquid_contribution"
  | "illiquid_valuation"
  | "quote";

const monthNow = today().slice(0, 7);
const todayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());
const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "activity", label: "Lançamentos", icon: Activity },
  { id: "portfolio", label: "Carteira", icon: BriefcaseBusiness },
  { id: "rebalance", label: "Rebalanceamento", icon: Scale },
  { id: "forecast", label: "Projeções", icon: LineChart },
];
const liquidClasses: Record<Geography, AssetClass[]> = {
  Brasil: ["Ações", "FIIs", "Renda fixa"],
  Exterior: ["Stocks", "REITs", "ETFs", "Fixed income"],
  Cripto: ["Bitcoin", "Altcoins"],
};
const illiquidClasses: IlliquidClass[] = [
  "FGTS",
  "Previdência",
  "Imóveis",
  "Empresas",
  "Metais preciosos",
  "Obras de arte",
  "Veículos",
  "Joias",
  "Outro",
];

const asNumber = (value: FormDataEntryValue | null, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const assetKey = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "");
const illiquidKey = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const monthTitle = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-15T00:00:00Z`));
const formatFx = (rate: number) => "R$ " + formatNumber(rate, 4);

function quantityAtDate(
  events: LedgerEvent[],
  assetId: string,
  date: string,
): number {
  return activeEvents(events)
    .filter(
      (event): event is TradeEvent | OpeningPositionEvent =>
        (event.type === "trade" || event.type === "opening_position") &&
        event.assetId === assetId &&
        event.date <= date,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    )
    .reduce(
      (quantity, event) =>
        event.type === "opening_position"
          ? event.quantity
          : event.side === "COMPRA"
            ? quantity + event.quantity
            : quantity - event.quantity,
      0,
    );
}

function openCalendar(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  } catch {
    input.focus();
  }
}

function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="month-control">
      <button
        type="button"
        className="month-picker"
        aria-label={`Escolher mês: ${monthTitle(month)}`}
        onClick={() => openCalendar(inputRef.current)}
      >
        <CalendarDays size={18} aria-hidden="true" />
        <span>{monthTitle(month)}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        className="month-picker-native"
        type="month"
        aria-label="Mês do relatório"
        value={month}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
    </div>
  );
}

function App() {
  const [data, setData] = useState<AppData>(emptyData());
  const [storageHealthy, setStorageHealthy] = useState(true);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [month, setMonth] = useState(monthNow);
  const [modal, setModal] = useState<EntryKind | null>(null);
  const [toast, setToast] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [importPreview, setImportPreview] = useState<AppData | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const demoLock = useRef(false);
  const exportLock = useRef(false);
  const dataGeneration = useRef(0);
  const importRef = useRef<HTMLInputElement>(null);
  const autoQuotesStarted = useRef(false);
  const [projectionMonths, setProjectionMonths] = useState(120);
  const [annualReturn, setAnnualReturn] = useState(7);
  const portfolio = useMemo(
    () => buildPortfolio(data.events, getFxRate(data.events)),
    [data.events],
  );
  const summary = useMemo(
    () => summarizeMonth(data.events, month, getFxRate(data.events)),
    [data.events, month],
  );
  const events = useMemo(
    () =>
      activeEvents(data.events).sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt),
      ),
    [data.events],
  );
  const fxRate = useMemo(() => getFxRate(data.events), [data.events]);
  const displayCurrency = data.settings.displayCurrency ?? "BRL";
  const display = useMemo(
    () => moneyDisplay(displayCurrency, fxRate),
    [displayCurrency, fxRate],
  );
  const formatMoney = display.formatMoney;
  const baseline = useMemo(() => savingsBaseline(data.events), [data.events]);
  const avgSavings = baseline.savingsRate;
  const monthlyContribution = baseline.monthlyContribution;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  useEffect(() => {
    let mounted = true;
    loadData()
      .then((loaded) => {
        if (mounted) {
          setData({
            ...loaded,
            settings: {
              ...loaded.settings,
              pockets: loaded.settings.pockets ?? defaultPockets,
            },
          });
          if (loaded.importInfo) {
            const lastMonth = activeEvents(loaded.events)
              .filter(
                (event) => event.type === "income" || event.type === "expense",
              )
              .map((event) => event.date.slice(0, 7))
              .sort()
              .pop();
            setMonth(lastMonth ?? loaded.importInfo.referenceDate.slice(0, 7));
          }
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setStorageHealthy(false);
          setReady(true);
          notify(
            error instanceof Error
              ? error.message
              : "Não foi possível abrir os dados.",
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (ready && storageHealthy)
      saveData(data).catch(() => notify("Falha ao salvar no navegador."));
  }, [data, ready, storageHealthy]);

  useEffect(() => {
    if (!ready || !storageHealthy) return;
    const recorded = new Set(
      activeEvents(data.events)
        .filter((event) => event.type === "milestone")
        .map((event) => event.threshold),
    );
    const newlyReached = data.settings.milestones.filter(
      (threshold) =>
        portfolio.totalValue >= threshold && !recorded.has(threshold),
    );
    if (newlyReached.length) {
      setData((current) => ({
        ...current,
        events: [
          ...current.events,
          ...newlyReached.map((threshold) =>
            makeEvent({ type: "milestone", date: today(), threshold }),
          ),
        ],
      }));
      notify(`Marco patrimonial alcançado: ${formatMoney(newlyReached[0])}.`);
    }
  }, [ready, portfolio.totalValue, data.events, data.settings.milestones]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!ready || autoQuotesStarted.current) return;
    autoQuotesStarted.current = true;
    void refreshQuotes();
  }, [ready]);

  function notify(message: string) {
    setToast(message);
  }

  function addEvent(event: LedgerEvent) {
    setData((current) => ({ ...current, events: [...current.events, event] }));
    setModal(null);
    notify("Lançamento adicionado ao histórico.");
  }

  function setReserve(position: Position, selected: boolean) {
    if (selected && data.settings.pockets?.some((p) => p.allocations.some((a) => a.assetId === position.assetId && a.amount > 0))) {
      notify("Remova a destinação deste ativo dos cofrinhos antes de incluí-lo na reserva.");
      return;
    }
    if (
      selected &&
      data.settings.pockets?.some((p) =>
        p.allocations.some(
          (a) => a.assetId === position.assetId && a.amount > 0,
        ),
      )
    ) {
      notify(
        "Remova a destinação nos cofrinhos antes de incluir esse ativo na reserva.",
      );
      return;
    }
    addEvent(
      makeEvent({
        type: "reserve_classification",
        date: today(),
        assetId: position.assetId,
        isEmergencyReserve: selected,
      }),
    );
    notify(
      selected
        ? position.ticker + " incluído na reserva de emergência."
        : position.ticker + " removido da reserva de emergência.",
    );
  }

  function setMilestones(milestones: number[]) {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, milestones },
    }));
    notify("Metas de patrimônio atualizadas.");
  }

  function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date") || today());
    const memo = String(form.get("memo") ?? "").trim();
    const optionalMemo = memo ? { memo } : {};
    if (modal === "income") {
      const amount = asNumber(form.get("amount"));
      if (amount <= 0) return notify("Informe um valor maior que zero.");
      addEvent(
        makeEvent({
          type: "income",
          date,
          category: String(form.get("category")) as
            | "Salário"
            | "Renda extra"
            | "Dividendos",
          amount,
          ...optionalMemo,
        }),
      );
    } else if (modal === "salary_change") {
      const monthlyAmount = asNumber(form.get("amount"));
      if (monthlyAmount <= 0)
        return notify("Informe uma remuneração mensal maior que zero.");
      addEvent(
        makeEvent({
          type: "salary_change",
          date,
          monthlyAmount,
          ...optionalMemo,
        }),
      );
    } else if (modal === "expense") {
      const amount = asNumber(form.get("amount"));
      if (amount <= 0) return notify("Informe um valor maior que zero.");
      const category = String(form.get("category")) as
        | "Cartão"
        | "PIX"
        | "Mercado"
        | "Outro";
      addEvent(
        makeEvent({
          type: "expense",
          date,
          category,
          amount,
          ...(category === "Cartão"
            ? { cardName: String(form.get("cardName") || "Cartão") }
            : {}),
          ...optionalMemo,
        }),
      );
    } else if (modal === "trade") {
      const ticker = assetKey(String(form.get("ticker") ?? ""));
      const quantity = asNumber(form.get("quantity"));
      const unitPrice = asNumber(form.get("unitPrice"));
      const geography = String(form.get("geography")) as Geography;
      const assetClass = String(form.get("assetClass")) as AssetClass;
      const precision = Math.max(
        0,
        Math.min(
          8,
          Math.trunc(
            asNumber(form.get("precision"), geography === "Cripto" ? 8 : 0),
          ),
        ),
      );
      if (!ticker || quantity <= 0 || unitPrice <= 0)
        return notify(
          "Preencha ticker, quantidade e preço com valores válidos.",
        );
      const side = String(form.get("side")) as "COMPRA" | "VENDA";
      const assetId = ticker;
      const available = quantityAtDate(data.events, assetId, date);
      if (side === "VENDA" && quantity > available + 1e-9)
        return notify(
          "A quantidade da venda supera a posição disponível na data escolhida.",
        );
      addEvent(
        makeEvent({
          type: "trade",
          date,
          side,
          assetId,
          ticker,
          name: String(form.get("name") || ticker),
          geography,
          assetClass,
          currency: String(form.get("currency")) as Currency,
          quantity,
          unitPrice,
          precision,
          fxRate:
            String(form.get("currency")) === "USD" ? fxRate || undefined : 1,
          ...optionalMemo,
        }),
      );
    } else if (modal === "target") {
      const ticker = assetKey(String(form.get("ticker") ?? ""));
      const targetPercent = asNumber(form.get("targetPercent"));
      const targetGeography = String(form.get("geography")) as Geography;
      if (!ticker || targetPercent <= 0 || targetPercent > 100)
        return notify("Informe um ticker e um alvo maior que 0% até 100%.");
      addEvent(
        makeEvent({
          type: "target",
          date,
          assetId: ticker,
          ticker,
          name: String(form.get("name") || ticker),
          geography: targetGeography,
          assetClass: String(form.get("assetClass")) as AssetClass,
          currency: String(form.get("currency")) as Currency,
          precision: Math.max(
            0,
            Math.min(8, Math.trunc(asNumber(form.get("precision")))),
          ),
          targetPercent,
          ...optionalMemo,
        }),
      );
    } else if (
      modal === "illiquid_contribution" ||
      modal === "illiquid_valuation"
    ) {
      const name = String(form.get("name") ?? "").trim();
      const amount = asNumber(form.get("amount"));
      const assetClass = String(form.get("assetClass")) as IlliquidClass;
      if (!name || amount <= 0)
        return notify("Informe o ativo e um valor maior que zero.");
      const assetId = illiquidKey(name);
      if (modal === "illiquid_contribution")
        addEvent(
          makeEvent({
            type: "illiquid_contribution",
            date,
            assetId,
            name,
            assetClass,
            amount,
            ...optionalMemo,
          }),
        );
      else
        addEvent(
          makeEvent({
            type: "illiquid_valuation",
            date,
            assetId,
            name,
            assetClass,
            amount,
            ...optionalMemo,
          }),
        );
    } else if (modal === "quote") {
      const ticker = assetKey(String(form.get("ticker") ?? ""));
      const price = asNumber(form.get("price"));
      const selectedAssetId = String(form.get("assetId") || ticker);
      const assetId = selectedAssetId === "manual" ? ticker : selectedAssetId;
      if (!assetId || price <= 0)
        return notify("Informe o ativo e um preço válido.");
      addEvent(
        makeEvent({
          type: "quote",
          date,
          assetId,
          ticker: ticker || "USD/BRL",
          price,
          currency: String(form.get("currency")) as Currency,
          source: "Manual",
          fetchedAt: new Date().toISOString(),
          ...optionalMemo,
        }),
      );
    }
  }

  function setTarget(position: Position, value: string) {
    const targetPercent = Math.max(0, Math.min(100, Number(value) || 0));
    const event = makeEvent({
      type: "target",
      date: today(),
      assetId: position.assetId,
      ticker: position.ticker,
      targetPercent,
    });
    setData((current) => ({ ...current, events: [...current.events, event] }));
  }

  function reverseEvent(id: string) {
    const reason = window.prompt("Motivo do estorno (opcional):");
    if (reason === null) return;
    setData((current) => ({
      ...current,
      events: [
        ...current.events,
        makeEvent({
          type: "correction",
          date: today(),
          targetEventId: id,
          reason,
        }),
      ],
    }));
    notify("Estorno registrado; o lançamento original foi preservado.");
  }

  async function refreshQuotes() {
    const generation = dataGeneration.current;
    setQuoteBusy(true);
    const latest: LedgerEvent[] = [];
    const active = activeEvents(data.events);
    const holdings = buildPortfolio(active, fxRate).positions;
    const stamp = new Date().toISOString();
    try {
      const response = await fetch(
        "https://api.frankfurter.dev/v2/rate/usd/brl",
      );
      if (response.ok) {
        const rateData = (await response.json()) as {
          date: string;
          rate: number;
        };
        if (rateData.rate > 0)
          latest.push(
            makeEvent({
              type: "quote",
              date: rateData.date,
              assetId: "FX:USD/BRL",
              ticker: "USD/BRL",
              price: rateData.rate,
              currency: "BRL",
              source: "Frankfurter · referência diária",
              fetchedAt: stamp,
            }),
          );
      }
    } catch {
      /* existing/manual FX stays in place */
    }

    await Promise.all(
      holdings
        .filter((position) => !position.balanceBased)
        .map(async (position) => {
          try {
            if (position.geography === "Cripto") {
              const symbol = position.ticker.endsWith("USDT")
                ? position.ticker
                : `${position.ticker}USDT`;
              const response = await fetch(
                `https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
              );
              if (!response.ok) return;
              const body = (await response.json()) as { price?: string };
              const price = Number(body.price);
              if (price > 0)
                latest.push(
                  makeEvent({
                    type: "quote",
                    date: today(),
                    assetId: position.assetId,
                    ticker: position.ticker,
                    price,
                    currency: "USD",
                    source: `Binance · ${symbol}`,
                    fetchedAt: stamp,
                  }),
                );
            } else if (
              position.geography === "Brasil" &&
              ["PETR4", "MGLU3", "VALE3", "ITUB4"].includes(position.ticker)
            ) {
              const response = await fetch(
                `https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(position.ticker)}`,
              );
              if (!response.ok) return;
              const body = (await response.json()) as {
                results?: {
                  data?: {
                    regularMarketPrice?: number;
                    regularMarketTime?: string;
                    currency?: string;
                  };
                }[];
              };
              const quote = body.results?.[0]?.data;
              if (quote?.regularMarketPrice && quote.regularMarketPrice > 0)
                latest.push(
                  makeEvent({
                    type: "quote",
                    date: quote.regularMarketTime?.slice(0, 10) ?? today(),
                    assetId: position.assetId,
                    ticker: position.ticker,
                    price: quote.regularMarketPrice,
                    currency: quote.currency === "USD" ? "USD" : "BRL",
                    source: "brapi · mercado brasileiro",
                    fetchedAt: stamp,
                  }),
                );
            }
          } catch {
            /* unsupported tickers and provider/CORS errors use the stored/manual quote */
          }
        }),
    );
    if (generation !== dataGeneration.current) {
      setQuoteBusy(false);
      return;
    }
    if (latest.length) {
      setData((current) => ({
        ...current,
        events: [...current.events, ...latest],
      }));
      notify(
        `${latest.length} cotação(ões) atualizada(s); os preços disponíveis foram preservados.`,
      );
    } else
      notify(
        "Nenhuma fonte respondeu para os ativos atuais. Você pode informar os preços manualmente.",
      );
    setQuoteBusy(false);
  }

  async function handleImportFile(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const imported = validateData(JSON.parse(await file.text()));
      setImportPreview(imported);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo.",
      );
    }
  }

  async function handleExport() {
    if (!storageHealthy) {
      notify("Restaure um backup válido antes de exportar.");
      return;
    }
    if (exportLock.current || importBusy) return;
    exportLock.current = true;
    setExportBusy(true);
    try {
      const exported = await exportBackup(data);
      const snapshot = exported.events[exported.events.length - 1];
      setData((current) => ({
        ...current,
        events: current.events.some((event) => event.id === snapshot.id)
          ? current.events
          : [...current.events, snapshot],
      }));
      notify(
        "JSON exportado com um novo snapshot do patrimônio salvo no histórico.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o snapshot e exportar.",
      );
    } finally {
      exportLock.current = false;
      setExportBusy(false);
    }
  }

  async function restoreImport() {
    if (!importPreview || importBusy || exportLock.current) return;
    setImportBusy(true);
    dataGeneration.current += 1;
    try {
      const restored = await restoreBackup(importPreview);
      setStorageHealthy(true);
      setData(restored);
      const lastMonth = activeEvents(restored.events)
        .filter((event) => event.type === "income" || event.type === "expense")
        .map((event) => event.date.slice(0, 7))
        .sort()
        .pop();
      setMonth(
        lastMonth ?? restored.importInfo?.referenceDate.slice(0, 7) ?? monthNow,
      );
      setView("overview");
      setModal(null);
      setMobileNav(false);
      setImportPreview(null);
      notify(
        restored.events.length +
          " registros importados e salvos. Painel atualizado.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o backup neste navegador.",
      );
    } finally {
      setImportBusy(false);
    }
  }

  function saveTargetFromRebalance(position: Position, value: string) {
    setTarget(position, value);
  }

  const heading =
    navItems.find((item) => item.id === view)?.label ?? "Visão geral";
  const projection = projectWealth(
    portfolio.totalValue,
    monthlyContribution,
    annualReturn,
    projectionMonths,
  );

  return (
    <DisplayCurrencyContext.Provider value={display}>
      <div className="app-shell">
        <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
          <div className="brand">
            <span className="brand-mark">
              <span />
              <span />
              <span />
            </span>
            <span className="brand-name">
              TioPatinhas<span className="brand-dot">.</span>
            </span>
            <button
              className="icon-button mobile-close"
              aria-label="Fechar navegação"
              onClick={() => setMobileNav(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="workspace-label">ESPAÇO PESSOAL</div>
          <div className="profile-chip">
            <div className="profile-avatar">TP</div>
            <div>
              <strong>Minha carteira</strong>
              <small>Visão consolidada</small>
            </div>
          </div>
          <nav className="primary-nav">
            <span className="nav-caption">MENU PRINCIPAL</span>
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${view === id ? "active" : ""}`}
                onClick={() => {
                  setView(id);
                  setMobileNav(false);
                }}
              >
                <Icon size={18} strokeWidth={view === id ? 2.2 : 1.8} />
                <span>{label}</span>
                {id === "rebalance" && (
                  <span className="nav-count">
                    {portfolio.positions.filter(
                      (item) =>
                        item.targetPercent > 0 &&
                        !item.isEmergencyReserve &&
                        item.rebalanceEligible !== false,
                    ).length || ""}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-spacer" />
          <div className="privacy-note">
            <LockKeyhole size={16} />
            <span>
              Seus dados ficam
              <br />
              neste navegador.
            </span>
          </div>
          <div className="sidebar-footer">
            <span className="online-dot" /> Armazenamento local ativo
            <button
              className="icon-button sidebar-help"
              title="Sobre os dados"
              onClick={() =>
                notify(
                  "Os dados são salvos localmente no IndexedDB do navegador e podem ser exportados em JSON.",
                )
              }
            >
              <CircleHelp size={16} />
            </button>
          </div>
        </aside>

        {mobileNav && (
          <button
            className="nav-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMobileNav(false)}
          />
        )}
        <main className="main-area">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir navegação"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <span>Finanças</span>
              <ChevronRight size={14} />
              <strong>{heading}</strong>
            </div>
            <div className="top-actions">
              <button
                disabled={
                  !storageHealthy || quoteBusy || exportBusy || importBusy
                }
                className="button button-quiet"
                onClick={async () => {
                  if (demoLock.current) return;
                  demoLock.current = true;
                  try {
                    await saveData(data);
                    dataGeneration.current++;
                    setStorageScope(!demo);
                    const next = demo ? await loadData() : demoData();
                    setDemo(!demo);
                    setData(next);
                    setView("overview");
                  } catch {
                    setStorageScope(demo);
                    notify(
                      "Não foi possível trocar o modo. Seus dados foram preservados.",
                    );
                  } finally {
                    demoLock.current = false;
                  }
                }}
              >
                {demo ? "Sair da demo" : "Experimentar demo"}
              </button>
              <CurrencySwitch
                currency={displayCurrency}
                usdBrl={fxRate}
                onChange={(currency) =>
                  setData((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      displayCurrency: currency,
                    },
                  }))
                }
              />
              <button
                className="button button-quiet top-import"
                onClick={() => importRef.current?.click()}
              >
                <FileUp size={16} /> Importar JSON
              </button>
              <button
                className="button button-outline top-export"
                disabled={exportBusy || importBusy}
                onClick={handleExport}
              >
                <Download size={16} /> {exportBusy ? "Exportando…" : "Exportar"}
              </button>
              <button
                className="button button-primary"
                onClick={() => setModal("income")}
              >
                <Plus size={17} /> Novo lançamento
              </button>
            </div>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleImportFile}
            />
          </header>

          <div className="page-content">
            {demo && (
              <div className="demo-banner">
                Demonstração · Marina Costa, pessoa fictícia. Seus dados
                pessoais ficam em um armazenamento separado.
              </div>
            )}
            {!storageHealthy && (
              <div role="alert" className="demo-banner">
                O histórico local não pôde ser lido. A gravação foi bloqueada
                para preservar os dados. Restaure um backup válido.
              </div>
            )}

            {view === "overview" && (
              <Overview
                month={month}
                setMonth={setMonth}
                monthTitle={monthTitle(month)}
                summary={summary}
                portfolio={portfolio}
                fxRate={fxRate}
                avgSavings={avgSavings}
                events={events}
                onNavigate={setView}
                onNew={setModal}
                onRefresh={refreshQuotes}
                quoteBusy={quoteBusy}
              />
            )}
            {view === "activity" && (
              <ActivityPage
                events={events}
                onNew={setModal}
                onReverse={reverseEvent}
                month={month}
                setMonth={setMonth}
              />
            )}
            {view === "portfolio" && (
              <PortfolioPage
                portfolio={portfolio}
                fxRate={fxRate}
                events={data.events}
                onNew={setModal}
                onTarget={setTarget}
                onRefresh={refreshQuotes}
                quoteBusy={quoteBusy}
                onReserve={setReserve}
                averageExpenses={baseline.averageExpenses}
                pocketsPanel={<Pockets positions={portfolio.positions} pockets={data.settings.pockets} onChange={(pockets: Pocket[]) => setData((c) => ({ ...c, settings: { ...c.settings, pockets } }))} />}
              />
            )}
            {view === "rebalance" && (
              <RebalancePage
                portfolio={portfolio}
                events={data.events}
                fxRate={fxRate}
                onTarget={saveTargetFromRebalance}
                onAddTarget={() => setModal("target")}
                onPortfolio={() => setView("portfolio")}
              />
            )}
            {view === "forecast" && (
              <ForecastPage
                portfolio={portfolio}
                events={events}
                baseline={baseline}
                projectionMonths={projectionMonths}
                setProjectionMonths={setProjectionMonths}
                annualReturn={annualReturn}
                setAnnualReturn={setAnnualReturn}
                projection={projection}
                milestones={data.settings.milestones}
                onMilestones={setMilestones}
              />
            )}
          </div>
          <ImportGuide />
          <footer className="page-footer">
            <span>
              TIOPATINHAS <span className="footer-separator">·</span> CONTROLE
              FINANCEIRO PESSOAL
            </span>
            <span>
              Valores em {displayCurrency}{" "}
              {fxRate > 0 ? (
                <>
                  <span className="footer-separator">·</span> US$ 1 ={" "}
                  {formatFx(fxRate)}
                  {displayCurrency === "USD"
                    ? " · conversão pelo câmbio de referência atual"
                    : ""}
                </>
              ) : (
                <>
                  <span className="footer-separator">·</span> câmbio
                  indisponível
                </>
              )}
            </span>
          </footer>
        </main>

        {modal && (
          <EntryModal
            kind={modal}
            onClose={() => setModal(null)}
            onSubmit={handleAddSubmit}
            portfolio={portfolio}
            onKindChange={setModal}
          />
        )}
        {importPreview && (
          <ConfirmDialog
            title="Importar backup JSON"
            busy={importBusy || exportBusy}
            onCancel={() => {
              if (!importBusy && !exportBusy) setImportPreview(null);
            }}
            onConfirm={restoreImport}
          >
            <p>
              Este arquivo contém <strong>{importPreview.events.length}</strong>{" "}
              eventos e substitui os dados salvos neste navegador.
            </p>
            <p>
              {
                importPreview.events.filter(
                  (event) => event.type === "opening_position",
                ).length
              }{" "}
              posições iniciais ·{" "}
              {
                importPreview.events.filter(
                  (event) => event.type === "investment_contribution",
                ).length
              }{" "}
              aportes históricos. Posições iniciais não contam como aportes.
            </p>
            {importPreview.importInfo && (
              <>
                <p>
                  Referência:{" "}
                  {formatDate(importPreview.importInfo.referenceDate)}. Origem:{" "}
                  {importPreview.importInfo.sourceFile}.
                </p>
                <details>
                  <summary>
                    Observações e divergências (
                    {importPreview.importInfo.warnings.length})
                  </summary>
                  <ul>
                    {importPreview.importInfo.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                  <p>
                    {importPreview.importInfo.reconciliations.length}{" "}
                    divergências entre abas foram registradas no backup;
                    prevalecem os detalhes.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Mês</th>
                          <th>Comparação</th>
                          <th>Detalhe adotado</th>
                          <th>Resumo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.importInfo.reconciliations.map(
                          (row, index) => (
                            <tr key={index}>
                              <td>{row.month}</td>
                              <td>{row.metric}</td>
                              <td>{formatMoney(row.detail)}</td>
                              <td>{formatMoney(row.summary)}</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
                <details>
                  <summary>Política de investimento e notas de origem</summary>
                  {importPreview.importInfo.notes.map((note, index) => (
                    <p key={index} style={{ whiteSpace: "pre-wrap" }}>
                      {note}
                    </p>
                  ))}
                </details>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={exportBusy || importBusy}
                  onClick={handleExport}
                >
                  <Download size={15} />{" "}
                  {exportBusy
                    ? "Exportando…"
                    : "Baixar backup atual antes de restaurar"}
                </button>
              </>
            )}
            <div className="import-summary">
              <ShieldCheck size={18} /> O arquivo passou pela validação de
              estrutura.
            </div>
          </ConfirmDialog>
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            {toast}
          </div>
        )}
        {!ready && (
          <div className="loading-screen">
            <span className="loader" />
            <span>Preparando sua visão financeira…</span>
          </div>
        )}
      </div>
    </DisplayCurrencyContext.Provider>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-head">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyInline({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-inline">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      <button onClick={onClick}>
        {action} <ArrowUpRight size={13} />
      </button>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  text,
  onClick,
  tone,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className={`quick-icon ${tone}`}>{icon}</span>
      <span className="quick-action-copy">
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ChevronRight size={16} className="quick-arrow" />
    </button>
  );
}

function ActivityRow({
  event,
  onReverse,
}: {
  event: LedgerEvent;
  onReverse?: (id: string) => void;
}) {
  const { formatMoney } = useDisplayCurrency();
  const { label, detail, amount, type } = eventDescription(event, formatMoney);
  return (
    <div className="activity-row">
      <div className={`activity-type ${type}`}>
        {type === "income" ? (
          <ArrowDownLeft size={16} />
        ) : type === "trade" ? (
          <ArrowLeftRight size={16} />
        ) : type === "expense" ? (
          <ArrowUpRight size={16} />
        ) : (
          <Landmark size={16} />
        )}
      </div>
      <div className="activity-copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <span
        className={`activity-amount ${type === "income" ? "positive" : ""}`}
      >
        {amount}
      </span>
      <span className="activity-date">{formatDate(event.date)}</span>
      {onReverse && (
        <button
          className="table-action"
          title="Estornar lançamento"
          onClick={() => onReverse(event.id)}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

function eventDescription(
  event: LedgerEvent,
  formatMoney: (value: number, currency?: Currency) => string,
): {
  label: string;
  detail: string;
  amount: string;
  type: "income" | "expense" | "trade" | "other";
} {
  if (event.type === "opening_position")
    return {
      label: "Posição inicial · " + event.ticker,
      detail: "Quantidade importada; custo de aquisição não informado",
      amount: formatMoney(event.quantity * event.marketPrice, event.currency),
      type: "other",
    };
  if (event.type === "investment_contribution")
    return {
      label: "Aporte histórico · " + event.category,
      detail: event.memo || "Registro mensal; não altera a posição atual",
      amount: formatMoney(event.amount),
      type: "other",
    };
  if (event.type === "wealth_snapshot")
    return {
      label: "Patrimônio histórico",
      detail: "Valor declarado na planilha; não altera o patrimônio atual",
      amount: formatMoney(event.totalValue),
      type: "other",
    };
  if (event.type === "income")
    return {
      label: event.category,
      detail: event.memo || "Recebimento",
      amount: `+${formatMoney(event.amount)}`,
      type: "income",
    };
  if (event.type === "expense")
    return {
      label:
        event.category === "Cartão"
          ? `Fatura · ${event.cardName || "Cartão"}`
          : event.category,
      detail: event.memo || "Despesa do mês",
      amount: `−${formatMoney(event.amount)}`,
      type: "expense",
    };
  if (event.type === "trade")
    return {
      label: `${event.side === "COMPRA" ? "Compra" : "Venda"} · ${event.ticker}`,
      detail: `${formatNumber(event.quantity, 6)} un. × ${formatMoney(event.unitPrice, event.currency)}`,
      amount: `${event.side === "COMPRA" ? "−" : "+"}${formatMoney(event.quantity * event.unitPrice, event.currency)}`,
      type: "trade",
    };
  if (event.type === "salary_change")
    return {
      label: "Atualização salarial",
      detail: event.memo || "Novo valor de remuneração",
      amount: formatMoney(event.monthlyAmount),
      type: "other",
    };
  if (event.type === "illiquid_contribution")
    return {
      label: `Aporte · ${event.name}`,
      detail: event.assetClass,
      amount: `+${formatMoney(event.amount)}`,
      type: "other",
    };
  if (event.type === "illiquid_valuation")
    return {
      label: `Avaliação · ${event.name}`,
      detail: event.assetClass,
      amount: formatMoney(event.amount),
      type: "other",
    };
  if (event.type === "quote")
    return {
      label: `Cotação · ${event.ticker}`,
      detail:
        event.assetId === "FX:USD/BRL"
          ? event.source + " · US$ 1 em BRL"
          : event.source,
      amount:
        event.assetId === "FX:USD/BRL"
          ? formatFx(event.price)
          : formatMoney(event.price, event.currency),
      type: "other",
    };
  if (event.type === "target")
    return {
      label: `Alvo · ${event.ticker}`,
      detail: "Meta de alocação atualizada",
      amount: `${event.targetPercent}%`,
      type: "other",
    };
  if (event.type === "reserve_classification")
    return {
      label: "Reserva · " + event.assetId,
      detail: event.isEmergencyReserve
        ? "Incluído na reserva de emergência"
        : "Removido da reserva de emergência",
      amount: "—",
      type: "other",
    };
  if (event.type === "milestone")
    return {
      label: `Marco patrimonial · ${formatMoney(event.threshold)}`,
      detail: "Conquista registrada",
      amount: "✓",
      type: "other",
    };
  if (event.type === "correction")
    return {
      label: "Estorno registrado",
      detail: event.reason || "Lançamento corrigido",
      amount: "—",
      type: "other",
    };
  return { label: "Registro", detail: "", amount: "—", type: "other" };
}

function ActivityPage({
  events,
  onNew,
  onReverse,
  month,
  setMonth,
}: {
  events: LedgerEvent[];
  onNew: (kind: EntryKind) => void;
  onReverse: (id: string) => void;
  month: string;
  setMonth: (month: string) => void;
}) {
  const monthEvents = events.filter((event) => event.date.startsWith(month));
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SEU HISTÓRICO"
        title="Lançamentos"
        subtitle="Um registro claro de cada movimentação financeira."
        action={
          <button
            className="button button-primary"
            onClick={() => onNew("income")}
          >
            <Plus size={16} /> Novo lançamento
          </button>
        }
      />
      <section className="panel ledger-panel">
        <div className="ledger-toolbar">
          <div>
            <h2>Histórico de eventos</h2>
            <p>
              {monthEvents.length} registros em {monthTitle(month)}
            </p>
          </div>
          <MonthPicker month={month} onChange={setMonth} />
        </div>
        {monthEvents.length ? (
          <div className="activity-list ledger-list">
            {monthEvents.map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                onReverse={event.type === "correction" ? undefined : onReverse}
              />
            ))}
          </div>
        ) : (
          <EmptyInline
            icon={<Clock3 size={19} />}
            title="Nenhum registro neste mês"
            text="Os lançamentos adicionados aparecerão aqui."
            action="Adicionar lançamento"
            onClick={() => onNew("income")}
          />
        )}
        <div className="ledger-note">
          <LockKeyhole size={15} /> Eventos são imutáveis. Para corrigir um
          registro, use o estorno; o histórico original permanece disponível no
          arquivo JSON.
        </div>
      </section>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading-row">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-dot" /> {eyebrow}
        </div>
        <h1>
          {title}
          <span className="heading-period">.</span>
        </h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}

function PortfolioPage({
  portfolio,
  fxRate,
  events,
  onNew,
  onTarget,
  onRefresh,
  quoteBusy,
  onReserve,
  averageExpenses,
  pocketsPanel,
}: {
  portfolio: ReturnType<typeof buildPortfolio>;
  fxRate: number;
  events: LedgerEvent[];
  onNew: (kind: EntryKind) => void;
  onTarget: (position: Position, value: string) => void;
  onRefresh: () => void;
  quoteBusy: boolean;
  onReserve: (position: Position, selected: boolean) => void;
  averageExpenses: number;
  pocketsPanel: ReactNode;
}) {
  const { formatMoney } = useDisplayCurrency();
  const allEvents = activeEvents(events);
  const fxEvents = allEvents.filter(
    (event) => event.type === "quote" && event.assetId === "FX:USD/BRL",
  );
  const lastFx = fxEvents[fxEvents.length - 1];
  const classAmounts = new Map<string, number>();
  portfolio.positions.forEach((position) =>
    classAmounts.set(
      position.assetClass,
      (classAmounts.get(position.assetClass) ?? 0) + position.value,
    ),
  );
  portfolio.illiquidAssets.forEach((asset) =>
    classAmounts.set(
      asset.assetClass,
      (classAmounts.get(asset.assetClass) ?? 0) + asset.value,
    ),
  );
  const classRows = [...classAmounts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="PATRIMÔNIO CONSOLIDADO"
        title="Sua carteira"
        subtitle="Posições, cotações e alvos em uma única visão."
        action={
          <>
            <a className="button button-outline" href="#portfolio-categories">
              Ver categorias <ChevronDown size={16} />
            </a>
            <button
              className="button button-quiet"
              onClick={onRefresh}
              disabled={quoteBusy}
            >
              <RefreshCw size={16} className={quoteBusy ? "spin" : ""} />{" "}
              {quoteBusy ? "Atualizando…" : "Atualizar preços"}
            </button>
            <button
              className="button button-primary"
              onClick={() => onNew("trade")}
            >
              <Plus size={16} /> Registrar operação
            </button>
          </>
        }
      />
      <div className="portfolio-summary-grid">
        <MetricCard
          label="Patrimônio total"
          value={formatMoney(portfolio.totalValue)}
          detail="Líquido + ilíquido"
          icon={<Wallet size={17} />}
          tone="mint"
        />
        <MetricCard
          label="Ativos líquidos"
          value={formatMoney(portfolio.liquidValue)}
          detail={`${portfolio.positions.length} posições consolidadas`}
          icon={<TrendingUp size={17} />}
          tone="blue"
        />
        <MetricCard
          label="Ativos ilíquidos"
          value={formatMoney(portfolio.illiquidValue)}
          detail={`${portfolio.illiquidAssets.length} bens e reservas`}
          icon={<Landmark size={17} />}
          tone="lavender"
        />
        <MetricCard
          label="Câmbio de referência"
          value={fxRate > 0 ? formatFx(fxRate) : "Indisponível"}
          detail={
            lastFx?.type === "quote"
              ? `US$ 1 em BRL · ${formatDate(lastFx.date)}`
              : "Busque uma taxa diária"
          }
          icon={<ArrowLeftRight size={17} />}
          tone="sand"
        />
      </div>
      <EmergencyReserve
        positions={portfolio.positions}
        monthlyExpenses={averageExpenses}
        onChange={onReserve}
      />
      {pocketsPanel}
      <section className="panel class-allocation-panel">
        <div className="panel-heading">
          <div>
            <h2>Distribuição por classe de ativo</h2>
            <p>
              Percentual sobre o patrimônio consolidado, incluindo ativos
              ilíquidos.
            </p>
          </div>
          <span className="small-icon soft-blue">
            <BarChart3 size={16} />
          </span>
        </div>
        {classRows.length ? (
          <AllocationPie
            items={classRows.map(([label, amount]) => ({ label, amount }))}
            label="Distribuição do patrimônio por classe de ativo"
          />
        ) : (
          <EmptyInline
            icon={<BarChart3 size={18} />}
            title="Sem classes para distribuir"
            text="Registre ativos para comparar as participações."
            action="Adicionar ativo"
            onClick={() => onNew("trade")}
          />
        )}
      </section>
      <LiquidAssetGroups
        positions={portfolio.positions}
        portfolioTotal={portfolio.totalValue}
        onTarget={onTarget}
        onAdd={() => onNew("trade")}
        onQuote={() => onNew("quote")}
      />
      <div className="dashboard-grid">
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <h2>Patrimônio ilíquido</h2>
              <p>Valores estimados por você.</p>
            </div>
            <button
              className="button button-quiet button-small"
              onClick={() => onNew("illiquid_contribution")}
            >
              <Plus size={15} /> Adicionar
            </button>
          </div>
          {portfolio.illiquidAssets.length ? (
            <IlliquidAssetGroups
              assets={portfolio.illiquidAssets}
              portfolioTotal={portfolio.totalValue}
              onRevalue={() => onNew("illiquid_valuation")}
            />
          ) : (
            <EmptyInline
              icon={<Landmark size={19} />}
              title="Sem ativos ilíquidos"
              text="Inclua FGTS, previdência, imóveis ou outros bens."
              action="Adicionar ativo"
              onClick={() => onNew("illiquid_contribution")}
            />
          )}
        </section>
        <section className="panel price-panel">
          <div className="panel-heading">
            <div>
              <h2>Preços e câmbio</h2>
              <p>Fontes públicas; preços manuais como alternativa.</p>
            </div>
            <span className="small-icon soft-green">
              <RefreshCw size={15} />
            </span>
          </div>
          <div className="price-source-row">
            <span className="provider-chip">brapi</span>
            <span>
              <strong>Bolsa brasileira</strong>
              <small>
                Tickers gratuitos disponíveis: PETR4, MGLU3, VALE3 e ITUB4.
              </small>
            </span>
          </div>
          <div className="price-source-row">
            <span className="provider-chip provider-dark">Binance</span>
            <span>
              <strong>Criptoativos</strong>
              <small>Consulta spot em pares com USDT quando disponível.</small>
            </span>
          </div>
          <div className="price-source-row">
            <span className="provider-chip provider-blue">FX</span>
            <span>
              <strong>USD/BRL</strong>
              <small>
                {fxRate > 0
                  ? `Referência diária · ${formatNumber(fxRate, 4)}`
                  : "Atualize cotações para consultar a taxa."}
              </small>
            </span>
          </div>
          <div className="price-actions">
            <button
              className="button button-outline button-small"
              onClick={onRefresh}
              disabled={quoteBusy}
            >
              <RefreshCw size={14} /> Atualizar cotações
            </button>
            <button
              className="button button-quiet button-small"
              onClick={() => onNew("quote")}
            >
              <Plus size={14} /> Preço manual
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function RebalancePage({
  portfolio,
  events,
  fxRate,
  onTarget,
  onAddTarget,
  onPortfolio,
}: {
  portfolio: ReturnType<typeof buildPortfolio>;
  events: LedgerEvent[];
  fxRate: number;
  onTarget: (position: Position, value: string) => void;
  onAddTarget: () => void;
  onPortfolio: () => void;
}) {
  const { formatMoney } = useDisplayCurrency();
  const eligible = portfolio.positions.filter(
    (position) =>
      position.rebalanceEligible !== false && !position.isEmergencyReserve,
  );
  portfolio = {
    ...portfolio,
    positions: eligible,
    liquidValue: eligible.reduce((sum, position) => sum + position.value, 0),
  };
  const targets = portfolio.positions.reduce(
    (sum, position) => sum + position.targetPercent,
    0,
  );
  const [budget, setBudget] = useState(1000);
  const actions = planContribution(portfolio.positions, budget, fxRate);
  const missingPrices = portfolio.positions.filter(
    (position) =>
      position.targetPercent > 0 &&
      (position.price <= 0 || (position.currency === "USD" && fxRate <= 0)),
  );
  const targetsList = activeEvents(events).filter(
    (event) => event.type === "target",
  );
  const lastTarget = targetsList[targetsList.length - 1];
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="ESTRATÉGIA DE CARTEIRA"
        title="Rebalanceamento"
        subtitle="Defina seus pesos e veja o caminho até a alocação desejada."
        action={
          <button className="button button-primary" onClick={onAddTarget}>
            <Plus size={16} /> Adicionar ativo-alvo
          </button>
        }
      />
      <section className="panel">
        <label className="field">
          <span>Novo aporte disponível (BRL)</span>
          <input
            aria-label="Novo aporte disponível"
            type="number"
            min="0"
            step="100"
            value={budget}
            onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <p>
          O plano distribui somente dinheiro novo entre ativos abaixo do alvo.
          Saldo não usado:{" "}
          {formatMoney(
            Math.max(0, budget - actions.reduce((s, a) => s + a.amount, 0)),
          )}
        </p>
      </section>
      <section className="rebalance-intro">
        <div className="rebalance-icon">
          <Target size={20} />
        </div>
        <div>
          <strong>Alvos sobre a carteira de risco</strong>
          <p>
            A reserva de emergência selecionada e saldos importados fora da
            carteira de risco ficam fora desta base. Os pesos dos demais ativos
            são normalizados para 100%.
          </p>
        </div>
        <div
          className={`target-total ${Math.abs(targets - 100) < 0.01 ? "complete" : ""}`}
        >
          <strong>{targets.toFixed(1).replace(".", ",")}%</strong>
          <small>alvos cadastrados</small>
        </div>
      </section>
      <section className="panel rebalance-panel">
        <div className="panel-heading">
          <div>
            <h2>Distribuição atual e desejada</h2>
            <p>Atualize o campo “alvo” para cada ativo.</p>
          </div>
          <span className="rebalance-status">
            <span className="online-dot" /> {portfolio.positions.length} ativos
            analisados
          </span>
        </div>
        {portfolio.positions.length ? (
          <div className="rebalance-table-wrap">
            <table className="rebalance-table">
              <thead>
                <tr>
                  <th>ATIVO</th>
                  <th>VALOR ATUAL</th>
                  <th>ALVO</th>
                  <th>ATUAL</th>
                  <th>DIFERENÇA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((position) => {
                  const currentPercent =
                    portfolio.liquidValue > 0
                      ? (position.value / portfolio.liquidValue) * 100
                      : 0;
                  const targetPercent =
                    targets > 0 ? (position.targetPercent / targets) * 100 : 0;
                  const gap = targetPercent - currentPercent;
                  return (
                    <tr key={position.assetId}>
                      <td>
                        <div className="asset-cell">
                          <span className="asset-avatar">
                            {position.ticker.slice(0, 2)}
                          </span>
                          <span>
                            <strong>{position.ticker}</strong>
                            <small>{position.assetClass}</small>
                          </span>
                        </div>
                      </td>
                      <td>{formatMoney(position.value)}</td>
                      <td>
                        <label className="target-input target-wide">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={position.targetPercent || ""}
                            placeholder="0"
                            onChange={(event) =>
                              onTarget(position, event.target.value)
                            }
                          />
                          <span>%</span>
                        </label>
                      </td>
                      <td>
                        <div className="current-allocation">
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${Math.min(currentPercent, 100)}%`,
                              }}
                            />
                          </div>
                          <small>
                            {currentPercent.toFixed(1).replace(".", ",")}%
                          </small>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`gap-value ${gap > 0.1 ? "gap-positive" : gap < -0.1 ? "gap-negative" : ""}`}
                        >
                          {gap > 0 ? "+" : ""}
                          {gap.toFixed(1).replace(".", ",")} p.p.
                        </span>
                      </td>
                      <td>
                        <ChevronRight size={15} className="muted-icon" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyInline
            icon={<Target size={19} />}
            title="Adicione ativos para definir alvos"
            text="O rebalanceamento compara posições líquidas marcadas a mercado."
            action="Adicionar ativo-alvo"
            onClick={onAddTarget}
          />
        )}
        {targets > 0 && (
          <div className="target-hint">
            <Sparkles size={15} /> Os pesos somam{" "}
            {targets.toFixed(1).replace(".", ",")}%. Para calcular o destino,
            eles são normalizados proporcionalmente.
          </div>
        )}
      </section>
      <section className="panel action-plan">
        {missingPrices.length > 0 && (
          <div className="form-callout" role="status">
            Plano incompleto: informe preço e câmbio para{" "}
            {missingPrices.map((position) => position.ticker).join(", ")} na
            carteira. Esses ativos ainda não geram quantidades de compra.
          </div>
        )}
        <div className="panel-heading">
          <div>
            <h2>Plano de ação estimado</h2>
            <p>
              Quantidades arredondadas conforme a precisão cadastrada para cada
              ativo.
            </p>
          </div>
          <span className="small-icon soft-sand">
            <ArrowLeftRight size={16} />
          </span>
        </div>
        {targets > 0 && actions.length ? (
          <div className="action-list">
            {actions.map((action) => (
              <div className="action-row" key={action.assetId}>
                <span
                  className={`action-direction ${action.side === "COMPRAR" ? "buy" : "sell"}`}
                >
                  {action.side === "COMPRAR" ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </span>
                <span className="action-asset">
                  <strong>
                    {action.side} {action.ticker}
                  </strong>
                  <small>
                    {formatNumber(action.quantity, 8)} unidades estimadas
                  </small>
                </span>
                <span className="action-amount">
                  <strong>{formatMoney(action.amount)}</strong>
                  <small>residual {formatMoney(action.residual)}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyInline
            icon={<Check size={18} />}
            title={
              missingPrices.length
                ? "Cotações necessárias para calcular o plano"
                : targets > 0
                  ? "Carteira alinhada aos alvos"
                  : "Defina seus percentuais alvo"
            }
            text={
              missingPrices.length
                ? "Há ativos-alvo sem preço ou câmbio válido."
                : targets > 0
                  ? "Não há operações estimadas para os preços atuais."
                  : "Informe a porcentagem desejada em cada ativo."
            }
            action="Ver carteira"
            onClick={onPortfolio}
          />
        )}
        <div className="action-disclaimer">
          <CircleHelp size={15} /> O cálculo usa a composição da carteira
          líquida atual e a última cotação disponível. Não inclui impostos,
          custos ou execução.
        </div>
      </section>
      {lastTarget?.type === "target" && (
        <p className="last-update">
          Última alteração de alvo registrada em {formatDate(lastTarget.date)}.
        </p>
      )}
    </div>
  );
}

function EntryModal({
  kind,
  onClose,
  onSubmit,
  portfolio,
  onKindChange,
}: {
  kind: EntryKind;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  portfolio: ReturnType<typeof buildPortfolio>;
  onKindChange: (kind: EntryKind) => void;
}) {
  const [geography, setGeography] = useState<Geography>("Brasil");
  const titleMap: Record<EntryKind, string> = {
    income: "Registrar recebimento",
    expense: "Registrar despesa",
    salary_change: "Atualizar remuneração",
    trade: "Registrar operação",
    target: "Adicionar ativo-alvo",
    illiquid_contribution: "Adicionar ativo ilíquido",
    illiquid_valuation: "Atualizar avaliação",
    quote: "Informar preço manual",
  };
  const subtitleMap: Record<EntryKind, string> = {
    income: "Adicione uma entrada ao seu fluxo de caixa.",
    expense: "Registre o total da fatura ou uma despesa do mês.",
    salary_change: "Guarde a evolução histórica do salário mensal.",
    trade: "Registre uma compra ou venda no histórico da carteira.",
    target:
      "Inclua um ativo desejado mesmo antes de comprar a primeira unidade.",
    illiquid_contribution: "Adicione um aporte ou valor inicial estimado.",
    illiquid_valuation: "Registre o valor estimado mais recente do ativo.",
    quote:
      "O preço manual fica registrado com a data e pode ser substituído por outra cotação.",
  };
  const kinds = [
    {
      id: "income" as const,
      label: "Entrada",
      icon: <ArrowDownLeft size={14} />,
    },
    {
      id: "expense" as const,
      label: "Despesa",
      icon: <ArrowUpRight size={14} />,
    },
    {
      id: "trade" as const,
      label: "Operação",
      icon: <ArrowLeftRight size={14} />,
    },
  ];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
      >
        <div className="modal-header">
          <div>
            <span className="modal-eyebrow">HISTÓRICO FINANCEIRO</span>
            <h2 id="entry-title">{titleMap[kind]}</h2>
            <p>{subtitleMap[kind]}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={19} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          {["income", "expense", "trade"].includes(kind) && (
            <div className="entry-tabs">
              {kinds.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={kind === item.id ? "selected" : ""}
                  onClick={() => onKindChange(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <EntryFields
            kind={kind}
            geography={geography}
            setGeography={setGeography}
            portfolio={portfolio}
            onKindChange={onKindChange}
          />
          <div className="modal-footer">
            <span>
              <LockKeyhole size={14} /> Salvo localmente
            </span>
            <div>
              <button
                type="button"
                className="button button-quiet"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button type="submit" className="button button-primary">
                <Check size={15} /> Salvar registro
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function EntryFields({
  kind,
  geography,
  setGeography,
  portfolio,
  onKindChange,
}: {
  kind: EntryKind;
  geography: Geography;
  setGeography: (value: Geography) => void;
  portfolio: ReturnType<typeof buildPortfolio>;
  onKindChange: (kind: EntryKind) => void;
}) {
  const effectiveKind = kind;
  const [currency, setCurrency] = useState<Currency>(
    geography === "Brasil" ? "BRL" : "USD",
  );
  const [quoteCurrency, setQuoteCurrency] = useState<Currency>("BRL");
  const [precision, setPrecision] = useState(geography === "Cripto" ? 8 : 0);
  useEffect(() => {
    setCurrency(geography === "Brasil" ? "BRL" : "USD");
    setPrecision(geography === "Cripto" ? 8 : 0);
  }, [geography]);
  const defaultDate = today();
  const assets = portfolio.illiquidAssets;
  return (
    <div className="form-fields">
      {effectiveKind === "income" && (
        <>
          <label className="field">
            <span>Categoria</span>
            <select name="category">
              <option>Salário</option>
              <option>Renda extra</option>
              <option>Dividendos</option>
            </select>
          </label>
          <label className="field">
            <span>Valor recebido</span>
            <MoneyInput name="amount" />
          </label>
          <label className="field">
            <span>Data do recebimento</span>
            <input
              name="date"
              type="date"
              onClick={(event) => openCalendar(event.currentTarget)}
              defaultValue={defaultDate}
              max={defaultDate}
              required
            />
          </label>
          <label className="field">
            <span>
              Observação <i>opcional</i>
            </span>
            <input name="memo" placeholder="Ex.: salário de novembro" />
          </label>
          <div className="form-callout">
            <HandCoins size={16} />
            <span>
              Para manter o histórico de remuneração, use{" "}
              <strong>Atualizar salário</strong> quando o valor mensal mudar.
            </span>
            <button type="button" onClick={() => onKindChange("salary_change")}>
              Atualizar salário
            </button>
          </div>
        </>
      )}
      {effectiveKind === "salary_change" && (
        <>
          <label className="field">
            <span>
              Remuneração mensal bruta/líquida <i>defina um padrão</i>
            </span>
            <MoneyInput name="amount" />
          </label>
          <label className="field">
            <span>Vigência a partir de</span>
            <input
              name="date"
              type="date"
              onClick={(event) => openCalendar(event.currentTarget)}
              defaultValue={defaultDate}
              required
            />
          </label>
          <label className="field">
            <span>
              Observação <i>opcional</i>
            </span>
            <input name="memo" placeholder="Ex.: reajuste anual" />
          </label>
          <div className="form-callout">
            <Clock3 size={16} />
            <span>
              Este registro guarda uma mudança de remuneração. O recebimento
              mensal precisa ser lançado separadamente.
            </span>
          </div>
        </>
      )}
      {effectiveKind === "expense" && (
        <>
          <label className="field">
            <span>Categoria</span>
            <select name="category">
              <option>Cartão</option>
              <option>PIX</option>
              <option>Mercado</option>
              <option>Outro</option>
            </select>
          </label>
          <label className="field">
            <span>Valor da despesa</span>
            <MoneyInput name="amount" />
          </label>
          <label className="field">
            <span>Data da fatura/pagamento</span>
            <input
              name="date"
              type="date"
              onClick={(event) => openCalendar(event.currentTarget)}
              defaultValue={defaultDate}
              max={defaultDate}
              required
            />
          </label>
          <label className="field">
            <span>
              Cartão <i>preencha se cartão</i>
            </span>
            <input name="cardName" placeholder="Ex.: Nubank, Visa…" />
          </label>
          <label className="field full-field">
            <span>
              Observação <i>opcional</i>
            </span>
            <input name="memo" placeholder="Ex.: fatura de novembro" />
          </label>
          <div className="form-callout">
            <ShieldCheck size={16} />
            <span>
              Cartão entra pelo total da fatura no mês de pagamento; não lance
              compras individuais e o pagamento novamente.
            </span>
          </div>
        </>
      )}
      {effectiveKind === "trade" && (
        <>
          <div className="field full-field">
            <span>Movimentação</span>
            <div className="trade-toggle">
              <label>
                <input type="radio" name="side" value="COMPRA" defaultChecked />
                <span>
                  <ArrowDownLeft size={14} /> Compra
                </span>
              </label>
              <label>
                <input type="radio" name="side" value="VENDA" />
                <span>
                  <ArrowUpRight size={14} /> Venda
                </span>
              </label>
            </div>
          </div>
          <label className="field">
            <span>Geografia</span>
            <select
              name="geography"
              value={geography}
              onChange={(event) =>
                setGeography(event.target.value as Geography)
              }
            >
              <option>Brasil</option>
              <option>Exterior</option>
              <option>Cripto</option>
            </select>
          </label>
          <label className="field">
            <span>Classe do ativo</span>
            <select name="assetClass">
              {liquidClasses[geography].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ticker / símbolo</span>
            <input
              name="ticker"
              placeholder={
                geography === "Cripto"
                  ? "BTC"
                  : geography === "Brasil"
                    ? "MUND11"
                    : "VWRA"
              }
              required
            />
          </label>
          <label className="field">
            <span>
              Nome <i>opcional</i>
            </span>
            <input name="name" placeholder="Nome do ativo" />
          </label>
          <label className="field">
            <span>Quantidade</span>
            <input
              name="quantity"
              type="number"
              min="0.00000001"
              step="any"
              placeholder="0,00"
              required
            />
          </label>
          <label className="field">
            <span>Preço unitário</span>
            <MoneyInput
              name="unitPrice"
              prefix={currency === "USD" ? "US$" : "R$"}
            />
          </label>
          <label className="field">
            <span>Moeda da operação</span>
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
            >
              <option>BRL</option>
              <option>USD</option>
            </select>
          </label>
          <label className="field">
            <span>Casas decimais de quantidade</span>
            <input
              name="precision"
              type="number"
              min="0"
              max="8"
              step="1"
              value={precision}
              onChange={(event) =>
                setPrecision(
                  Math.max(0, Math.min(8, Number(event.target.value))),
                )
              }
            />
          </label>
          <label className="field">
            <span>Data da operação</span>
            <input
              name="date"
              type="date"
              onClick={(event) => openCalendar(event.currentTarget)}
              defaultValue={defaultDate}
              max={defaultDate}
              required
            />
          </label>
          <label className="field full-field">
            <span>
              Observação <i>opcional</i>
            </span>
            <input name="memo" placeholder="Ex.: aporte mensal" />
          </label>
          <div className="form-callout full-field">
            <Coins size={16} />
            <span>
              O preço médio ponderado e a posição serão calculados a partir das
              operações registradas. Vendas acima do saldo serão recusadas.
            </span>
          </div>
        </>
      )}
      {effectiveKind === "target" && (
        <>
          <label className="field">
            <span>Geografia</span>
            <select
              name="geography"
              value={geography}
              onChange={(event) =>
                setGeography(event.target.value as Geography)
              }
            >
              <option>Brasil</option>
              <option>Exterior</option>
              <option>Cripto</option>
            </select>
          </label>
          <label className="field">
            <span>Classe do ativo</span>
            <select name="assetClass">
              {liquidClasses[geography].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ticker / símbolo</span>
            <input
              name="ticker"
              placeholder={
                geography === "Cripto"
                  ? "BTC"
                  : geography === "Brasil"
                    ? "MUND11"
                    : "VWRA"
              }
              required
            />
          </label>
          <label className="field">
            <span>
              Nome <i>opcional</i>
            </span>
            <input name="name" placeholder="Nome do ativo" />
          </label>
          <label className="field">
            <span>Alocação desejada</span>
            <div className="input-with-suffix">
              <input
                name="targetPercent"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                placeholder="0"
                required
              />
              <span>%</span>
            </div>
          </label>
          <label className="field">
            <span>Moeda do preço</span>
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
            >
              <option>BRL</option>
              <option>USD</option>
            </select>
          </label>
          <label className="field">
            <span>Casas decimais de quantidade</span>
            <input
              name="precision"
              type="number"
              min="0"
              max="8"
              step="1"
              value={precision}
              onChange={(event) =>
                setPrecision(
                  Math.max(0, Math.min(8, Number(event.target.value))),
                )
              }
            />
          </label>
          <label className="field">
            <span>Data</span>
            <input
              name="date"
              type="date"
              onClick={(event) => openCalendar(event.currentTarget)}
              defaultValue={defaultDate}
              max={defaultDate}
              required
            />
          </label>
          <div className="form-callout full-field">
            <Target size={16} />
            <span>
              Depois de criar o alvo, informe um preço atual se a cotação
              pública não estiver disponível. O plano usa a moeda de exibição
              selecionada no topo.
            </span>
          </div>
        </>
      )}
      {(effectiveKind === "illiquid_contribution" ||
        effectiveKind === "illiquid_valuation") && (
        <>
          <label className="field">
            <span>Nome do ativo</span>
            <input
              name="name"
              list="existing-illiquid"
              placeholder="Ex.: Apartamento, FGTS, PGBL"
              required
            />
            <datalist id="existing-illiquid">
              {assets.map((asset) => (
                <option key={asset.assetId} value={asset.name} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Categoria</span>
            <select name="assetClass">
              {illiquidClasses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              {effectiveKind === "illiquid_contribution"
                ? "Valor do aporte inicial"
                : "Valor atualizado estimado"}
            </span>
            <MoneyInput name="amount" />
          </label>
          <label className="field">
            <span>Data</span>
            <input
              name="date"
              type="date"
              onClick={(event) => openCalendar(event.currentTarget)}
              defaultValue={defaultDate}
              max={defaultDate}
              required
            />
          </label>
          <label className="field full-field">
            <span>
              Observação <i>opcional</i>
            </span>
            <input
              name="memo"
              placeholder="Ex.: aporte mensal ou avaliação anual"
            />
          </label>
          <div className="form-callout full-field">
            <Landmark size={16} />
            <span>
              Um aporte soma-se ao valor anterior; uma avaliação substitui o
              valor de mercado a partir daquela data.
            </span>
          </div>
        </>
      )}
      {effectiveKind === "quote" && (
        <>
          <label className="field">
            <span>Ativo</span>
            <select
              name="assetId"
              onChange={(event) => {
                const tickerField = document.getElementById(
                  "quote-ticker",
                ) as HTMLInputElement | null;
                if (tickerField) tickerField.value = event.target.value;
              }}
            >
              {portfolio.positions.map((position) => (
                <option key={position.assetId} value={position.assetId}>
                  {position.ticker}
                </option>
              ))}
              <option value="FX:USD/BRL">USD/BRL</option>
              <option value="manual">Outro (ticker abaixo)</option>
            </select>
          </label>
          <label className="field">
            <span>Ticker ou par</span>
            <input
              id="quote-ticker"
              name="ticker"
              defaultValue={portfolio.positions[0]?.ticker ?? "USD/BRL"}
              placeholder="Ex.: PETR4"
            />
          </label>
          <label className="field">
            <span>Preço / câmbio</span>
            <MoneyInput
              name="price"
              prefix={quoteCurrency === "USD" ? "US$" : "R$"}
            />
          </label>
          <label className="field">
            <span>Moeda do preço</span>
            <select
              name="currency"
              value={quoteCurrency}
              onChange={(event) =>
                setQuoteCurrency(event.target.value as Currency)
              }
            >
              <option>BRL</option>
              <option>USD</option>
            </select>
          </label>
          <label className="field">
            <span>Data da cotação</span>
            <input
              name="date"
              type="date"
              onClick={(event) => openCalendar(event.currentTarget)}
              defaultValue={defaultDate}
              max={defaultDate}
              required
            />
          </label>
          <label className="field full-field">
            <span>
              Observação <i>opcional</i>
            </span>
            <input name="memo" placeholder="Fonte ou referência" />
          </label>
        </>
      )}
    </div>
  );
}

function MoneyInput({
  name,
  prefix = "R$",
}: {
  name: string;
  prefix?: string;
}) {
  const [formatted, setFormatted] = useState("");
  const [raw, setRaw] = useState("");
  function change(value: string) {
    const digits = value.replace(/\D/g, "");
    const amount = Number(digits) / 100;
    setRaw(String(amount));
    setFormatted(
      digits
        ? amount.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "",
    );
  }
  return (
    <div className="money-input">
      <span>{prefix}</span>
      <input
        inputMode="decimal"
        value={formatted}
        onChange={(event) => change(event.target.value)}
        placeholder="0,00"
        required
        aria-label={name === "amount" ? "Valor em reais" : "Preço"}
      />
      <input type="hidden" name={name} value={raw} />
    </div>
  );
}

function ConfirmDialog({
  title,
  children,
  onCancel,
  onConfirm,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <section className="confirm-card" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <span className="modal-eyebrow">BACKUP LOCAL</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Fechar"
          >
            <X size={19} />
          </button>
        </div>
        <div className="confirm-body">{children}</div>
        <div className="modal-footer">
          <span>
            <ShieldCheck size={14} /> Importação validada
          </span>
          <div>
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={onConfirm}
            >
              <FileDown size={15} />{" "}
              {busy ? "Restaurando…" : "Restaurar backup"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
function getFxRate(events: LedgerEvent[]): number {
  const quote = activeEvents(events)
    .filter(
      (event) =>
        event.type === "quote" &&
        event.assetId === "FX:USD/BRL" &&
        event.date <= today(),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )[0];
  return quote?.type === "quote" ? quote.price : 0;
}

interface OverviewProps {
  month: string;
  setMonth: (value: string) => void;
  monthTitle: string;
  summary: ReturnType<typeof summarizeMonth>;
  portfolio: ReturnType<typeof buildPortfolio>;
  fxRate: number;
  avgSavings: number;
  events: LedgerEvent[];
  onNavigate: (view: View) => void;
  onNew: (kind: EntryKind) => void;
  onRefresh: () => void;
  quoteBusy: boolean;
}

function Overview({
  month,
  setMonth,
  monthTitle: title,
  summary,
  portfolio,
  fxRate,
  avgSavings,
  events,
  onNavigate,
  onNew,
  onRefresh,
  quoteBusy,
}: OverviewProps) {
  const { formatMoney } = useDisplayCurrency();
  const savingsAmount = summary.income - summary.expenses;
  const recent = events.slice(0, 5);
  const allocation = [
    {
      label: "Brasil",
      amount: portfolio.positions
        .filter((item) => item.geography === "Brasil")
        .reduce((sum, item) => sum + item.value, 0),
    },
    {
      label: "Exterior",
      amount: portfolio.positions
        .filter((item) => item.geography === "Exterior")
        .reduce((sum, item) => sum + item.value, 0),
    },
    {
      label: "Cripto",
      amount: portfolio.positions
        .filter((item) => item.geography === "Cripto")
        .reduce((sum, item) => sum + item.value, 0),
    },
    { label: "Ilíquido", amount: portfolio.illiquidValue },
  ];
  const totalForAllocation = allocation.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  return (
    <div className="page-stack">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> {todayLabel.toUpperCase()}
          </div>
          <h1>
            Sua visão financeira<span className="heading-period">.</span>
          </h1>
          <p>Acompanhe sua evolução financeira com clareza.</p>
        </div>
        <div className="heading-actions">
          <button
            className="button button-quiet"
            onClick={onRefresh}
            disabled={quoteBusy}
          >
            <RefreshCw size={16} className={quoteBusy ? "spin" : ""} />{" "}
            {quoteBusy ? "Atualizando…" : "Atualizar cotações"}
          </button>
        </div>
      </div>

      <section className="hero-card">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-orbit orbit-three" />
        <div className="hero-content">
          <div className="hero-label">
            <span className="hero-label-icon">
              <Wallet size={14} />
            </span>{" "}
            PATRIMÔNIO TOTAL{" "}
            <span className="hero-period">ATUALIZADO AGORA</span>
          </div>
          <div className="hero-value">{formatMoney(portfolio.totalValue)}</div>
          <div className="hero-foot">
            <div className="hero-split">
              <div>
                <span className="hero-split-label">Líquido</span>
                <strong>{formatMoney(portfolio.liquidValue)}</strong>
              </div>
              <div className="hero-divider" />
              <div>
                <span className="hero-split-label">Ilíquido</span>
                <strong>{formatMoney(portfolio.illiquidValue)}</strong>
              </div>
            </div>
            <button
              className="hero-link"
              onClick={() => onNavigate("portfolio")}
            >
              Ver patrimônio <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-side-mark">
            <TrendingUp size={19} />
          </div>
          <span>VISÃO CONSOLIDADA</span>
          <strong>
            {portfolio.positions.length + portfolio.illiquidAssets.length}
          </strong>
          <small>ativos acompanhados</small>
        </div>
      </section>

      <WealthHistory events={events} />
      <div className="section-title-row">
        <div>
          <h2>Fluxo de caixa</h2>
          <p>
            Seu resumo financeiro de <span className="capitalize">{title}</span>
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <section className="metric-grid">
        <MetricCard
          label="Entradas"
          value={formatMoney(summary.income)}
          detail={`${Object.keys(summary.byIncome).length || 0} categorias registradas`}
          icon={<ArrowDownLeft size={17} />}
          tone="mint"
        />
        <MetricCard
          label="Saídas"
          value={formatMoney(summary.expenses)}
          detail="Faturas, PIX e mercado"
          icon={<ArrowUpRight size={17} />}
          tone="rose"
        />
        <MetricCard
          label="Total investido"
          value={formatMoney(summary.invested)}
          detail="Aportes e compras do mês"
          icon={<Coins size={17} />}
          tone="lavender"
        />
        <MetricCard
          label="Taxa de poupança"
          value={`${(summary.savingsRate * 100).toFixed(1).replace(".", ",")}%`}
          detail={`${formatMoney(savingsAmount)} poupados no período`}
          icon={<BadgeDollarSign size={17} />}
          tone="sand"
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel allocation-panel">
          <div className="panel-heading">
            <div>
              <h2>Macroalocação</h2>
              <p>Distribuição do seu patrimônio</p>
            </div>
            <button
              className="panel-more"
              onClick={() => onNavigate("portfolio")}
            >
              Detalhes <ChevronRight size={15} />
            </button>
          </div>
          {totalForAllocation > 0 ? (
            <AllocationPie
              items={allocation}
              label="Macroalocação do patrimônio entre Brasil, exterior, cripto e ilíquidos"
            />
          ) : (
            <EmptyInline
              icon={<BarChart3 size={19} />}
              title="Sua carteira começa aqui"
              text="Registre ativos para ver sua distribuição."
              action="Adicionar ativo"
              onClick={() => onNew("trade")}
            />
          )}
          <div className="panel-bottom-link">
            <button onClick={() => onNavigate("portfolio")}>
              Explorar alocação completa <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
        <section className="panel savings-panel">
          <div className="panel-heading">
            <div>
              <h2>Ritmo de poupança</h2>
              <p>Últimos 12 meses com registros, ou o histórico disponível</p>
            </div>
            <span className="small-icon soft-green">
              <Sparkles size={16} />
            </span>
          </div>
          <div className="savings-stat">
            <strong>
              {(avgSavings * 100).toFixed(1).replace(".", ",")}
              <small>%</small>
            </strong>
            <span className="savings-caption">
              da renda se transforma em patrimônio
            </span>
          </div>
          <div className="savings-progress-label">
            <span>Meta de referência</span>
            <strong>20%</strong>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, (avgSavings / 0.2) * 100))}%`,
              }}
            />
          </div>
          <div className="savings-note">
            <span className="note-sparkle">✳</span> Seu ritmo médio usa{" "}
            {(avgSavings * 100).toFixed(1).replace(".", ",")}% da renda
            registrada. <strong>Um passo de cada vez.</strong>
          </div>
        </section>
      </div>

      <div className="lower-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Atividade recente</h2>
              <p>Os últimos registros da sua jornada</p>
            </div>
            <button
              className="panel-more"
              onClick={() => onNavigate("activity")}
            >
              Ver todos <ChevronRight size={15} />
            </button>
          </div>
          {recent.length ? (
            <div className="activity-list">
              {recent.map((event) => (
                <ActivityRow key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyInline
              icon={<Clock3 size={18} />}
              title="Sem registros por enquanto"
              text="Comece adicionando uma entrada ou ativo."
              action="Novo lançamento"
              onClick={() => onNew("income")}
            />
          )}
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Acesso rápido</h2>
              <p>O que você quer registrar?</p>
            </div>
            <span className="quick-squiggle">↗</span>
          </div>
          <div className="quick-actions">
            <QuickAction
              icon={<HandCoins size={17} />}
              title="Recebimento"
              text="Salário, renda extra ou dividendos"
              onClick={() => onNew("income")}
              tone="mint"
            />
            <QuickAction
              icon={<ArrowUpRight size={17} />}
              title="Despesa do mês"
              text="Fatura, PIX, mercado ou outro"
              onClick={() => onNew("expense")}
              tone="rose"
            />
            <QuickAction
              icon={<ArrowLeftRight size={17} />}
              title="Compra ou venda"
              text="Registrar movimentação de ativo"
              onClick={() => onNew("trade")}
              tone="lavender"
            />
            <QuickAction
              icon={<Landmark size={17} />}
              title="Ativo ilíquido"
              text="Aporte ou atualização de valor"
              onClick={() => onNew("illiquid_contribution")}
              tone="sand"
            />
          </div>
        </section>
      </div>
      <div className="data-tip">
        <ShieldCheck size={15} />
        <span>
          Os valores são calculados a partir do seu histórico. Cotações
          automáticas são indicativas; confirme preços e câmbio antes de tomar
          decisões.
        </span>
        <span className="data-tip-rate">
          {fxRate > 0 ? `US$ 1 = ${formatFx(fxRate)}` : "Câmbio não carregado"}
        </span>
      </div>
    </div>
  );
}

export default App;
