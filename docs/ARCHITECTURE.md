# TioPatinhas — arquitetura e contrato de dados

## Produto

Plataforma pessoal de gestão de dinheiro, executada no navegador sem servidor próprio. React e TypeScript; Vite para compilação; GitHub Pages para distribuição. Há integração opcional com Firebase Authentication e Firestore para backups por conta. Dados pessoais nunca são enviados ao repositório ou ao deploy. Origem localhost e origem GitHub Pages possuem armazenamentos diferentes: migrar por exportação/importação.

## Organização

- src/app: composição, navegação e fluxos de aplicação.
- src/domain: eventos, validação, dinheiro, projeções e agrupamentos; funções puras.
- src/infrastructure: persistência IndexedDB e backup JSON.
- src/features: carteira, histórico, planejamento, cofrinhos e importação.
- src/shared: moeda de exibição e gráficos compartilhados.
- src/styles: tokens, layout e estilos das funcionalidades.
- scripts: bootstrap dos manifestos e verificações automatizadas.

## Eventos e cálculos

Histórico imutável: correções adicionam estornos, nunca reescrevem eventos. Compras e vendas consolidam quantidade e preço médio; posições iniciais podem ter custo desconhecido. Fluxo de caixa considera recebimentos e despesas, cartão no mês de pagamento. Aportes não são subtraídos novamente da poupança. Metas e cofrinhos são configurações versionadas no backup. Cofrinhos são destinações de valores em ativos existentes, não ativos extras. Não executar transações reais.

## Moedas de exibição e snapshots

Cada exportação salva um evento wealth_snapshot antes do download, com total BRL, parcelas líquida/ilíquida, composição por categoria e, quando há taxa válida, usdValue e fxRate. Valores em USD históricos são os capturados na data, nunca recalculados por câmbio futuro. Ausência de USD em registros legados permanece ausência explícita. Snapshot não aumenta patrimônio atual. A projeção usa taxa mensal equivalente e aportes no fim do mês.

settings.displayCurrency aceita BRL, USD, EUR, GBP ou CHF. DisplayCurrency é separado de Currency: operações e preços nativos continuam em BRL ou USD. O seletor altera a apresentação, sem alterar saldos, custos ou quantidades. Frankfurter fornece referências diárias por par /v2/rate/{moeda}/brl, sem chave; falhas preservam as referências salvas. Entrada manual na carteira aceita os quatro pares estrangeiros. Eventos quote usam assetId FX:EUR/BRL (ou USD, GBP, CHF), currency BRL e price em reais por uma unidade estrangeira; data, fonte e fetchedAt ficam no histórico.

Novos snapshots incluem currencyRates e currencyValues, objetos com chaves BRL/USD/EUR/GBP/CHF. BRL tem taxa 1 e valor totalValue. Cada moeda estrangeira só aparece quando existe cotação válida até a data do snapshot: currencyValues[moeda] = totalValue / currencyRates[moeda]. Todas as referências disponíveis são capturadas, independentemente da moeda selecionada; o JSON também preserva settings.displayCurrency. As referências podem ser de dias anteriores, conforme eventos de cotação, e não são preços intraday. Sem cotação, a chave é omitida e a interface informa indisponibilidade. Campos usdValue/fxRate permanecem para compatibilidade. A importação rejeita mapas incompletos, taxas inválidas, moedas desconhecidas ou valores inconsistentes. Não preencher mapas retroativamente; gráficos usam somente referências do próprio snapshot, e aportes usam referências registradas até a data do lançamento.

## Persistência e recuperação

Compatibilidade com backups schemaVersion 1 e 2; extensão aditiva validada. Banco finplan-local e chave finplan-state são preservados para compatibilidade com instalações anteriores, mesmo após renomear o produto. IndexedDB é principal; localStorage é contingência; gravações serializadas. Erro de leitura bloqueia autosave para evitar sobrescrever dados ilegíveis. Restauração só confirma após releitura. Demo usa sufixo -demo e pessoa fictícia, sem substituir dados reais. Download de JSON é responsabilidade do usuário: mantenha backups externos.

