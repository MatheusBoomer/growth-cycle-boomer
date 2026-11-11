# Reports de bug e melhoria — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualquer usuário logado reporta bug ou melhoria com print marcado e comentário; o admin triagem numa aba "Reports" e copia em Markdown para o Claude.

**Architecture:** Tabela `planejamento.reports` + bucket privado `planejamento-reports`, atrás das mesmas camadas das notas das skills: `Repositorio` (tabela) e `ArmazemArquivos` (objetos) em `packages/core/src/nuvem`, orquestrados por `NuvemArmazenamento.criarReport` (com desfazer), validados no `ServicoPlanejamento` e expostos por rotas Next. No cliente, `modern-screenshot` captura a tela e o `MarcadorImagem` do chat marca o print.

**Tech Stack:** TypeScript, Next.js (App Router), Supabase (Postgres + Storage), Vitest, Tailwind + `@workspace/ui`, `modern-screenshot`, `sonner`.

**Spec:** `docs/superpowers/specs/2026-11-11-reports-bugs-melhorias-design.md`

## Global Constraints

- Trabalhar na worktree `.claude/worktrees/reports`, branch `feat/reports` (saiu da main 399cc01). Conferir `git branch --show-current` antes de cada commit.
- Textos de tela, mensagens de erro, nomes de funções e arquivos em português, como o resto do código.
- Tipos: `bug` | `melhoria`. Status: `aberto` | `em_andamento` | `resolvido` | `descartado`.
- Comentário: 1 a 2000 caracteres depois de aparar. Nota do admin: até 2000 (vazia vira `null`).
- Imagens: no máximo 1 print da tela (PNG) + 3 extras (PNG ou JPEG); cada uma até 5 MB (5 * 1024 * 1024 bytes); tipo conferido pela assinatura dos bytes, nunca pelo nome ou pelo `Content-Type`.
- Objeto no bucket: `<id>/<n>.<png|jpg>`, `n` a partir de 0; o print da tela, quando existe, é o 0.
- `autor` sempre do e-mail da sessão, nunca do corpo.
- Modo `fs`: toda operação de report lança `ErroEntrada("Os reports só existem com os dados na nuvem.")` (400); `listarReports` também lança (a tela do admin mostra a mensagem). O botão "Reportar" some quando `useAmbiente().nuvem` é falso.
- Componente de cliente nunca importa módulo do core com `node:` (quebra o `next build`). `reports.ts` não tem imports de `node:`.
- Commits no padrão do repositório (`feat(core): …`, `feat(web): …`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Aplicar a migração no Supabase é ação externa: pedir confirmação ao usuário antes.

## Review Focus

1. **Falha no meio do envio** (linha gravada, segundo upload falha): o esperado é nenhuma linha e nenhum objeto sobrando. Teste na Task 3 com `MemoriaArmazem.falharEm`.
2. **Imagem disfarçada** (arquivo `.png` com bytes de GIF, ou PDF renomeado): 400 "Imagem em formato não aceito. Use PNG ou JPEG." Teste na Task 1 (`tipoDaImagem`) e na Task 4 (rota).
3. **Usuário comum tentando ler imagens ou listar** via URL direta da rota admin: 403. Teste na Task 4.
4. **Captura da tela falhando** (CORS de imagem, navegador antigo): o diálogo abre mesmo assim, sem print, com o aviso. Coberto pela função `capturarTela` devolver `null` em vez de lançar (Task 5, teste unitário de `montarFormularioReport` sem tela).
5. **Contexto com campos enormes ou estranhos** (userAgent de 5 KB, `url` com host, `prospect` com `../`): servidor corta/normaliza; `prospect` inválido vira `null`. Teste na Task 1.

---

### Task 1: Domínio dos reports (`packages/core/src/reports.ts`)

**Files:**
- Create: `src/packages/core/src/reports.ts`
- Test: `src/packages/core/test/reports.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TipoReport = "bug" | "melhoria"
  export type StatusReport = "aberto" | "em_andamento" | "resolvido" | "descartado"
  export const TIPOS_REPORT: readonly TipoReport[]
  export const STATUS_REPORT: readonly StatusReport[]
  export const ROTULO_TIPO: Record<TipoReport, string>      // "Bug", "Melhoria"
  export const ROTULO_STATUS: Record<StatusReport, string>  // "Aberto", "Em andamento", "Resolvido", "Descartado"
  export const LIMITE_COMENTARIO = 2000
  export const LIMITE_NOTA_ADMIN = 2000
  export const LIMITE_IMAGENS_EXTRAS = 3
  export const LIMITE_IMAGEM_BYTES = 5 * 1024 * 1024
  export const MSG_REPORTS_SEM_NUVEM = "Os reports só existem com os dados na nuvem."
  export interface ContextoReport { url: string; prospect: string | null; navegador: string; tela: { largura: number; altura: number } | null }
  export interface NovoReport { tipo: TipoReport; comentario: string; contexto: ContextoReport }
  export interface Report extends NovoReport {
    id: number; status: StatusReport; autor: string; imagens: string[]; notaAdmin: string | null
    criadoEm: string; atualizadoEm: string | null; atualizadoPor: string | null
  }
  export interface FiltroReports { status?: StatusReport[]; tipo?: TipoReport }
  export interface MudancaReport { status?: StatusReport; notaAdmin?: string | null }
  export type FormatoImagem = "png" | "jpg"
  export interface ImagemReport { bytes: Uint8Array; formato: FormatoImagem }
  export function validarNovoReport(entrada: unknown): NovoReport            // ErroEntrada
  export function validarMudancaReport(entrada: unknown): MudancaReport      // ErroEntrada
  export function tipoDaImagem(bytes: Uint8Array): FormatoImagem | null
  export function validarImagensReport(tela: Uint8Array | null, extras: Uint8Array[]): ImagemReport[] // ErroEntrada; tela primeiro
  export function textoReports(reports: Report[], urlImagem: (id: number, n: number) => string): string
  ```

- [ ] **Step 1: Write the failing tests** em `test/reports.test.ts`:
  - `validarNovoReport` aceita `{ tipo: "bug", comentario: "  Botão não salva  ", contexto: { url: "/prospects/acme?x=1", prospect: "acme", navegador: "UA", tela: { largura: 1440, altura: 900 } } }` e devolve o comentário aparado.
  - Recusa (ErroEntrada) tipo ausente ou `"outro"` com "Escolha se é um bug ou uma melhoria."; comentário vazio com "Escreva o que aconteceu ou o que sugere."; comentário de 2001 caracteres com "O comentário passa de 2000 caracteres.".
  - Ignora `autor` vindo na entrada (o resultado não tem a chave `autor`).
  - Contexto: `url` com host (`"https://x.com/a"`) vira `"/a"`; `url` corta em 500 caracteres; `navegador` corta em 300; `prospect` `"../etc"` ou `"Acme Ltda"` vira `null` (só aceita valor não vazio com `normalizarSlug(v) === v`); `tela` com número negativo, não inteiro ou ausente vira `null`; contexto ausente vira `{ url: "", prospect: null, navegador: "", tela: null }`.
  - `validarMudancaReport({ status: "resolvido" })` ok; `{ status: "fechado" }` dá "Status inválido."; `{ notaAdmin: "  " }` vira `{ notaAdmin: null }`; nota de 2001 caracteres dá "A nota passa de 2000 caracteres."; `{}` dá "Nada para alterar.".
  - `tipoDaImagem`: assinatura PNG (`89 50 4E 47 0D 0A 1A 0A`) → `"png"`; JPEG (`FF D8 FF`) → `"jpg"`; GIF (`47 49 46 38`) → `null`; vazio → `null`.
  - `validarImagensReport`: tela JPEG dá "O print da tela precisa ser PNG."; 4 extras dá "Envie no máximo 3 imagens além do print."; imagem de `LIMITE_IMAGEM_BYTES + 1` dá "Cada imagem pode ter no máximo 5 MB."; extra GIF dá "Imagem em formato não aceito. Use PNG ou JPEG."; tela + 2 extras devolve 3 itens com a tela primeiro; sem tela e sem extras devolve `[]`.
  - `textoReports`: lista vazia → `"Nenhum report."`; um report gera bloco que começa com `## #7 · Bug · Aberto`, contém o comentário, `Autor: ana (05/11)` (via `nomeCurto` e data dd/mm em America/Sao_Paulo), `Página: /prospects/acme`, `Prospect: acme` (linha omitida quando `null`), e `- <urlImagem(7, 0)>` para cada imagem; blocos separados por linha em branco, na ordem recebida.

- [ ] **Step 2: Run to verify it fails**
  Run: `cd src/packages/core && npx vitest run test/reports.test.ts`
  Expected: FAIL (módulo `../src/reports` não existe).

- [ ] **Step 3: Implement `src/reports.ts`** com as assinaturas acima. Sem imports de `node:`; usa `ErroEntrada` de `./erros`, `nomeCurto` de `./autenticacao` e `normalizarSlug` de `./slug` (prospect válido: não vazio e `normalizarSlug(v) === v`). `url` com host: parsear com `new URL(valor, "http://x")` e ficar com `pathname + search`.

- [ ] **Step 4: Run to verify it passes**
  Run: `cd src/packages/core && npx vitest run test/reports.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(core): domínio dos reports de bug e melhoria`

---

### Task 2: Persistência — interfaces, memória, Supabase e migração

**Files:**
- Create: `supabase/migrations/20261113120000_reports.sql`
- Modify: `src/packages/core/src/nuvem/tipos.ts` (interfaces `Repositorio` e `ArmazemArquivos`)
- Modify: `src/packages/core/src/nuvem/memoria.ts` (`MemoriaRepositorio`, `MemoriaArmazem`; `OperacaoArmazem` ganha `"enviarImagemReport"`)
- Modify: `src/packages/core/src/nuvem/supabase.ts` (`SupabaseRepositorio`, `SupabaseArmazem`, `BUCKET_REPORTS = "planejamento-reports"`)
- Modify: `src/packages/core/test/nuvem/contrato-repositorio.ts`, `contrato-armazem.ts`, `supabase.test.ts` (limpeza da suíte viva)

**Interfaces:**
- Consumes: tipos da Task 1.
- Produces (em `Repositorio`):
  ```ts
  /** Grava com status "aberto" e imagens []. Não valida (quem chama valida). */
  criarReport(r: NovoReport & { autor: string }): Promise<Report>
  definirImagensReport(id: number, caminhos: string[]): Promise<void>
  /** Só para desfazer um envio que falhou. */
  apagarReport(id: number): Promise<void>
  /** Mais recentes primeiro. */
  listarReports(filtro?: FiltroReports): Promise<Report[]>
  lerReport(id: number): Promise<Report | null>
  /** Grava atualizadoEm = agora e atualizadoPor = por. Null quando não existe. */
  atualizarReport(id: number, mudanca: MudancaReport, por: string): Promise<Report | null>
  ```
  Em `ArmazemArquivos`:
  ```ts
  enviarImagemReport(caminho: string, imagem: ImagemReport): Promise<void>   // contentType image/png | image/jpeg
  baixarImagemReport(caminho: string): Promise<Uint8Array>                    // ErroNaoEncontrado se não existe
  /** Apaga tudo de `<id>/`; não falha se não há nada. */
  apagarImagensReport(id: number): Promise<void>
  ```

- [ ] **Step 1: Write the failing contract tests.**
  - `contrato-repositorio.ts`, caso "cria, lista com filtro, lê, atualiza e apaga um report": cria um bug e uma melhoria com `autor: novoEmail()`; `listarReports()` traz os dois, o mais novo primeiro; `listarReports({ tipo: "bug" })` só o bug; `listarReports({ status: ["aberto", "em_andamento"] })` os dois; `definirImagensReport(id, ["<id>/0.png"])` aparece em `lerReport(id).imagens`; `atualizarReport(id, { status: "resolvido", notaAdmin: "feito" }, "carla@boomer.com.br")` devolve status, nota, `atualizadoPor` e `atualizadoEm` não nulo; `atualizarReport(id, { notaAdmin: null }, …)` mantém o status; `atualizarReport(999999999, …)` é `null`; `apagarReport(id)` faz `lerReport(id)` virar `null`. O `contexto` volta igual ao gravado.
  - `contrato-armazem.ts`, caso "envia, baixa e apaga imagens de report": id único por caso (`Date.now()` + aleatório no intervalo seguro); envia `<id>/0.png` e `<id>/1.jpg`; baixa os bytes iguais; `apagarImagensReport(id)` faz `baixarImagemReport` lançar `ErroNaoEncontrado`; apagar de novo não lança.

- [ ] **Step 2: Run to verify it fails**
  Run: `cd src/packages/core && npx vitest run test/nuvem/memoria.test.ts`
  Expected: FAIL (métodos inexistentes / tsc).

- [ ] **Step 3: Implement the memory versions** em `memoria.ts` (array + contador, cópias defensivas como nas notas; `enviarImagemReport` chama `this.verificar("enviarImagemReport", caminho)` para os testes injetarem falha).

- [ ] **Step 4: Run to verify it passes**
  Run: `cd src/packages/core && npx vitest run test/nuvem/memoria.test.ts`
  Expected: PASS.

- [ ] **Step 5: Write the migration** `supabase/migrations/20261113120000_reports.sql`, idempotente, no estilo de `20261110120000_notas_skills.sql`:
  - tabela com as colunas e `check`s da spec (`nota_admin` com `check (nota_admin is null or char_length(nota_admin) <= 2000)`), índice `reports_status_criado (status, criado_em desc)`, RLS ligado, `revoke all … from public, anon, authenticated`, `grant all … to service_role`, `grant usage, select on sequence planejamento.reports_id_seq to service_role`;
  - `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('planejamento-reports', 'planejamento-reports', false, 5242880, array['image/png','image/jpeg']) on conflict (id) do nothing;`

- [ ] **Step 6: Implement the Supabase versions** em `supabase.ts`, seguindo `listarNotasSkills`/`criarNotaSkill` (mapeamento snake_case ↔ camelCase numa função `paraReport(linha)`) e `apagarPasta` para `apagarImagensReport`. Filtro de status com `.in("status", …)`. `baixarImagemReport` usa `ehObjetoAusente` para lançar `ErroNaoEncontrado`.

- [ ] **Step 7: Live-suite cleanup** em `supabase.test.ts`: acrescentar `"planejamento-reports"` a `BUCKETS` e um bloco que lê `reports` (`id, autor`), filtra por `ehEmailDeContrato(autor)`, apaga os objetos `<id>/` e a linha.

- [ ] **Step 8: Typecheck e testes do core**
  Run: `cd src/packages/core && npx tsc --noEmit && npm test`
  Expected: sem erros; tudo PASS.

- [ ] **Step 9: Commit** — `feat(core): tabela e bucket dos reports, com memória, Supabase e contrato`

- [ ] **Step 10: Pedir ao usuário para aplicar a migração** (via MCP do Supabase, `apply_migration` com nome `planejamento_reports`). Depois de aplicada, rodar `cd src/packages/core && npm run test:supabase` e esperar PASS, incluindo os casos novos.

---

### Task 3: Armazenamento e serviço

**Files:**
- Modify: `src/packages/core/src/armazenamento.ts` (stubs do `FsArmazenamento`)
- Modify: `src/packages/core/src/nuvem/armazenamento-nuvem.ts`
- Modify: `src/packages/core/src/servico-planejamento.ts`
- Test: `src/packages/core/test/servico-reports.test.ts`

**Interfaces:**
- Consumes: Tasks 1 e 2.
- Produces (no armazenamento base e em `NuvemArmazenamento`):
  ```ts
  criarReport(novo: NovoReport, autor: string, imagens: ImagemReport[]): Promise<Report>
  listarReports(filtro?: FiltroReports): Promise<Report[]>
  lerReport(id: number): Promise<Report | null>
  atualizarReport(id: number, mudanca: MudancaReport, por: string): Promise<Report | null>
  baixarImagemReport(caminho: string): Promise<Uint8Array>
  ```
  No `ServicoPlanejamento`:
  ```ts
  criarReport(entrada: unknown, autor: string, tela: Uint8Array | null, extras: Uint8Array[]): Promise<Report>
  listarReports(filtro?: FiltroReports): Promise<Report[]>
  atualizarReport(id: number, entrada: unknown, por: string): Promise<Report>          // ErroNaoEncontrado("Report não encontrado.")
  imagemReport(id: number, n: number): Promise<{ bytes: Uint8Array; contentType: "image/png" | "image/jpeg" }> // ErroNaoEncontrado("Imagem não encontrada.")
  ```

- [ ] **Step 1: Write the failing tests** em `test/servico-reports.test.ts`, com `NuvemArmazenamento` sobre `MemoriaRepositorio` + `MemoriaArmazem` (montagem igual à de `apps/web/app/api/admin/skills.test.ts`) e um caso com `FsArmazenamento`:
  - `criarReport` com tela PNG + 1 extra JPEG grava `imagens: ["<id>/0.png", "<id>/1.jpg"]` e `autor` igual ao argumento.
  - Com `armazem.falharEm = (op) => op === "enviarImagemReport" && <segunda chamada>`: rejeita, `listarReports()` fica vazio e `baixarImagemReport("<id>/0.png")` lança `ErroNaoEncontrado` (desfez tudo).
  - Entrada inválida (comentário vazio) rejeita com `ErroEntrada` sem gravar nada.
  - `imagemReport(id, 1)` devolve os bytes e `contentType: "image/jpeg"`; `imagemReport(id, 5)` e `imagemReport(999, 0)` lançam `ErroNaoEncontrado`.
  - `atualizarReport(999, { status: "resolvido" }, "x")` lança `ErroNaoEncontrado`; `atualizarReport(id, { status: "fechado" }, "x")` lança `ErroEntrada`.
  - Com `FsArmazenamento`: `criarReport` e `listarReports` lançam `ErroEntrada` com `MSG_REPORTS_SEM_NUVEM`.

- [ ] **Step 2: Run to verify it fails**
  Run: `cd src/packages/core && npx vitest run test/servico-reports.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `FsArmazenamento`: os cinco métodos lançam `new ErroEntrada(MSG_REPORTS_SEM_NUVEM)`.
  - `NuvemArmazenamento.criarReport`: `repositorio.criarReport({ ...novo, autor })` → para cada imagem `i`, `armazem.enviarImagemReport(\`${id}/${i}.${formato}\`, imagem)` → `definirImagensReport` → `lerReport`. Em qualquer falha depois da linha criada: `apagarImagensReport(id)` e `apagarReport(id)` (cada um em `try/catch` próprio, para a falha original ser a que sobe) e relançar. Os demais delegam.
  - `ServicoPlanejamento`: `criarReport` chama `validarNovoReport` e `validarImagensReport` antes de tocar no armazenamento; `imagemReport` acha o caminho por índice em `report.imagens` e deriva o `contentType` pela extensão.

- [ ] **Step 4: Run to verify it passes**
  Run: `cd src/packages/core && npx vitest run test/servico-reports.test.ts && npx tsc --noEmit`
  Expected: PASS, sem erros de tipo.

- [ ] **Step 5: Commit** — `feat(core): serviço dos reports, com desfazer quando o envio falha`

---

### Task 4: Rotas da API

**Files:**
- Create: `src/apps/web/app/api/reports/route.ts` (POST)
- Create: `src/apps/web/app/api/admin/reports/route.ts` (GET)
- Create: `src/apps/web/app/api/admin/reports/[id]/route.ts` (PATCH)
- Create: `src/apps/web/app/api/admin/reports/[id]/imagens/[n]/route.ts` (GET)
- Create: `src/apps/web/app/api/admin/reports/id-do-report.ts` (`idInteiro(bruto: string, msg: string): number`, mesma regex `^[1-9]\d*$` de `skills/notas/[notaId]`, 404 com `msg`)
- Test: `src/apps/web/app/api/reports.test.ts`
- Modify (se a varredura exigir lista explícita): `src/apps/web/app/api/rotas-exigem-usuario.test.ts`

**Interfaces:**
- Consumes: métodos do `ServicoPlanejamento` da Task 3; `exigirUsuario`, `exigirAdmin` de `@/lib/sessao`; `json`, `lerJson`, `respostaDeErro` de `@/lib/http`.
- Produces (contrato HTTP):
  - `POST /api/reports` — `multipart/form-data`: `dados` (string JSON `{ tipo, comentario, contexto }`), `tela` (File opcional), `extras` (0–3 Files). 201 `{ id: number }`. `dados` ausente ou JSON inválido: 400 "Dados do report inválidos.".
  - `GET /api/admin/reports?status=aberto,em_andamento&tipo=bug` — 200 `{ reports: Report[] }`. Status/tipo desconhecidos são ignorados.
  - `PATCH /api/admin/reports/[id]` — corpo JSON `MudancaReport`. 200 `{ report: Report }`.
  - `GET /api/admin/reports/[id]/imagens/[n]` — bytes, `Content-Type` da imagem, `Cache-Control: private, max-age=3600`.

- [ ] **Step 1: Write the failing tests** em `app/api/reports.test.ts`, copiando a montagem de `admin/skills.test.ts` (mocks de `@supabase/ssr`, `next/headers`, `@/lib/servidor`; `entrarComo`); `CHEFE` admin, `ANA` usuário comum:
  - Sem sessão (`getClaims` sem claims): POST e GET admin dão 401.
  - ANA faz POST com `FormData` (dados válidos + `tela` PNG + 1 extra JPEG): 201; `servico.listarReports()` tem 1 report com `autor: ANA` mesmo com `autor: "x@y"` dentro de `dados`.
  - POST com extra GIF: 400 com "Imagem em formato não aceito. Use PNG ou JPEG."; com 4 extras: 400; com `dados` = `"{"`: 400 "Dados do report inválidos.".
  - ANA em GET admin, PATCH e imagem: 403.
  - CHEFE: GET `?status=aberto` lista 1; PATCH `{ status: "resolvido" }` devolve `atualizadoPor: CHEFE`; GET imagem `0` devolve os bytes e `content-type: image/png`; imagem `9` dá 404; `[id]` = `"abc"` dá 404 "Report não encontrado.".
  - Com `FsArmazenamento` no servidor: POST como ANA dá 400 com `MSG_REPORTS_SEM_NUVEM`.

- [ ] **Step 2: Run to verify it fails**
  Run: `cd src/apps/web && npx vitest run app/api/reports.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement the four routes.** Mesmo esqueleto de `skills/[id]/notas/route.ts` (try / `respostaDeErro`); `usuario.email === null` → `ErroEntrada("Sem e-mail na sessão, não dá para saber quem está reportando.")`. Arquivos lidos com `new Uint8Array(await file.arrayBuffer())`; antes de ler, recusar `file.size > LIMITE_IMAGEM_BYTES` para não alocar à toa.

- [ ] **Step 4: Run to verify it passes, incluindo a varredura**
  Run: `cd src/apps/web && npx vitest run app/api/reports.test.ts app/api/rotas-exigem-usuario.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(web): rotas de envio e triagem dos reports`

---

### Task 5: Botão "Reportar" e diálogo de envio

**Files:**
- Create: `src/apps/web/lib/report-envio.ts` (lógica pura, testável)
- Test: `src/apps/web/lib/report-envio.test.ts`
- Create: `src/apps/web/components/reports/botao-reportar.tsx`
- Create: `src/apps/web/components/reports/dialogo-report.tsx`
- Modify: `src/apps/web/components/marca/barra-topo.tsx` (botão antes de `<LinkAdministracao />`)
- Modify: `src/apps/web/lib/api.ts` (`enviarReport`, e os de admin usados na Task 6)

**Interfaces:**
- Consumes: rota `POST /api/reports` (Task 4); `MarcadorImagem` de `components/cards/marcador-imagem.tsx` (`{ titulo, urlImagem, marcas, primeiroNumero, aoMudar, aoFechar }`); `renderizarAnotada(url, marcas)` de `lib/anotacoes-canvas.ts` (devolve base64 **sem** o prefixo `data:`); `useAmbiente()` de `components/marca/conta-contexto.tsx`; tipos e limites de `@workspace/core/reports`.
- Produces:
  ```ts
  // lib/report-envio.ts
  export function contextoDaTela(loc: { pathname: string; search: string }, nav: { userAgent: string }, janela: { innerWidth: number; innerHeight: number }): ContextoReport
  //   prospect = segmento depois de /prospects/ quando o caminho começa assim, senão null
  export function montarFormularioReport(d: { tipo: TipoReport; comentario: string; contexto: ContextoReport; tela: Blob | null; extras: File[] }): FormData
  export function base64ParaBlob(base64: string, tipo: string): Blob
  export function extraAceito(arquivo: File): string | null   // mensagem de erro ou null; confere tipo MIME png/jpeg e tamanho (o servidor confere de novo os bytes)
  // lib/api.ts
  enviarReport: (form: FormData) => Promise<{ id: number }>   // fetch sem Content-Type manual (o navegador põe o boundary)
  ```

- [ ] **Step 1: Write the failing tests** em `lib/report-envio.test.ts`:
  - `contextoDaTela({ pathname: "/prospects/acme", search: "?aba=2" }, { userAgent: "UA" }, { innerWidth: 1440, innerHeight: 900 })` → `{ url: "/prospects/acme?aba=2", prospect: "acme", navegador: "UA", tela: { largura: 1440, altura: 900 } }`; em `"/admin/skills"` o `prospect` é `null`.
  - `montarFormularioReport` sem tela: `form.get("tela")` é `null`, `form.getAll("extras")` tem o tamanho de `extras`, e `JSON.parse(form.get("dados"))` não tem `autor`.
  - `extraAceito` recusa `image/gif` com "Imagem em formato não aceito. Use PNG ou JPEG." e arquivo de 5 MB + 1 com "Cada imagem pode ter no máximo 5 MB."; aceita `image/jpeg` pequeno.
  - `base64ParaBlob("iVBORw0KGgo=", "image/png").size` é 8.

- [ ] **Step 2: Run to verify it fails**
  Run: `cd src/apps/web && npx vitest run lib/report-envio.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `lib/report-envio.ts`** e `enviarReport` em `lib/api.ts`.

- [ ] **Step 4: Run to verify it passes**
  Run: `cd src/apps/web && npx vitest run lib/report-envio.test.ts`
  Expected: PASS.

- [ ] **Step 5: Implement the components.**
  - `BotaoReportar`: devolve `null` quando `!useAmbiente().nuvem`. Botão fantasma de ícone (`MessageSquareWarning` do `lucide-react`, `aria-label="Reportar bug ou melhoria"`, tooltip "Reportar"). No clique: `capturarTela()` **antes** de abrir o diálogo — `domToPng(document.body, { width: innerWidth, height: innerHeight, … })` com o mesmo deslocamento de rolagem que `capturarTela` do modo dev usa (`components/modo-dev/modo-dev.tsx:90`), em `try/catch` devolvendo `null`; guarda a data URL e abre o `DialogoReport`.
  - `DialogoReport` (`Dialog` de `@workspace/ui`): título "Reportar"; grupo de dois botões "Bug" / "Melhoria" (nenhum marcado); `Textarea` com contador `n/2000`; bloco do print com miniatura, botões "Marcar" (abre `MarcadorImagem`, `titulo="Print da tela"`, `primeiroNumero={1}`) e "Remover"; sem print, o aviso "Não consegui capturar a tela. Cole um print se quiser."; área de extras com "Adicionar imagem" (input `accept="image/png,image/jpeg"`) e colagem por `onPaste` no diálogo, mostrando cada extra com "Remover" e o erro de `extraAceito` num toast; "Enviar" desabilitado sem tipo, sem comentário ou enquanto envia.
  - Ao enviar: se há marcas, `renderizarAnotada(urlPrint, marcas)` → `base64ParaBlob(…, "image/png")`; senão converte a data URL do print direto. `montarFormularioReport` → `api.enviarReport`. Sucesso: fecha, limpa e `toast.success("Recebido, obrigado!")`. Erro: `toast.error(mensagem)` e mantém o diálogo.
  - `BarraTopo`: `<BotaoReportar />` imediatamente antes de `<LinkAdministracao />`.

- [ ] **Step 6: Typecheck, lint e testes do web**
  Run: `cd src && npm run typecheck && npm run lint && (cd apps/web && npm test)`
  Expected: sem erros; tudo PASS.

- [ ] **Step 7: Conferir no navegador** com o skill `run` (app local com os dados na nuvem de teste, ou pela VPS depois do deploy se o local não tiver nuvem): o print sai sem o diálogo, a marcação aparece no PNG enviado, colar com Ctrl+V adiciona extra. Se não der para rodar com nuvem localmente, registrar que essa conferência fica para a aceitação na VPS.

- [ ] **Step 8: Commit** — `feat(web): botão Reportar com print marcado e imagens extras`

---

### Task 6: Aba "Reports" no admin

**Files:**
- Modify: `src/apps/web/components/admin/abas-admin.tsx` (aba `{ href: "/admin/reports", rotulo: "Reports" }` no fim)
- Create: `src/apps/web/app/admin/reports/page.tsx`
- Create: `src/apps/web/components/admin/reports/painel-reports.tsx` (lista + filtros + copiar)
- Create: `src/apps/web/components/admin/reports/detalhe-report.tsx` (painel lateral)
- Create: `src/apps/web/lib/filtro-reports.ts` + `filtro-reports.test.ts`
- Modify: `src/apps/web/lib/api.ts`

**Interfaces:**
- Consumes: rotas admin da Task 4; `textoReports` e rótulos da Task 1; `nomeCurto` de `@workspace/core/autenticacao`.
- Produces:
  ```ts
  // lib/api.ts
  listarReports: (f: { status: StatusReport[]; tipo: TipoReport | null }) => Promise<{ reports: Report[] }>
  atualizarReport: (id: number, mudanca: MudancaReport) => Promise<{ report: Report }>
  urlImagemReport: (id: number, n: number) => string   // "/api/admin/reports/<id>/imagens/<n>"
  // lib/filtro-reports.ts
  export const STATUS_PADRAO: StatusReport[]           // ["aberto", "em_andamento"]
  export function consultaDoFiltro(f: { status: StatusReport[]; tipo: TipoReport | null }): string  // "?status=aberto,em_andamento" (+ "&tipo=bug"); status vazio = todos, sem parâmetro
  ```

- [ ] **Step 1: Write the failing test** `lib/filtro-reports.test.ts`: `consultaDoFiltro({ status: STATUS_PADRAO, tipo: null })` → `"?status=aberto,em_andamento"`; `{ status: [], tipo: "bug" }` → `"?tipo=bug"`; `{ status: [], tipo: null }` → `""`.

- [ ] **Step 2: Run to verify it fails**
  Run: `cd src/apps/web && npx vitest run lib/filtro-reports.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `filtro-reports.ts` e as funções de `api.ts`.**

- [ ] **Step 4: Run to verify it passes**
  Run: `cd src/apps/web && npx vitest run lib/filtro-reports.test.ts`
  Expected: PASS.

- [ ] **Step 5: Implement the page and components**, no visual das outras abas do admin (tabela/lista sem fundo próprio dentro do painel do layout):
  - `page.tsx`: componente de servidor fino que renderiza `<PainelReports />` (o layout do admin já exige admin).
  - `PainelReports`: filtros (tipo: Todos/Bug/Melhoria; status: chips multisseleção começando em `STATUS_PADRAO`), lista do mais recente para o mais antigo — selo do tipo, comentário em uma linha (`truncate`), `nomeCurto(autor)`, `contexto.url`, data dd/mm hh:mm, selo do status. Lista vazia: "Nenhum report com esses filtros.". Erro da API (ex.: modo fs): mostra a mensagem. Botão "Copiar para o Claude" copia `textoReports(reportsNaTela, (id, n) => location.origin + urlImagemReport(id, n))` e dá `toast.success("Copiado.")`.
  - `DetalheReport` (`Sheet` de `@workspace/ui`, lado direito): comentário completo; imagens (`<img src={urlImagemReport(id, n)}>`, `object-contain`, nunca esticada; clicar abre em nova aba); contexto (página como link, prospect, navegador, tela `LxA`); `Select` de status e `Textarea` da nota com "Salvar" → `api.atualizarReport`, atualizando o item na lista; rodapé "Atualizado por <nomeCurto> em <data>" quando houver.

- [ ] **Step 6: Typecheck, lint e testes**
  Run: `cd src && npm run typecheck && npm run lint && npm test`
  Expected: sem erros; tudo PASS.

- [ ] **Step 7: Commit** — `feat(web): aba Reports na administração`

---

### Task 7: Verificação final e build

- [ ] **Step 1: Build sem `.env`** (a worktree não tem `.env` na raiz; confirmar com `ls -a` na raiz da worktree)
  Run: `cd src && npm run build`
  Expected: build ok. Falha de `node:` em componente de cliente = algum componente importou módulo do core que não é `reports.ts`; corrigir o import.

- [ ] **Step 2: Suíte completa**
  Run: `cd src && npm run typecheck && npm run lint && npm test`
  Expected: tudo PASS.

- [ ] **Step 3: Atualizar a memória** `area-admin-pecas.md` (ou criar `reports-bugs-melhorias.md`) com o estado: spec, branch, migração aplicada ou não, o que falta (PR, deploy, aceitação na VPS).

- [ ] **Step 4: Seguir com superpowers:finishing-a-development-branch** (PR, merge, deploy na VPS e aceitação ficam com o usuário, como nas peças anteriores).
