# Ajustes estéticos da execução das etapas e da apresentação — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os 8 apontamentos do analista: seis na interface web (botão, respiro do chat, histórico de ações, rolagem dos entregáveis, coluna 3, modal "Ampliar") e dois no gerador do `.pptx` (Jornada e imagens pequenas).

**Architecture:** Bloco A mexe só em componentes e libs de `src/apps/web` (mais uma lib nova de frases). Bloco B adiciona um módulo `scripts/layout_slides.py` que ajusta a geometria dos slides na hora de gerar, sem alterar o molde `.pptx`. Os dois blocos são independentes e podem ser feitos em qualquer ordem.

**Tech Stack:** Next.js (App Router) + React + Tailwind + Base UI (`@workspace/ui`), vitest (`jsdom` onde o teste monta o componente), Python 3 com `python-pptx`, Pillow e pytest.

**Spec:** `docs/superpowers/specs/2026-11-17-ajustes-esteticos-execucao-design.md`

## Global Constraints

- Trabalhar na worktree `.claude/worktrees/ajustes-esteticos`, branch `fix/ajustes-esteticos`. Antes de cada commit: `git branch --show-current` deve imprimir `fix/ajustes-esteticos` (outra sessão pode ter trocado a branch).
- Um commit por apontamento. A mensagem termina com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Textos de interface e comentários em português; nomes de código no padrão do repositório (português sem acento).
- `src/apps/web/AGENTS.md`: este Next.js tem mudanças incompatíveis. Nenhuma tarefa usa API nova do Next; só classes, estado de componente cliente e `Dialog` já usado no projeto.
- Valores fixos do spec: respiro do chat `pb-14` (degradê de `h-12`); modal `h-[92vh]` e `sm:max-w-[min(96vw,1500px)]`; limite da faixa larga: proporção (largura/altura) **maior que 2,8**; área da imagem x 34–97%, y 7–92% do slide; coluna de texto de x 4,4% a 31%; caixa de item da Jornada com 420 000 EMU de altura, centrada na seta.
- Não alterar `packages/core/src/atividade.ts`, o molde `.pptx` nem skills.
- Testes do web: `cd src/apps/web && npx vitest run <arquivo>`. Testes Python: `python3 -m pytest scripts/tests/<arquivo> -q` a partir da raiz da worktree.

## Review Focus

1. **Pedido de ajuste pendente:** com `ajustePedido` preenchido, o botão Aprovar do modal fica desabilitado, como no card (Task 6).
2. **Imagens de proporção extrema:** quadrada, muito alta (400×700) e exatamente no limite 2,8 não estouram a área nem a coluna (Task 8).
3. **Eventos antigos do log:** `Rodando: cd "/Users/…/clientes/x" && python3 scripts/…` e caminhos absolutos nunca vazam para a frase amigável (Task 3).
4. **Layout salvo incoerente:** layout salvo "com visualizador" com `painel` 0 e painel aberto agora (e o inverso), com soma 100 e sem coluna negativa (Task 5).
5. **Molde inesperado na Jornada:** sem 5 setas ou sem a caixa de 5 itens, a geração não quebra: avisa e deixa o slide como está; e a numeração sai 1 a 5, não "1." cinco vezes (Task 7).

---

## Bloco A — Interface web

### Task 1: Painel da etapa — rolagem dos entregáveis (A4) e botão que quebra linha (A1)

**Files:**
- Modify: `src/apps/web/components/trabalho/painel-etapa.tsx` (o `<aside>` e o `<Button className="w-full" …>` de "Concluir etapa e ir para …")
- Test: `src/apps/web/components/trabalho/painel-etapa.test.ts`

**Interfaces:** nenhuma nova.

