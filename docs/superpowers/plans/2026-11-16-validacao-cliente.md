# Validação dos dados com o cliente (etapa 04) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A etapa 04 só conclui depois que o analista baixou o PDF de validação, confirmou que o cliente validou, e todo erro apontado foi corrigido no chat da 04, inclusive os que nascem na 03.

**Architecture:** Um estado novo `validacaoCliente` no `Estado` (funções puras em `validacao-cliente.ts`) alimenta `condicoesConcluir` da 04. O serviço ganha a ferramenta MCP `propor_validacao_cliente`, as ações de baixar e confirmar, e libera à 04 três coisas da 03: pedir insumo, propor entregável (`etapa_origem`) e atualizar o resumo. Um script Python com reportlab gera o PDF a partir de JSON e dos gráficos aprovados.

**Tech Stack:** TypeScript (vitest, Next.js route handlers, React), Python 3.11 (pytest, reportlab), MCP SDK + zod.

**Spec:** `docs/superpowers/specs/2026-11-16-validacao-cliente-design.md`

## Global Constraints

- Regras em código, não só em texto de skill; o agente nunca consegue pular o gate.
- Sem CPF, e-mail, telefone ou endereço de cliente final no PDF (só séries agregadas).
- Nome de arquivo estável, sem versão: `entrega/validacao-cliente/documento-validacao.pdf` (sobrescreve). O PDF fica fora de `entrega/ativos-aprovados/`.
- O agente só grava em `.app/rascunhos/`; quem grava em `entrega/validacao-cliente/` é o app.
- Gate vale para toda 04 ainda não concluída; quem já concluiu a 04 não é afetado.
- Troca de insumo só conta depois da primeira geração do PDF (`primeiraGeracaoEm`).
- Texto de interface em português, itens curtos (coluna estreita), sem travessão (há `sem-travessao.test.ts`).
- Skill e fluxograma mudam juntos: `fluxo.mmd` (convenções do CLAUDE.md), `fluxo-geral.mmd`, `analista-dados.fluxo.mmd`, lista "Subagentes disponíveis" do CLAUDE.md.
- Antes de concluir: `npm test` em `src/packages/core` e `src/apps/web`.
- Passos de commit só rodam com a autorização do analista; stage por caminho explícito (há arquivos não relacionados não rastreados). Confirme a branch antes de cada commit.

## Review Focus

1. Fluxo normal sem correção: gráficos da 03 aprovados antes do envio do insumo da 04 NÃO ficam desatualizados e o PDF sai de primeira (Task 1).
2. Mensagem do analista depois de confirmar desfaz a confirmação, mas mantém o download (Task 1).
3. Confirmar sem ter baixado, ou com o PDF defasado, é recusado; confirmar duas vezes não quebra (Tasks 1 e 5).
4. Baixar de prospect sem PDF dá 404; usuário sem acesso ao prospect não baixa nem confirma (Task 5).
5. JSON do PDF com gráfico inexistente, e-mail ou CPF na observação, ou seção sem gráfico: erro claro e nenhum PDF parcial no disco (Task 7).
6. 04 reaberta depois de concluída, sem `validacaoCliente` antigo, exige o PDF de novo (Task 1).
7. Insumo da 03 trocado com a 04 "pronta": a 04 volta a "em andamento" e o agente recebe a mensagem na conversa da 04 (Task 3).

---

## File Structure

- Create `src/packages/core/src/validacao-cliente.ts`: funções puras do gate (estado, pendências, desatualização).
- Modify `src/packages/core/src/tipos.ts`: `ValidacaoCliente`, `Estado.validacaoCliente`, `Entregavel.etapaConversa`, eventos `card_validacao_cliente` e `etapaInsumo`, `RespostaEstado.validacaoDefasada`.
- Modify `src/packages/core/src/maquina-estados.ts`: `condicoesConcluir`, `registrarMensagemAnalista`.
- Modify `src/packages/core/src/servico-planejamento.ts`: ferramentas, insumos da 03 na 04, etapa de conversa dos entregáveis, resumo da 03, ações de baixar e confirmar.
- Modify `src/packages/mcp-planejamento/src/servidor.ts`: registrar `propor_validacao_cliente` e os parâmetros novos.
- Create `src/apps/web/app/api/prospects/[slug]/validacao-cliente/download/route.ts`; modify `.../etapas/[etapa]/acoes/route.ts`; modify `src/apps/web/lib/api.ts`.
- Create `src/apps/web/lib/passos-validacao.ts`, `src/apps/web/components/cards/card-validacao-cliente.tsx`; modify `src/apps/web/components/chat/item-conversa.tsx`.
- Create `scripts/gerar_documento_validacao.py`, `scripts/assets/boomer-logo-claro.png`, `scripts/tests/test_gerar_documento_validacao.py`; modify `docker/requirements.txt`.
- Modify `.claude/skills/04-unidade-economica/{SKILL.md,fluxo.mmd}`, `.claude/skills/_shared/{etapas.json,fluxo-geral.mmd,regras-de-validacao.md}`, `.claude/agents/analista-dados.{md,fluxo.mmd}`, `CLAUDE.md`.

