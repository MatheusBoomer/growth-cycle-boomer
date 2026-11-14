# Plano de ação em ondas (modelo Happy Duck) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a Skill 08 gerar, para todo prospect, o `.docx` e a `.xlsx` no formato dos dois modelos de referência da Happy Duck (plano em ondas com checkpoints, abertura rica, fechamento com KPIs e decisões do cliente, planilha por onda com resumo), e fazer o deck da Skill 09 ler a tabela de ações desse mesmo plano.

**Architecture:** O JSON v2 do plano (um só arquivo, validador, gerador) ganha chaves **opcionais e aditivas**: `ondas`, `decisao_cliente` por ação e blocos de abertura e fechamento. Com `ondas`, o gerador usa o layout novo; sem `ondas`, tudo sai como hoje (planos antigos e a etapa 10 de revisão não quebram). Os dois arquivos continuam saindo do mesmo JSON, no mesmo comando.

**Tech Stack:** Python 3.9+, openpyxl, XML direto do `.docx` (como `plano_acao_docx.py`), pytest. Etapa 08 também mexe em `.claude/skills`, `etapas.json` e testes `npm test` (web e core).

**Spec:** não há spec nova; a análise dos modelos está na conversa de 2026-11-14 e na seção "Decisões" abaixo. Base: `docs/superpowers/specs/2026-11-10-plano-de-acao-prompt-9-design.md` (existe só na `main`). Modelos: `~/Downloads/Happy Duck _ Plano de Ação.docx` e `~/Downloads/Happy Duck _ Plano de Ação - Planilha.xlsx` (copiar para `docs/superpowers/plans/assets/happy-duck/` na Task 0, para o executor ter os modelos à mão).

## Decisões (já tomadas)

1. Mudança aditiva: `versao` continua 2; `ondas` é opcional no validador (AVISO quando falta) e obrigatória segundo a skill.
2. `horizonte` continua em toda ação (Imediato, Curto prazo, Médio prazo); as **ondas** são o agrupamento do documento e da planilha.
3. Marcações `[VALIDAR]`, `[PREENCHER]` e "(a confirmar …)", "(a preencher …)" **continuam proibidas** na versão final (decisão do usuário em 2026-11-14). Nenhuma mudança na regra do validador.
4. Achado de origem cita a **seção do diagnóstico e o número**, nunca "slide N": o plano é feito antes do deck.
5. A tabela-resumo cronológica do fim do `.docx` sai quando há `ondas` (a "Visão geral" por onda a substitui). Sem `ondas`, continua.
6. "Status" da planilha com ondas: A iniciar, Em andamento, Concluída, Atrasada, Adiada (como no modelo). Sem `ondas`, continua A fazer/Em andamento/Feito/Atrasado.
7. Divisão Meta/Google na tabela de metas mensais e geração automática da tabela de "sessões não pagas" ficam **fora do escopo**: a primeira vem da etapa 07 e a segunda é específica de cada prospect; entram como blocos livres do JSON.

## Global Constraints

- Português do Brasil em todo texto visível; datas `dd/mm/aaaa`; números `1.234,56`.
- `.docx` e `.xlsx` saem do mesmo JSON; nunca escrever os arquivos na mão (regra da skill).
- Frentes com os nomes exatos já validados (`FRENTES` em `plano_acao_comum.py`); horizontes `Imediato`, `Curto prazo`, `Médio prazo`.
- Nenhuma menção à garantia nos arquivos.
- A regra do `CLAUDE.md`: mudou skill, muda o `fluxo.mmd` da mesma pasta no mesmo commit; rodar `npm test` em `src/apps/web` e `src/packages/core` antes de concluir a Task 7.
- Sem dado pessoal de cliente final em nenhum arquivo (PII).

## Review Focus