- [ ] **Step 0: Preparar o ambiente.** `cd src && npm ci`. Esperado: termina sem erro e `src/node_modules` existe.
- [ ] **Step 1: Teste que falha (A4).** Em `painel-etapa.test.ts`, novo `it("o aside ocupa a altura da coluna, para a área de entregáveis rolar em vez de ser cortada")`: renderiza com o helper `html(...)` e espera `/<aside[^>]*class="[^"]*\bh-full\b/`.
- [ ] **Step 2: Teste que falha (A1).** Outro `it("o botão de concluir deixa o rótulo longo quebrar linha")`: com `html([], true)` (condição "pronto"), a tag `<button` que contém `Concluir etapa e ir para 05 · Soluções` tem as classes `whitespace-normal`, `h-auto` e `text-balance`.
- [ ] **Step 3: Rodar** `npx vitest run components/trabalho/painel-etapa.test.ts`. Esperado: os 2 novos falham.
- [ ] **Step 4: Implementar.** `<aside className="flex h-full min-h-0 flex-col">`. No botão de concluir do painel acrescentar `h-auto min-h-8 py-2 text-center whitespace-normal text-balance` (o `Button` base tem `whitespace-nowrap`, o `cn` do projeto resolve o conflito). Não mexer no botão de `fim-da-etapa.tsx`.
- [ ] **Step 5: Rodar** o arquivo de teste inteiro e `painel-etapa-concluir.test.ts`. Esperado: tudo passa.
- [ ] **Step 6: Commits** (dois, na ordem): `fix(web): entregáveis da etapa rolam quando a divisão com o arquivo corta o painel` e `fix(web): botão de concluir quebra o rótulo longo em vez de vazar`. Se as duas mudanças ficaram no mesmo arquivo, usar `git add -p` para separar.

### Task 2: Respiro no fim do chat (A2)

**Files:**
- Modify: `src/apps/web/components/chat/chat-etapa.tsx` (`MessageScrollerContent`)
- Test: `src/apps/web/components/chat/chat-visual.test.ts`

- [ ] **Step 1: Teste que falha.** Em `chat-visual.test.ts`, dentro de `describe("chat como no protótipo")`: `it("o fim da conversa tem respiro maior que o degradê de baixo, para a última linha não ficar sob a sombra")` espera `chat` casar `/<MessageScrollerContent className="[^"]*\bpb-14\b/`.
- [ ] **Step 2: Rodar** `npx vitest run components/chat/chat-visual.test.ts`. Esperado: falha.
- [ ] **Step 3: Implementar.** Acrescentar `pb-14` depois de `p-4` no `className` de `MessageScrollerContent` (o `cn` faz o `pb-14` vencer o `p-4` embaixo). Manter os dois `data-slot="desfoque-chat"`.
- [ ] **Step 4: Rodar** `chat-visual.test.ts` e `chat-etapa.test.ts`. Esperado: passam (o teste "desfoque nas bordas" continua com 2 ocorrências).
- [ ] **Step 5: Commit** `fix(web): respiro no fim do chat para a última linha não ficar sob a sombra`.

### Task 3: Frases amigáveis do agente (A3, parte 1)

**Files:**
- Create: `src/apps/web/lib/frases-do-agente.ts`
- Test: `src/apps/web/lib/frases-do-agente.test.ts`

**Interfaces:**
- Produces: `export type PassoDeAtividade = Extract<import("./passos").EventoProcesso, { tipo: "atividade" }>` e `export function fraseDoPasso(passo: PassoDeAtividade, posicao: number): string`. É pura e determinística: a variação é `pool[posicao % pool.length]`.

Categorias, em ordem de decisão (a primeira que casar vence; `nome` é `passo.nome`, `d` é `passo.detalhe`):

| Categoria | Casa quando | Variações |
|---|---|---|
| skill | `nome === "Skill"` | "Abrindo o manual da etapa", "Consultando o passo a passo da agência" |
| subagente | `nome` é `Agent` ou `Task` | `d` com `analista-dados` → "Chamando o analista de dados"; com `pesquisador-benchmark` → "Chamando o pesquisador de mercado"; senão "Chamando um especialista" |
| meta | `d` começa com "Coletando anúncios" | "Garimpando anúncios na Biblioteca do Meta" |
| canva | `nome` contém `Canva` | "Montando no Canva" |
| regras | `nome === "Read"` e `d` contém `.claude/` | "Relendo as regras da casa", "Conferindo o padrão da agência" |
| contexto | `Read` e `d` contém `contexto/` | "Relembrando o que já sabemos do prospect", "Revendo as anotações do prospect" |
| dados | `Read` e `d` contém `dados/` ou termina em `.xlsx`/`.csv` | "Folheando as planilhas do cliente", "Dando uma olhada nos números" |
| leitura | `Read` (qualquer outro) | "Passando os olhos num material de apoio", "Lendo um arquivo de apoio" |
| escrita | `nome` é `Write`, `Edit` ou `MultiEdit` | "Passando a limpo", "Escrevendo o rascunho" |
| cálculo | `nome === "Bash"` | "Fazendo as contas", "Rodando uma análise", "Deixando o computador suar um pouco" |
| busca | `nome` é `Glob` ou `Grep` | "Procurando nas gavetas", "Vasculhando as pastas" |
| web | `nome` começa com `mcp__firecrawl` ou é `WebSearch`/`WebFetch` | "Dando uma volta pela web", "Pesquisando por aí" |
| outro | qualquer coisa | "Passando um café…", "Alongando as ideias…" |