---

### Task 1: Núcleo do gate (tipos, funções puras, condições de conclusão)

**Files:**
- Create: `src/packages/core/src/validacao-cliente.ts`
- Modify: `src/packages/core/src/tipos.ts`, `src/packages/core/src/maquina-estados.ts`
- Test: `src/packages/core/test/validacao-cliente.test.ts`; adjust `src/packages/core/test/maquina-estados.test.ts`

**Interfaces:**
- Produces (tipos.ts):
  - `interface ValidacaoCliente { arquivo: string; primeiraGeracaoEm: string; geradoEm: string; baixadoEm: string | null; baixadoPor: string | null; confirmadoEm: string | null; confirmadoPor: string | null }`
  - `Estado.validacaoCliente?: ValidacaoCliente`
  - `Entregavel.etapaConversa?: EtapaId` (etapa do chat onde o card vive, quando difere de `etapa`)
- Produces (validacao-cliente.ts), todas puras:
  - `ARQUIVO_VALIDACAO = "entrega/validacao-cliente/documento-validacao.pdf"`
  - `etapaDaConversa(e: Pick<Entregavel, "etapa" | "etapaConversa">): EtapaId`
  - `entregaveisAntesDaTroca(estado: Estado): Entregavel[]`: vazio sem `validacaoCliente`; senão, aprovados de tipo grafico/tabela/secao das etapas 03 e 04 com `decididoEm` anterior ao maior `atualizadoEm` entre insumos das etapas 03/04 que seja posterior a `primeiraGeracaoEm`.
  - `documentoDefasado(estado: Estado): boolean`: existe aprovado (grafico/tabela/secao, etapas 03/04) com `decididoEm > geradoEm`.
  - `refezTresDepoisDoPdf(estado: Estado): boolean`: insumo da etapa 03 com `atualizadoEm > primeiraGeracaoEm`, ou entregável aprovado com `etapa === "03"` e `decididoEm > primeiraGeracaoEm`.
  - `registrarValidacaoGerada(estado: Estado, em: string): Estado`: exige 04 em_andamento ou pronta e `entregaveisAntesDaTroca` vazio (senão `TransicaoInvalida` listando os títulos); grava `validacaoCliente` mantendo `primeiraGeracaoEm` se já existia; zera baixado/confirmado.
  - `registrarDownloadValidacao(estado, autor: string | null, em): Estado` (exige `validacaoCliente`).
  - `confirmarValidacaoCliente(estado, autor: string | null, em): Estado`: exige documento, `baixadoEm`, não defasado, 04 em_andamento ou pronta; idempotente.
  - `limparConfirmacaoValidacao(estado, em): Estado`
  - `pendenciasValidacao(estado: Estado): string[]`, nesta ordem: `"Gerar o documento de validação do cliente"` (sem documento); `"Gerar de novo o documento de validação: os gráficos mudaram depois dele"` (defasado); um `"Aprovar de novo, depois da troca de dados: <título>"` por item de `entregaveisAntesDaTroca`; `"Baixar o documento de validação"`; `"Confirmar que o cliente validou os dados"`.

