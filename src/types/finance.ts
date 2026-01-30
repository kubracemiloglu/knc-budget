export type TxType = "income" | "expense";

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  note?: string;
};

export type Goal = {
  title: string;
  targetAmount: number;
  targetDate?: string;
};

export type ScheduledIncome = {
  id: string;
  amount: number;
  expectedDate: string;
  source: string;
  received: boolean;
  receivedAt?: string; // YYYY-MM-DD
  receivedTxId?: string;
};

export type GoalContribution = {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
};

export type FinanceState = {
  startingBalance: number;
  goal: Goal | null;
  transactions: Transaction[];
  scheduledIncomes: ScheduledIncome[];
  goalContributions?: GoalContribution[];

  // ✅ yeni: limitler
  dailyLimit?: number;  // günlük harcama limiti
  weeklyLimit?: number; // haftalık harcama limiti
};