- [ ] **Step 1: Testes que falham** (`frases-do-agente.test.ts`), todos com `passo(nome, detalhe)` montando `{ tipo: "atividade", nome, detalhe, em: "2026-11-12T10:00:00.000Z" }`:
  - uma entrada por categoria da tabela, esperando a primeira variação para `posicao 0` e a segunda (quando existe) para `posicao 1`;
  - `fraseDoPasso(x, 2)` numa categoria de 2 variações dá a primeira (módulo);
  - **vazamento:** para a lista de detalhes reais abaixo, a frase não contém `/`, `.py`, `.md`, `.xlsx`, `clientes`, `.claude` nem `cd `:
    `Rodando: cd "/Users/matheus/Documents/Claude/Projetos Boomer/planejamento-estrategico-boomer-v2/clientes/x" && python3 scripts/projecao.py`, `Lendo .claude/skills/_shared/regras-de-validacao.md`, `Lendo contexto/status-planejamento.md`, `Lendo /Users/a/clientes/x/dados/base.xlsx`, `Escrevendo entrega/ativos-aprovados/graficos/roas.png`, `Usando a skill 03-diagnostico-performance`, e uma ferramenta desconhecida `mcp__coisa__faz` com `detalhe` igual ao nome;
  - `detalhe` vazio não derruba (devolve uma frase da categoria da ferramenta ou de "outro").
- [ ] **Step 2: Rodar** `npx vitest run lib/frases-do-agente.test.ts`. Esperado: falha (módulo não existe).
- [ ] **Step 3: Implementar** `fraseDoPasso` em `lib/frases-do-agente.ts` com a tabela acima como dado (um array de `{ casa, frases }` percorrido em ordem), sem acessar `detalhe` além dos testes de contém/termina-com.
- [ ] **Step 4: Rodar** o teste. Esperado: passa.
- [ ] **Step 5: Commit** `feat(web): frases amigáveis para os passos do agente`.

### Task 4: Histórico de ações recolhido e amigável (A3, parte 2)

**Files:**
- Modify: `src/apps/web/components/chat/thought-line.tsx`
- Test: `src/apps/web/components/chat/thought-line.test.ts`

**Interfaces:**
- Consumes: `fraseDoPasso(passo, posicao)` da Task 3. `ThoughtLine` mantém as props `{ itens: EventoProcesso[]; slug: string; aoVivo: boolean }`.

- [ ] **Step 1: Atualizar e acrescentar testes** em `thought-line.test.ts`:
  - substituir `"ao vivo: mostra o passo atual … e os passos abertos"` por **"ao vivo: fechado por padrão, com a frase amigável do passo atual"**: `aria-expanded` é `"false"`, o cabeçalho contém a frase de `fraseDoPasso(DOIS[1], 1)`, não contém `scripts/ltv.py` nem `clientes/x/`, e não há `li` na tela;
  - **"abrir é escolha do analista"**: ao vivo e fechado, clicar abre (2 `li`, cada um com o texto da frase e `title` igual ao `detalhe` técnico); em seguida `r.render(...)` de novo com `aoVivo: false` mantém aberto; fechar e re-renderizar com `aoVivo: true` mantém fechado (nada abre ou fecha sozinho);
  - **"ao vivo sem passos"**: `itens = []` e `aoVivo` mostra "Pensando…";
  - **fala intermediária** (`tipo: "texto_agente"`) continua aparecendo como texto da fala, sem passar por `fraseDoPasso`.
  Os testes "encerrado" e "sem horário confiável" ficam como estão.
