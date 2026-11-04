import { formatDate, wealthHistory, type LedgerEvent } from './domain';
import { useDisplayCurrency } from './DisplayCurrency';

export default function WealthHistory({ events }: { events: LedgerEvent[] }) {
  const { formatMoney, compact, currency } = useDisplayCurrency();
  const history = wealthHistory(events);
  if (!history.length) return <section className="panel wealth-history">
    <div className="panel-heading"><div><h2>Histórico do patrimônio total</h2><p>Exporte seu patrimônio para registrar um snapshot ou importe um histórico.</p></div></div>
  </section>;
  const first = history[0];
  const last = history[history.length - 1];
  const maxValue = Math.max(...history.map((point) => point.totalValue), 1) * 1.08;
  const start = Date.parse(first.date);
  const duration = Date.parse(last.date) - start;
  const x = (date: string) => duration ? 90 + (Date.parse(date) - start) / duration * 510 : 345;
  const y = (value: number) => 190 - value / maxValue * 155;
  const points = history.map((point) => x(point.date) + ',' + y(point.totalValue)).join(' ');
  return <section className="panel wealth-history">
    <div className="panel-heading"><div><h2>Histórico do patrimônio total</h2>
      <p>Histórico importado e snapshots registrados a cada exportação.</p></div>
      <div className="wealth-last"><strong>{formatMoney(last.totalValue)}</strong><small>Último registro histórico · {formatDate(last.date)}</small></div>
    </div>
    <div className="wealth-chart-scroll"><svg className="wealth-chart" viewBox="0 0 640 230" role="img"
      aria-label={'Evolução do patrimônio total: ' + history.length + ' registros, de ' + formatDate(first.date) + ' a ' + formatDate(last.date)}>
      <title>Patrimônio total declarado ao longo do tempo</title>
      {[0, .5, 1].map((fraction) => <g key={fraction}>
        <line x1="90" x2="600" y1={y(maxValue * fraction)} y2={y(maxValue * fraction)} className="wealth-grid" />
        <text x="78" y={y(maxValue * fraction) + 5} textAnchor="end">{compact(maxValue * fraction)}</text>
      </g>)}
      {history.length > 1 && <polygon points={x(first.date) + ',190 ' + points + ' ' + x(last.date) + ',190'} className="wealth-fill" />}
      <polyline points={points} className="wealth-line" />
      {history.map((point) => <circle key={point.id} cx={x(point.date)} cy={y(point.totalValue)} r="4" className="wealth-point">
        <title>{(point.origin === 'export' ? new Date(point.createdAt).toLocaleString('pt-BR') : formatDate(point.date)) + ' · ' + formatMoney(point.totalValue)}</title>
      </circle>)}
      <text x="90" y="220" textAnchor="start">{formatDate(first.date)}</text>
      {history.length > 1 && <text x="600" y="220" textAnchor="end">{formatDate(last.date)}</text>}
    </svg></div>
    <p className="wealth-history-note">Cada exportação registra o patrimônio atual com data e horário, inclusive várias exportações no mesmo dia. Registros da planilha preservam os valores originais. Os snapshots não são somados ao patrimônio atual.{currency === 'USD' ? ' Valores históricos em dólar usam o câmbio de referência atual.' : ''}</p>
    <details><summary>Consultar os {history.length} registros e suas origens</summary>
      <div className="table-wrap"><table><thead><tr><th>Referência</th><th>Patrimônio total</th><th>Origem</th></tr></thead><tbody>
        {history.map((point) => <tr key={point.id}><td>{point.origin === 'export' ? new Date(point.createdAt).toLocaleString('pt-BR') : formatDate(point.date)}</td><td>{formatMoney(point.totalValue)}</td>
          <td>{point.origin === 'export' ? 'Snapshot da exportação' : point.provenance ? point.provenance.sheet + '!' + point.provenance.range : 'Registro histórico'}</td></tr>)}
      </tbody></table></div>
    </details>
  </section>;
}
