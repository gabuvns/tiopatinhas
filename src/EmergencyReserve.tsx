import { useState } from 'react';
import { ChevronDown, Search, ShieldCheck } from 'lucide-react';
import { formatNumber, type Position } from './domain';
import { useDisplayCurrency } from './DisplayCurrency';

export default function EmergencyReserve({ positions, monthlyExpenses, onChange }: {
  positions: Position[]; monthlyExpenses: number; onChange: (position: Position, selected: boolean) => void;
}) {
  const { formatMoney } = useDisplayCurrency();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const total = positions.filter((position) => position.isEmergencyReserve).reduce((sum, position) => sum + position.value, 0);
  const count = positions.filter((position) => position.isEmergencyReserve).length;
  const available = positions.filter((position) => (position.ticker + ' ' + position.name).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <section className="panel reserve-panel" aria-labelledby="reserve-heading">
    <div className="reserve-header"><div className="reserve-title"><span className="small-icon soft-green"><ShieldCheck size={20} /></span><div><h2 id="reserve-heading">Reserva de emergência</h2><p>{count ? count + ' ativo(s) selecionado(s)' : 'Escolha quais ativos compõem sua reserva'}</p></div></div>
      <button className="button button-outline" aria-expanded={open} aria-controls="reserve-assets" onClick={() => setOpen(!open)}>Gerenciar reserva <ChevronDown size={17} className={open ? 'chevron-open' : ''} /></button>
    </div>
    <div className="reserve-summary"><strong>{formatMoney(total)}</strong><span>{monthlyExpenses > 0 ? formatNumber(total / monthlyExpenses, 1) + ' meses de despesas médias' : 'Registre despesas para calcular a cobertura'}</span></div>
    <p className="reserve-note">A reserva continua no patrimônio e fica fora das ordens de rebalanceamento. A seleção é sua; confira a liquidez e o risco dos ativos.</p>
    {open && <div id="reserve-assets" className="reserve-manager">
      <label className="reserve-search"><Search size={17} /><input aria-label="Buscar ativo para reserva" placeholder="Buscar por ticker ou nome" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="reserve-options">{available.map((position) => <label key={position.assetId} className={'reserve-option' + (position.isEmergencyReserve ? ' reserve-selected' : '')}>
        <input type="checkbox" checked={Boolean(position.isEmergencyReserve)} onChange={(event) => onChange(position, event.target.checked)} aria-label={'Incluir ' + position.ticker + ' na reserva de emergência'} />
        <span className="reserve-asset"><strong>{position.ticker}</strong><small>{position.name} · {position.assetClass}</small></span><strong>{formatMoney(position.value)}</strong>
      </label>)}</div>
      {!available.length && <p className="muted">{positions.length ? 'Nenhum ativo encontrado.' : 'Adicione um ativo líquido à carteira para selecioná-lo aqui.'}</p>}
    </div>}
  </section>;
}