1. Ação cujo `inicio` cai fora da janela da onda onde foi listada, ou ação listada em duas ondas ou em nenhuma: erro claro apontando a ação.
2. Plano **sem** `ondas` (formato antigo, planos de teste e fixtures da etapa 10) continua validando e gerando exatamente como hoje.
3. Texto com `&`, `<`, `>` e aspas nas tabelas novas do `.docx` e nas células da planilha: o arquivo abre e o texto volta idêntico.
4. Frente ou horizonte com acento ou caixa diferente na planilha: o "Resumo por frente" conta certo (as fórmulas usam o nome exato; o validador já barra nome fora do padrão).
5. Projeção com menos meses que o pedido, ou aba do cenário ausente: `metas_mensais.py` falha com mensagem em português e não grava nada.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `scripts/plano_acao_comum.py` (modificar) | Acessores das ondas, `texto_depende` com nomes, visão geral, decisões do cliente, `quando_curto` |
| `scripts/validar_plano_acao.py` (modificar) | Regras das ondas, `decisao_cliente` e blocos novos |
| `scripts/metas_mensais.py` (criar) | Lê a planilha de projeção e grava `metas_mensais` no JSON do plano |
| `scripts/plano_acao_docx.py` (modificar) | Layout por onda (abertura, ondas, checkpoints, fechamento) |
| `scripts/plano_acao_xlsx.py` (modificar) | Planilha por onda e aba "Resumo por frente" |
| `scripts/gerar_plano_acao.py` (modificar só se preciso) | Nada muda na linha de comando |
| `scripts/linhas_plano_acao.py` (modificar) | Passa a ler o JSON do plano (deck) em vez do `.docx` |
| `scripts/fixture_verdeluz/plano-de-acao.json`, `roteiro_09.py` (modificar) | Fixture em ondas; deck de referência |
| `.claude/skills/08-plano-de-acao/{SKILL.md,fluxo.mmd}`, `.claude/skills/_shared/etapas.json`, `.claude/skills/09-apresentacao-final/SKILL.md` (modificar) | Prompt e fluxos |

---

### Task 0: Base de trabalho

**Files:** nenhum arquivo de código; cria branch e a pasta de modelos.

A Skill 08 v2 está só na `main`; a branch `feat/roteiro-modal-e-mudancas` tem o commit `e4e2bd1` (slide `tabela_plano`, extrator do docx v1) e ainda não a tem.

- [ ] **Step 1:** Em `feat/roteiro-modal-e-mudancas`, `git merge main` e resolver conflitos (esperados: `09-apresentacao-final/SKILL.md`, `fixture_verdeluz/roteiro_09.py`, `roteiro-apresentacao.json` do fixture; manter os dois lados). Rodar `python3 -m pytest scripts/tests -q`; esperado: só falha `test_linhas_plano_acao.py` e o teste do roteiro de referência (o extrator lê o docx v1; é refeito na Task 8). Marcar essas falhas como conhecidas.
- [ ] **Step 2:** `git switch -c feat/plano-acao-ondas`. Criar `docs/superpowers/plans/assets/happy-duck/` e copiar os dois modelos para lá. Commit: `docs: modelos de referência da Happy Duck`.

---

### Task 1: Acessores das ondas em `plano_acao_comum.py`

**Files:** Modify `scripts/plano_acao_comum.py`; Test `scripts/tests/test_plano_acao_comum.py` (usar `plano_v2_exemplo.py`; acrescentar um `plano_com_ondas()` nesse arquivo de exemplo, com 3 ondas, 6 ações, checkpoints e 2 ações com `decisao_cliente`).