- [ ] **Step 2: Rodar** `npx vitest run components/chat/thought-line.test.ts`. Esperado: os novos/alterados falham.
- [ ] **Step 3: Implementar.** `useState(false)` para `aberto`; remover `vivoAntes`/`setVivoAntes` e o bloco "recolhe sozinho"; o `rotulo` ao vivo vira `fraseDoPasso(último, índice)` quando o último é atividade, e `linhaDoProcesso` quando é fala; cada `li` de atividade mostra `fraseDoPasso(e, i)` com `title={e.detalhe}`. Ajustar o comentário do componente ("recolhido por padrão, mesmo ao vivo"). Verificar com `grep -rn "linhaDoProcesso" src/apps/web` que o export continua usado; se ficar sem uso fora do arquivo, deixar de exportá-lo.
- [ ] **Step 4: Rodar** `thought-line.test.ts`, `chat-etapa.test.ts` e `chat-visual.test.ts`. Esperado: passam.
- [ ] **Step 5: Commit** `feat(web): histórico de ações recolhido por padrão e com frases amigáveis`.

### Task 5: Coluna 3 respeita o estado ao abrir o visualizador (A7)

**Files:**
- Modify: `src/apps/web/lib/layout-colunas.ts` (`layoutParaVisualizador`), `src/apps/web/components/trabalho/area-de-trabalho.tsx` (efeito que chama `layoutParaVisualizador`)
- Test: `src/apps/web/lib/layout-colunas.test.ts`

**Interfaces:**
- Produces: `layoutParaVisualizador(atual: Layout, salvo: Layout | null, aberto: boolean, painel?: { recolhido: boolean; largura: number }): Layout`. O quarto argumento é opcional; sem ele o comportamento é o de hoje (os testes existentes continuam valendo).
- Consumes: `layoutParaPainel(atual, aberto, largura)` do mesmo arquivo.

- [ ] **Step 1: Testes que falham** em `describe("layout ao abrir e fechar o visualizador")`, com `fechado = { trilha: 20, chat: 50, visualizador: 0, painel: 30 }`:
  - **recolhido continua recolhido:** `atual = { trilha: 20, chat: 80, visualizador: 0, painel: 0 }`, `salvo = { trilha: 10, chat: 30, visualizador: 40, painel: 20 }`, `painel = { recolhido: true, largura: 30 }` → `painel` do resultado é 0, `chat` é 50 (30 + 20), soma 100;
  - **recolhido, sem layout salvo:** o resultado de `atual` recolhido abrindo sem salvo tem `painel` 0 e soma 100;
  - **aberto continua aberto:** `atual = fechado`, `salvo = { trilha: 20, chat: 40, visualizador: 40, painel: 0 }`, `painel = { recolhido: false, largura: 22 }` → `painel` é 22, nenhuma coluna negativa, soma 100;
  - **aberto com salvo que já tem painel:** o resultado é o salvo, sem alteração;
  - sem o 4º argumento, os 4 testes atuais seguem passando.
- [ ] **Step 2: Rodar** `npx vitest run lib/layout-colunas.test.ts`. Esperado: os novos falham.
- [ ] **Step 3: Implementar.** Calcular o layout como hoje; depois, se `painel` veio: recolhido e `r.painel > 0` → `{ ...r, chat: r.chat + r.painel, painel: 0 }`; aberto e `(r.painel ?? 0) === 0` → `layoutParaPainel(r, true, painel.largura)`.
- [ ] **Step 4: Ligar no componente.** No efeito de `area-de-trabalho.tsx` que faz `grupo.setLayout(layoutParaVisualizador(...))`, passar `{ recolhido: painelRef.current?.isCollapsed() ?? false, largura: larguraPainel.current }`. Não mexer em `abrirArquivo` (continua abrindo a coluna 3, como o spec mantém).
- [ ] **Step 5: Rodar** `layout-colunas.test.ts` e `area-de-trabalho.test.ts`. Esperado: passam.
- [ ] **Step 6: Commit** `fix(web): coluna 3 oculta continua oculta ao expandir um arquivo`.

### Task 6: Modal do "Ampliar" do gráfico e da tabela (A8)