- [ ] **Step 1: Write the failing tests** in `validacao-cliente.test.ts`. Use `estadoInicial`, `registrarInsumo`, `proporEntregavel`/`aprovarEntregavel` com datas fixas (`T0 < T1 < …`). Names and assertions:
  - `sem_documento_a_pendencia_e_gerar` : `pendenciasValidacao(e)[0] === "Gerar o documento de validação do cliente"`.
  - `fluxo_normal_nao_marca_grafico_da_03_como_desatualizado`: gráfico da 03 aprovado em T0, insumo `clientes-historico` (04) enviado em T1, PDF gerado em T2 → `entregaveisAntesDaTroca(e)` é `[]` e `registrarValidacaoGerada` não lança.
  - `troca_de_insumo_depois_do_pdf_invalida_o_que_foi_aprovado_antes`: PDF em T2, insumo `historico-mensal` (03) reenviado em T3 → lista contém o gráfico aprovado em T0; `registrarValidacaoGerada(e, T4)` lança `TransicaoInvalida` com o título do gráfico; depois de reaprovar o gráfico em T4 a geração passa.
  - `pdf_novo_zera_download_e_confirmacao_e_preserva_primeira_geracao`: confirma, gera de novo → `baixadoEm === null`, `confirmadoEm === null`, `primeiraGeracaoEm` igual ao antigo.
  - `confirmar_exige_download`: `confirmarValidacaoCliente` sem download lança `TransicaoInvalida`.
  - `confirmar_recusa_pdf_defasado`: aprovação nova em T9 > `geradoEm` → lança; `pendenciasValidacao` inclui a frase de gerar de novo.
  - `confirmar_duas_vezes_nao_quebra`: segunda chamada devolve estado com o mesmo `confirmadoEm`.
  - `mensagem_do_analista_apos_confirmar_desfaz_a_confirmacao_e_mantem_o_download`: via `registrarMensagemAnalista(e, "04", T)` → `confirmadoEm === null`, `baixadoEm` preservado.
  - `condicoesConcluir_da_04_inclui_pendencias_de_validacao_e_pendentes_vindos_da_03`: entregável com `etapa: "03"`, `etapaConversa: "04"`, status pendente aparece como `"Aprovar: <título>"` em `condicoesConcluir(e, "04", cat)`; e não aparece em `condicoesConcluir(e, "03", cat)`.
  - `refezTresDepoisDoPdf` verdadeiro/falso para insumo da 03 trocado depois / antes do PDF.
  - `04_reaberta_sem_validacao_antiga_exige_o_pdf`: concluir a 04 com `validacaoCliente` removido do estado simulando legado, `reabrirEtapa(e, "04", T)` → `condicoesConcluir` contém a pendência de gerar.