**Interfaces:**
- Produces:
  - `ondas(plano: dict) -> list[dict]` (lista vazia sem `ondas`)
  - `onda_da_acao(plano: dict, numero: int) -> dict | None`
  - `nome_da_acao(plano: dict, numero: int) -> str`
  - `texto_depende(acao: dict, plano: dict | None = None) -> str`: sem `plano`, igual a hoje ("Nenhuma", "Ação 2", "Ações 2, 5"); com `plano`, "Ação 2 (Nome da ação 2); Ação 5 (Nome da ação 5)"
  - `visao_geral(plano: dict) -> list[dict]`: chaves `numero`, `nome`, `janela` ("11/11/2026 a 17/11/2026"), `calendario_midia`, `foco`, `total_acoes`
  - `decisoes_do_cliente(plano: dict) -> list[dict]`: chaves `numero`, `acao`, `ate`, `recomendacao`; ordenadas por `ate` e depois por número
  - `quando_curto(acao: dict, ano_base: int) -> str`: "12/11 a 13/11"; a data cujo ano difere de `ano_base` leva "/aa" (ex.: "29/01/27")

- [ ] **Step 1: Testes que falham**, um por função, com estes asserts: `visao_geral(plano_com_ondas())[0]["total_acoes"] == 2`; `texto_depende(a, plano) == "Ação 1 (Liberar os acessos)"`; `decisoes_do_cliente` devolve as 2 ações na ordem das datas; `quando_curto({"inicio":"17/11/2026","entrega":"29/01/2027"}, 2026) == "17/11 a 29/01/27"`; `ondas({"horizontes": []}) == []`.
- [ ] **Step 2:** `python3 -m pytest scripts/tests/test_plano_acao_comum.py -q`. Esperado: FAIL (funções não definidas).
- [ ] **Step 3:** Implementar as funções acima. `texto_depende` mantém o comportamento atual quando `plano is None`.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS, e os testes antigos do arquivo continuam passando.
- [ ] **Step 5:** Commit `feat(plano-de-acao): acessores das ondas e das decisões do cliente`.

---

### Task 2: Regras das ondas no validador

**Files:** Modify `scripts/validar_plano_acao.py`; Test `scripts/tests/test_validar_plano_acao.py`.

**Interfaces:**
- Consumes: `ondas`, `onda_da_acao` (Task 1); `ler_data`, `ErroPlano`.
- Produces: `validar(plano, registro, rascunho=False)` (assinatura atual) passa a devolver ERRO/AVISO também para as chaves novas. Esquema das chaves novas, todas opcionais:
  - `ondas`: `[{numero:int, nome, inicio, fim, calendario_midia, objetivo, acoes:[int], checkpoint: null | {data, duracao, pauta, para_liberar, quem_decide}}]`
  - ação: `decisao_cliente: null | {ate, recomendacao}`
  - `como_funciona`: `[{titulo, texto}]`
  - `metas_mensais`: `{cenario, colunas:[str], linhas:[[str]], observacao: str | null}`
  - `sessoes_nao_pagas`: `{colunas:[str], linhas:[[str]], premissas, risco}`
  - `protocolo_mudanca`: `{intro, regras:[str]}`
  - `kpis_acompanhamento`: `[{kpi, meta_limite}]`

**ERRO (bloqueia), cada um com teste:**
- ondas fora de ordem, sobrepostas, numeradas fora de 1..n, primeira antes de `data_referencia` ou última depois de `fim_ciclo`;
- campo de texto vazio em onda ou checkpoint;
- ação em duas ondas, em nenhuma, ou com número que não existe;
- `inicio` da ação fora da janela da onda onde está listada (a entrega pode passar da janela);
- `checkpoint.data` antes do início da onda ou depois do início da seguinte (a última: depois de `fim_ciclo`);
- `decisao_cliente` com `ate` inválida, fora de `data_referencia`..`fim_ciclo`, ou `recomendacao` vazia;
- linha de tabela com número de células diferente do de `colunas`; `kpis_acompanhamento`, `como_funciona` ou `protocolo_mudanca` malformados.

**AVISO:** plano sem `ondas`; onda sem ação; onda (exceto a última) sem checkpoint; sem `kpis_acompanhamento`.

