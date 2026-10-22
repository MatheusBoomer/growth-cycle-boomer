# Conversa no chat principal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o card "Pergunta do agente" e mover o "Pedir ajuste" para o chat principal como anexo (referência) acima da caixa de mensagem, para o analista conversar em texto com o agente.

**Architecture:** Duas partes independentes. A Parte A remove a ferramenta `fazer_perguntas` de ponta a ponta e mantém só a leitura do histórico antigo. A Parte B troca o campo de texto do "Pedir ajuste" por uma referência em memória (por etapa) que viaja com a mensagem do chat; o servidor valida, grava o ajuste e monta a mensagem longa para o agente. A Parte A pode ser entregue sozinha.

**Tech Stack:** TypeScript, Next.js (`src/apps/web`), vitest, servidor MCP em `src/packages/mcp-planejamento`, serviços em `src/packages/core`. Skills em `.claude/skills/`.

**Spec:** `docs/superpowers/specs/2026-10-22-conversa-no-chat-design.md` (numeração "decisão N" abaixo = itens 1 a 14 da spec).

## Global Constraints

- Cor só por token (teste de paleta); sem travessão fora de intervalo numérico (teste `sem-travessao`) nos arquivos de `src/`.
- Textos e nomes em português.
- O `next dev` mantém os serviços em memória; código de servidor novo precisa que os serviços sejam recriados (já tratado em `apps/web/lib/servidor.ts`).
- Roteiro e apresentação final mantêm o comentário por slide; citar trecho, @ de arquivo e anexar arquivo não mudam; Aprovar continua sendo o botão do card.
- Imagem anotada: `.app/ajustes/<id>/ajuste-N.png`, fora da Biblioteca, gravada só depois da validação.
- Baseline antes de começar: `packages/core` 229 testes e `apps/web` 190 testes passando.
- Comandos de teste: `cd src/packages/core && npx vitest run`, `cd src/apps/web && npx vitest run`, tipos com `cd src && npm run typecheck`.

## Review Focus

- Agente ainda tenta chamar `fazer_perguntas` (resposta antiga em sessão em andamento): a ferramenta some e o servidor MCP devolve erro legível, sem quebrar o turno.
- `estado.json` de prospect existente (adda, adda-demo, sottile-*) com `perguntas` preenchido: carrega sem erro e o histórico aparece como leitura.
- Conjunto `pendente` antigo: aparece como "sem resposta" no histórico, sem botão.
- Duas referências na mesma mensagem: marcações numeradas de forma contínua (A: 1 e 2, B: 3).
- Entregável deixa de estar pendente entre o clique em "Pedir ajuste" e o envio: o envio inteiro falha, nada é enviado e nenhuma imagem fica órfã.
- Recarregar a página com referência não enviada: navegador avisa antes de sair.

---

# Parte A · Acabar com o card de perguntas

### Task 1: O agente passa a perguntar no chat (ferramenta, instruções, skills)

Tudo na mesma tarefa para o agente nunca ser instruído a chamar uma ferramenta que não existe.

**Files:**
- Modify: `src/packages/core/src/prompts.ts:18` (regra da ferramenta)
- Modify: `src/packages/mcp-planejamento/src/servidor.ts:82-110` (remove o registro de `fazer_perguntas`)
- Modify: `src/packages/core/src/servico-planejamento.ts` (remove `ferramentaPerguntar`, o `if` em `ferramenta`, o import de `lerPerguntas` e `criarConjunto`)
- Modify: `src/packages/core/src/executor/fake.ts:32,60-` (remove o `demo:perguntar`)
- Modify: `.claude/skills/_shared/regras-de-validacao.md:93,105-113`, `.claude/skills/02-contextualizacao-estrategica/SKILL.md:44-54`, `.claude/skills/05-solucoes/SKILL.md:45-49`
- Test: `src/packages/core/test/prompts.test.ts`, `src/packages/core/test/servico-planejamento.test.ts`