- [ ] **Step 2: Run** `cd src/packages/core && npx vitest run test/validacao-cliente.test.ts`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** os tipos e `validacao-cliente.ts` com as assinaturas acima. Em `maquina-estados.ts`: `condicoesConcluir` troca `e.etapa === id` por `etapaDaConversa(e) === id` e, para `id === "04"`, concatena `pendenciasValidacao(estado)` ao fim; `registrarMensagemAnalista` chama `limparConfirmacaoValidacao` quando `id === "04"`. Datas ISO comparadas como string.
- [ ] **Step 4: Fix regressions**: no `maquina-estados.test.ts`, o helper `concluir` passa a, para `etapa === "04"`, aplicar antes de `concluirEtapa` as três transições (`registrarValidacaoGerada`, `registrarDownloadValidacao`, `confirmarValidacaoCliente`) via helper `comValidacaoConfirmada(e)`. Rodar `npx vitest run` no core e ajustar o que mais falhar pelo mesmo motivo (fixtures e testes de serviço que concluem a 04) usando o mesmo helper, em `test/ajuda.ts` se for compartilhado.
- [ ] **Step 5: Run** `cd src/packages/core && npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** `git add docs/superpowers/specs/2026-11-16-validacao-cliente-design.md docs/superpowers/plans/2026-11-16-validacao-cliente.md src/packages/core && git commit -m "feat(core): gate de validação do cliente na etapa 04"`

---

### Task 2: Entregáveis da 03 propostos pela 04 (`etapa_origem`)

**Files:**
- Modify: `src/packages/core/src/entregaveis.ts` (`DadosProposta.etapaConversa?: EtapaId`, gravado só quando difere de `etapa`), `src/packages/core/src/servico-planejamento.ts` (`ferramentaPropor`, `aprovarEntregavel`, `pedirAjuste`, `pedirAjustes`)
- Test: `src/packages/core/test/entregaveis.test.ts`, `src/packages/core/test/servico-planejamento.test.ts`

**Interfaces:**
- Consumes: `etapaDaConversa` (Task 1).
- Produces: `propor_entregavel` aceita `etapa_origem?: "03" | "04"`. Com `"03"`, só vale se a conversa é a da 04, a 03 está concluída e a 04 em andamento ou pronta; senão `ErroEntrada`. O entregável nasce com `etapa: "03"`, `etapaConversa: "04"`; o card (`card_entregavel`) e `reavaliarPronta` vão para a 04; aprovar, pedir ajuste e a fila automática usam `etapaDaConversa(alvo)`.

- [ ] **Step 1: Write the failing tests** (serviço, com `servico` e `catalogoReal` do arquivo existente):
  - `propor com etapa_origem 03 pela conversa da 04 cria entregavel da 03 com card na 04`: `estado.entregaveis.at(-1)` tem `etapa === "03"` e `etapaConversa === "04"`; evento `card_entregavel` gravado na conversa da 04.
  - `aprovar entregavel de origem 03 grava em ativos-aprovados com o prefixo da 03 e enfileira na 04`: seção `nomeFinal: "macro-financeiro"` aprovada vai para `entrega/ativos-aprovados/secoes/03-macro-financeiro.md`; `enfileirados` contém a etapa `"04"`, nunca `"03"`.
  - `pedir ajuste de entregavel da 03 na 04 reabre a 04 sem erro`: `pedirAjuste` não lança e a 04 fica `em_andamento`.
  - `etapa_origem 03 fora da 04 ou com a 04 concluida lanca ErroEntrada com mensagem em portugues`.
  - `etapa_origem invalida (05) lanca ErroEntrada`.
- [ ] **Step 2: Run** `npx vitest run test/servico-planejamento.test.ts -t "etapa_origem"`. Expected: FAIL.
- [ ] **Step 3: Implement.** Em `pedirAjustes`, a checagem `alvo.etapa !== etapa` vira `etapaDaConversa(alvo) !== etapa`.
- [ ] **Step 4: Run** `cd src/packages/core && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/packages/core && git commit -m "feat(core): 04 propõe entregáveis da 03 durante a correção"`

---

### Task 3: Insumos da 03 pedidos e recebidos pela conversa da 04

**Files:**
- Modify: `src/packages/core/src/servico-planejamento.ts` (`insumoDaEtapa`, `ferramentaSolicitar`, `ferramentaRegistrarAnexo`, `registrarResultadoInsumo`), `src/packages/core/src/tipos.ts` (`card_insumo` ganha `etapaInsumo?: EtapaId`)
- Test: `src/packages/core/test/servico-planejamento.test.ts`

**Interfaces:**
- Produces: `private donoDoInsumo(etapaConversa: EtapaId, insumoId: string, estado: Estado): EtapaId`: a própria etapa se o catálogo dela lista o insumo; se `etapaConversa === "04"`, a 04 está em andamento ou pronta e o catálogo da 03 lista o insumo, devolve `"03"`; senão `ErroEntrada` (mensagem atual de "não pertence a esta etapa").
- `solicitar_insumo` na 04 com `historico-mensal` grava `card_insumo` com `etapaInsumo: "03"`. `registrar_insumo_anexado` na 04 registra o insumo na etapa dona (o anexo continua em `.app/anexos/04/`).
- `registrarResultadoInsumo`: quando a etapa dona está concluída e é a 03 com a 04 aberta, a mensagem automática vai para a conversa `"04"` e `reavaliarPronta` roda para a `"04"` (a 04 "pronta" volta a "em andamento" por causa das pendências de `entregaveisAntesDaTroca`).

- [ ] **Step 1: Write the failing tests:**
  - `solicitar_insumo da 03 pela 04 mostra card com etapaInsumo 03`.
  - `solicitar_insumo de insumo de outra etapa fora da 04 continua recusado`.
  - `registrar anexo como historico-mensal pela 04 grava dados/historico-mensal.xlsx e o insumo na etapa 03`: `estado.insumos.find(i => i.etapa === "03" && i.insumoId === "historico-mensal")` válido com `atualizadoEm` novo.
  - `troca de insumo da 03 com a 04 pronta volta a 04 para em_andamento e enfileira na 04` (PDF já gerado e gráfico aprovado antes da troca): `status === "em_andamento"`; `enfileirados` inclui `"04"`.
  - `insumo da 03 recebido sem a 04 aberta nao enfileira nada` (comportamento atual preservado).
- [ ] **Step 2: Run** `npx vitest run test/servico-planejamento.test.ts -t "insumo"`. Expected: FAIL.
- [ ] **Step 3: Implement** `donoDoInsumo` e as três chamadas acima.
- [ ] **Step 4: Run** `cd src/packages/core && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/packages/core && git commit -m "feat(core): 04 pede e recebe insumos da 03 na correção"`

---

### Task 4: Ferramentas e ações do serviço (PDF, download, confirmação, resumo da 03)

**Files:**
- Modify: `src/packages/core/src/servico-planejamento.ts`, `src/packages/core/src/tipos.ts` (`EventoConversa` ganha `{ tipo: "card_validacao_cliente"; em: string }`; `RespostaEstado.validacaoDefasada: boolean`), `src/packages/mcp-planejamento/src/servidor.ts`
- Test: `src/packages/core/test/servico-planejamento.test.ts`

**Interfaces:**
- Produces (serviço):
  - ferramenta `propor_validacao_cliente { arquivo_rascunho: string }`: só na conversa da 04 com a etapa em andamento ou pronta; o arquivo precisa estar em `.app/rascunhos/`, existir e terminar em `.pdf`; copia para `ARQUIVO_VALIDACAO`, aplica `registrarValidacaoGerada`, grava `card_validacao_cliente`, roda `reavaliarPronta`. Erros de `registrarValidacaoGerada` voltam como `{ ok: false, mensagem }` listando os itens a refazer.
  - `async registrarDownloadValidacao(slug: string, autor: string | null): Promise<string>`: grava o download e devolve `ARQUIVO_VALIDACAO`; `ErroNaoEncontrado("O documento de validação ainda não foi gerado.")` sem documento; publica `{ tipo: "estado" }`.
  - `async confirmarValidacaoCliente(slug: string, autor: string | null): Promise<void>`.
  - `sinalizar_etapa_pronta` aceita `resumo_decisoes_03?: string`. Na 04, se `refezTresDepoisDoPdf(estado)` e o campo faltar, retorna `{ ok: false, mensagem }` pedindo o resumo corrigido da 03 e não sinaliza. Com o campo, substitui `etapas["03"].resumoDecisoes` e regrava `contexto/decisoes/03-diagnostico-performance.md` (cabeçalho `# Decisões da etapa 03 · Diagnóstico de performance`, como em `concluirEtapa`).
  - `RespostaEstado.validacaoDefasada` = `documentoDefasado(estado)`.