**Files:**
- Create: `src/apps/web/components/cards/modal-grafico.tsx`, `src/apps/web/components/cards/modal-grafico.test.ts`, `src/apps/web/components/cards/previa-arquivo.test.ts`
- Modify: `src/apps/web/components/cards/previa-arquivo.tsx`, `src/apps/web/components/cards/card-entregavel.tsx`, `src/apps/web/components/cards/card-entregavel.test.ts`

**Interfaces:**
- Produces: `ModalGrafico(props: { aberto: boolean; aoMudarAberto: (aberto: boolean) => void; titulo: string; urlImagem: string; urlDownload: string; pendente: boolean; aprovarDesabilitado: boolean; motivoAprovarDesabilitado?: string; ocupado: boolean; aoAprovar: () => Promise<boolean>; aoPedirAjuste: () => void })`.
- Produces: `PreviaArquivo` ganha `aoAmpliar?: () => void`. Para `tipo` `grafico` e `tabela`, o botão "Ampliar" e o clique na imagem chamam `aoAmpliar`; sem ela, o botão não aparece e a imagem não é clicável. `aoAbrir` continua existindo para os outros tipos.
- Produces: em `CardEntregavel`, `aprovar` passa a devolver `Promise<boolean>` (`true` se a API aprovou, `false` se deu erro e o toast foi mostrado).

- [ ] **Step 1: Testes do modal** (`modal-grafico.test.ts`, `// @vitest-environment jsdom`, montando com `createRoot` como em `thought-line.test.ts` e consultando `document.body`, porque o `Dialog` usa portal):
  - aberto e `pendente`: existem o link "Abrir em nova aba" (`href` = `urlImagem`, `target="_blank"`), o link "Baixar" (`href` = `urlDownload`, atributo `download`), e os botões "Aprovar" e "Pedir ajuste…"; a imagem tem `src = urlImagem` e `alt = titulo`;
  - `pendente: false`: os dois links existem e **não** há "Aprovar" nem "Pedir ajuste…";
  - **Aprovar com `aprovarDesabilitado: true`:** o botão está `disabled` e leva o `title` de `motivoAprovarDesabilitado`;
  - clicar Aprovar chama `aoAprovar` e, se resolver `true`, chama `aoMudarAberto(false)`; se resolver `false`, **não** fecha;
  - clicar "Pedir ajuste…" chama `aoPedirAjuste` e `aoMudarAberto(false)`, nessa ordem;
  - `aberto: false` não renderiza nada.
- [ ] **Step 2: Rodar** `npx vitest run components/cards/modal-grafico.test.ts`. Esperado: falha (arquivo não existe).
- [ ] **Step 3: Implementar `ModalGrafico`** com `Dialog`/`DialogContent` de `@workspace/ui/components/dialog` no molde de `modal-roteiro.tsx`: `DialogContent className="h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1500px)]"`; cabeçalho com `DialogTitle` (título) e `DialogDescription` `sr-only`, mais os links como `Button variant="outline" size="sm"` com `render={<a … />}` e `nativeButton={false}` (padrão de `visualizador-arquivo.tsx`); corpo com a imagem `max-h-full max-w-full object-contain` sobre fundo `bg-papel`; rodapé só quando `pendente`, com o mesmo botão Aprovar do card (`className="brilho-passa"`, `CheckIcon`, `Spinner` quando `ocupado`) e `Pedir ajuste…` (`variant="outline"`, desabilitado com `ocupado`).
- [ ] **Step 4: Testes da prévia** (`previa-arquivo.test.ts`, `renderToStaticMarkup`): `tipo: "grafico"` com `aoAmpliar` mostra o botão "Ampliar" e o `<button aria-label="Abrir …">` da imagem sem `disabled`; sem `aoAmpliar` não mostra "Ampliar" e a imagem fica `disabled`; `tipo: "secao"` e `"html"` não mudam ("Expandir" e "Abrir" continuam).
- [ ] **Step 5: Implementar na prévia.** No ramo `grafico`/`tabela` de `previa-arquivo.tsx`, trocar `aoAbrir` por `aoAmpliar` (clique na imagem, `disabled={!aoAmpliar}` e o botão "Ampliar").
- [ ] **Step 6: Ligar no card.** Em `card-entregavel.tsx`: estado `const [ampliado, setAmpliado] = useState(false)`; `aprovar` devolve `true`/`false`; `<PreviaArquivo … aoAmpliar={ehImagem ? () => setAmpliado(true) : undefined} />`; renderizar `<ModalGrafico>` só quando `ehImagem`, com `titulo={e.titulo}`, `urlImagem={urlArquivo(slug, e.arquivoRascunho)}`, `urlDownload={urlArquivo(slug, e.arquivoRascunho, true)}`, `pendente={e.status === "pendente"}`, `aprovarDesabilitado={aguardandoNovaVersao}`, `motivoAprovarDesabilitado="Disponível quando o agente gerar a nova versão com o ajuste"`, `ocupado={ocupado}`, `aoAprovar={aprovar}`, `aoPedirAjuste={pedirAjuste}`. Remover do `aoAbrir` do card o caso `() => abrirArquivo(…)` apenas para `grafico`/`tabela`, se ele deixar de ter uso (documento continua).
- [ ] **Step 7: Teste do card** em `card-entregavel.test.ts` (estilo do arquivo, sobre a fonte): contém `<ModalGrafico`, `aoAmpliar={ehImagem` e `aguardandoNovaVersao`; e `tela-trabalho-partes.test.ts` ("Ampliar" em vidro escuro) segue passando.
- [ ] **Step 8: Rodar** `npx vitest run components/cards components/tela-trabalho-partes.test.ts`. Esperado: tudo passa.
- [ ] **Step 9: Commit** `feat(web): "Ampliar" do gráfico abre modal com aprovar e pedir ajuste`.