**Interfaces:**
- Produces: `ferramenta(ctx, "fazer_perguntas", ...)` devolve `{ ok: false, mensagem: "Ferramenta desconhecida: fazer_perguntas" }` (caminho que já existe para nome desconhecido).

- [ ] **Step 1: Escrever os testes que falham**
  - `prompts.test.ts`, teste `"manda perguntar no chat, em texto, uma por vez"`: `systemPromptModoInterface(...)` não contém `fazer_perguntas` e contém `"uma pergunta por vez"` e `"sua recomendação"`.
  - `servico-planejamento.test.ts`: troque os 7 testes do bloco "fazer_perguntas" (linhas ~600-720) por um só, `"fazer_perguntas deixou de existir"`: `ferramenta(ctx03, "fazer_perguntas", { perguntas: [] })` retorna `ok: false` com `"desconhecida"` e `(await servico.estado(slug)).perguntas` continua `[]`. Os testes de resposta (`responderPerguntas`) saem na Task 2; deixe-os por enquanto e apague só os que dependem de `comPerguntas()` junto na Task 2.
- [ ] **Step 2: Rodar e ver falhar** — `cd src/packages/core && npx vitest run test/prompts.test.ts test/servico-planejamento.test.ts`; esperado: os dois novos falham.
- [ ] **Step 3: Implementar**
  - `prompts.ts`: a linha de `fazer_perguntas` vira: pergunte no chat, em texto, uma pergunta por vez, com a sua recomendação quando houver, e espere a resposta; nunca liste várias perguntas de uma vez. Sem travessão.
  - Remover a ferramenta do servidor MCP, de `ferramenta()` e de `fake.ts`.
  - Skills: `regras-de-validacao.md` perde `fazer_perguntas` da lista de ferramentas e o item "Decisões entre alternativas" vira "pergunte no chat, em texto, uma por vez, com recomendação". Skill 02: bloco 5 passa a fazer as 10 perguntas estratégicas no chat, uma por vez (o analista responde cada uma; só então a próxima). Skill 05: a ordem dos problemas é pedida no chat, um problema por linha (`P1 …`, `P2 …`) na mensagem.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando; esperado: PASS. Depois `cd src && npm run typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat: agente pergunta no chat; remove a ferramenta fazer_perguntas"`.

### Task 2: Remover resposta, rota e módulo de perguntas

**Files:**
- Delete: `src/packages/core/src/perguntas.ts`, `src/packages/core/test/perguntas.test.ts`
- Delete: `src/apps/web/app/api/prospects/[slug]/perguntas/[id]/route.ts`
- Modify: `src/packages/core/src/servico-planejamento.ts` (remove `responderPerguntas` e import de `./perguntas`)
- Modify: `src/packages/core/src/prompts.ts` (remove `mensagemRespostas`)
- Modify: `src/apps/web/lib/api.ts:60-61` (remove `responderPerguntas`; tira `RespostaPergunta` do import)
- Modify: `src/packages/core/test/servico-planejamento.test.ts` (apaga os testes de responder e `comPerguntas`)

**Interfaces:**
- Mantém em `tipos.ts`: `Pergunta`, `RespostaPergunta`, `StatusPerguntas`, `ConjuntoPerguntas`, `Estado.perguntas`, evento `card_perguntas` (a leitura do histórico depende deles; só o comentário do tipo muda para "histórico, ferramenta removida").

- [ ] **Step 1: Teste de leitura do histórico que deve continuar passando** — em `armazenamento.test.ts`: `estado.json` com `perguntas` preenchido (uma `respondida`, uma `pendente`) é lido e devolvido intacto; estado sem o campo vira `perguntas: []` (já existe, `armazenamento.ts:133`).
- [ ] **Step 2: Apagar os arquivos e métodos acima**; `npm run typecheck` mostra o que sobrar referenciando.
- [ ] **Step 3: Rodar `core` e `web`** — esperado: tudo passa; contagem de testes cai pelos removidos.
- [ ] **Step 4: Commit** — `git commit -m "refactor: remove rota, serviço e módulo de resposta de perguntas"`.

