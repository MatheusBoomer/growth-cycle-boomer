# Catálogo de skills — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba "Skills" na Administração com a visão geral do processo, as 10 skills, os subagentes e as regras compartilhadas, cada item com fluxograma Mermaid e notas de melhoria.

**Architecture:**
- O catálogo é uma lista fixa num módulo do `core` só de servidor, que lê os arquivos de `.claude/`.
- Os fluxogramas são arquivos `.mmd` versionados.
- As notas ficam em `planejamento.notas_skills`, com repositório e serviço no padrão das peças anteriores.
- A tela desenha os fluxos com Mermaid importado dinamicamente no navegador.

**Tech Stack:** TypeScript, Next.js 16, Vitest, Supabase/Postgres (schema `planejamento`) e `mermaid` (nova dependência do web, versão exata).

**Spec:** `docs/superpowers/specs/2026-11-08-catalogo-skills-design.md`

## Global Constraints

- Nada fora do schema `planejamento`. A migração só é aplicada pelo MCP, com o OK do analista e **antes** do deploy.
- Ids do catálogo e caminhos: exatamente a tabela da seção 1 do spec. Um `id` fora da lista nunca vira caminho de arquivo.
- Legenda dos fluxos:
  - `classDef checkpoint` (laranja), `classDef subagente` (azul) e `classDef entrega` (verde), em todos os 13 arquivos;
  - todos começam com `flowchart TD`.
- Nota: de 1 a 2000 caracteres.
- Textos fixos:
  - `Item não encontrado.`;
  - `Não foi possível desenhar o fluxograma.`;
  - `Laranja: aprovação do analista · Azul: subagente · Verde: entrega`;
  - `Ver texto completo`;
  - `Nova nota`;
  - `Adicionar`;
  - `Marcar como resolvida`;
  - `Resolvidas (<n>)`;
  - `Reabrir`;
  - `Copiar notas abertas`;
  - `Notas copiadas.`;
  - `Nenhuma nota aberta.`;
  - `A administração de pessoas só existe com os dados na nuvem.`
- Grupos, na ordem: `Processo`, `Etapas`, `Subagentes`, `Regras compartilhadas`.
- **Nenhum módulo importado por componente de cliente pode importar `node:`.** O leitor do catálogo é só de servidor. O cliente usa `import type`.
- `mermaid` só pode ser importado dinamicamente (`await import("mermaid")`) dentro de `useEffect`. Antes do PR, `next build` numa worktree isolada sem o `.env` da raiz.
- A versão de `mermaid` é exata e publicada há pelo menos 2 semanas (`npm view mermaid time`).
- Nunca ler `.env` nem `.env.example`. Textos sem travessão (—).

## Review Focus

1. **`id` com `../` ou com codificação estranha na URL.** Responde 404 sem ler disco. Teste na Task 2.
2. **Arquivo de fluxo ausente no deploy** (ex.: skill nova sem fluxo). Responde `fluxo: null` e a tela mostra o texto, sem erro 500. Teste na Task 2.
3. **Fluxo com caractere especial em rótulo** (acento, parênteses, `/`). Os rótulos ficam entre aspas e passam pela validação. Teste na Task 3.
4. **Nota só de espaços.** É tratada como vazia e dá 400. Teste na Task 4.
5. **Resolver uma nota já resolvida, ou reabrir uma aberta.** É idempotente: devolve a nota sem erro e sem mudar `resolvida_por` à toa. Teste na Task 4.

---

### Task 1: Migração `notas_skills` e backup

**Files:**
- Create: `supabase/migrations/20261110120000_notas_skills.sql` e `supabase/testes/testar-notas-skills.sh` (no padrão de `testar-config-modelos.sh`)
- Modify: `scripts/backup/comum.mjs`

**Interfaces:**
- Produces:
  - a tabela do spec (seção 3), com o `check` de 1 a 2000 caracteres, o índice `notas_skills_item (item, resolvida_em)`, RLS e permissões para `service_role` (incluindo a sequência);
  - em `TABELAS`, a entrada `{ nome: "notas_skills", chave: ["id"], identidade: "id", global: true }`, depois de `config_modelos`.