- Produces (MCP): `propor_validacao_cliente` registrada; `propor_entregavel` ganha `etapa_origem: z.enum(["03","04"]).optional()`; `sinalizar_etapa_pronta` ganha `resumo_decisoes_03: z.string().optional()`; `solicitar_insumo` e `registrar_insumo_anexado` citam, na descrição, que a 04 também pede `historico-mensal` e `produtos-curva-abc` na correção.

- [ ] **Step 1: Write the failing tests:**
  - `propor_validacao_cliente copia o pdf para entrega/validacao-cliente e registra validacaoCliente`: arquivo existe em disco; `geradoEm` preenchido; evento `card_validacao_cliente` na conversa da 04.
  - `propor_validacao_cliente fora da 04 ou com arquivo que nao e pdf devolve ok false`.
  - `propor_validacao_cliente apos troca de insumo lista os itens a refazer`: mensagem contém o título do gráfico.
  - `registrarDownloadValidacao sem documento lanca ErroNaoEncontrado`; com documento grava `baixadoEm` e `baixadoPor`.
  - `confirmarValidacaoCliente exige download` e, concluído o fluxo, `concluirEtapa(slug, "04")` passa (e antes falha com "Ainda falta: ...Baixar o documento de validação...").
  - `sinalizar na 04 apos refazer a 03 sem resumo_decisoes_03 devolve ok false e nao sinaliza`; com o campo, `estado.etapas["03"].resumoDecisoes` muda e o arquivo `contexto/decisoes/03-diagnostico-performance.md` contém o texto novo.
  - `sinalizar na 04 sem correcao nao exige resumo_decisoes_03`.
  - `estado() expoe validacaoDefasada`.
- [ ] **Step 2: Run** `npx vitest run test/servico-planejamento.test.ts -t "validacao"`. Expected: FAIL.
- [ ] **Step 3: Implement** no serviço (despacho em `ferramenta()`), tipos e `servidor.ts` conforme as interfaces. Use `this.arm.copiar` para o PDF.
- [ ] **Step 4: Run** `cd src/packages/core && npx vitest run && npx tsc --noEmit` e `cd ../mcp-planejamento && npx tsc --noEmit` (se houver script `typecheck`). Expected: PASS.
- [ ] **Step 5: Commit** `git add src/packages/core src/packages/mcp-planejamento && git commit -m "feat: ferramenta propor_validacao_cliente, download, confirmação e resumo da 03"`

---

### Task 5: Rotas web (download e confirmação)