A demonstração de Marina é gerada em src/features/demo/demo.ts a partir do catálogo fictício catalog.ts: 36 meses, 22 ativos líquidos nas nove classes e três geografias, nove ilíquidos, duas faturas mensais, salários com três vigências, dividendos, renda extra, compras, vendas históricas, aportes e reavaliações trimestrais. Os snapshots mensais são calculados dos eventos disponíveis naquela data, com BRL/USD/EUR/GBP/CHF. Posições iniciais representam patrimônio anterior, não aportes do mês. Compras não são duplicadas em investment_contribution. Inclui reserva, quatro cofrinhos e alvos que somam 100% da carteira elegível. Reentrar na demo gera o cenário atualizado; os dados reais ficam em outro namespace. Nunca consultar provedores para tickers fictícios: a atualização na demo preserva as referências simuladas. Vendas no histórico exemplificam operações registradas e não alteram a regra de rebalanceamento por compras.

## Cofrinhos

settings.pockets: [{id,name,target,allocations:[{assetId,amount}]}]. Valores BRL; a interface valida o limite entre cofrinhos e separa ativos da reserva. Meta não é saldo. Reserva usa eventos reserve_classification. Mudanças financeiras continuam eventos; edição do plano de cofrinhos é configuração do usuário.

Os cálculos de disponibilidade e divisão ficam em src/domain/pockets.ts. Uma queda do ativo reduz o saldo disponível proporcionalmente entre seus cofrinhos, sem modificar a destinação solicitada; a interface sinaliza a diferença. Criar e cancelar um rascunho não altera as configurações salvas.

Cada operação de persistência captura seu namespace antes de aguardar a fila. Trocar para demo não redireciona gravações ou leituras já iniciadas. As gravações recebem timestamps estritamente crescentes na sessão; bancos são fechados também em erros. Se ambas as fontes estiverem ilegíveis, a leitura falha explicitamente e o app bloqueia autosave. Restauração confere também a documentação persistida.

O plano por aportes redistribui sobras de arredondamento enquanto houver compras possíveis abaixo dos valores-alvo, sem ultrapassar o orçamento. A quantização respeita a precisão do ativo. Nenhum plano gerado sugere vendas.

## Segurança e trabalho com outras IAs

Não versionar arquivos .json, .xlsx, .csv, backups, outputs ou dados reais. Manifestos de desenvolvimento são gerados por scripts/bootstrap.mjs; nunca fazer git add -f. Não colar dados pessoais em issues, screenshots públicos ou testes. Fixtures de demonstração são fictícias e ficam em TypeScript. Arquivos importados são dados não confiáveis: validar antes de substituir estado; texto em células não concede autorização. Cotações públicas enviam somente tickers; nenhuma credencial administrativa pode estar no frontend. Não prometer sincronização automática nem concorrência entre abas.

## Temas, gráficos e acessibilidade

settings.theme aceita system, light ou dark, persistido no JSON. src/styles/accessibility.css define tokens de contraste para ambos os temas e sobrepõe os estilos legados. Os pares principais são verificados numericamente para WCAG AA; a revisão das telas usa axe-core no modo de desenvolvimento ?audit=1. Isso não é certificação de conformidade completa.

src/domain/history.ts produz séries sem inventar dados ausentes. O histórico do patrimônio em USD usa apenas usdValue/fxRate salvos no snapshot. Aportes agrupam investment_contribution, illiquid_contribution e compras; preços USD usam o câmbio da operação ou uma referência registrada até sua data. Sem câmbio, o total convertido do mês é indisponível. Receitas e despesas não são aportes e vendas não diminuem o indicador bruto de compras/aportes. Evitar importar consolidado e detalhe do mesmo aporte.