- [ ] **Step 1: Testes que falham**, um por regra acima, mais `test_plano_antigo_sem_ondas_so_avisa` (plano de `plano_valido()` não ganha ERRO, só o AVISO "sem ondas").
- [ ] **Step 2:** `python3 -m pytest scripts/tests/test_validar_plano_acao.py -q`. Esperado: FAIL nos novos.
- [ ] **Step 3:** Implementar `_validar_ondas(plano, erros, avisos)` e `_validar_blocos_novos(plano, erros, avisos)` em `validar_plano_acao.py`, chamados no fim de `validar`. Mensagens no estilo atual: `Onda 2: ...`, `Ação 7 ("nome"): ...`.
- [ ] **Step 4:** Rodar o arquivo inteiro. Esperado: PASS, incluindo `test_validar_solucoes.py` e `test_validar_revisao.py` (rodar `python3 -m pytest scripts/tests -q -k "validar"`).
- [ ] **Step 5:** Commit `feat(plano-de-acao): validador confere ondas, checkpoints e decisões do cliente`.

---

### Task 3: Metas dos 3 primeiros meses a partir da projeção

**Files:** Create `scripts/metas_mensais.py`; Test `scripts/tests/test_metas_mensais.py`.

**Interfaces:**
- Produces:
  - `calcular_meses(projecao: Path, cenario: str, meses: int) -> list[dict]`: lê a aba do cenário (`"Realista"` lê a aba `Meta`; `"Pessimista"` e `"Otimista"` leem a aba de mesmo nome), colunas de entrada B (investimento), C (ticket), D (conversão), E (custo por sessão paga), F (% sessões pagas), das linhas 2 em diante, e calcula pela cadeia do `projecao.py`: sessões pagas = B/E; sessões totais = pagas/F; vendas = totais×D; receita = vendas×C. Não depende de valores em cache das fórmulas. Devolve `[{"mes_indice": 1, "investimento": float, "ticket": float, "conversao": float, "cps": float, "pct_pagas": float, "sessoes": float, "vendas": float, "receita": float}, ...]`
  - `montar_bloco(linhas: list[dict], rotulos_mes: list[str], checks: list[str], cenario: str) -> dict`: devolve o bloco `metas_mensais` do JSON (colunas: Mês, Check em, Receita (R$), Invest. (R$), Ticket (R$), Conv., CPS (R$), % pagas, Sessões, Vendas, mais uma linha "3 meses" com soma de receita, investimento, sessões e vendas), números formatados com `formatar_decimal` e `formatar_percentual` de `plano_acao_comum`
  - CLI: `python3 scripts/metas_mensais.py --plano <json> --projecao <xlsx> --cenario Realista --meses 3 --rotulos "Nov/26,Dez/26,Jan/27" --checks "02/12/2026,30/12/2026,05/02/2027"`; grava `metas_mensais` no JSON (sem apagar o resto) e imprime `OK`. Erro: `ERRO:` em português, código 1, nada gravado.