- [ ] **Step 1:** Escrever a migração, idempotente e sem `drop`, e o script de teste. O script aplica a base e depois a migração duas vezes, faz `\d`, confere que um `insert` com texto vazio falha e que outro com 2001 caracteres também falha.
- [ ] **Step 2:** Run: `bash supabase/testes/testar-notas-skills.sh`. Expected: `notas-skills: migração aplicada duas vezes sem erro`. Também `node --check scripts/backup/*.mjs`.
  - Para a identidade, confira em `scripts/backup/restaurar.mjs` que uma tabela global com `identidade: "id"` é tratada pela restauração global. Se não for, adapte o mínimo.
- [ ] **Step 3: Commit** `feat(banco): tabela de notas de melhoria das skills`

---

### Task 2: Catálogo e leitura dos arquivos (core, servidor)

**Files:**
- Create:
  - `src/packages/core/src/catalogo-skills.ts` (servidor, pode usar `node:fs`);
  - `src/packages/core/src/catalogo-skills-tipos.ts` (só tipos e a lista de ids e grupos, sem `node:`).
- Test: `src/packages/core/test/catalogo-skills.test.ts`

**Interfaces:**
- Produces:

```ts
// catalogo-skills-tipos.ts
export type GrupoSkill = "Processo" | "Etapas" | "Subagentes" | "Regras compartilhadas"
export interface ItemCatalogo { id: string; grupo: GrupoSkill; titulo: string; resumo: string; temFluxo: boolean }
export interface ConteudoItem extends ItemCatalogo { texto: string | null; fluxo: string | null }
// catalogo-skills.ts
export function itensDoCatalogo(raiz: string, catalogo: Catalogo): ItemCatalogo[]                 // ordem: visão geral, etapas na ordem do catálogo, subagentes, regras
export function lerItemDoCatalogo(raiz: string, catalogo: Catalogo, id: string): ConteudoItem | null // null = id fora da lista
```

Regras:
- **Títulos:**
  - etapas: `rotuloStatus` do catálogo;
  - visão geral: `Visão geral do processo`;
  - subagentes: o `name` do `.md`;
  - regras: `Padrão visual`, `Regras de validação`, `Repertório de soluções`.
- **Resumos:**
  - etapas: a `descricao` do `etapas.json`;
  - subagentes: a `description` do cabeçalho;
  - regras e visão geral: uma frase fixa escolhida pelo implementador.
- `temFluxo` é verdadeiro quando a entrada tem caminho de fluxo, mesmo que o arquivo esteja ausente.
- Arquivo ausente vira `null`, sem lançar (Review Focus 2).
- A pasta da skill sai de `etapa.skill`. Etapa sem `skill` dá `texto: null`.