**Files:**
- Create: `src/apps/web/app/api/prospects/[slug]/validacao-cliente/download/route.ts`
- Modify: `src/apps/web/app/api/prospects/[slug]/etapas/[etapa]/acoes/route.ts`, `src/apps/web/lib/api.ts` (tipo `AcaoEtapa`)
- Test: `src/apps/web/app/api/prospects/[slug]/validacao-cliente/download/route.test.ts`, `src/apps/web/app/api/rotas-exigem-usuario.test.ts` (atualizar se a lista de rotas for explícita), teste da ação em `.../acoes` seguindo `estado/route.test.ts`

**Interfaces:**
- Consumes: `registrarDownloadValidacao`, `confirmarValidacaoCliente` (Task 4).
- Produces: `GET .../validacao-cliente/download` → PDF com `content-disposition: attachment; filename*=UTF-8''validacao-<slug>.pdf` e `cache-control: no-store`, usando `exigirAcessoAoProspect` e lendo o arquivo como a rota `arquivo` faz; 404 em português sem documento. Ação nova `"confirmar-validacao-cliente"` no `switch` das ações, passando `usuario.email`.

- [ ] **Step 1: Write the failing tests:** `baixar sem documento devolve 404`; `baixar devolve application/pdf, attachment e registra baixadoEm`; `usuario sem acesso ao prospect recebe 403 no download e na confirmacao` (mesmo padrão de `acesso-prospect.test.ts`); `confirmar antes de baixar devolve erro de transicao (status do ErroDominio)`; `confirmar depois de baixar devolve ok`.
- [ ] **Step 2: Run** `cd src/apps/web && npx vitest run app/api`. Expected: FAIL.
- [ ] **Step 3: Implement** as duas rotas e o tipo `AcaoEtapa`.
- [ ] **Step 4: Run** `cd src/apps/web && npx vitest run app/api && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `git add "src/apps/web/app/api" src/apps/web/lib/api.ts && git commit -m "feat(web): rotas de download e confirmação da validação do cliente"`

---

### Task 6: Cards na tela (validação e insumo da 03 na 04)

**Files:**
- Create: `src/apps/web/lib/passos-validacao.ts`, `src/apps/web/lib/passos-validacao.test.ts`, `src/apps/web/components/cards/card-validacao-cliente.tsx`
- Modify: `src/apps/web/components/chat/item-conversa.tsx` (casos `card_validacao_cliente` e `card_insumo` com `etapaInsumo`), `src/apps/web/lib/api.ts`

**Interfaces:**
- Produces: `passosValidacao(v: ValidacaoCliente | undefined, defasado: boolean): { gerado: boolean; baixado: boolean; confirmado: boolean; podeConfirmar: boolean; aviso: string | null }`. `podeConfirmar` só com baixado, não confirmado e não defasado. `aviso` com defasado: `"Os gráficos mudaram depois deste PDF. Peça um novo ao agente."`; sem download: `"Baixe o PDF para liberar a confirmação."`.
- `CardValidacaoCliente({ slug, etapa, validacao, defasado })`: título `Documento de validação do cliente`; três passos `Gerado`, `Baixado`, `Cliente confirmou`; link `Baixar PDF` para `/api/prospects/${slug}/validacao-cliente/download`; botão `Cliente confirmou, sem alterações` (desativado quando `!podeConfirmar`) que chama `api.acaoEtapa(slug, etapa, "confirmar-validacao-cliente")`. Segue o estilo de `card-entregavel.tsx` e as regras do redesign (nenhum confete).
- `item-conversa.tsx`: `card_insumo` usa `evento.etapaInsumo ?? etapa` para achar o insumo no catálogo, o estado do insumo e o envio.

- [ ] **Step 1: Write the failing test** em `passos-validacao.test.ts`: `sem documento tudo falso`; `gerado e nao baixado: podeConfirmar falso com o aviso de baixar`; `baixado: podeConfirmar verdadeiro e aviso nulo`; `confirmado: podeConfirmar falso`; `defasado: podeConfirmar falso com o aviso de PDF novo`.
- [ ] **Step 2: Run** `cd src/apps/web && npx vitest run lib/passos-validacao.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a função, o card e os casos do `item-conversa.tsx`.
- [ ] **Step 4: Run** `cd src/apps/web && npx vitest run && npx tsc --noEmit && npx eslint components lib`. Expected: PASS. Abrir o app local (`PLANEJAMENTO_AUTH=off PLANEJAMENTO_DADOS=fs`, ver memória "Rodar o app local sem a nuvem"), levar um prospect de teste até a 04 e conferir a aparência do card nas larguras de coluna estreita.
- [ ] **Step 5: Commit** `git add src/apps/web && git commit -m "feat(web): card do documento de validação e card de insumo da 03 na 04"`