- [ ] **Step 1: Testes que falham**, usando o `projecao-de-cenarios.xlsx` do fixture Verdeluz (`clientes/_fixtures/verdeluz/base/entrega/ativos-aprovados/projecao/`): receita do mês 1 igual a `B2/E2/F2*D2*C2` calculada no teste; `meses=13` falha com "A projeção tem 12 meses"; cenário inexistente falha; o CLI preserva as outras chaves do JSON; falha não deixa o JSON alterado.
- [ ] **Step 2:** `python3 -m pytest scripts/tests/test_metas_mensais.py -q`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3:** Implementar com `openpyxl.load_workbook(data_only=False)` lendo só as colunas de entrada. Gravar o JSON por arquivo temporário e `replace`.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(plano-de-acao): metas dos 3 primeiros meses a partir da projeção`.

---

### Task 4: `.docx` por onda

**Files:** Modify `scripts/plano_acao_docx.py`; Test `scripts/tests/test_plano_acao_docx.py`.

**Interfaces:**
- Consumes: Task 1 (`ondas`, `visao_geral`, `decisoes_do_cliente`, `texto_depende(acao, plano)`).
- Produces em `plano_acao_docx.py`:
  - `tabela_generica(cabecalhos: list[str], linhas: list[list[str]], larguras: list[int]) -> str`: reaproveita `_tc` (cabeçalho `1c2f5f`, zebra `eef2f8`)
  - `acao_bloco_tabela(titulo: str, cabecalho: str, campos: list[tuple[str, str]]) -> str`: linha "AÇÃO n · texto" com destaque amarelo, linha de cabeçalho em fonte menor ("Início e entrega: … Dono: … Frente: … Horizonte: … Depende de: …") e tabela de 2 colunas (rótulo em negrito | texto) com os rótulos ACHADO, ALAVANCA, COMO, EVIDÊNCIA, KPI E META, GATILHO
  - `onda_titulo(onda: dict) -> str`, `checkpoint_bloco(onda: dict) -> str`
  - `montar_document_xml(plano)` escolhe o layout: com `ondas`, a ordem é: título do prospect · "Como este plano funciona" (`como_funciona`) · "Visão geral" (tabela de `visao_geral`) · "Metas dos 3 primeiros meses" (`metas_mensais`) · "Sessões não pagas" (`sessoes_nao_pagas`) · abertura atual (metas, cabe, não cabe, premissas, piso de ROAS) · "Como mudamos minimizando riscos" (`protocolo_mudanca`) · cada onda (título, "Objetivo", "Calendário de mídia", ações em ordem de número, checkpoint) · "KPIs de acompanhamento e limites" · "Decisões que dependem de <prospect>" (tabela Ação, Até, Recomendação). Blocos opcionais ausentes são omitidos. Sem `ondas`: layout de hoje, inalterado.

- [ ] **Step 1: Testes que falham** com `plano_com_ondas()`: lendo o `.docx` de volta, a ordem dos títulos é a acima; "AÇÃO 1" fica dentro da onda 1; `texto_depende` com nome aparece no cabeçalho da ação; o checkpoint traz "Pauta", "Para liberar" e "Quem decide"; sem `ondas` o texto contém "Tabela-Resumo Cronológica" e com `ondas` não contém; texto com `&`, `<` e `"` numa ação volta idêntico (Review Focus 3); `decisao_cliente` vira linha da tabela de decisões, e plano sem nenhuma decisão não gera o título da seção.
- [ ] **Step 2:** `python3 -m pytest scripts/tests/test_plano_acao_docx.py -q`. Esperado: FAIL nos novos; os antigos passam.
- [ ] **Step 3:** Implementar as funções acima. Larguras das tabelas somam 9029 (como as atuais). Escapar XML pelo mesmo caminho de `_run`.
- [ ] **Step 4:** Rodar. Esperado: PASS. Abrir o `.docx` gerado do fixture no LibreOffice (`soffice --headless --convert-to pdf`) e conferir a olho contra o modelo Happy Duck (páginas 1 a 5): ordem, tabelas, bloco de ação.
- [ ] **Step 5:** Commit `feat(plano-de-acao): documento organizado em ondas, com checkpoints e fechamento`.

---

### Task 5: Planilha por onda com resumo

**Files:** Modify `scripts/plano_acao_xlsx.py`; Test `scripts/tests/test_plano_acao_xlsx.py`.