---

## Bloco B — Gerador do `.pptx`

### Task 7: Jornada alinhada às setas (B5)

**Files:**
- Create: `scripts/layout_slides.py`, `scripts/tests/test_layout_slides.py`
- Modify: `scripts/gerar_apresentacao.py` (função `_preencher`)

**Interfaces:**
- Produces: `layout_slides.alinhar_jornada(slide) -> bool` (`True` se alinhou; `False`, sem alterar nada, se o slide não tem a estrutura esperada). Constantes `ALTURA_ITEM_JORNADA = 420_000` (EMU).
- O módulo é importado por `gerar_apresentacao.py` como `import layout_slides as lay` (mesmo padrão de `import apresentacao_pptx as ap`).

Estrutura esperada do slide `jornada` do molde: 5 auto-formas sem texto com `left == 0` (as setas, ordenadas por `top`) e 1 caixa de texto cujo texto tem 5 parágrafos (a lista; a caixa "JORNADA" tem 1 parágrafo). Cada parágrafo tem `a:buAutoNum type="arabicPeriod"` e `a:lnSpc` de 250%.

- [ ] **Step 1: Testes que falham** (`test_layout_slides.py`, reaproveitando `prospect` e `roteiro_basico` de `test_gerar_apresentacao.py` por import ou copiando as funções; gerar com `ga.gerar(...)` e abrir o `.pptx` de saída; o slide da Jornada é o 2º):
  - existem 5 caixas de item; o centro vertical de cada uma (`top + height/2`) é igual (±1 EMU) ao da seta de mesmo índice, ordenando setas e caixas por `top`;
  - cada caixa tem `height == ALTURA_ITEM_JORNADA`, o mesmo `left` e `width` da caixa original (lidos do molde), ancoragem `anchor="ctr"` e `lnSpc` 100000;
  - **numeração:** o `buAutoNum` do item de índice `i` tem `startAt == str(i + 1)`; os textos, na ordem, são os 5 parágrafos do molde;
  - a caixa original de 5 parágrafos não existe mais, e os `id` das formas do slide são únicos;
  - **molde inesperado:** chamar `lay.alinhar_jornada(slide)` num slide de `grafico` devolve `False` e não altera as formas; e em `gerar`, quando devolve `False`, entra o aviso "Slide N (jornada): o molde não tem a estrutura esperada; o alinhamento com as setas não foi aplicado." em `avisos`, sem exceção.