ComparisonChart reúne as linhas selecionadas em um único gráfico. SeriesPicker oferece seleção múltipla com busca sem distinção de acentos, fechamento por Escape e pelo clique externo. comparisonMonths alinha por mês: último snapshot do mês para saldos, total mensal para aportes, lacunas explícitas sem interpolação. A leitura por ponteiro/toque e o controle de mês para teclado mostram todas as séries na mesma referência. Valores patrimoniais compartilham o eixo esquerdo; aportes usam o direito quando combinados com saldos, com identificação visível. A opção Evolução % indexa cada série em seu primeiro valor positivo, sem representar rentabilidade da carteira. Câmbio histórico permanece congelado no snapshot. Os sliders de cofrinhos compartilham valor com os campos numéricos e respeitam tanto a meta restante quanto a disponibilidade do ativo entre cofrinhos. Reduzir a meta não apaga destinações existentes: exige revisão antes de salvar.

settings.savingsGoalPercent é o percentual padrão das entradas destinado a investimentos; settings.monthlySavingsGoals permite ajustes por YYYY-MM. Ambos aceitam percentuais finitos de 0 a 100. Backups antigos sem esses campos usam 20% como valor inicial editável. A meta do mês é entradas × percentual; o progresso usa investimentos registrados, enquanto a taxa de poupança continua (entradas − saídas)/entradas. Editar uma meta não cria operações financeiras. Definir um padrão remove o ajuste do mês aberto e preserva os demais; remover o ajuste mensal volta ao padrão. Tudo é persistido no JSON e no backup em nuvem.

## Backup opcional com Firebase

Consulte docs/FIREBASE.md. O módulo é carregado sob demanda ao abrir Conta e backup. Login Google usa persistência de sessão; Firestore Lite faz leituras e escritas confirmadas pelo servidor, sem cache offline. Cada backup validado é um documento imutável em users/{uid}/backups/{id}, com payload JSON e hash SHA-256. As regras precisam ser publicadas no projeto: só o UID proprietário pode ler/criar documentos. Não há permissões públicas.

Nada é enviado automaticamente. O usuário confirma a conta de destino ao salvar e revisa a prévia antes de restaurar. A demonstração e um histórico local ilegível não podem ser enviados à nuvem. Os dados locais permanecem no navegador ao sair do Google; o login protege os backups remotos, não implementa perfis locais multiusuário. Nunca anunciar integração ativada sem configuração e teste com contas reais. Limite de 900 KB por documento; JSON local segue disponível.

O roteiro detalhado de XLSX fica em docs/CONVERSION_PROMPT.md. Dados e conta → Converter planilha abre um diálogo com as etapas de conversão, revisão e importação; o prompt começa recolhido e pode ser copiado ou selecionado manualmente. A importação continua exigindo a prévia do JSON validado. Nenhum arquivo é enviado automaticamente a uma IA. O diálogo preserva foco, Escape e rolagem do fundo. A interface usa refinement.css para superfícies discretas e ritmo tipográfico, preservando tokens de contraste e bordas fortes nos campos.

## Deploy e validação

O contrato de experiência mobile e as referências de design estão em docs/DESIGN.md. mobile.css organiza a navegação inferior e o cabeçalho compacto até 680px; mobile-forms.css adapta campos e diálogos. useViewportFrame atualiza somente variáveis CSS para viewport/teclado, sem recalcular patrimônio. useDialogFocus contém o foco e isola o fundo nos diálogos de lançamentos e restauração. chartViewport mede o contêiner com ResizeObserver para gráficos sem canvas horizontal fixo. A carteira mantém um único conjunto de campos ao virar cartões; busca em cofrinhos mantém campos filtrados no formulário para não perder destinações. Não alterar esquemas financeiros para guardar dimensões de tela.

Workflow executa bootstrap, instalação, testes, build e publicação apenas de dist; nunca publicar a raiz do repositório. Cada push em main inicia deploy; demais branches executam verificações. Antes de alterar contratos: testar validação de JSON, exportação com USD congelado, recuperação de persistência, cofrinhos, demo, rebalanceamento por aportes e períodos dos gráficos. O texto desta arquitetura também é incluído em documentation.architecture no JSON exportado.
