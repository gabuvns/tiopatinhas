import { useId, useState } from 'react';
import { useDisplayCurrency } from './DisplayCurrency';

interface Point { year: number; value: number; deposits: number }
export default function ProjectionChart({ rows }: { rows: Point[] }) {
  const { formatMoney, compact } = useDisplayCurrency();
  const [selected, setSelected] = useState<number | null>(null);
  const gradient = useId().replace(/:/g, '');
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.value, row.deposits]));
  const x = (index: number) => 80 + index / Math.max(1, rows.length - 1) * 700;
  const y = (value: number) => 230 - value / maximum * 200;
  const points = rows.map((row, index) => x(index) + ',' + y(row.value)).join(' ');
  const deposits = rows.map((row, index) => x(index) + ',' + y(row.deposits)).join(' ');
  const selectedRow = rows.find((row) => row.year === selected) ?? rows[rows.length - 1];
  return <div className="projection-chart-wrap">
    <div className="projection-chart-key"><span><i />Patrimônio projetado</span><span><i className="deposits-key" />Inicial + aportes</span></div>
    <div className="projection-chart-scroll"><svg viewBox="0 0 820 280" className="projection-chart" role="img" aria-label="Projeção de patrimônio por ano, comparada ao patrimônio inicial mais aportes" onMouseLeave={() => setSelected(null)}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#76dfab" stopOpacity=".2" /><stop offset="100%" stopColor="#76dfab" stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1="80" x2="780" y1={y(maximum * fraction)} y2={y(maximum * fraction)} className="wealth-grid" /><text x="66" y={y(maximum * fraction) + 5} textAnchor="end">{compact(maximum * fraction)}</text></g>)}
      <polygon points={'80,230 ' + points + ' 780,230'} fill={'url(#' + gradient + ')'} />
      <polyline points={deposits} className="projection-deposits-line" /><polyline points={points} className="wealth-line" />
      {rows.map((row, index) => <g key={row.year} onMouseEnter={() => setSelected(row.year)}>
        <circle cx={x(index)} cy={y(row.value)} r={selected === row.year ? 6 : 4} className="wealth-point"><title>{'Ano ' + row.year + ': ' + formatMoney(row.value)}</title></circle>
        <rect x={x(index) - 350 / Math.max(1, rows.length - 1)} y="22" width={700 / Math.max(1, rows.length - 1)} height="216" fill="transparent"><title>{'Ano ' + row.year + ': ' + formatMoney(row.value)}</title></rect>
        {(rows.length <= 12 || index % Math.ceil(rows.length / 10) === 0 || index === rows.length - 1) && <text x={x(index)} y="264" textAnchor="middle">{row.year === 0 ? 'Hoje' : row.year + 'a'}</text>}
      </g>)}
    </svg></div>
    <div className="projection-chart-detail" aria-live="polite"><span>{selectedRow.year === 0 ? 'Hoje' : 'Ano ' + selectedRow.year}</span><strong>{formatMoney(selectedRow.value)}</strong></div>
  </div>;
}
