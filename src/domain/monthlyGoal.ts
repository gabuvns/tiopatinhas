export interface MonthlyGoalSettings {
  savingsGoalPercent?: number;
  monthlySavingsGoals?: Record<string, number>;
}

export const isGoalPercent = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100;

export function validateMonthlyGoalSettings(
  settings: MonthlyGoalSettings,
): void {
  if (
    settings.savingsGoalPercent !== undefined &&
    !isGoalPercent(settings.savingsGoalPercent)
  )
    throw new Error("A meta mensal deve ser um percentual entre 0 e 100.");
  if (settings.monthlySavingsGoals === undefined) return;
  const months = settings.monthlySavingsGoals;
  if (
    !months ||
    typeof months !== "object" ||
    Array.isArray(months) ||
    Object.entries(months).some(
      ([month, percent]) =>
        !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
        !isGoalPercent(percent),
    )
  )
    throw new Error(
      "As metas por mês devem usar referências AAAA-MM e percentuais entre 0 e 100.",
    );
}

/** Legacy backups retain the original reference until the user chooses a new default. */
export function resolveMonthlyGoal(
  settings: MonthlyGoalSettings,
  month: string,
) {
  const defaultPercent = settings.savingsGoalPercent ?? 20;
  const hasOverride = Object.prototype.hasOwnProperty.call(
    settings.monthlySavingsGoals ?? {},
    month,
  );
  return {
    percent: hasOverride
      ? settings.monthlySavingsGoals![month]
      : defaultPercent,
    defaultPercent,
    hasOverride,
  };
}

export function monthlyInvestmentProgress(
  income: number,
  invested: number,
  percent: number,
) {
  const targetAmount = (Math.max(0, income) * percent) / 100;
  return {
    targetAmount,
    progress:
      targetAmount > 0
        ? Math.min(100, (Math.max(0, invested) / targetAmount) * 100)
        : 0,
    remaining: Math.max(0, targetAmount - Math.max(0, invested)),
  };
}