---

### Task 7: Script que gera o PDF

**Files:**
- Create: `scripts/gerar_documento_validacao.py`, `scripts/assets/boomer-logo-claro.png` (exportar de `src/apps/web/public/marca/boomer-logo-claro.svg`), `scripts/tests/test_gerar_documento_validacao.py`
- Modify: `docker/requirements.txt` (reportlab com versão exata, testada no build amd64 e arm64)
- Referência de layout: `docs/referencias/validacao-cliente/` (o analista copia o PDF da Roberta) e a seção "Geração do PDF" do spec.

**Interfaces:**
- CLI: `python scripts/gerar_documento_validacao.py --input entrada.json --pasta-prospect clientes/<slug> --output clientes/<slug>/.app/rascunhos/documento-validacao.pdf`.
- Entrada JSON: `{ "prospect": str, "periodo": str, "secoes": [{ "titulo": str, "graficos": [{ "arquivo": str, "observacao": str | null }] }], "limitacoes": { "titulo": str, "itens": [{ "titulo": str, "texto": str }] } | null }`. `arquivo` é o nome do PNG em `entrega/ativos-aprovados/graficos/`.
- `class ErroDocumento(Exception)`; `validar_entrada(dados: dict, pasta_prospect: Path) -> None`; `gerar(dados: dict, pasta_prospect: Path, saida: Path) -> Path`; `main(argv: list[str] | None = None) -> int` (0 ok, 1 com a mensagem em português no stderr).
- Layout (ver spec): faixa azul-marinho com logo e "DOCUMENTO DE VALIDAÇÃO PRÉ-APRESENTAÇÃO"; nome do prospect; período; caixa de introdução; seções com filete laranja; gráfico em cartão; "Observação" em caixa amarela; bloco "AUSÊNCIA DO GOOGLE ANALYTICS E LIMITAÇÕES" quando houver `limitacoes`; bloco final azul-marinho "Confirme os dados antes da apresentação"; rodapé `Documento de validação · Boomer | Página N de M`. Seção sem gráfico é omitida.

- [ ] **Step 1: Write the failing tests** (`tmp_path`, PNGs gerados com Pillow):
  - `gera_pdf_valido`: saída começa com `%PDF`, contém o nome do prospect e a palavra `Observação`/`Observacao` (PDF sem compressão no teste via parâmetro interno ou fixture) e `Página 1 de` aparece no rodapé.
  - `observacao_e_opcional`: gráfico com `observacao: null` gera PDF.
  - `secao_sem_grafico_e_omitida`: título da seção vazia não aparece.
  - `limitacoes_nulas_omite_o_bloco`.
  - `grafico_inexistente_vira_erro_e_nao_deixa_pdf`: `ErroDocumento` com o nome do arquivo; `saida.exists()` falso.
  - `observacao_com_email_cpf_ou_telefone_vira_erro`: `"cliente@x.com"`, `"123.456.789-09"`, `"(11) 91234-5678"` recusados; `"R$ 460.703 · 81.2% da receita"` aceito.
  - `muitos_graficos_geram_varias_paginas_com_total_correto`: 8 gráficos, rodapé `de M` com M igual ao número de páginas.
  - `main_devolve_1_e_mensagem_em_portugues_com_json_invalido`.
