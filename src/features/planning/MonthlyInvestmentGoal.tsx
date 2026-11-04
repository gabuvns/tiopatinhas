import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Pencil, X } from "lucide-react";
import {
  isGoalPercent,
  monthlyInvestmentProgress,
  resolveMonthlyGoal,
} from "../../domain/monthlyGoal";
import { useDisplayCurrency } from "../../shared/DisplayCurrency";
import "./monthly-goal.css";

interface Props {
  month: string;
  income: number;
  invested: number;
  savings: number;
  defaultPercent?: number;
  monthlyGoals?: Record<string, number>;
  onChange: (settings: {
    defaultPercent: number;
    monthlyGoals: Record<string, number>;
  }) => void;
}

export default function MonthlyInvestmentGoal({
  month,
  income,
  invested,
  savings,
  defaultPercent,
  monthlyGoals = {},
  onChange,
}: Props) {
  const { formatMoney } = useDisplayCurrency();
  const settings = {
    savingsGoalPercent: defaultPercent,
    monthlySavingsGoals: monthlyGoals,
  };
  const goal = resolveMonthlyGoal(settings, month);
  const { targetAmount, progress, remaining } = monthlyInvestmentProgress(
    income,
    invested,
    goal.percent,
  );
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"month" | "default">("month");
  const [error, setError] = useState("");
  const editorId = useId();
  useEffect(() => {
    setEditing(false);
    setError("");
  }, [month]);
  const button = useRef<HTMLButtonElement>(null);
  const percentInput = useRef<HTMLInputElement>(null);
  const monthLabel = new Date(month + "-01T12:00:00").toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric" },
  );
  const percentLabel = (amount: number) =>
    amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  function close() {
    setEditing(false);
    setError("");
    button.current?.focus();
  }
  function start() {
    setValue(String(goal.percent));
    setScope("month");
    setError("");
    setEditing(true);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const percent = value.trim() ? Number(value.replace(",", ".")) : NaN;
    if (!isGoalPercent(percent)) {
      setError("Informe um percentual de 0 a 100.");
      percentInput.current?.focus();
      return;
    }
    const next = { ...monthlyGoals };
    if (scope === "default") delete next[month];
    else next[month] = percent;
    onChange({
      defaultPercent: scope === "default" ? percent : goal.defaultPercent,
      monthlyGoals: next,
    });
    close();
  }
  return (
    <section
      className="monthly-investment-goal"
      aria-label="Meta mensal de investimento"
    >
      <div className="monthly-goal-heading">
        <div>
          <h3>Meta de investimento</h3>
          <p>
            {monthLabel} ·{" "}
            {goal.hasOverride ? "ajuste deste mês" : "meta padrão"}
          </p>
        </div>
        <button
          ref={button}
          type="button"
          className="monthly-goal-edit"
          aria-label="Alterar meta mensal de investimento"
          aria-expanded={editing}
          aria-controls={editorId}
          onClick={() => (editing ? close() : start())}
        >
          <Pencil size={14} /> Alterar
        </button>
      </div>
      <div className="monthly-goal-amounts">
        <strong>{formatMoney(invested)}</strong>
        <span>
          de {formatMoney(targetAmount)} · {percentLabel(goal.percent)} da renda
        </span>
      </div>
      {income > 0 && goal.percent > 0 ? (
        <>
          <div
            className="monthly-goal-track"
            role="progressbar"
            aria-label="Progresso da meta mensal de investimento"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-valuetext={
              formatMoney(invested) +
              " investidos de " +
              formatMoney(targetAmount)
            }
          >
            <span style={{ width: progress + "%" }} />
          </div>
          <p className="monthly-goal-status">
            {remaining > 0
              ? "Faltam " + formatMoney(remaining) + " para a meta do mês."
              : "Meta do mês atingida."}
          </p>
        </>
      ) : (
        <p className="monthly-goal-status">
          {goal.percent === 0
            ? "Sem valor mínimo de investimento para este mês."
            : "Registre as entradas do mês para calcular a meta em dinheiro."}
        </p>
      )}
      <p className="monthly-goal-footnote">
        Aportes e compras do mês. Poupança do mês: {formatMoney(savings)}.
      </p>
      {editing && (
        <form
          id={editorId}
          className="monthly-goal-editor"
          onSubmit={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        >
          <div className="monthly-goal-editor-heading">
            <h4>Quanto pretende investir?</h4>
            <button
              type="button"
              aria-label="Fechar edição da meta"
              className="monthly-goal-close"
              onClick={close}
            >
              <X size={16} />
            </button>
          </div>
          <label className="monthly-goal-input">
            <span>Percentual das entradas do mês</span>
            <div>
              <input
                ref={percentInput}
                aria-label="Percentual da meta de investimento"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? editorId + "-error" : undefined}
              />
              <span aria-hidden="true">%</span>
            </div>
          </label>
          <fieldset>
            <legend>Aplicar esta meta</legend>
            <label>
              <input
                type="radio"
                name={editorId + "-scope"}
                checked={scope === "month"}
                onChange={() => setScope("month")}
              />
              Somente em {monthLabel}
            </label>
            <label>
              <input
                type="radio"
                name={editorId + "-scope"}
                checked={scope === "default"}
                onChange={() => setScope("default")}
              />
              Como padrão para os outros meses
            </label>
          </fieldset>
          <p className="monthly-goal-help">
            {scope === "default"
              ? "O padrão também será aplicado a este mês. Os demais ajustes mensais serão mantidos."
              : "O ajuste vale apenas para este mês; o padrão dos demais meses será mantido."}{" "}
            A edição não cria nem altera lançamentos.
          </p>
          {error && (
            <p
              id={editorId + "-error"}
              role="alert"
              className="monthly-goal-error"
            >
              {error}
            </p>
          )}
          <div className="monthly-goal-actions">
            <button type="submit" className="button button-primary">
              Salvar meta
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={close}
            >
              Cancelar
            </button>
          </div>
          {goal.hasOverride && (
            <button
              type="button"
              className="monthly-goal-reset"
              onClick={() => {
                const next = { ...monthlyGoals };
                delete next[month];
                onChange({
                  defaultPercent: goal.defaultPercent,
                  monthlyGoals: next,
                });
                close();
              }}
            >
              Usar padrão de {percentLabel(goal.defaultPercent)} neste mês
            </button>
          )}
        </form>
      )}
    </section>
  );
}