**Interfaces:**
- Consumes: Task 1.
- Produces em `plano_acao_xlsx.py`: constantes `ABA_PLANO_ONDAS = "Plano de Ação Estratégico"`, `ABA_RESUMO = "Resumo por frente"`, `STATUS_ONDAS = ["A iniciar", "Em andamento", "Concluída", "Atrasada", "Adiada"]`, `COLUNAS_ONDAS` (Nº, Ação, Racional (achado de origem), Alavanca da meta, Frente, Horizonte, Responsável, Início, Entrega, Depende de, Como, Evidência, Impacto esperado / KPI e meta, Gatilho, Status) e `_escrever_ondas(ws, plano) -> int` (devolve o total de ações).
  - `gerar_xlsx(plano, saida, modelo=None)` com `ondas` grava 3 abas, nesta ordem: `ABA_PLANO_ONDAS`, `ABA_RESUMO`, `ABA_METAS` (a de hoje). Sem `ondas`, o comportamento atual.
  - Aba do plano: linha 1 título (`PLANO DE AÇÃO ESTRATÉGICO — <prospect>`), linha 2 subtítulo (horizonte de 12 meses, data-base, "Elaborado por" `empresa_agencia`), ambas mescladas; depois, para cada onda, linha de faixa mesclada (`ONDA 1 · NOME · janela`), cabeçalho repetido e as ações da onda em ordem de número; `freeze_panes = "C6"`; datas como data; "Depende de" com `texto_depende(acao, plano)`; Status vazio com lista `STATUS_ONDAS` aplicada só às linhas de ação; zebra e cabeçalho `1c2f5f`.
  - Aba `ABA_RESUMO`: contagem por frente (linhas) × horizonte (colunas) com `COUNTIFS` sobre a aba do plano, total por linha e coluna, bloco "Status do plano" com `COUNTIF` por status e a linha "Conferência (total de ações = N)" com N do plano.

