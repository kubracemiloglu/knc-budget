"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  FinanceState,
  Transaction,
  TxType,
  ScheduledIncome,
  GoalContribution,
} from "@/types/finance";
import { loadState, saveState, resetState } from "@/lib/storage";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTRY(value: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${Number(value || 0).toFixed(2)} ₺`;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function startOfWeekISO(d = new Date()) {
  // Pazartesi başlangıç
  const date = new Date(d);
  const day = date.getDay(); // 0 pazar
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const QUICK_CATEGORIES = [
  "Yemek",
  "Market",
  "Ulaşım",
  "Kahve",
  "Fatura",
  "Eğlence",
  "Sağlık",
  "Giyim",
  "Diğer",
];

export default function Home() {
  const [state, setState] = useState<FinanceState>({
    startingBalance: 0,
    goal: null,
    transactions: [],
    scheduledIncomes: [],
    goalContributions: [],
    dailyLimit: 0,
    weeklyLimit: 0,
  });

  // setup
  const [startingBalanceInput, setStartingBalanceInput] = useState("0");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  // tx form (full)
  const [txType, setTxType] = useState<TxType>("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txCategory, setTxCategory] = useState("Yemek");
  const [txNote, setTxNote] = useState("");

  // scheduled income form
  const [schAmount, setSchAmount] = useState("");
  const [schDate, setSchDate] = useState(todayISO());
  const [schSource, setSchSource] = useState("");

  // goal contribution form (full)
  const [gcAmount, setGcAmount] = useState("");
  const [gcDate, setGcDate] = useState(todayISO());
  const [gcNote, setGcNote] = useState("");

  // filters
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [fType, setFType] = useState<"all" | TxType>("all");
  const [fCategory, setFCategory] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSearch, setFSearch] = useState("");

  // ✅ modal quick add
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickTab, setQuickTab] = useState<"tx" | "goal">("tx");
  const [qType, setQType] = useState<TxType>("expense");
  const [qAmount, setQAmount] = useState("");
  const [qCategory, setQCategory] = useState("Yemek");
  const [qNote, setQNote] = useState("");
  const [qGoalAmount, setQGoalAmount] = useState("");

  // ✅ limit inputs
  const [dailyLimitInput, setDailyLimitInput] = useState("0");
  const [weeklyLimitInput, setWeeklyLimitInput] = useState("0");

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Hydrate after mount; do not save the empty server state over browser data.
    queueMicrotask(() => {
    if (cancelled) return;
    const s = loadState();
    setState(s);
    setStartingBalanceInput(String(s.startingBalance ?? 0));
    if (s.goal) {
      setGoalTitle(s.goal.title);
      setGoalTarget(String(s.goal.targetAmount));
    }
    setDailyLimitInput(String(s.dailyLimit ?? 0));
    setWeeklyLimitInput(String(s.weeklyLimit ?? 0));
    setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const hasGoal = !!state.goal;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of state.transactions) set.add(t.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [state.transactions]);

  const summary = useMemo(() => {
    const starting = Number(state.startingBalance || 0);

    const totalIncome = state.transactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const totalExpense = state.transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const balance = starting + totalIncome - totalExpense;

    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const monthIncome = state.transactions
      .filter((t) => t.type === "income" && t.date.startsWith(ym))
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const monthExpense = state.transactions
      .filter((t) => t.type === "expense" && t.date.startsWith(ym))
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    // upcoming 30 days scheduled incomes not received
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const upcoming30 = (state.scheduledIncomes ?? [])
      .filter((s) => !s.received)
      .filter((s) => {
        const d = new Date(s.expectedDate + "T00:00:00");
        const t0 = new Date(today.toDateString());
        return d >= t0 && d <= end;
      })
      .reduce((acc, s) => acc + Number(s.amount || 0), 0);

    // goal progress from contributions
    const goal = state.goal;
    const target = goal?.targetAmount ?? 0;
    const savedForGoal = (state.goalContributions ?? []).reduce(
      (acc, g) => acc + Number(g.amount || 0),
      0
    );
    const progressPct = target > 0 ? clamp((savedForGoal / target) * 100, 0, 100) : 0;
    const remaining = target > 0 ? Math.max(target - savedForGoal, 0) : 0;

    // ETA based on last 30 days contributions avg
    const t0 = new Date();
    t0.setDate(t0.getDate() - 29);
    const last30Goal = (state.goalContributions ?? [])
      .filter((g) => new Date(g.date + "T00:00:00") >= t0)
      .reduce((acc, g) => acc + Number(g.amount || 0), 0);
    const avgDailyGoal = last30Goal / 30;

    let etaText: string | null = null;
    if (goal && target > 0 && remaining > 0 && avgDailyGoal > 0) {
      const days = Math.ceil(remaining / avgDailyGoal);
      const eta = new Date();
      eta.setDate(eta.getDate() + days);
      etaText = `${days} gün (~${eta.toLocaleDateString("tr-TR")})`;
    }

    return {
      starting,
      totalIncome,
      totalExpense,
      balance,
      monthIncome,
      monthExpense,
      upcoming30,
      goal,
      target,
      savedForGoal,
      progressPct,
      remaining,
      etaText,
    };
  }, [state]);

  // ✅ limits + alerts
  const limits = useMemo(() => {
    const today = todayISO();
    const weekStart = startOfWeekISO(new Date());
    const weekEnd = addDaysISO(weekStart, 6);

    const todayExpense = state.transactions
      .filter((t) => t.type === "expense" && t.date === today)
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const weekExpense = state.transactions
      .filter((t) => t.type === "expense" && t.date >= weekStart && t.date <= weekEnd)
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const dailyLimit = Number(state.dailyLimit || 0);
    const weeklyLimit = Number(state.weeklyLimit || 0);

    const dailyPct = dailyLimit > 0 ? clamp((todayExpense / dailyLimit) * 100, 0, 200) : 0;
    const weeklyPct = weeklyLimit > 0 ? clamp((weekExpense / weeklyLimit) * 100, 0, 200) : 0;

    return { todayExpense, weekExpense, weekStart, weekEnd, dailyLimit, weeklyLimit, dailyPct, weeklyPct };
  }, [state.transactions, state.dailyLimit, state.weeklyLimit]);

  // ✅ charts data
  const charts = useMemo(() => {
    // last 7 days expenses
    const end = new Date();
    const days: { date: string; expense: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(end.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;
      const expense = state.transactions
        .filter((t) => t.type === "expense" && t.date === iso)
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      days.push({ date: iso, expense });
    }
    const maxDay = Math.max(1, ...days.map((x) => x.expense));

    // category breakdown (this month)
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const map = new Map<string, number>();
    for (const t of state.transactions) {
      if (t.type !== "expense") continue;
      if (!t.date.startsWith(ym)) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + Number(t.amount || 0));
    }
    const cat = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxCat = Math.max(1, ...cat.map((x) => x[1]));

    return { days, maxDay, cat, maxCat, ym };
  }, [state.transactions]);

  const filteredTransactions = useMemo(() => {
    const q = fSearch.trim().toLocaleLowerCase("tr");
    return state.transactions.filter((t) => {
      if (fType !== "all" && t.type !== fType) return false;
      if (fCategory !== "all" && t.category !== fCategory) return false;
      if (fFrom && t.date < fFrom) return false;
      if (fTo && t.date > fTo) return false;

      if (q) {
        const hay = `${t.category} ${t.note ?? ""} ${t.type}`.toLocaleLowerCase("tr");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [state.transactions, fType, fCategory, fFrom, fTo, fSearch]);

  function applySetup() {
    const starting = Number(startingBalanceInput);
    const target = Number(goalTarget);

    if (!Number.isFinite(starting)) return alert("Başlangıç bakiyesi sayı olmalı.");
    if (goalTitle.trim().length === 0) return alert("Hedef adı gir.");
    if (!Number.isFinite(target) || target <= 0) return alert("Hedef tutarı 0'dan büyük sayı olmalı.");

    setState((prev) => ({
      ...prev,
      startingBalance: starting,
      goal: { title: goalTitle.trim(), targetAmount: target },
    }));
  }

  function saveLimits() {
    const d = Number(dailyLimitInput);
    const w = Number(weeklyLimitInput);
    if (!Number.isFinite(d) || d < 0) return alert("Günlük limit 0 veya pozitif sayı olmalı.");
    if (!Number.isFinite(w) || w < 0) return alert("Haftalık limit 0 veya pozitif sayı olmalı.");
    setState((prev) => ({ ...prev, dailyLimit: d, weeklyLimit: w }));
  }

  function addTransaction(item: Omit<Transaction, "id">) {
    const tx: Transaction = { ...item, id: uid() };
    setState((prev) => ({ ...prev, transactions: [tx, ...prev.transactions] }));
  }

  function deleteTransaction(id: string) {
    setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
  }

  // Full form add
  function addTransactionFromForm() {
    const amount = Number(txAmount);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Tutar 0'dan büyük sayı olmalı.");
    if (!txDate) return alert("Tarih seç.");
    if (!txCategory.trim()) return alert("Kategori gir.");

    addTransaction({
      type: txType,
      amount,
      date: txDate,
      category: txCategory.trim(),
      note: txNote.trim() ? txNote.trim() : undefined,
    });

    setTxAmount("");
    setTxNote("");
  }

  function addScheduledIncome() {
    const amount = Number(schAmount);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Planlı gelir tutarı 0'dan büyük sayı olmalı.");
    if (!schDate) return alert("Tarih seç.");
    if (!schSource.trim()) return alert("Kaynak gir (ör. burs, maaş).");

    const item: ScheduledIncome = {
      id: uid(),
      amount,
      expectedDate: schDate,
      source: schSource.trim(),
      received: false,
    };

    setState((prev) => ({ ...prev, scheduledIncomes: [item, ...(prev.scheduledIncomes ?? [])] }));
    setSchAmount("");
    setSchSource("");
  }

  // Planlı gelir "Geldi" => otomatik gelir tx (geri al da var)
  function markScheduledAsReceived(id: string) {
    setState((prev) => {
      const s = (prev.scheduledIncomes ?? []).find((x) => x.id === id);
      if (!s) return prev;

      if (s.received) {
        const txId = s.receivedTxId;
        const nextTx = txId ? prev.transactions.filter((t) => t.id !== txId) : prev.transactions;

        const nextScheduled = (prev.scheduledIncomes ?? []).map((x) =>
          x.id === id ? { ...x, received: false, receivedAt: undefined, receivedTxId: undefined } : x
        );

        return { ...prev, transactions: nextTx, scheduledIncomes: nextScheduled };
      }

      const txId = uid();
      const incomeTx: Transaction = {
        id: txId,
        type: "income",
        amount: Number(s.amount),
        date: todayISO(),
        category: "Planlı Gelir",
        note: s.source,
      };

      const nextScheduled = (prev.scheduledIncomes ?? []).map((x) =>
        x.id === id ? { ...x, received: true, receivedAt: todayISO(), receivedTxId: txId } : x
      );

      return { ...prev, transactions: [incomeTx, ...prev.transactions], scheduledIncomes: nextScheduled };
    });
  }

  function addGoalContribution(item: Omit<GoalContribution, "id">) {
    const gc: GoalContribution = { ...item, id: uid() };
    setState((prev) => ({
      ...prev,
      goalContributions: [gc, ...(prev.goalContributions ?? [])],
    }));
  }

  function addGoalContributionFromForm() {
    const amount = Number(gcAmount);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Ayırdığın tutar 0'dan büyük sayı olmalı.");
    if (!gcDate) return alert("Tarih seç.");

    addGoalContribution({
      amount,
      date: gcDate,
      note: gcNote.trim() ? gcNote.trim() : undefined,
    });

    setGcAmount("");
    setGcNote("");
  }

  function deleteGoalContribution(id: string) {
    setState((prev) => ({
      ...prev,
      goalContributions: (prev.goalContributions ?? []).filter((g) => g.id !== id),
    }));
  }

  function clearAll() {
    const ok = confirm("Tüm verileri sıfırlamak istiyor musun?");
    if (!ok) return;
    resetState();
    setState({
      startingBalance: 0,
      goal: null,
      transactions: [],
      scheduledIncomes: [],
      goalContributions: [],
      dailyLimit: 0,
      weeklyLimit: 0,
    });
    setStartingBalanceInput("0");
    setGoalTitle("");
    setGoalTarget("");
    setDailyLimitInput("0");
    setWeeklyLimitInput("0");
  }

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ✅ quick modal actions
  function quickAddTx() {
    const amount = Number(qAmount);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Tutar 0'dan büyük sayı olmalı.");
    addTransaction({
      type: qType,
      amount,
      date: todayISO(),
      category: qCategory,
      note: qNote.trim() ? qNote.trim() : undefined,
    });
    setQAmount("");
    setQNote("");
    setQuickOpen(false);
    jump("transactions");
  }

  function quickAddGoal() {
    if (!hasGoal) return alert("Önce hedefi kaydet.");
    const amount = Number(qGoalAmount);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Tutar 0'dan büyük sayı olmalı.");
    addGoalContribution({
      amount,
      date: todayISO(),
      note: "Hızlı ayırdım",
    });
    setQGoalAmount("");
    setQuickOpen(false);
    jump("dashboard");
  }

  const dailyOver = limits.dailyLimit > 0 && limits.todayExpense > limits.dailyLimit;
  const weeklyOver = limits.weeklyLimit > 0 && limits.weekExpense > limits.weeklyLimit;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-6xl p-4 md:p-10 space-y-6 pb-24 md:pb-10" id="dashboard">
        {/* Top bar */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Budget Goal Tracker</h1>
            <p className="text-sm text-slate-300">Mobil uyum · PWA · Limit uyarıları · Grafikler</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={clearAll}
              className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm hover:bg-slate-900/70"
            >
              Sıfırla
            </button>
          </div>
        </header>

        {/* Setup + progress */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Kurulum</h2>
              {hasGoal && (
                <span className="text-xs text-slate-300">
                  Aktif hedef: <b className="text-slate-100">{state.goal?.title}</b>
                </span>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-slate-300">Başlangıç bakiyesi (₺)</label>
                <input
                  value={startingBalanceInput}
                  onChange={(e) => setStartingBalanceInput(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-300">Hedef adı</label>
                <input
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Örn: Laptop"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-300">Hedef tutar (₺)</label>
                <input
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Örn: 25000"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={applySetup}
                className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Kaydet / Güncelle
              </button>
              <span className="text-xs text-slate-300">
                Mobilde hızlı giriş için alttaki “Ekle +” modalını kullan.
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-300">Hedef progress</div>
                <div className="text-xl font-bold">{hasGoal ? `${summary.progressPct.toFixed(1)}%` : "-"}</div>
              </div>
              {summary.etaText && (
                <div className="text-right">
                  <div className="text-xs text-slate-300">Tahmini varış</div>
                  <div className="text-sm font-semibold">{summary.etaText}</div>
                </div>
              )}
            </div>

            <div className="w-full rounded-full bg-slate-800 h-3 overflow-hidden">
              <div
                className="h-3 bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                style={{ width: `${summary.progressPct}%` }}
              />
            </div>

            <div className="text-sm space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Ayırdığın</span>
                <span className="text-slate-100 font-semibold">{formatTRY(summary.savedForGoal)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Hedef</span>
                <span className="text-slate-100 font-semibold">{formatTRY(summary.target)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Kalan</span>
                <span className="text-slate-100 font-semibold">{formatTRY(summary.remaining)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Limits */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Limitler</h2>
              <p className="text-xs text-slate-400">
                Günlük/haftalık harcama limiti koy. Aşınca uyarı verir.
              </p>
            </div>
            <div className="text-xs text-slate-400">
              Hafta: <b className="text-slate-100">{limits.weekStart}</b> – <b className="text-slate-100">{limits.weekEnd}</b>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-slate-300">Günlük limit (₺)</label>
              <input
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-300">Haftalık limit (₺)</label>
              <input
                value={weeklyLimitInput}
                onChange={(e) => setWeeklyLimitInput(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={saveLimits}
                className="w-full rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Limitleri Kaydet
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className={cx("rounded-2xl border p-4", dailyOver ? "border-rose-500/40 bg-rose-500/10" : "border-slate-800 bg-slate-950/30")}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">Bugün harcama</div>
                {dailyOver && <div className="text-xs font-semibold text-rose-300">LIMIT AŞILDI</div>}
              </div>
              <div className="text-xl font-bold">{formatTRY(limits.todayExpense)}</div>
              <div className="mt-2 w-full rounded-full bg-slate-800 h-2 overflow-hidden">
                <div
                  className={cx("h-2", dailyOver ? "bg-rose-400" : "bg-emerald-400")}
                  style={{ width: `${Math.min(limits.dailyPct, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Limit: {formatTRY(limits.dailyLimit)} · %{limits.dailyPct.toFixed(0)}
              </div>
            </div>

            <div className={cx("rounded-2xl border p-4", weeklyOver ? "border-rose-500/40 bg-rose-500/10" : "border-slate-800 bg-slate-950/30")}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">Bu hafta harcama</div>
                {weeklyOver && <div className="text-xs font-semibold text-rose-300">LIMIT AŞILDI</div>}
              </div>
              <div className="text-xl font-bold">{formatTRY(limits.weekExpense)}</div>
              <div className="mt-2 w-full rounded-full bg-slate-800 h-2 overflow-hidden">
                <div
                  className={cx("h-2", weeklyOver ? "bg-rose-400" : "bg-emerald-400")}
                  style={{ width: `${Math.min(limits.weeklyPct, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Limit: {formatTRY(limits.weeklyLimit)} · %{limits.weeklyPct.toFixed(0)}
              </div>
            </div>
          </div>
        </section>

        {/* Insights / Charts */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20 space-y-4" id="insights">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Özet Grafikler</h2>
              <p className="text-xs text-slate-400">Kütük grafik: son 7 gün harcama · Bu ay kategori dağılımı</p>
            </div>
            <div className="text-xs text-slate-400">Ay: <b className="text-slate-100">{charts.ym}</b></div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* 7 day chart */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
              <div className="text-sm text-slate-300 mb-3">Son 7 gün harcama</div>
              <div className="flex items-end gap-2 h-28">
                {charts.days.map((d) => {
                  const h = Math.round((d.expense / charts.maxDay) * 100);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full rounded-lg bg-slate-800 overflow-hidden h-20 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-indigo-500 to-fuchsia-500"
                          style={{ height: `${h}%` }}
                          title={`${d.date} · ${formatTRY(d.expense)}`}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400">{d.date.slice(8)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Max gün: {formatTRY(charts.maxDay)}
              </div>
            </div>

            {/* category chart */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
              <div className="text-sm text-slate-300 mb-3">Bu ay kategori (top)</div>
              <div className="space-y-2">
                {charts.cat.length === 0 ? (
                  <div className="text-sm text-slate-400">Bu ay gider yok.</div>
                ) : (
                  charts.cat.map(([cat, val]) => {
                    const w = Math.round((val / charts.maxCat) * 100);
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200">{cat}</span>
                          <span className="text-slate-300">{formatTRY(val)}</span>
                        </div>
                        <div className="w-full rounded-full bg-slate-800 h-2 overflow-hidden">
                          <div
                            className="h-2 bg-emerald-400"
                            style={{ width: `${w}%` }}
                            title={`${cat} · ${formatTRY(val)}`}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Add Section (full forms still here) */}
        <section className="grid lg:grid-cols-3 gap-4" id="add">
          {/* Add transaction */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Gelir / Gider Ekle</h2>
              <span className="text-xs text-slate-400">Detaylı form (opsiyonel)</span>
            </div>

            <div className="grid md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-slate-300">Tür</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as TxType)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="expense">Gider</option>
                  <option value="income">Gelir</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-300">Tutar (₺)</label>
                <input
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-300">Tarih</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-300">Kategori</label>
                <input
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-300">Not</label>
                <input
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={addTransactionFromForm}
              className="w-full md:w-auto rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Ekle
            </button>
          </div>

          {/* Goal contribution full */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Hedef için ayırdım</h2>
              <span className="text-xs text-slate-400">Detaylı form</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-slate-300">Tutar (₺)</label>
                <input
                  value={gcAmount}
                  onChange={(e) => setGcAmount(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-300">Tarih</label>
                <input
                  type="date"
                  value={gcDate}
                  onChange={(e) => setGcDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-sm text-slate-300">Not</label>
                <input
                  value={gcNote}
                  onChange={(e) => setGcNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
            </div>

            <button
              onClick={addGoalContributionFromForm}
              className="w-full rounded-xl bg-fuchsia-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-fuchsia-400 disabled:opacity-50"
              disabled={!hasGoal}
            >
              {hasGoal ? "Ayırdım olarak ekle" : "Önce hedefi kaydet"}
            </button>

            {(state.goalContributions?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400">Son ayırdıkların</div>
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {(state.goalContributions ?? []).slice(0, 6).map((g) => (
                    <div
                      key={g.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold">{formatTRY(g.amount)}</div>
                        <div className="text-xs text-slate-400">
                          {g.date} {g.note ? `· ${g.note}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteGoalContribution(g.id)}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-900/60"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Scheduled incomes */}
        <section
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20 space-y-4"
          id="scheduled"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Planlı Gelirler</h2>
            <span className="text-xs text-slate-400">Geldi ✅ → otomatik Gelir işlemi</span>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-slate-300">Tutar (₺)</label>
              <input
                value={schAmount}
                onChange={(e) => setSchAmount(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-300">Beklenen tarih</label>
              <input
                type="date"
                value={schDate}
                onChange={(e) => setSchDate(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm text-slate-300">Kaynak</label>
              <input
                value={schSource}
                onChange={(e) => setSchSource(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={addScheduledIncome}
            className="w-full md:w-auto rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Planlı Gelir Ekle
          </button>

          {(state.scheduledIncomes?.length ?? 0) > 0 && (
            <div className="space-y-3">
              {/* mobile cards */}
              <div className="md:hidden space-y-3">
                {state.scheduledIncomes.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-400">{s.expectedDate}</div>
                        <div className="text-sm font-semibold">{s.source}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Tutar</div>
                        <div className="text-lg font-bold">{formatTRY(Number(s.amount))}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => markScheduledAsReceived(s.id)}
                      className={cx(
                        "w-full rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-slate-900/60",
                        s.received ? "border-emerald-500/40 text-emerald-300" : "border-slate-700 text-slate-100"
                      )}
                    >
                      {s.received ? "Geldi ✅ (Geri al)" : "Bekliyor → Geldi ✅"}
                    </button>
                  </div>
                ))}
              </div>

              {/* desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-300">
                    <tr className="border-b border-slate-800">
                      <th className="py-2">Beklenen</th>
                      <th>Kaynak</th>
                      <th className="text-right">Tutar</th>
                      <th className="text-right">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.scheduledIncomes.map((s) => (
                      <tr key={s.id} className="border-b border-slate-800 last:border-b-0">
                        <td className="py-2">{s.expectedDate}</td>
                        <td className="text-slate-200">{s.source}</td>
                        <td className="text-right font-semibold">{formatTRY(Number(s.amount))}</td>
                        <td className="text-right">
                          <button
                            onClick={() => markScheduledAsReceived(s.id)}
                            className={cx(
                              "rounded-xl border px-4 py-3 text-xs font-semibold hover:bg-slate-900/60",
                              s.received ? "border-emerald-500/40 text-emerald-300" : "border-slate-700 text-slate-100"
                            )}
                          >
                            {s.received ? "Geldi ✅ (Geri al)" : "Bekliyor → Geldi ✅"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Transactions */}
        <section
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 shadow-lg shadow-black/20 space-y-4"
          id="transactions"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">İşlemler</h2>
              <p className="text-xs text-slate-400">Mobilde kart, masaüstünde tablo.</p>
            </div>
            <div className="text-xs text-slate-400">
              Gösterilen: <b className="text-slate-100">{filteredTransactions.length}</b> / {state.transactions.length}
            </div>
          </div>

          {/* Mobile filter toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setShowFiltersMobile((v) => !v)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/30 px-4 py-3 text-sm font-semibold hover:bg-slate-900/60"
            >
              {showFiltersMobile ? "Filtreleri Gizle ▲" : "Filtreleri Göster ▼"}
            </button>
          </div>

          {/* Filters */}
          <div className={cx("grid lg:grid-cols-6 gap-3", "md:grid", !showFiltersMobile && "hidden md:grid")}>
            <div className="space-y-1 lg:col-span-1">
              <label className="text-sm text-slate-300">Tür</label>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value as "all" | TxType)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Hepsi</option>
                <option value="income">Gelir</option>
                <option value="expense">Gider</option>
              </select>
            </div>

            <div className="space-y-1 lg:col-span-1">
              <label className="text-sm text-slate-300">Kategori</label>
              <select
                value={fCategory}
                onChange={(e) => setFCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Hepsi</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 lg:col-span-1">
              <label className="text-sm text-slate-300">Başlangıç</label>
              <input
                type="date"
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1 lg:col-span-1">
              <label className="text-sm text-slate-300">Bitiş</label>
              <input
                type="date"
                value={fTo}
                onChange={(e) => setFTo(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label className="text-sm text-slate-300">Arama (not/kategori)</label>
              <input
                value={fSearch}
                onChange={(e) => setFSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Örn: market, dolmuş, planlı"
              />
            </div>
          </div>

          {state.transactions.length === 0 ? (
            <p className="text-sm text-slate-300">Henüz işlem yok.</p>
          ) : (
            <>
              {/* mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredTransactions.slice(0, 40).map((t) => (
                  <div key={t.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-400">{t.date}</div>
                        <div className="text-sm font-semibold">{t.category}</div>
                        <div className="text-xs text-slate-400">{t.note ?? "-"}</div>
                      </div>

                      <div className="text-right space-y-2">
                        <span
                          className={cx(
                            "inline-flex rounded-full px-2 py-1 text-xs border",
                            t.type === "income" ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"
                          )}
                        >
                          {t.type === "income" ? "Gelir" : "Gider"}
                        </span>
                        <div className="text-lg font-bold">
                          <span className={t.type === "income" ? "text-emerald-300" : "text-rose-300"}>
                            {t.type === "income" ? "+" : "-"}
                            {formatTRY(Number(t.amount))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-900/60"
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>

              {/* desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-300">
                    <tr className="border-b border-slate-800">
                      <th className="py-2">Tarih</th>
                      <th>Tür</th>
                      <th>Kategori</th>
                      <th>Not</th>
                      <th className="text-right">Tutar</th>
                      <th className="text-right">Sil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(0, 60).map((t) => (
                      <tr key={t.id} className="border-b border-slate-800 last:border-b-0">
                        <td className="py-2">{t.date}</td>
                        <td>
                          <span
                            className={cx(
                              "inline-flex rounded-full px-2 py-1 text-xs border",
                              t.type === "income" ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"
                            )}
                          >
                            {t.type === "income" ? "Gelir" : "Gider"}
                          </span>
                        </td>
                        <td className="text-slate-200">{t.category}</td>
                        <td className="text-slate-400">{t.note ?? "-"}</td>
                        <td className="text-right font-semibold">
                          <span className={t.type === "income" ? "text-emerald-300" : "text-rose-300"}>
                            {t.type === "income" ? "+" : "-"}
                            {formatTRY(Number(t.amount))}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => deleteTransaction(t.id)}
                            className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-semibold hover:bg-slate-900/60"
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <footer className="text-xs text-slate-500 pb-2">
          İpucu: Limit aştığında uyarı kartları kırmızıya döner.
        </footer>
      </div>

      {/* ✅ Quick Add Modal */}
      {quickOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-3">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold">Hızlı Ekle</div>
              <button
                onClick={() => setQuickOpen(false)}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:bg-slate-900/60"
              >
                Kapat
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuickTab("tx")}
                className={cx(
                  "rounded-xl px-4 py-3 text-sm font-semibold border",
                  quickTab === "tx"
                    ? "border-indigo-500 bg-indigo-500/20"
                    : "border-slate-800 bg-slate-900/30"
                )}
              >
                Gelir / Gider
              </button>
              <button
                onClick={() => setQuickTab("goal")}
                className={cx(
                  "rounded-xl px-4 py-3 text-sm font-semibold border",
                  quickTab === "goal"
                    ? "border-fuchsia-500 bg-fuchsia-500/20"
                    : "border-slate-800 bg-slate-900/30"
                )}
              >
                Hedefe Ayır
              </button>
            </div>

            {quickTab === "tx" ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setQType("expense")}
                    className={cx(
                      "rounded-xl px-4 py-3 text-sm font-semibold border",
                      qType === "expense"
                        ? "border-rose-500/60 bg-rose-500/15 text-rose-200"
                        : "border-slate-800 bg-slate-900/30"
                    )}
                  >
                    Gider
                  </button>
                  <button
                    onClick={() => setQType("income")}
                    className={cx(
                      "rounded-xl px-4 py-3 text-sm font-semibold border",
                      qType === "income"
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-800 bg-slate-900/30"
                    )}
                  >
                    Gelir
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-slate-300">Tutar (₺)</label>
                  <input
                    value={qAmount}
                    onChange={(e) => setQAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Örn: 120"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-slate-300">Kategori</div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setQCategory(c)}
                        className={cx(
                          "rounded-full border px-3 py-2 text-xs font-semibold hover:bg-slate-900/60",
                          qCategory === c ? "border-indigo-500 bg-indigo-500/20" : "border-slate-800"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-slate-300">Not (opsiyonel)</label>
                  <input
                    value={qNote}
                    onChange={(e) => setQNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Örn: dışarıda"
                  />
                </div>

                <button
                  onClick={quickAddTx}
                  className="w-full rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
                >
                  Kaydet
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="text-sm text-slate-300">
                  Bugün hedefe ayırdığın tutarı hızlıca ekler.
                </div>

                <div className="space-y-1">
                  <label className="text-sm text-slate-300">Tutar (₺)</label>
                  <input
                    value={qGoalAmount}
                    onChange={(e) => setQGoalAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-3 outline-none focus:ring-2 focus:ring-fuchsia-500"
                    placeholder="Örn: 200"
                  />
                </div>

                <button
                  onClick={quickAddGoal}
                  className="w-full rounded-xl bg-fuchsia-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-fuchsia-400 disabled:opacity-50"
                  disabled={!hasGoal}
                >
                  {hasGoal ? "Hedefe ayır" : "Önce hedefi kaydet"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 py-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => jump("dashboard")}
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 text-sm font-semibold hover:bg-slate-900/70"
          >
            Dashboard
          </button>

          <button
            onClick={() => setQuickOpen(true)}
            className="rounded-xl bg-indigo-500 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Ekle +
          </button>

          <button
            onClick={() => jump("transactions")}
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 text-sm font-semibold hover:bg-slate-900/70"
          >
            İşlemler
          </button>
        </div>
      </nav>
    </main>
  );
}