- [ ] **Step 2: Rodar** `python3 -m pytest scripts/tests/test_layout_slides.py -q`. Esperado: falha (módulo não existe).
- [ ] **Step 3: Implementar `alinhar_jornada`.** Localizar setas e lista como descrito; para cada parágrafo `i`, copiar o elemento `p:sp` da lista, deixar só o parágrafo `i`, definir `startAt`, trocar `lnSpc` por `spcPct 100000`, trocar `a:spAutoFit` por `a:noAutofit`, `bodyPr` com `anchor="ctr"` e `tIns`/`bIns` zero, `x`/largura da original, `y = seta.top + seta.height // 2 - ALTURA_ITEM_JORNADA // 2`, `cy = ALTURA_ITEM_JORNADA`, `cNvPr id` novo (maior id do slide + 1) e `name="Jornada item {i+1}"`; inserir no lugar da original e removê-la.
- [ ] **Step 4: Ligar no gerador.** Em `_preencher`, quando `tipo == "jornada"`, chamar `lay.alinhar_jornada(slide)` e, se devolver `False`, acrescentar o aviso acima. Importante: o `return` antecipado de `TIPOS_SEM_AVISO_DE_ESTOURO` não inclui `jornada`; manter a ordem (alinhar antes da checagem de ocupação).
- [ ] **Step 5: Rodar** `python3 -m pytest scripts/tests -q`. Esperado: tudo passa (incluindo `test_molde_apresentacao.py` e `test_gerar_apresentacao.py`).
- [ ] **Step 6: Commit** `fix(apresentacao): itens da Jornada alinhados às setas azuis, um por caixa`.

### Task 8: Slides com imagem em coluna: texto à esquerda, imagem à direita (B6)

**Files:**
- Modify: `scripts/layout_slides.py`, `scripts/gerar_apresentacao.py` (`_preencher`), `scripts/tests/test_layout_slides.py`
- Verificar: `.claude/skills/09-apresentacao-final/SKILL.md` (a frase sobre "tabelas em `tabela_lateral` quando altas ou `imagem_larga` quando largas" segue verdadeira; só editar se passar a contradizer o comportamento)

**Interfaces:**
- Produces: `layout_slides.aplicar_coluna(prs, slide, tipo: str, imagem: Path) -> bool`. `True` se aplicou o layout em coluna; `False` (slide intacto) se a proporção `largura/altura` da imagem é **maior que 2,8** (`ASPECTO_FAIXA_LARGA = 2.8`) ou o tipo não é um dos três. Constantes em % do slide: `AREA_IMAGEM = (34.0, 7.0, 63.0, 85.0)` (x, y, largura, altura) e `COLUNA_TEXTO` por tipo, com `(x, y, largura, altura)`: para `grafico` e `tabela_lateral`, `titulo (4.4, 7.2, 26.6, 22.0)`, `subtitulo (4.4, 30.0, 26.6, 20.0)`, `conclusoes (4.4, 51.0, 26.6, 41.0)`; para `imagem_larga`, `titulo (4.4, 7.2, 26.6, 22.0)`, `texto (4.4, 30.0, 26.6, 62.0)` (alturas ajustadas depois da prévia do Verdeluz: o título precisa de 3 linhas). Os campos são achados por `ap.campos(slide)`.
- Consumes: `ap.campos`, `ap.trocar_imagem` (centraliza e encaixa a imagem na área da forma).

- [ ] **Step 1: Testes que falham** em `test_layout_slides.py`. Gerar decks com `ga.gerar`, variando o tipo (`grafico`, `tabela_lateral`, `imagem_larga`) e o tamanho da imagem PNG (criada com Pillow): 1200×600 (2,0), 400×700 (0,57), 900×900 (1,0), 2800×1000 (2,8 exato) e 3000×600 (5,0). Para cada deck, ler a forma `campo:imagem` do slide gerado (em % do slide, via `ap.caixa_percentual`):
  - proporção ≤ 2,8: a imagem fica dentro de `AREA_IMAGEM` (tolerância 0,5) e **encosta nela pelo lado limitante**: `|w − 63| ≤ 1` ou `|h − 85| ≤ 1` (largura se `largura_px/altura_px` for maior que a da área, senão altura); o centro dela coincide com o centro da área (±1);
  - proporção > 2,8: a geometria da imagem e dos textos é idêntica à do molde (comparar com o slide-modelo) e `aplicar_coluna` devolveu `False`;
  - **textos na coluna:** para os três tipos, cada campo de texto presente fica com `x` ≥ 4,4 e `x + w` ≤ 31 e não se sobrepõe à imagem (`x + w` do texto < `x` da imagem), nem entre si na vertical (`y + h` do campo anterior ≤ `y` do seguinte);
  - o `mapa-slides.json` gerado traz as caixas novas (as de `imagem` e `titulo` do slide em coluna batem com as lidas do `.pptx`);
  - o limite 2,8 exato (2800×1000) usa o layout em coluna.