### Task 3: Histórico de perguntas só leitura no chat

**Files:**
- Create: `src/apps/web/components/cards/historico-perguntas.tsx` (exporta `HistoricoPerguntas({ conjunto })`)
- Modify: `src/apps/web/components/chat/item-conversa.tsx:13,131-139`
- Delete: `src/apps/web/components/cards/card-perguntas.tsx`, `src/apps/web/lib/descricao-pergunta.ts`, `src/apps/web/lib/descricao-pergunta.test.ts`
- Delete: `src/packages/ui/src/components/question.tsx` (só o card o usava; confirmar com `grep -rn "components/question" src --include='*.tsx' --exclude-dir=node_modules`)
- Modify: `src/apps/web/lib/servidor.ts:36` (o comentário cita `fazer_perguntas`; troque o exemplo por outra regra do serviço)
- Test: `src/apps/web/lib/historico-perguntas.test.ts` com a função pura abaixo

**Interfaces:**
- Produces: `linhasDoHistorico(c: ConjuntoPerguntas): { enunciado: string; resposta: string }[]` em `src/apps/web/lib/historico-perguntas.ts`. Resposta = selecionadas e `outra` unidas por `"; "`; conjunto `respondida` sem resposta de uma pergunta ou conjunto `pendente`/`sem_resposta` devolve `resposta: "sem resposta"`.

- [ ] **Step 1: Teste** — para um conjunto `respondida` com `selecionadas: ["Realista"]` e `outra: "testar TikTok"` → `"Realista; testar TikTok"`; para `pendente` → todas `"sem resposta"`.
- [ ] **Step 2: Rodar e ver falhar** — `cd src/apps/web && npx vitest run lib/historico-perguntas.test.ts`.
- [ ] **Step 3: Implementar** a função e o componente (lista de pergunta em negrito + resposta em texto comum, sem botões, sem estado). Em `item-conversa.tsx`, `card_perguntas` renderiza `HistoricoPerguntas` (sem o cálculo de `bloqueado`).
- [ ] **Step 4: Rodar `web` e `typecheck`; abrir o app (`preview_start`) num prospect antigo que tenha perguntas** e conferir o histórico em leitura. Esperado: sem erro no console.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): histórico de perguntas só leitura; remove o card de perguntas"`.

---

# Parte B · Pedir ajuste como anexo no chat

### Task 4: Marcas sem texto e numeração contínua (função pura)

**Files:**
- Modify: `src/apps/web/lib/anotacoes.ts` (remove `texto` de `Marca`; remove `podeEnviar`; ajusta `textoDoPedido`)
- Modify: `src/apps/web/lib/anotacoes.test.ts`
- Modify: `src/apps/web/lib/anotacoes-canvas.ts` (desenha o número com `inicio`)

**Interfaces:**
- Produces: `descreverMarcacoes(marcas: Marca[], primeiroNumero: number): string[]` — uma linha por marca: `"${n}. ${ROTULO_FORMA[forma]} em ${ondeEstaMarca(m)}"` (sem texto do analista).
- Produces: `renderizarAnotada(urlImagem: string, marcas: Marca[], primeiroNumero?: number): Promise<string>` (PNG em base64; `primeiroNumero` default 1).
- Produces: `faixaDeMarcacoes(primeiro: number, quantidade: number): string` — `"marcações 3 a 4"`, `"marcação 3"` ou `""` quando zero.

