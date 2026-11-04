import { useState } from 'react';
import { useDisplayCurrency } from './DisplayCurrency';

const palette = ['#76dfab', '#7dbcf4', '#f1bf70', '#ba9aee', '#ed969e', '#66d5d0', '#bad179', '#e9a86b', '#91a4ed', '#d7a0d0', '#8ec9a1', '#c6b498'];
export interface AllocationItem { label: string; amount: number; color?: string }

export default function AllocationPie({ items, label }: { items: AllocationItem[]; label: string }) {
  const { formatMoney } = useDisplayCurrency();
  const [selected, setSelected] = useState<string | null>(null);
  const positive = items.filter((item) => item.amount > 0);
  const total = positive.reduce((sum, item) => sum + item.amount, 0);
  const selectedItem = positive.find((item) => item.label === selected);
  let angle = -Math.PI / 2;
  const slices = positive.map((item, index) => {
    const start = angle;
    const fraction = item.amount / total;
    angle += fraction * Math.PI * 2;
    const x1 = 120 + Math.cos(start) * 104, y1 = 120 + Math.sin(start) * 104;
    const x2 = 120 + Math.cos(angle) * 104, y2 = 120 + Math.sin(angle) * 104;
    return { ...item, fraction, color: item.color ?? palette[index % palette.length],
      path: 'M120 120 L' + x1 + ' ' + y1 + ' A104 104 0 ' + (fraction > 0.5 ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z' };
  });
  const percent = (fraction: number) => (fraction * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  if (!total) return <p className="muted">Sem valores para distribuir.</p>;
  return <div className="pie-layout">
    <div className="pie-visual">
      <svg viewBox="0 0 240 240" className="allocation-pie" role="img" aria-label={label} onMouseLeave={() => setSelected(null)}>
        <title>{label}</title>
        {slices.map((item) => <g key={item.label} className={'pie-slice' + (selected && selected !== item.label ? ' pie-dimmed' : '')} fill={item.color} onMouseEnter={() => setSelected(item.label)}>
          {slices.length === 1 ? <circle cx="120" cy="120" r="104" /> : <path d={item.path} />}
          <title>{item.label + ': ' + percent(item.fraction) + ' · ' + formatMoney(item.amount)}</title>
        </g>)}
      </svg>
      <div className="pie-detail" aria-live="polite"><span>{selectedItem?.label ?? 'Patrimônio distribuído'}</span><strong>{formatMoney(selectedItem?.amount ?? total)}</strong><small>{selectedItem ? percent(selectedItem.amount / total) + ' do total' : 'Passe o mouse nas fatias para explorar'}</small></div>
    </div>
    <div className="pie-legend" aria-label="Detalhes da distribuição">
      {slices.map((item) => <button key={item.label} className={'pie-legend-row' + (selected === item.label ? ' pie-active' : '')}
        onMouseEnter={() => setSelected(item.label)} onMouseLeave={() => setSelected(null)}
        onFocus={() => setSelected(item.label)} onBlur={() => setSelected(null)}
        onClick={() => setSelected(selected === item.label ? null : item.label)}
        aria-label={item.label + ', ' + percent(item.fraction) + ', ' + formatMoney(item.amount)}>
        <i style={{ background: item.color }} /><span><strong>{item.label}</strong><small>{formatMoney(item.amount)}</small></span><b>{percent(item.fraction)}</b>
      </button>)}
    </div>
  </div>;
}
