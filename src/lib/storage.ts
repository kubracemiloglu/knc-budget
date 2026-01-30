import type { FinanceState } from "@/types/finance";

const KEY = "budget_goal_tracker_v1";

const defaultState: FinanceState = {
  startingBalance: 0,
  goal: null,
  transactions: [],
  scheduledIncomes: [],
  goalContributions: [],
  dailyLimit: 0,
  weeklyLimit: 0,
};

export function loadState(): FinanceState {
  if (typeof window === "undefined") return defaultState;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;

    const parsed = JSON.parse(raw) as Partial<FinanceState>;

    return {
      ...defaultState,
      ...parsed,
      transactions: parsed.transactions ?? [],
      scheduledIncomes: parsed.scheduledIncomes ?? [],
      goal: parsed.goal ?? null,
      startingBalance:
        typeof parsed.startingBalance === "number" ? parsed.startingBalance : 0,
      goalContributions: parsed.goalContributions ?? [],
      dailyLimit: typeof parsed.dailyLimit === "number" ? parsed.dailyLimit : 0,
      weeklyLimit: typeof parsed.weeklyLimit === "number" ? parsed.weeklyLimit : 0,
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state: FinanceState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