- [ ] **Step 1: Testes** — `descreverMarcacoes([retângulo, número], 3)` começa em `"3. Retângulo em área de…"` e termina em `"4. Número em ponto a…"`; `faixaDeMarcacoes(3, 2)` = `"marcações 3 a 4"`, `(1, 1)` = `"marcação 1"`, `(1, 0)` = `""`.
- [ ] **Step 2: Rodar e ver falhar**, **Step 3: implementar**, **Step 4: rodar e ver passar** (`npx vitest run lib/anotacoes.test.ts`).
- [ ] **Step 5: Commit** — `feat(web): marcações numeradas sem texto e com numeração contínua`.

### Task 5: Serviço e rota: envio da mensagem com ajustes

**Files:**
- Modify: `src/packages/core/src/tipos.ts` (evento `mensagem_analista` ganha `referencias?: ReferenciaAjuste[]`)
- Modify: `src/packages/core/src/prompts.ts` (`mensagemAjuste` vira a mensagem composta)
- Modify: `src/packages/core/src/servico-planejamento.ts` (substitui `pedirAjuste` por `pedirAjustes`)
- Modify: `src/packages/core/src/servico-turnos.ts:174` (`enviarMensagem` aceita texto do agente separado do texto do balão)
- Modify: `src/apps/web/app/api/prospects/[slug]/etapas/[etapa]/mensagens/route.ts`; remove a ação `ajuste` de `.../entregaveis/[id]/route.ts` e o `lerImagem` de lá (move para a rota de mensagens)
- Modify: `src/apps/web/lib/api.ts` (`enviarMensagem(slug, etapa, texto, ajustes?)`; remove `pedirAjuste`)
- Test: `src/packages/core/test/servico-planejamento.test.ts`, `src/packages/core/test/prompts.test.ts`, `src/packages/core/test/servico-turnos.test.ts`

**Interfaces:**
- Produces (`tipos.ts`): `interface ReferenciaAjuste { entregavelId: string; titulo: string; marcacoes: number; primeiraMarcacao: number }`.
- Produces (`servico-planejamento.ts`): `type AjusteEnvio = { entregavelId: string; marcas: { forma: FormaMarca; x: number; y: number; w: number; h: number }[]; imagem?: Uint8Array }` e `pedirAjustes(slug: string, etapa: EtapaId, texto: string, ajustes: AjusteEnvio[]): Promise<{ textoAgente: string; referencias: ReferenciaAjuste[] }>`. Valida todos antes de gravar qualquer coisa: cada `entregavelId` deve ser da `etapa` e `pendente`, senão `TransicaoInvalida` e nada é gravado nem enviado; texto em branco com ajustes é `ErroEntrada("Escreva o que mudar.")` (decisão 4). Grava `ajustePedido = texto` em cada entregável (decisão 9), a imagem em `.app/ajustes/<id>/ajuste-N.png` só depois de validar (decisão 13), numera marcas de forma contínua entre ajustes (decisão 10).
- Produces (`prompts.ts`): `mensagemAjustes(texto: string, itens: { titulo: string; nomeFinal: string; marcas: string[]; imagem?: string }[]): string`, com o texto do analista seguido, por item, de `AJUSTE no entregável “título” (nome_final): refaça, salve em .app/rascunhos/ e proponha de novo com o mesmo nome_final`, a lista numerada das marcações e `abra <caminho> com Read`.
- Produces (`servico-turnos.ts`): `enviarMensagem(slug, etapa, texto, extra?: { textoAgente?: string; referencias?: ReferenciaAjuste[] })`; o evento guarda `texto` e `referencias`, o executor recebe `textoAgente ?? texto`.
- Rota de mensagens aceita `{ texto, ajustes?: { entregavelId, marcas, imagem?: string /* PNG base64 */ }[] }`; limites de imagem (8 MB, assinatura PNG) iguais aos de hoje.