- [ ] **Step 2: Run** `python3 -m pip install -r docker/requirements.txt && python3 -m pytest scripts/tests/test_gerar_documento_validacao.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** com reportlab (platypus + canvas numerado em duas passagens para "Página N de M"); gravar em arquivo temporário e mover para `saida` só no sucesso. Fontes padrão do reportlab com acentos em português.
- [ ] **Step 4: Run** `python3 -m pytest scripts/tests/test_gerar_documento_validacao.py -v`. Expected: PASS. Gerar um PDF com os gráficos de `clientes/adda-demo` e conferir visualmente contra o exemplo.
- [ ] **Step 5: Verificar o build** `docker build` local ou o procedimento da VPS (memória "Deploy na nuvem") instala o reportlab em amd64 e arm64.
- [ ] **Step 6: Commit** `git add scripts docker/requirements.txt && git commit -m "feat(scripts): gera o PDF do documento de validação"`

---

### Task 8: Skill 04, fluxogramas, catálogo e regras

**Files:**
- Modify: `.claude/skills/04-unidade-economica/SKILL.md`, `.claude/skills/04-unidade-economica/fluxo.mmd`, `.claude/skills/_shared/etapas.json`, `.claude/skills/_shared/fluxo-geral.mmd`, `.claude/skills/_shared/regras-de-validacao.md`, `.claude/agents/analista-dados.md`, `.claude/agents/analista-dados.fluxo.mmd`, `CLAUDE.md`
- Test: `src/apps/web/lib/fluxos.test.ts`, `src/packages/core/test/catalogo-skills.test.ts`, `src/packages/core/test/catalogo.test.ts`

**Interfaces:** nenhuma de código. Conteúdo exigido:
- `SKILL.md` da 04: novo passo final "Documento de validação do cliente" (montar o JSON com as seções e observações a partir dos dados aprovados da 03 e da 04, rodar o script com `--output` em `.app/rascunhos/`, chamar `propor_validacao_cliente`, chamar `sinalizar_etapa_pronta` e encerrar); seção "Correções pedidas pelo cliente" (descobrir a origem do erro; erro em dado da 03: pedir o insumo com `solicitar_insumo`, refazer com o `analista-dados` e propor com `etapa_origem: "03"` as peças da 03 que mudam, e regerar tudo que depende; depois de qualquer correção, gerar PDF novo; enviar `resumo_decisoes_03` ao sinalizar; registrar "Correções pedidas pelo cliente" no resumo da 04); critério de conclusão e handoff atualizados (analista baixa o PDF, leva ao cliente, volta e confirma; o handoff para a 05 continua dizendo que não há arquivo novo). Modo terminal: gerar em `entrega/validacao-cliente/` e pedir a confirmação no chat.
- `etapas.json` (04): `"subagentes": ["analista-dados"]` e `oQueEsperar` avisando que a etapa termina com o PDF para o cliente conferir e que correções se apontam no chat.
- `fluxo.mmd` da 04: nós "Gerar o PDF de validação para o cliente", decisão `"Analista aprova?"` (classe `checkpoint`, saídas `sim` e `não, ajustar`) ligada ao laço de correção, `analista-dados` em azul, entrega em verde; três `classDef` no fim.
- `regras-de-validacao.md`: Regra 7 cita `propor_validacao_cliente`, `etapa_origem` e `resumo_decisoes_03`; nova Regra 9 descreve a validação do cliente.

- [ ] **Step 1: Write the failing check**: rodar `cd src/packages/core && npx vitest run test/catalogo-skills.test.ts test/catalogo.test.ts` depois de editar só o `etapas.json`; se algum teste fixa os subagentes da 04, ele falha e mostra o que ajustar.
- [ ] **Step 2: Edit** todos os arquivos acima, na mesma mudança.
- [ ] **Step 3: Run** `cd src/apps/web && npx vitest run lib/fluxos.test.ts` e `cd src/packages/core && npx vitest run test/catalogo-skills.test.ts test/catalogo.test.ts test/sem-travessao.test.ts`. Expected: PASS.
- [ ] **Step 4: Run** a suíte completa: `cd src/packages/core && npm test` e `cd src/apps/web && npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git add .claude CLAUDE.md && git commit -m "feat(skills): etapa 04 gera o documento de validação e trata correções do cliente"`

---

## Self-review

- **Cobertura do spec:** fluxo do analista (Tasks 4 a 6); estado, pendências e desatualização (Task 1); troca de insumo da 03 (Task 3); entregáveis da 03 (Task 2); resumo da 03 e registro das correções (Tasks 4 e 8); PDF e layout (Task 7); rotas e tela (Tasks 5 e 6); skill, MCP, fluxos, `etapas.json`, Regra 7 (Tasks 4 e 8); modo terminal (Task 8); prospects em andamento entram na regra e concluídos não (Task 1, pois `condicoesConcluir` só vale ao concluir); `analista-dados` na 04 e suas atualizações de fluxo (Task 8).
- **Correções ao spec feitas na redação do plano:** a regra de troca de insumo só conta depois da primeira geração (evitava falso positivo no fluxo normal); observação por gráfico é opcional (como no exemplo); mensagem do analista desfaz a confirmação.
- **Consistência de nomes:** `etapaDaConversa`, `entregaveisAntesDaTroca`, `documentoDefasado`, `refezTresDepoisDoPdf`, `ARQUIVO_VALIDACAO`, `registrarValidacaoGerada`, `registrarDownloadValidacao`, `confirmarValidacaoCliente`, `limparConfirmacaoValidacao`, `pendenciasValidacao` usados igual nas Tasks 1 a 6.
