import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { useDisplayCurrency } from './DisplayCurrency';
import { validateMilestones } from './planning';

interface Props {
  goals: number[];
  currentValue: number;
  reached: Set<number>;
  onChange: (goals: number[]) => void;
}

export default function WealthGoals({ goals, currentValue, reached, onChange }: Props) {
  const { formatMoney, currency } = useDisplayCurrency();
  const [editing, setEditing] = useState<number | null>(null);
  const [value, setValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState('');
  function save(event: FormEvent, original: number | null) {
    event.preventDefault();
    try {
      const amount = Number(original === null ? newValue : value);
      onChange(validateMilestones(original === null ? [...goals, amount] : goals.map((goal) => goal === original ? amount : goal)));
      setEditing(null); setNewValue(''); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Revise o valor da meta.'); }
  }
  return <section className="panel goals-panel" aria-labelledby="goals-heading">
    <div className="panel-heading"><div><h2 id="goals-heading">Suas metas de patrimônio</h2><p>Adicione, ajuste ou remova os marcos da sua jornada.</p></div><span className="small-icon soft-green"><Target size={18} /></span></div>
    <div className="goal-grid">
      {goals.map((goal) => {
        const achieved = currentValue >= goal || reached.has(goal);
        const progress = Math.max(0, Math.min(100, currentValue / goal * 100));
        return <div className={'goal-item' + (achieved ? ' goal-achieved' : '')} key={goal}>
          {editing === goal ? <form className="goal-edit" onSubmit={(event) => save(event, goal)}>
            <label className="field"><span>Editar meta em R$</span><input autoFocus aria-label={'Novo valor da meta de ' + formatMoney(goal)} type="number" min="0.01" step="0.01" required value={value} onChange={(event) => setValue(event.target.value)} /></label>
            <div className="goal-actions"><button className="button button-primary button-small" type="submit"><Check size={15} /> Salvar</button><button type="button" className="icon-button" aria-label="Cancelar edição" onClick={() => { setEditing(null); setError(''); }}><X size={17} /></button></div>
          </form> : <>
            <div className="goal-top"><span className={'goal-status' + (achieved ? ' positive' : '')}>{achieved ? <Check size={15} /> : <Target size={15} />}{achieved ? 'Alcançada' : 'Em andamento'}</span><div className="goal-actions">
              <button className="icon-button" title="Editar meta" aria-label={'Editar meta de ' + formatMoney(goal)} onClick={() => { setEditing(goal); setValue(String(goal)); setError(''); }}><Pencil size={16} /></button>
              <button className="icon-button danger-action" title="Remover meta" aria-label={'Remover meta de ' + formatMoney(goal)} onClick={() => { onChange(goals.filter((item) => item !== goal)); setError(''); }}><Trash2 size={16} /></button>
            </div></div>
            <strong className="goal-amount">{formatMoney(goal)}</strong>
            <div className="progress-track" role="progressbar" aria-label={'Progresso da meta de ' + formatMoney(goal)} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: progress + '%' }} /></div>
            <small>{achieved ? 'Conquista registrada na sua jornada' : 'Faltam ' + formatMoney(Math.max(0, goal - currentValue))}</small>
          </>}
        </div>;
      })}
    </div>
    {!goals.length && <p className="muted">Crie sua primeira meta para acompanhar o progresso.</p>}
    {currency === 'USD' && <p className="muted goal-currency-note">Cadastre as metas em reais. Os cartões mostram o equivalente em dólar pelo câmbio de referência.</p>}
    <form className="goal-add-form" onSubmit={(event) => save(event, null)}>
      <label className="field"><span>Nova meta de patrimônio · R$</span><input aria-label="Valor da nova meta em reais" placeholder="Ex.: 500000" type="number" min="0.01" step="0.01" required value={newValue} onChange={(event) => setNewValue(event.target.value)} /></label>
      <button className="button button-primary" type="submit"><Plus size={17} /> Adicionar meta</button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