- [ ] **Step 1: Escrever os testes que falham**
  - `itensDoCatalogo(raizReal, catalogoReal)` dá 16 itens: 1 de processo, 10 de etapas, 2 de subagentes e 3 de regras, na ordem dos grupos;
  - `lerItemDoCatalogo(..., "etapa:03")` traz um `texto` que contém `Skill 03`;
  - `lerItemDoCatalogo(..., "regra:padrao-visual")` dá `fluxo: null` e `temFluxo: false`;
  - os ids `"../../.env"`, `"etapa:99"` e `"etapa:03/../../x"` dão `null` (Review Focus 1). Um espião em `readFileSync` (ou na função de leitura injetável) confirma que nenhuma leitura aconteceu;
  - numa raiz temporária sem `fluxo.mmd`, sai `fluxo: null` e `temFluxo: true`;
  - um teste de guarda confirma que `catalogo-skills-tipos.ts` não importa `node:`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run test/catalogo-skills.test.ts` (core). Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar a suíte do core e conferir os tipos.** Run: `npm test` e `npm run typecheck` (core). Expected: PASS. Os testes de existência de fluxo **não** entram aqui (são da Task 3).
- [ ] **Step 5: Commit** `feat(core): catálogo de skills, subagentes e regras com leitura segura dos arquivos`

---

### Task 3: Os 13 fluxogramas

**Files:**
- Create:
  - `.claude/skills/_shared/fluxo-geral.mmd`;
  - `.claude/skills/<pasta>/fluxo.mmd`, para cada uma das 10 etapas;
  - `.claude/agents/analista-dados.fluxo.mmd` e `.claude/agents/pesquisador-benchmark.fluxo.mmd`.
- Create: `src/apps/web/lib/fluxos.test.ts`, um teste de validade no web, que tem acesso à dependência `mermaid` da Task 6. Se `mermaid` ainda não estiver instalado nesta task, use a validação estrutural descrita abaixo e deixe o teste com `mermaid.parse` para a Task 6.
- Test: `src/packages/core/test/catalogo-skills.test.ts`, com os testes de existência e de legenda.

Conteúdo (spec, seção 2):
- **Antes de escrever cada fluxo, ler o `SKILL.md` inteiro** e os arquivos que ele cita.
- Cada fluxo de etapa mostra:
  - os insumos pedidos (de `etapas.json` e do texto);
  - as fases ou passos;
  - cada checkpoint de aprovação do analista, com a classe `checkpoint` e a decisão `Analista aprova?` com as saídas `sim` e `não, ajustar` voltando ao passo;
  - os subagentes acionados (classe `subagente`);
  - a entrega e o handoff para a próxima etapa (classe `entrega`).
- A visão geral mostra as etapas de 01 a 10 em sequência, o que cada uma entrega à seguinte (rótulo curto na aresta) e os subagentes ligados às etapas que os usam.
- Os subagentes mostram em quais etapas são acionados, o que recebem, o que fazem e o que devolvem.
- Todo rótulo vai entre aspas (`A["Fase 1 · Macro financeiro"]`). Os ids de nó são simples (`[A-Za-z0-9_]`).
- As três `classDef` aparecem no fim de cada arquivo:
  - `classDef checkpoint fill:#fff1e6,stroke:#e8803a,color:#7a3d0c`;
  - `classDef subagente fill:#e8f0fd,stroke:#1f4fa8,color:#173a7a`;
  - `classDef entrega fill:#e6f6ec,stroke:#16743b,color:#0f4f28`.

Validação estrutural, a de reserva (Review Focus 3):
- a primeira linha não vazia é `flowchart TD`;
- as três `classDef` estão presentes;
- todo rótulo entre colchetes ou chaves está entre aspas;
- todo id usado em `-->` é declarado com rótulo em algum lugar do arquivo;
- não há `—`.

- [ ] **Step 1: Escrever os testes que falham.**
  - Core: todo item de `itensDoCatalogo` com `temFluxo` tem o arquivo existente e não vazio, e todo fluxo contém as três `classDef` e começa com `flowchart TD`.
  - Web: a validação estrutural (ou `mermaid.parse`) passa nos 13 arquivos.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL, porque os arquivos não existem.
- [ ] **Step 3: Escrever os 13 fluxos.**
- [ ] **Step 4: Rodar as suítes.** Run: core e web `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `docs(skills): fluxogramas da visão geral, das 10 etapas e dos subagentes`

---

### Task 4: Notas no repositório e no serviço

**Files:**
- Modify:
  - `src/packages/core/src/nuvem/tipos.ts`, `nuvem/memoria.ts` e `nuvem/supabase.ts`;
  - `src/packages/core/src/armazenamento.ts` e `nuvem/armazenamento-nuvem.ts`;
  - `src/packages/core/src/servico-planejamento.ts`.
- Create: `src/packages/core/src/notas-skills.ts`, puro e sem `node:`, com o texto de exportação.
- Test:
  - `test/nuvem/contrato-repositorio.ts`, `test/nuvem/supabase-fake.test.ts` e `test/nuvem/supabase.test.ts` (limpeza da suíte viva só das notas que ela criar);
  - `test/servico-planejamento.test.ts`;
  - `test/notas-skills.test.ts`.

**Interfaces:**
- Consumes (Task 2): ids do catálogo, `itensDoCatalogo`.
- Produces:

```ts
export interface NotaSkill { id: number; item: string; texto: string; autor: string; criadaEm: string; resolvidaEm: string | null; resolvidaPor: string | null }
// Repositorio
listarNotasSkills(item?: string): Promise<NotaSkill[]>        // mais novas primeiro
criarNotaSkill(n: { item: string; texto: string; autor: string }): Promise<NotaSkill>
marcarNotaSkill(id: number, resolvida: boolean, autor: string): Promise<NotaSkill | null>  // null = não existe
// FsArmazenamento: listar → []; criar/marcar → ErroEntrada("A administração de pessoas só existe com os dados na nuvem.")
// ServicoPlanejamento
notasDoItem(item: string): Promise<NotaSkill[]>
criarNota(item: string, texto: string, autor: string): Promise<NotaSkill>   // valida item no catálogo (404), texto aparado 1..2000 (400)
marcarNota(id: number, resolvida: boolean, autor: string): Promise<NotaSkill> // 404 se não existe; idempotente
contagemNotasAbertas(): Promise<Record<string, number>>
// notas-skills.ts
export function textoNotasAbertas(notas: NotaSkill[], itens: Array<{ id: string; titulo: string }>): string
```

Regras:
- `marcarNota(id, true)` numa nota já resolvida devolve a nota sem mudar `resolvidaEm` e `resolvidaPor` (Review Focus 5). `false` limpa os dois campos.
- `textoNotasAbertas` agrupa por item na ordem de `itens` (`## <titulo>` e linhas `- <texto> (<nomeCurto(autor)>, <dd/mm>)`). Sem notas abertas, devolve `Nenhuma nota aberta.`