- [ ] **Step 2: Rodar** `python3 -m pytest scripts/tests/test_layout_slides.py -q`. Esperado: os novos falham.
- [ ] **Step 3: Implementar `aplicar_coluna`.** Lê a proporção da imagem com Pillow; se > 2,8 devolve `False`; senão converte os percentuais em EMU com `prs.slide_width`/`prs.slide_height`, posiciona a forma `campo:imagem` na `AREA_IMAGEM` (a imagem é encaixada depois por `ap.trocar_imagem`, que já mantém a proporção e centraliza na área) e cada campo de texto na sua caixa de `COLUNA_TEXTO[tipo]`; campos ausentes no slide são ignorados.
- [ ] **Step 4: Ligar no gerador.** Em `_preencher`, antes de `_preencher_campos`, para `tipo in {"grafico", "tabela_lateral", "imagem_larga"}`: `lay.aplicar_coluna(prs, slide, tipo, pasta / dados["imagem"])`. A ordem importa: a área da imagem é posicionada **antes** de `trocar_imagem`, que roda dentro de `_preencher_campos` e encaixa a imagem na área que a forma tem naquele momento.
- [ ] **Step 5: Rodar** `python3 -m pytest scripts/tests -q`. Esperado: passa. Testes antigos que fixavam a geometria de `grafico`/`imagem_larga` precisam ser atualizados para a nova geometria, nunca afrouxados sem motivo.
- [ ] **Step 6: Ajuste fino com o ensaio do Verdeluz.** Escrever, no scratchpad, um roteiro de 3 slides (`jornada`, `imagem_larga` com `entrega/ativos-aprovados/graficos/cenarios-pessimista-realista-otimista.png` e um `grafico` qualquer da mesma pasta, com `conclusoes`) e gerar: `python3 scripts/gerar_apresentacao.py --roteiro <roteiro> --prospect clientes/_fixtures/verdeluz/base --output <pasta-scratchpad>/deck.pptx`. Gerar a prévia: `python3 scripts/previa_apresentacao.py gerar --pptx <deck> --saida <pasta>` (usa LibreOffice, já instalado) e olhar os PNG. Se título ou conclusões estourarem a coluna (aviso "provavelmente não cabe" do gerador ou texto cortado na prévia), reduzir o tamanho da fonte do campo na coluna dentro de `aplicar_coluna` (nunca no molde) até caber, e registrar o valor numa constante. A Jornada também é conferida nesta prévia.
- [ ] **Step 7: Rodar** `python3 -m pytest scripts/tests -q` de novo. Esperado: passa.
- [ ] **Step 8: Commit** `fix(apresentacao): slides com imagem em coluna, texto à esquerda e imagem grande à direita`.

---

## Verificação final

### Task 9: Conferência no app e suíte completa

- [ ] **Step 1:** `cd src/apps/web && npm test`. Esperado: todos os testes passam. `cd src/packages/core && npm test` também (não foi alterado; confirma que nada quebrou).
- [ ] **Step 2:** `python3 -m pytest scripts/tests -q`. Esperado: passa.
- [ ] **Step 3: Conferência visual no navegador** com o app local sem nuvem (`PLANEJAMENTO_AUTH=off PLANEJAMENTO_DADOS=fs npm run dev` em `src/`, e o cliente de teste Verdeluz no modo ensaiado). Conferir, com screenshot de cada item: (A1) painel direito na largura mínima com o botão de concluir; (A2) fim do chat sem véu na última linha; (A3) histórico fechado durante o trabalho e frases amigáveis; (A4) entregáveis com arquivo aberto embaixo, rolando até o último; (A7) coluna 3 oculta e "Expandir" de um texto, sem ela reabrir; (A8) "Ampliar" abre o modal, com Aprovar, Pedir ajuste e Abrir em nova aba. Se algum item falhar, corrigir na task dele e repetir.
- [ ] **Step 4:** `git status --short` limpo, `git log --oneline origin/main..HEAD` com um commit por apontamento mais o spec e o plano. Não abrir PR nem fazer push sem o analista pedir.