- [ ] **Step 1: Testes que falham:** nomes e ordem das abas; as ações de cada onda ficam entre a faixa dela e a seguinte; `freeze_panes == "C6"`; a lista de validação vale só nas linhas de ação (não nas faixas nem nos cabeçalhos); recalcular a planilha no LibreOffice (`soffice --headless --convert-to xlsx`) e ler os valores: soma do resumo igual ao total de ações e cada frente igual à contagem feita no teste a partir do JSON (Review Focus 4); texto com `&` e `<` volta idêntico; sem `ondas`, os testes antigos seguem passando sem mudança.
- [ ] **Step 2:** `python3 -m pytest scripts/tests/test_plano_acao_xlsx.py -q`. Esperado: FAIL nos novos.
- [ ] **Step 3:** Implementar. Com `--modelo-xlsx` e `ondas`, exigir as três abas e levantar `ErroPlano` em português se faltar alguma.
- [ ] **Step 4:** Rodar. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(plano-de-acao): planilha por onda com resumo por frente e horizonte`.

---

### Task 6: Fixture Verdeluz e integração do gerador

**Files:** Modify `scripts/fixture_verdeluz/plano-de-acao.json`, `scripts/fixture_verdeluz/producao.md` (se citar o formato), `scripts/tests/test_gerar_plano_acao.py`; `scripts/gerar_plano_acao.py` só se o teste exigir.

- [ ] **Step 1:** Reescrever o fixture com as mesmas ações e soluções, agora com 4 ondas, checkpoints, 3 ações com `decisao_cliente`, `como_funciona`, `metas_mensais` (gerada por `metas_mensais.py` a partir da projeção do próprio fixture), `protocolo_mudanca` e `kpis_acompanhamento`. Números só os que o fixture já tem (cliente fictício).
- [ ] **Step 2: Testes que falham** em `test_gerar_plano_acao.py`: o fixture passa em `validar` sem ERRO e sem AVISO de "sem ondas"; `gerar` com o fixture produz `.docx`, `.xlsx` e `.json` e, lendo de volta, o conjunto de números de ação, datas e textos de achado é igual nos dois arquivos; plano sem `ondas` continua gerando os dois arquivos como antes (Review Focus 2); `python3 -m pytest scripts/tests/test_revisao_exemplo.py scripts/tests/test_validar_revisao.py scripts/tests/test_relatorio_revisao.py -q` continua passando (etapa 10 lê o JSON com as chaves novas).
- [ ] **Step 3:** Rodar `python3 -m pytest scripts/tests -q`. Esperado: tudo passa, exceto as falhas conhecidas da Task 0 (extrator do deck).
- [ ] **Step 4:** Commit `feat(plano-de-acao): fixture Verdeluz em ondas e teste de ponta a ponta`.

---

### Task 7: Prompt da Skill 08, fluxograma e catálogo

**Files:** Modify `.claude/skills/08-plano-de-acao/SKILL.md`, `.claude/skills/08-plano-de-acao/fluxo.mmd`, `.claude/skills/_shared/etapas.json` (campos `descricao` e `oQueEsperar` da etapa `08`).

- [ ] **Step 1:** Em `SKILL.md`: (a) Fase 1 passa a montar também as **ondas** a partir do calendário estratégico de mídia (cada onda termina em um checkpoint com data, pauta, "para liberar a próxima onda" e quem decide; o Imediato é a onda 1; janela de cada onda e mês do calendário: Contenção, Escala, Pico, Manutenção), o texto "Como este plano funciona" (lógica do plano, data-base, datas-âncora do calendário, plano mínimo se o rastreamento ou os responsáveis não ficarem prontos, horizontes, dono, frentes, como ler cada ação), `protocolo_mudanca` (uma mudança por vez, backup, testar antes, 48–72 h entre mudanças, congelamento de datas-âncora) e `kpis_acompanhamento` (KPI e meta/limite, com número do cenário aprovado); (b) Fase 2: ação que depende de decisão do cliente leva `decisao_cliente` com a recomendação da Boomer; o achado cita seção e número, **nunca "slide N"**; (c) Fase 3: antes de gerar, rodar `scripts/metas_mensais.py` com a projeção aprovada (`entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx`); (d) Fase 4: acrescentar ao relatório "toda ação está em exatamente uma onda e começa dentro dela"; (e) atualizar a seção "Formato do plano (JSON v2)" com as chaves novas e o aviso de que ficam opcionais para o gerador mas **obrigatórias para esta skill**; (f) manter proibidas as marcações no arquivo final.
- [ ] **Step 2:** `fluxo.mmd`: acrescentar as etapas "Montar ondas e checkpoints", "Gerar metas mensais da projeção" e "Conferir cobertura por onda", mantendo as convenções (`flowchart TD`, rótulos entre aspas, aprovação como decisão `"Analista aprova?"` com classe `checkpoint`, saídas `sim` e `não, ajustar`, três `classDef` no fim).
- [ ] **Step 3:** `etapas.json`: atualizar `descricao` e `oQueEsperar` citando ondas e checkpoints, sem prometer o que a skill não faz.
- [ ] **Step 4:** `cd src/apps/web && npm test -- --force` e `cd src/packages/core && npm test -- --force` (o turbo guarda cache). Esperado: PASS, incluindo `lib/fluxos.test.ts` e `test/catalogo-skills.test.ts`.
- [ ] **Step 5:** Commit `docs(skills): Skill 08 no formato em ondas do modelo Happy Duck`.

---

### Task 8: Deck lê o plano em JSON

**Files:** Modify `scripts/linhas_plano_acao.py`, `scripts/tests/test_linhas_plano_acao.py`, `scripts/gerar_apresentacao.py` (função `_acoes_fora_do_roteiro`), `.claude/skills/09-apresentacao-final/SKILL.md`, `scripts/fixture_verdeluz/roteiro_09.py` e o `roteiro-apresentacao.json` do fixture.

**Interfaces:**
- Produces em `linhas_plano_acao.py`: `CAMINHO_PLANO = "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json"` (substitui `CAMINHO_DOCX`); `ler_plano(caminho: Path) -> list[dict]` com as linhas `num`, `acao`, `horizonte`, `quando`, `quem`, `frente` em ordem cronológica, onde `quando = quando_curto(acao, ano da data_referencia)`, `quem` = dono sem o sufixo " · empresa", `num` = `numero`; `ler_tabela_docx` é removida. `slides_do_roteiro` e a linha de comando não mudam de assinatura.

- [ ] **Step 1: Testes que falham:** `ler_plano` sobre o JSON do fixture Verdeluz devolve as ações na ordem de início, `quem` sem " · Boomer", `quando` no formato "dd/mm a dd/mm"; JSON ausente falha com "Plano de ação aprovado não encontrado"; os testes de divisão em slides (`slides_do_roteiro`) continuam como estão.
- [ ] **Step 2:** `python3 -m pytest scripts/tests/test_linhas_plano_acao.py scripts/tests/test_gerar_apresentacao.py -q`. Esperado: FAIL.
- [ ] **Step 3:** Implementar e trocar `plano.ler_tabela_docx`/`CAMINHO_DOCX` por `ler_plano`/`CAMINHO_PLANO` em `gerar_apresentacao.py` e no `roteiro_09.py`; regerar o `roteiro-apresentacao.json` do fixture (`python3 scripts/fixture_verdeluz/roteiro_09.py --cliente clientes/_fixtures/verdeluz/base`). Na `SKILL.md` da 09, apontar o extrator para o JSON do plano e citar o link do documento detalhado como já está.
- [ ] **Step 4:** `python3 -m pytest scripts/tests -q`. Esperado: tudo passa (as falhas conhecidas da Task 0 somem).
- [ ] **Step 5:** Commit `fix(apresentacao): tabela do plano de ação lida do JSON do plano`.

---

### Task 9: Verificação ponta a ponta contra os modelos

**Files:** nenhum (só verificação e relato).

- [ ] **Step 1:** Gerar do fixture o `.docx`, a `.xlsx` e o deck (`gerar_plano_acao.py`, `gerar_apresentacao.py`) em uma pasta temporária e converter `.docx` e deck para imagem (`soffice` e `pdftoppm`).
- [ ] **Step 2:** Comparar lado a lado com os modelos Happy Duck: ordem das seções do documento; bloco de ação em tabela; checkpoint; tabela de decisões; abas, faixas de onda, painéis congelados e menu de Status da planilha; tabelas do deck com o link. Registrar divergências como itens abertos, não corrigir fora do escopo.
- [ ] **Step 3:** `python3 -m pytest scripts/tests -q`, `npm test -- --force` em `src/apps/web` e `src/packages/core`. Esperado: tudo verde.
- [ ] **Step 4:** Relatar ao usuário: o que ficou igual ao modelo, o que ficou de fora (divisão Meta/Google, tabela de sessões não pagas gerada) e o que mudou no prompt. Sem push nem deploy até o usuário pedir (VPS: `~/bin/vps-deploy deploy`).

---

## Self-review

- **Cobertura:** abertura rica (Tasks 3, 4, 7), ondas e checkpoints (1, 2, 4, 7), fechamento com KPIs e decisões (1, 2, 4), planilha por onda, resumo com fórmulas e status Adiada (5), dependências com nome (1, 4, 5), "sem slide N" (7), marcações continuam proibidas (Decisão 3; nenhuma task mexe nisso), correção do extrator do deck (8), plano antigo e etapa 10 preservados (2, 4, 5, 6).
- **Nomes consistentes:** `texto_depende(acao, plano)`, `visao_geral`, `decisoes_do_cliente`, `quando_curto`, `ler_plano`, `CAMINHO_PLANO` usados do mesmo jeito em todas as tasks.
- **Proporção:** tasks 4 e 5 concentram o trabalho de código; a 7 é só texto de skill e fluxo.
- **Risco aceito:** o fixture em ondas (Task 6) é conteúdo novo escrito à mão por quem executa; conferir com o analista se algum número do fixture precisar bater com algo fora dele.