- [ ] **Step 1: Escrever os testes que falham**
  - Contrato:
    - criar, listar por item, marcar `true`, marcar `true` de novo (sem mudança) e marcar `false`;
    - marcar uma nota inexistente dá `null`.
  - Serviço:
    - texto `"   "` dá 400 (Review Focus 4);
    - texto com 2001 caracteres dá 400;
    - item `etapa:99` dá 404;
    - `contagemNotasAbertas` ignora as resolvidas.
  - `textoNotasAbertas`: a ordem pelos itens, o formato da linha e `Nenhuma nota aberta.`
  - Supabase falso: `insert` e `update` em `notas_skills`, sem vazar URL nos erros.
- [ ] **Step 2: Rodar e ver falhar.** Run: core `npx vitest run test/notas-skills.test.ts test/servico-planejamento.test.ts test/nuvem`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Não rodar `test:supabase`.
- [ ] **Step 4: Rodar a suíte do core e conferir os tipos.** Run: `npm test` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): notas de melhoria das skills no repositório e no serviço`

---

### Task 5: Rotas de admin

**Files:**
- Create:
  - `src/apps/web/app/api/admin/skills/route.ts` (`GET`);
  - `src/apps/web/app/api/admin/skills/[id]/route.ts` (`GET`);
  - `src/apps/web/app/api/admin/skills/[id]/notas/route.ts` (`POST`);
  - `src/apps/web/app/api/admin/skills/notas/[notaId]/route.ts` (`PATCH`).
- Modify: `src/apps/web/lib/api.ts`
- Test: `src/apps/web/app/api/admin/skills.test.ts`

**Interfaces:**
- Consumes (Tasks 2 e 4): `itensDoCatalogo`, `lerItemDoCatalogo`, `servico.notasDoItem`, `criarNota`, `marcarNota`, `contagemNotasAbertas`, e os tipos.
- Produces:
  - as rotas do spec (seção 5). Todas chamam `exigirAdmin()` primeiro;
  - `GET /api/admin/skills` também devolve `textoExportacao: string`, gerado por `textoNotasAbertas` com todas as notas abertas (no modo fs, `Nenhuma nota aberta.`);
  - as rotas de notas usam `usuariosDaNuvem()` para o 400 do modo fs;
  - as rotas de leitura funcionam no modo fs, com `notasAbertas: 0` e `notas: []`;
  - `[id]` é decodificado com `decodeURIComponent` dentro de `try`. Uma decodificação inválida dá 404 `Item não encontrado.`
  - Em `lib/api.ts`: `api.itensSkills()`, `api.itemSkill(id)`, `api.criarNotaSkill(id, texto)`, `api.marcarNotaSkill(notaId, resolvida)`, com `encodeURIComponent(id)` e os tipos exportados.

- [ ] **Step 1: Escrever os testes que falham**, no padrão de `admin/modelos.test.ts`:
  - usuário comum recebe 403 nas 4 rotas;
  - `GET` da lista traz 16 itens, com `notasAbertas` correto;
  - `GET etapa%3A03` traz texto e fluxo;
  - `GET %2E%2E%2F.env` dá 404;
  - criar nota dá 201, e o autor é o e-mail do admin;
  - texto vazio dá 400;
  - `PATCH` resolve e reabre;
  - `PATCH` de nota inexistente dá 404;
  - modo fs dá 400 nas notas, e a leitura continua 200.
- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run app/api/admin/skills.test.ts` (web). Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar a suíte do web e conferir os tipos.** Run: `npm test` e `npm run typecheck`. Expected: PASS, com a varredura de rotas classificando as novas como admin.
- [ ] **Step 5: Commit** `feat(web): rotas de admin do catálogo de skills e das notas`

