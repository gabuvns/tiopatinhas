import {
  activeEvents,
  summarizeMonth,
  today,
  type LedgerEvent,
} from "./domain";

export interface SavingsBaseline {
  months: string[];
  averageIncome: number;
  averageExpenses: number;
  averageSurplus: number;
  monthlyContribution: number;
  savingsRate: number;
}

/** Actual cash flow; purchases are already included in savings, never deducted twice. */
export function savingsBaseline(
  events: LedgerEvent[],
  asOf = today(),
): SavingsBaseline {
  const records = activeEvents(events.filter((event) => event.date <= asOf));
  const months = [
    ...new Set(
      records
        .filter((event) => event.type === "income" || event.type === "expense")
        .map((event) => event.date.slice(0, 7)),
    ),
  ]
    .sort()
    .slice(-12);
  const totals = months.reduce(
    (sum, month) => {
      const summary = summarizeMonth(records, month);
      return {
        income: sum.income + summary.income,
        expenses: sum.expenses + summary.expenses,
      };
    },
    { income: 0, expenses: 0 },
  );
  const count = months.length || 1;
  const averageSurplus = (totals.income - totals.expenses) / count;
  return {
    months,
    averageIncome: totals.income / count,
    averageExpenses: totals.expenses / count,
    averageSurplus,
    monthlyContribution: Math.max(0, averageSurplus),
    savingsRate:
      totals.income > 0 ? (totals.income - totals.expenses) / totals.income : 0,
  };
}

export function validateMilestones(values: number[]): number[] {
  if (values.some((value) => !Number.isFinite(value) || value <= 0))
    throw new Error("Informe uma meta maior que zero.");
  if (new Set(values).size !== values.length)
    throw new Error("Já existe uma meta com esse valor.");
  return [...values].sort((a, b) => a - b);
}

export function baselinePeriod(baseline: SavingsBaseline): string {
  if (!baseline.months.length) return "Sem meses registrados";
  const label = (month: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
      .format(new Date(month + "-15T00:00:00Z"))
      .replace(".", "");
  return (
    label(baseline.months[0]) +
    (baseline.months.length > 1
      ? " a " + label(baseline.months[baseline.months.length - 1])
      : "")
  );
}
