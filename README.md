# TioPatinhas

Plataforma web para acompanhar fluxo de caixa, carteira, patrimônio e cofrinhos. O histórico fica no navegador, com exportação JSON e integração opcional com Google/Firebase para backups privados por conta.

## Executar no WSL

Requer Node.js 24.12 ou superior para as dependências atuais do Firebase.

```sh
node scripts/bootstrap.mjs
npm install
npm run dev
```

Abra o endereço local informado pelo Vite (normalmente http://localhost:5173).

## Dados e backup

- O seletor de tema oferece claro, escuro e preferência do sistema; a escolha é preservada no JSON.
- Os gráficos permitem comparar patrimônio, classes e aportes mensais lado a lado. Mouse, toque e teclado exploram os valores; filtros de datas se aplicam a todos os painéis.
- Os sliders dos cofrinhos respeitam o valor disponível de cada ativo, as outras destinações e a meta restante.
- O login Google e o backup por conta dependem de um projeto Firebase configurado. Consulte [docs/FIREBASE.md](docs/FIREBASE.md) e publique as regras antes de ativar o serviço. Nada é enviado automaticamente.
- O [roteiro de conversão de XLSX](docs/CONVERSION_PROMPT.md) detalha o contrato, reconciliação e prevenção de dupla contagem.

- Os eventos são salvos no IndexedDB. Navegadores com IndexedDB indisponível usam localStorage como contingência.
- Use **Exportar** para baixar um backup JSON versionado. A importação valida o arquivo, mostra a quantidade de eventos e pede confirmação antes de substituir os dados locais.
- Eventos financeiros não são editados ou apagados. Use **Estornar** no histórico para retirar um lançamento dos cálculos sem remover o registro original.

## Cotações

Ao abrir o app e ao solicitar atualização, ele tenta obter USD/BRL do Frankfurter, cotações B3 dos tickers sem chave suportados pela brapi e preços cripto de pares spot públicos da Binance. A taxa USD/BRL é uma referência diária; ativos sem preço disponível podem receber uma cotação manual na carteira. Os preços cripto USDT são tratados como referência USD.

Essas chamadas enviam ao provedor somente o par ou ticker consultado. Alguns provedores podem bloquear chamadas diretas do navegador, limitar requisições ou não cobrir um ativo; nesses casos, o último preço salvo ou a entrada manual permanece disponível.

## Cálculos

### Moeda de exibição e categorias

O switch **BRL / USD** no topo alterna a moeda dos painéis, gráficos, tabelas, metas e projeções. A preferência é salva no navegador e incluída no backup JSON. A conversão usa o último câmbio USD/BRL válido disponível, inclusive para exibir observações históricas; ela não representa o câmbio de cada data passada. Sem câmbio, o switch informa que é necessário atualizar cotações ou cadastrar a taxa.

O histórico financeiro, os snapshots e as metas continuam registrados em BRL; operações e cotações preservam sua moeda original. Formulários indicam a moeda do lançamento. A alternância afeta somente a apresentação. A taxa USD/BRL continua mostrando quantos reais equivalem a US$ 1.

Em **Carteira → Ver categorias**, os ativos aparecem agrupados por classe, com subtotal e participação sobre o patrimônio total. Os grupos podem ser recolhidos, filtrados por categoria ou pesquisados por ticker/nome. Ativos ilíquidos também são agrupados por categoria.

### Importação de carteiras existentes

O backup versão 2 aceita posições iniciais com preço médio desconhecido, aportes mensais consolidados e fotografias históricas de patrimônio. Posições iniciais não entram no total investido do mês. Aportes consolidados e fotografias históricas não aumentam o patrimônio atual. O custo desconhecido continua como “Não informado” até que a posição seja encerrada e uma nova compra estabeleça uma base conhecida.

A prévia mostra a origem, a data de referência e as divergências registradas no arquivo. O importador aceita backups versão 1, valida tipos, datas, identificadores duplicados e vendas acima da posição disponível. A exportação conserva as notas e a origem dos registros.

Ativos importados apenas como saldos monetários não representam cotas negociáveis e podem ficar fora da base do rebalanceamento. Ativos-alvo sem cotação são sinalizados como pendentes, sem inventar preço ou quantidade de compra.

O painel exibe o histórico total importado de Macro Alocação: datas originais da coluna L e valores declarados de Patrimônio Total da coluna AA. Linhas de médias e projeções ficam fora do gráfico. A tabela detalhada conserva a origem de cada registro; essas observações não são somadas ao patrimônio atual.

Cada clique em Exportar (inclusive o backup antes da restauração) calcula um snapshot com total, parcela líquida, parcela ilíquida, data e horário. O evento é salvo no navegador antes do download e incluído no próprio JSON. Exportações no mesmo dia geram registros distintos, preservados na tabela histórica. Atualizações posteriores das cotações não alteram snapshots anteriores.

- O preço médio é ponderado por compras; as vendas reduzem a quantidade sem alterar o custo médio remanescente.
- A taxa de poupança mensal é (entradas − saídas) / entradas. Investimentos são totalizados separadamente e não são somados de novo à poupança.
- O cartão é lançado pelo valor total da fatura no mês do pagamento.
- Em **Carteira → Gerenciar reserva**, selecione os ativos que compõem a reserva de emergência. A classificação é um evento imutável e pode ser revertida pelo histórico. Nenhum ativo é considerado reserva automaticamente. A cobertura usa a despesa média do mesmo período da projeção.
- O rebalanceamento usa os ativos líquidos elegíveis, exclui a reserva de emergência e normaliza seus alvos para 100%. A reserva e os ativos ilíquidos continuam no patrimônio e nos gráficos de alocação.
- Em **Projeções → Gerenciar metas**, adicione, edite ou remova valores de metas patrimoniais. As configurações são salvas no navegador e no JSON; conquistas já registradas permanecem no histórico.
- A projeção começa em 10 anos e usa a média de (entradas − despesas) dos últimos 12 meses com registros, ou todos os disponíveis se houver menos. Meses sem entradas nem despesas ficam fora; o mês corrente usa somente os registros existentes. O salário vigente não substitui a renda recebida, e compras de investimentos não são descontadas novamente. Se a média for negativa, o aporte estimado é zero.
- A taxa mensal equivale à rentabilidade anual informada e os aportes ocorrem no fim de cada mês. O gráfico compara a projeção com o patrimônio inicial somado aos aportes, com tabela anual acessível.

## Verificações

```sh
npm run build
node scripts/verify-planning.mjs
node scripts/verify-currency-categories.mjs
node scripts/verify-storage.mjs
node scripts/verify-export.mjs
```

O teste de importação aceita o backup e os controles de origem como arquivos externos: `node scripts/verify-import.mjs backup.json controles.json`.

Em desenvolvimento, abra a aplicação com `?audit=1` para executar as verificações de acessibilidade com axe-core nas telas renderizadas. O painel de diagnóstico e a biblioteca não entram no build público. Os testes incluem contraste dos tokens, mas não substituem uma auditoria WCAG completa.

## Arquitetura e privacidade

Leia docs/ARCHITECTURE.md antes de alterar contratos. Nunca versione JSON. Regere manifestos com node scripts/bootstrap.mjs. Demo fictícia em src/features/demo/demo.ts. O deploy publica somente dist. Migre dados entre localhost e Pages por backup. Histórico USD novo mantém o câmbio capturado; valores legados ausentes não são inventados.
