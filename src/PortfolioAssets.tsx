import { useState } from 'react';
import { BadgeDollarSign, ChevronDown, Landmark, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { formatDate, formatNumber, type IlliquidPosition, type Position } from './domain';
import { useDisplayCurrency } from './DisplayCurrency';
import { groupAssets } from './portfolioGroups';

export function LiquidAssetGroups({ positions, portfolioTotal, onTarget, onAdd, onQuote }: {
  positions: Position[]; portfolioTotal: number; onTarget: (position: Position, value: string) => void;
  onAdd: () => void; onQuote: () => void;
}) {
  const { formatMoney, currency } = useDisplayCurrency();
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const categories = groupAssets(positions, portfolioTotal);
  const search = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = positions.filter((position) => (category === 'all' || category === position.assetClass)
    && (position.ticker + ' ' + position.name).toLocaleLowerCase('pt-BR').includes(search));
  const groups = groupAssets(filtered, portfolioTotal);
  return <section className="panel category-panel" id="portfolio-categories" aria-labelledby="categories-heading">
    <div className="panel-heading"><div><h2 id="categories-heading">Ativos por categoria</h2><p>Preços e valores em {currency}. Abra ou recolha cada grupo para explorar sua carteira.</p></div><button className="button button-quiet button-small" onClick={onQuote}><BadgeDollarSign size={16} /> Informar preço</button></div>
    {positions.length > 0 && <div className="category-toolbar">
      <label className="category-search"><Search size={17} /><input aria-label="Buscar ativo na carteira" placeholder="Buscar ticker ou nome" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="category-filter"><span>Categoria</span><select aria-label="Filtrar categoria de ativo" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas as categorias</option>{categories.map((group) => <option key={group.category} value={group.category}>{group.category} ({group.assets.length})</option>)}</select></label>
    </div>}
    <div className="asset-category-list">{groups.map((group) => <details className="asset-category" key={group.category} open>
      <summary><span className="category-label"><ChevronDown size={17} /><strong>{group.category}</strong><small>{group.assets.length} {group.assets.length === 1 ? 'ativo' : 'ativos'}</small></span><span className="category-total"><strong>{formatMoney(group.total)}</strong><small>{formatNumber(group.percent, 1)}% do patrimônio</small></span></summary>
      <div className="table-wrap category-table"><table><thead><tr><th>ATIVO</th><th>GEOGRAFIA</th><th>QUANTIDADE</th><th>PREÇO ATUAL</th><th>PREÇO MÉDIO</th><th>VALOR EM {currency}</th><th>ALVO</th></tr></thead><tbody>
        {[...group.assets].sort((a, b) => a.ticker.localeCompare(b.ticker, 'pt-BR', { numeric: true })).map((position) => <tr key={position.assetId}>
          <td><div className="asset-cell"><span className={'asset-avatar ' + (position.geography === 'Exterior' ? 'foreign' : position.geography === 'Cripto' ? 'crypto' : '')}>{position.ticker.slice(0, 2)}</span><span><strong>{position.ticker}</strong><small>{position.name}</small></span></div></td>
          <td><span className={'geo-pill ' + position.geography.toLowerCase()}>{position.geography}</span></td>
          <td>{position.balanceBased ? 'Saldo consolidado' : formatNumber(position.quantity, 8)}</td>
          <td>{position.price > 0 ? formatMoney(position.price, position.currency) : '—'}<small className="cell-secondary">{position.priceSource}{position.priceDate ? ' · ' + formatDate(position.priceDate) : ''}</small><small className="cell-secondary">Moeda original: {position.currency}</small></td>
          <td>{position.averageCost === null ? 'Não informado' : formatMoney(position.averageCost, position.currency)}{position.rebalanceEligible === false && <small className="cell-secondary">Fora da carteira de risco</small>}</td>
          <td><strong>{formatMoney(position.value)}</strong>{position.isEmergencyReserve && <small className="reserve-badge"><ShieldCheck size={13} /> Reserva de emergência</small>}</td>
          <td>{position.isEmergencyReserve ? <small className="cell-secondary">Reserva · sem ordens</small> : <label className="target-input"><input aria-label={'Alvo de ' + position.ticker + ' em porcentagem'} type="number" min="0" max="100" step="0.1" value={position.targetPercent || ''} placeholder="0" onChange={(event) => onTarget(position, event.target.value)} /><span>%</span></label>}</td>
        </tr>)}
      </tbody></table></div>
    </details>)}</div>
    {!groups.length && <div className="category-empty"><p>{positions.length ? 'Nenhum ativo encontrado para esses filtros.' : 'Adicione uma posição para ver os ativos por categoria.'}</p><button className="button button-outline" onClick={() => { if (positions.length) { setQuery(''); setCategory('all'); } else onAdd(); }}>{positions.length ? 'Limpar filtros' : <><Plus size={16} /> Registrar compra</>}</button></div>}
    {groups.length > 0 && <p className="category-count">{filtered.length} de {positions.length} ativos · {groups.length} {groups.length === 1 ? 'categoria' : 'categorias'} · total exibido {formatMoney(filtered.reduce((sum, position) => sum + position.value, 0))}</p>}
  </section>;
}

export function IlliquidAssetGroups({ assets, portfolioTotal, onRevalue }: {
  assets: IlliquidPosition[]; portfolioTotal: number; onRevalue: () => void;
}) {
  const { formatMoney } = useDisplayCurrency();
  return <div className="illiquid-category-list">{groupAssets(assets, portfolioTotal).map((group) => <details className="asset-category illiquid-category" key={group.category} open>
    <summary><span className="category-label"><ChevronDown size={16} /><strong>{group.category}</strong><small>{group.assets.length}</small></span><span className="category-total"><strong>{formatMoney(group.total)}</strong><small>{formatNumber(group.percent, 1)}% do patrimônio</small></span></summary>
    <div className="illiquid-list">{group.assets.map((asset) => <div className="illiquid-row" key={asset.assetId}><span className="illiquid-icon"><Landmark size={17} /></span><span className="illiquid-name"><strong>{asset.name}</strong><small>Atualização {formatDate(asset.lastUpdate)}</small></span><strong>{formatMoney(asset.value)}</strong><button className="table-action" title={'Atualizar avaliação de ' + asset.name} onClick={onRevalue}><RefreshCw size={14} /></button></div>)}</div>
  </details>)}</div>;
}