- [ ] **Step 1: Testes** — (a) `pedirAjustes` com dois gráficos (2 e 1 marca) devolve `referencias` com `primeiraMarcacao` 1 e 3, e `textoAgente` contém `"3. Número"`; (b) um entregável `aprovado` no meio da lista → rejeita com `TransicaoInvalida`, nenhum `ajustePedido` gravado e `.app/ajustes/` inexistente; (c) texto em branco com ajuste → `ErroEntrada`; (d) `mensagemAjustes` contém `"proponha de novo com o mesmo nome_final"` e o caminho `clientes/<slug>/.app/ajustes/<id>/ajuste-1.png`; (e) `enviarMensagem` com `textoAgente` registra o evento com o texto curto e entrega o longo ao executor.
- [ ] **Step 2: Rodar e ver falhar**, **Step 3: implementar** conforme as interfaces (reaproveita `pedirAjuste` de `entregaveis.ts`, que já recusa não pendente), **Step 4: rodar `core` e `web` e `typecheck`**.
- [ ] **Step 5: Commit** — `feat: mensagem do chat aceita pedidos de ajuste com marcações`.

### Task 6: Referências no compositor (estado em memória por etapa)

**Files:**
- Create: `src/apps/web/components/chat/contexto-referencias.tsx`
- Create: `src/apps/web/lib/referencias.ts` (lógica pura) e `src/apps/web/lib/referencias.test.ts`
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx` (monta o provedor ao redor de `ContextoVisualizador.Provider`, ~linha 255)
- Modify: `src/apps/web/components/chat/compositor.tsx` (etiquetas acima da caixa, envio com `ajustes`, bloqueio sem texto, `beforeunload`)
- Modify: `src/apps/web/components/chat/etiqueta-anexo.tsx` (variante com ícone do tipo)

**Interfaces:**
- Produces (`referencias.ts`): `interface Referencia { entregavelId: string; titulo: string; tipo: TipoEntregavel; urlImagem: string | null; marcas: Marca[] }`; `adicionarReferencia(lista: Referencia[], nova: Referencia): Referencia[]` (não duplica o mesmo `entregavelId`); `removerReferencia(lista, entregavelId)`; `numerar(lista: Referencia[]): { entregavelId: string; primeira: number; quantidade: number }[]`; `descartarSuperadas(lista: Referencia[], pendentesAtuais: string[]): { lista: Referencia[]; descartadas: number }` (decisão 5 e 11).
- Produces (`contexto-referencias.tsx`): `useReferencias(etapa: EtapaId): { referencias: Referencia[]; adicionar(r: Referencia): void; remover(id: string): void; marcar(id: string, marcas: Marca[]): void; limpar(): void }`; guarda por etapa em um `Map`, sobrevive à troca de card e de etapa durante a sessão.

- [ ] **Step 1: Testes** — `adicionarReferencia` não duplica; `numerar` com marcas 2 e 1 dá `primeira` 1 e 3; `descartarSuperadas` remove a referência cujo entregável não está mais entre os pendentes e conta 1.
- [ ] **Step 2: Rodar e ver falhar**, **Step 3: implementar**. No compositor: `podeEnviar` exige texto não vazio quando há referência (decisão 4); com o agente rodando a referência fica na caixa e o envio segue as regras atuais (decisão 12); `beforeunload` ativo enquanto houver referência (decisão 11); ao descartar por nova versão, `toast.info("A versão mudou; as marcações antigas foram descartadas")` e o texto digitado não é tocado.
- [ ] **Step 4: Rodar `web` e `typecheck`.**
- [ ] **Step 5: Commit** — `feat(web): referências de ajuste acima da caixa de mensagem`.

### Task 7: "Pedir ajuste…" no card vira referência; marcar na imagem

**Files:**
- Modify: `src/apps/web/components/cards/card-entregavel.tsx` (remove `ajusteAberto`, `texto`, `enviarAjuste` e a `Textarea`)
- Rename: `src/apps/web/components/cards/editor-ajuste.tsx` → `marcador-imagem.tsx` (`MarcadorImagem`, sem textareas por marca, sem botão de enviar)
- Modify: `src/apps/web/components/chat/compositor.tsx` (clicar na etiqueta de gráfico/tabela reabre o modo de marcar; envio desenha o PNG com `renderizarAnotada(url, marcas, primeira)`)
- Test: `src/apps/web/lib/anotacoes.test.ts` (já cobre a função pura); verificação visual no app

**Interfaces:**
- Consumes: `useReferencias` e `numerar` (Task 6), `renderizarAnotada` e `faixaDeMarcacoes` (Task 4).
- Produces: `MarcadorImagem({ titulo, urlImagem, marcas, primeiroNumero, aoMudar, aoFechar })`. Em `grafico` e `tabela` o card entra em modo de marcar e a referência mostra `· N marcações`; nos demais tipos o clique só adiciona a referência (sem modo de marcar) e dá foco à caixa de mensagem. O botão **Pedir ajuste…** continua escondido em etapa concluída ou desatualizada.

- [ ] **Step 1: Implementar** os componentes conforme as interfaces. Cor só por token (`bg-destructive`, etc., como no editor atual).
- [ ] **Step 2: Verificar no app** (`preview_start`, prospect de demonstração com `PLANEJAMENTO_EXECUTOR=demo`): pedir ajuste em dois gráficos, marcar 2 e 1, conferir etiquetas "marcações 1 a 2" e "marcação 3", enviar com texto e confirmar o balão e o card ("Ajuste pedido … aguardando a nova versão"). Mensagem sem texto fica bloqueada. Capturar tela como prova.
- [ ] **Step 3: Rodar `web` e `typecheck`.**
- [ ] **Step 4: Commit** — `feat(web): pedir ajuste vira referência no chat; marcação sobre a imagem`.

### Task 8: Balão com as referências e fim da limpeza

**Files:**
- Modify: `src/apps/web/components/chat/item-conversa.tsx` (balão mostra o texto do analista e etiquetas das referências, decisão 9)
- Modify: `src/apps/web/components/chat/etiqueta-anexo.tsx`
- Modify: `CLAUDE.md` do projeto e `src/packages/core/src/tipos.ts` (comentário de `ConjuntoPerguntas`), se citarem o card de perguntas
- Modify: `docs/superpowers/specs/2026-10-22-conversa-no-chat-design.md` (marcar o que foi entregue)

- [ ] **Step 1: Implementar** o balão: `evento.referencias` vira `EtiquetaAnexo` com título e `faixaDeMarcacoes(primeiraMarcacao, marcacoes)`; recarregar a página mostra as mesmas etiquetas.
- [ ] **Step 2: Busca final** — `grep -rn "fazer_perguntas\|CardPerguntas\|responderPerguntas\|mensagemRespostas\|EditorAjuste" src .claude CLAUDE.md --include='*.ts' --include='*.tsx' --include='*.md' --exclude-dir=node_modules --exclude-dir=.next` não deve achar nada fora de `docs/`.
- [ ] **Step 3: Suíte completa** — `cd src && npm run test && npm run typecheck && npm run lint`; esperado: tudo passa.
- [ ] **Step 4: Commit** — `feat(web): balão do chat mostra as referências de ajuste`.

---

## Self-Review

- **Cobertura da spec:** objetivos 1 (Tasks 1 a 3), 2 e 3 (Tasks 4 a 8); decisões 1 a 5 e 12 (Task 6, 7), 3 e 13 (Task 5), 6 (Task 1), 7 (Tasks 2 e 3), 8 (Tasks 2, 3 e 5), 9 (Tasks 5 e 8), 10 (Tasks 4 e 5), 11 (Task 6), 14 (Task 7: só no card). Não objetivos respeitados.
- **Ordem:** Task 1 antes da 2 porque o agente não pode ser instruído a usar a ferramenta enquanto o resto é desmontado; Parte B depende só das Tasks 4 e 5 entre si.
- **Fora do plano:** marcar no visualizador da coluna larga (decisão 14).
