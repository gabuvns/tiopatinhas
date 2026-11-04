import { useState } from 'react';
import { ArrowUpRight, Check, LineChart, Sparkles, TrendingUp } from 'lucide-react';
import { activeEvents, projectWealth, type LedgerEvent, type PortfolioSnapshot } from './domain';
import { useDisplayCurrency } from './DisplayCurrency';
import { baselinePeriod, type SavingsBaseline } from './planning';
import WealthGoals from './WealthGoals';
import ProjectionChart from './ProjectionChart';

interface Props {
  portfolio: PortfolioSnapshot;
  events: LedgerEvent[];
  baseline: SavingsBaseline;
  projectionMonths: number;
  setProjectionMonths: (value: number) => void;
  annualReturn: number;
  setAnnualReturn: (value: number) => void;
  projection: number;
  milestones: number[];
  onMilestones: (values: number[]) => void;
}

export default function ForecastPage({ portfolio, events, baseline, projectionMonths, setProjectionMonths, annualReturn, setAnnualReturn, projection, milestones, onMilestones }: Props) {
  const { formatMoney, symbol, number } = useDisplayCurrency();
  const [returnDraft, setReturnDraft] = useState(String(annualReturn));
  const [yearsDraft, setYearsDraft] = useState(String(projectionMonths / 12));
  const goals = [...milestones].sort((a, b) => a - b);
  const reached = new Set(activeEvents(events).filter((event) => event.type === 'milestone').map((event) => event.threshold));
  const next = goals.find((goal) => !reached.has(goal) && portfolio.totalValue < goal);
  const achieved = goals.filter((goal) => portfolio.totalValue >= goal || reached.has(goal)).length;
  const progress = next ? Math.max(0, Math.min(100, portfolio.totalValue / next * 100)) : goals.length ? 100 : 0;
  const contribution = baseline.monthlyContribution;
  const contributed = portfolio.totalValue + contribution * projectionMonths;
  const years = Math.round(projectionMonths / 12);
  const rows = Array.from({ length: years + 1 }, (_, year) => ({
    year, value: projectWealth(portfolio.totalValue, contribution, annualReturn, year * 12),
    deposits: portfolio.totalValue + contribution * year * 12,
  }));
  return <div className="page-stack">
    <div className="page-heading-row"><div><div className="eyebrow">PLANEJAMENTO FINANCEIRO</div><h1>Projeções e metas<span className="heading-period">.</span></h1><p>Seu histórico de hoje como ponto de partida para o futuro.</p></div>
      <a href="#goals-heading" className="button button-outline">Gerenciar metas <ArrowUpRight size={16} /></a>
    </div>
    <section className="milestone-hero milestone-overview">
      <div className="milestone-copy"><span className="milestone-kicker"><Sparkles size={15} /> PRÓXIMO MARCO</span>
        <h2>{next ? formatMoney(next) : goals.length ? 'Metas alcançadas' : 'Defina sua primeira meta'}</h2>
        <p>{next ? 'Faltam ' + formatMoney(next - portfolio.totalValue) + ' para chegar lá.' : goals.length ? 'Crie um novo marco para continuar acompanhando sua evolução.' : 'Escolha um valor abaixo para começar a acompanhar sua jornada.'}</p>
        <div className="milestone-progress"><div className="progress-track"><span style={{ width: progress + '%' }} /></div><small>{progress.toFixed(0)}% do caminho</small></div>
      </div>
      <div className="goals-summary"><Check size={22} /><strong>{achieved}<span> / {goals.length}</span></strong><small>metas alcançadas</small></div>
    </section>
    <section className="panel simulator-panel">
      <div className="panel-heading"><div><h2>Seu patrimônio em {years} anos</h2><p>Aportes no fim do mês, com taxa mensal equivalente à rentabilidade anual.</p></div><span className="small-icon soft-green"><TrendingUp size={18} /></span></div>
      <div className="forecast-baseline"><div><span>Base dos aportes</span><strong>{baseline.months.length} {baseline.months.length === 1 ? 'mês registrado' : 'meses registrados'}</strong><small>{baselinePeriod(baseline)}</small></div><div><span>Entradas médias / mês</span><strong>{formatMoney(baseline.averageIncome)}</strong></div><div><span>Despesas médias / mês</span><strong>{formatMoney(baseline.averageExpenses)}</strong></div></div>
      <div className="simulator-inputs">
        <label className="field"><span>Patrimônio atual</span><div className="input-with-prefix"><span>{symbol}</span><input aria-label="Patrimônio inicial da projeção" value={number(portfolio.totalValue)} readOnly /></div></label>
        <label className="field"><span>Aporte mensal estimado</span><div className="input-with-prefix"><span>{symbol}</span><input aria-label="Aporte mensal da projeção" value={number(contribution)} readOnly /></div><small>Média de entradas menos despesas, até 12 meses.</small></label>
        <label className="field"><span>Rentabilidade anual</span><div className="input-with-suffix"><input aria-label="Rentabilidade anual em porcentagem" type="number" value={returnDraft} onChange={(event) => {
          const raw = event.target.value; setReturnDraft(raw);
          if (raw !== '' && Number.isFinite(Number(raw)) && Number(raw) >= -99 && Number(raw) <= 1000) setAnnualReturn(Number(raw));
        }} onBlur={() => {
          const value = returnDraft === '' ? annualReturn : Math.max(-99, Math.min(1000, Number(returnDraft)));
          setAnnualReturn(value); setReturnDraft(String(value));
        }} min="-99" max="1000" step="0.5" /><span>% a.a.</span></div></label>
        <label className="field"><span>Horizonte da projeção</span><div className="input-with-suffix"><input aria-label="Horizonte da projeção em anos" type="number" value={yearsDraft} min="1" max="50" step="1" onChange={(event) => {
          const raw = event.target.value; setYearsDraft(raw);
          if (Number.isInteger(Number(raw)) && Number(raw) >= 1 && Number(raw) <= 50) setProjectionMonths(Number(raw) * 12);
        }} onBlur={() => {
          const value = yearsDraft === '' ? years : Math.max(1, Math.min(50, Math.round(Number(yearsDraft))));
          setProjectionMonths(value * 12); setYearsDraft(String(value));
        }} /><span>anos</span></div></label>
      </div>
      {baseline.averageSurplus < 0 && <p className="form-callout">As despesas médias superam as entradas. O aporte usado nesta simulação é zero.</p>}
      {!baseline.months.length && <p className="form-callout">Registre entradas e despesas para estimar o aporte mensal. Por enquanto, a projeção considera apenas o patrimônio atual.</p>}
      <div className="projection-result"><div><span>PATRIMÔNIO ESTIMADO EM {years} ANOS</span><strong>{formatMoney(projection)}</strong></div><div className="projection-mark"><LineChart size={23} /></div></div>
      <div className="projection-breakdown"><span>Patrimônio inicial + aportes <strong>{formatMoney(contributed)}</strong></span><span>Rendimento projetado <strong>{formatMoney(projection - contributed)}</strong></span></div>
      <ProjectionChart rows={rows} />
      <details className="projection-table"><summary>Ver evolução ano a ano</summary><div className="table-wrap"><table><thead><tr><th>Ano</th><th>Inicial + aportes</th><th>Patrimônio projetado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.year}><td>{row.year === 0 ? 'Hoje' : row.year}</td><td>{formatMoney(row.deposits)}</td><td>{formatMoney(row.value)}</td></tr>)}</tbody></table></div></details>
      <p className="projection-disclaimer">Usamos os últimos 12 meses com entradas ou despesas, ou todos os disponíveis se houver menos. Meses sem registros ficam fora da média; o mês atual usa os lançamentos existentes. Compras de investimentos não são descontadas novamente. Simulação sem inflação ou impostos e sem garantia de rentabilidade.</p>
    </section>
    <WealthGoals goals={goals} currentValue={portfolio.totalValue} reached={reached} onChange={onMilestones} />
  </div>;
}