---

### Task 6: Aba "Skills"

**Files:**
- Modify: `src/apps/web/package.json` (dependência `mermaid`, versão exata conforme o Global Constraints) e o `package-lock.json`.
- Create:
  - `src/apps/web/app/admin/skills/page.tsx`;
  - `src/apps/web/components/admin/catalogo-skills.tsx`;
  - `src/apps/web/components/admin/fluxograma.tsx`;
  - `src/apps/web/components/admin/notas-skill.tsx`.
- Modify: `src/apps/web/components/admin/abas-admin.tsx` (aba `Skills`, `/admin/skills`, depois de `Modelos`).
- Test:
  - `src/apps/web/lib/fluxos.test.ts`: troca a validação estrutural da Task 3 por `mermaid.parse` nos 13 arquivos, se o parser rodar no ambiente de teste do Vitest (jsdom ou happy-dom, conforme a configuração do web). Se não rodar, mantém a estrutural e registra o motivo no relatório;
  - `src/apps/web/lib/catalogo-skills-tela.test.ts`, para os helpers puros da tela (agrupamento por grupo e rótulo `Resolvidas (<n>)`).

Tela: seção 4 do spec, verbatim.
- `Fluxograma({ codigo })` faz `const { default: mermaid } = await import("mermaid")` em `useEffect`, `mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme })` (claro ou escuro conforme o tema do app) e `mermaid.render(idUnico, codigo)`. Em erro, mostra `Não foi possível desenhar o fluxograma.`
- O texto completo usa o `Markdown` de `components/markdown.tsx` dentro do `Sheet` de `@workspace/ui/components/sheet`.
- `Copiar notas abertas`: recarrega `api.itensSkills()` e copia o `textoExportacao` (Task 5) com `navigator.clipboard.writeText`, mostrando `Notas copiadas.`

- [ ] **Step 1: Escrever os testes que falham**, dos helpers puros e da validação dos fluxos.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Instalar `mermaid` com `npm install mermaid@<versão> --save-exact -w apps/web` em `src`.
- [ ] **Step 4: Rodar as suítes e conferir os tipos.** Run: web `npm test` e `npm run typecheck`, e core `npm test`. Expected: PASS.
- [ ] **Step 5: Conferir a compilação de produção** numa worktree isolada no scratchpad: `npm ci` em `<wt>/src` e `env -i PATH="$PATH" HOME="$HOME" npx next build` em `<wt>/src/apps/web`. Expected: `Compiled successfully`, com `/admin/skills` na tabela de rotas. Depois, remover a worktree.
- [ ] **Step 6: Commit** `feat(web): aba Skills com fluxogramas, texto completo e notas de melhoria`

---

### Task 7: Aplicação no Supabase, PR e aceitação

Feita pelo controlador com o analista.

- [ ] **Step 1:** Com o OK do analista, aplicar `20261110120000_notas_skills.sql` pelo MCP (`planejamento_notas_skills`) e conferir as colunas.
- [ ] **Step 2:** Rodar `npm run test:supabase` (core). Expected: PASS, sem notas de teste sobrando.
- [ ] **Step 3:** Abrir o PR. Depois do merge, o deploy na VPS (o comando de sempre).
- [ ] **Step 4:** Aceitação:
  1. abrir a aba Skills;
  2. conferir a visão geral e os fluxos de 2 ou 3 etapas;
  3. criar uma nota, resolver e reabrir;
  4. `Copiar notas abertas`.
