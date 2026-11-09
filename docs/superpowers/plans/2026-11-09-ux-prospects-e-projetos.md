# UX da janela de prospects e do painel de Projetos: Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar a home do administrador (cartões em seções, analista com foto do Gmail, etapa pelo nome, filtros) e transformar Administração → Projetos num painel com filtros e gráficos de gasto e tempo em dólar.

**Architecture:** O servidor ganha uma agregação pura (`metricas/painel.ts`) que recebe usos, presenças e projetos já lidos e devolve, de uma vez, números, série temporal, rosca e barras; uma rota nova de admin a serve com cache curto. O front usa o componente `chart` do shadcn (Recharts) com filtros guardados na URL. A foto vem de uma coluna nova em `planejamento.usuarios`, gravada no login depois de validada contra uma lista de domínios do Google. A fase de cada etapa passa a morar em `etapas.json`.

**Tech Stack:** TypeScript, Next.js 16.4 (modificado), React 19, shadcn `base-nova` sobre `@base-ui/react`, Tailwind v4, Recharts (via shadcn `chart`), vitest 5 (jsdom por arquivo), Supabase Postgres (schema `planejamento`).

**Spec:** `docs/superpowers/specs/2026-11-09-ux-prospects-e-projetos-design.md`

## Global Constraints

- Todo texto de interface em português; valores de gasto **só em US$** (`formatarUsd` de `@workspace/core/metricas/formato`); duração com `formatarDuracao`.
- **Gráficos nunca esticados ou distorcidos**, nem traços nem textos: usar só `ChartContainer` do shadcn (Recharts) com altura fixa em px e largura 100%; **proibido** `<svg preserveAspectRatio="none">` ou escala por CSS em texto de gráfico. Conferir em 360, 768 e 1440 px de largura, nos temas claro e escuro.
- Antes de código específico do Next, ler `src/apps/web/node_modules/next/dist/docs/` (`src/apps/web/AGENTS.md`). Componentes shadcn pelo CLI a partir de `src/`: `npx shadcn@latest add <nomes> -c apps/web`; composição com `render={…}`, nunca `asChild`; `nativeButton={false}` quando o `render` não for botão.
- Tudo do painel e do filtro de analista só para administrador; usuário comum continua vendo só os projetos dele e nunca recebe métrica de gasto.
- Custo de um turno é `custoTurnoUsd` (diferença do acumulado da sessão, `metricas/custo.ts`); nada novo pode somar `custoUsd` acumulado. O que for estimado (linhas antigas) segue marcado como estimado.
- Dados de uso só existem na nuvem; no modo disco `listarUsos` e `listarPresencas` vêm vazios: o painel mostra estado vazio claro, nunca `NaN` nem gráfico em branco sem texto.
- Nada fora do schema `planejamento` é tocado (o projeto Supabase é compartilhado com o `pit`). `.env.example` nunca entra em commit; commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Trabalhar na branch `feat/ux-prospects-e-projetos`.
- Não rodar o app local com o `.env` da produção (Supabase de verdade): verificação visual só com dados de fixture, modo disco e login desligado.
- Estilo do repositório: identificadores e comentários em português, sem ponto e vírgula em TS, aspas duplas; testes de componente em `.ts` com `createElement` e `react-dom/client` (não há `@testing-library`), jsdom por arquivo (`// @vitest-environment jsdom`).

## Review Focus

1. **Gráfico esticado ou ilegível** em largura estreita, larga e no tema escuro (os tokens `--chart-*` só existem no claro hoje). Pinado em Task 5 (tokens) e Task 7 (verificação visual obrigatória com capturas).
2. **Dados vazios e divisão por zero:** nuvem sem usos, modo disco, filtro sem resultado, período anterior com custo zero (variação "vs. anterior"), projeto sem dono. Teste em Task 3 e Task 7.
3. **Soma que não fecha:** série temporal, rosca, barras por projeto e total têm de dar o mesmo valor; linhas antigas (sem custo por turno) entram como estimadas sem duplicar; filtro de modelo soma só a parcela do modelo. Teste de invariante em Task 3.
4. **URL de foto insegura:** `user_metadata` é gravável pelo próprio usuário, então só `https` e domínios do Google são aceitos; foto falha nunca derruba o login; sem foto, iniciais. Teste em Task 2.
5. **Escala:** 100+ prospects (lista, filtros, nomes longos truncados, dono ausente, e-mails com caixa diferente) e a agregação com milhares de turnos sem reler a base a cada clique de filtro. Teste em Task 3, 4 e 6.
6. **Fuso de agrupamento:** um turno às 01:00 UTC pertence ao dia anterior no horário de Brasília; semana começa na segunda-feira. Teste em Task 3.

---

### Task 1: Fase de cada etapa no catálogo

**Files:**
- Modify: `.claude/skills/_shared/etapas.json` (campo `"fase"` em cada etapa)
- Modify: `src/packages/core/src/tipos.ts` (`EtapaCatalogo.fase`, ~l.34)
- Modify: `src/packages/core/src/catalogo.ts` (`validarCatalogo` ~l.14-40; nova `faseDaEtapa`)
- Test: `src/packages/core/test/catalogo.test.ts`

**Interfaces:**
- Produces: `EtapaCatalogo.fase?: string`; `export const FASE_ARQUIVADA = "Arquivada"`; `export function faseDaEtapa(c: Catalogo, etapa: string): string` (etapa fora do catálogo, como `briefing-benchmark`, devolve `FASE_ARQUIVADA`). Fases: `01`,`02` = "Contexto"; `03`,`04` = "Diagnóstico"; `05`,`06` = "Soluções e metas"; `07`,`08` = "Mídia e ação"; `final` = "Apresentação".

- [ ] **Step 1: Escrever os testes que falham** em `catalogo.test.ts`: o catálogo real tem `fase` não vazia em todas as 9 etapas e as cinco fases acima na ordem de aparição; `faseDaEtapa(catalogoReal(), "04") === "Diagnóstico"`; `faseDaEtapa(catalogoReal(), "briefing-benchmark") === "Arquivada"`; `validarCatalogo` recusa (lança) etapa sem `fase` num catálogo clonado com `delete`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run test/catalogo.test.ts` em `src/packages/core`.
- [ ] **Step 3: Implementar** o campo em `etapas.json` (sem travessão, o teste `sem-travessao.test.ts` confere), o tipo, a validação (campo obrigatório no JSON real) e `faseDaEtapa`. Os mocks de teste de página que montam `catalogo: { etapas: [{ id, rotuloStatus }] }` não mudam: o tipo é opcional, só a validação do arquivo real exige.
- [ ] **Step 4: Rodar** `npx vitest run test/catalogo.test.ts test/sem-travessao.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): fase de cada etapa em etapas.json`.

---

### Task 2: Foto do Google (coluna, repositório, validação, login)

**Files:**
- Create: `supabase/migrations/20261112120000_usuarios_avatar.sql`
- Modify: `src/packages/core/src/autenticacao.ts` (helpers de avatar)
- Modify: `src/packages/core/src/nuvem/usuarios.ts` (interface, `MemoriaUsuarios`), `src/packages/core/src/nuvem/usuarios-supabase.ts`
- Modify: `src/apps/web/app/auth/callback/route.ts` (grava a foto no login)
- Create: `src/apps/web/lib/avatares.ts`
- Test: `src/packages/core/test/autenticacao.test.ts` (ou o arquivo existente de `nomeCurto`), `src/packages/core/test/nuvem/contrato-usuarios.ts` + `usuarios.test.ts`, `src/apps/web/app/auth/callback/route.test.ts`

**Interfaces:**
- Migration: `alter table planejamento.usuarios add column if not exists avatar_url text;` (idempotente, mesmo padrão de RLS/grants da migration de `usuarios`, que já cobre a tabela).
- `autenticacao.ts`: `export function avatarSeguro(url: unknown): string | null` aceita só string com ≤ 512 caracteres, protocolo `https:` e host `googleusercontent.com` ou terminado em `.googleusercontent.com`; qualquer outra coisa vira `null`. `export function avatarDeClaims(claims: Record<string, unknown>): string | null` lê `claims.user_metadata.avatar_url`, depois `.picture`, e passa por `avatarSeguro` (`user_metadata` é lido como `unknown`; não vale como prova de identidade, só como fonte da foto).
- `RepositorioUsuarios` ganha, **sem alterar `registrarAcesso`** (os testes do Supabase falso fixam o formato das queries dele): `registrarAvatar(email: string, url: string | null): Promise<void>` (atualiza só se a pessoa existe; grava `null` apaga) e `avatares(): Promise<Map<string, string>>` (e-mail normalizado → URL; só quem tem foto). Implementar em `MemoriaUsuarios` e em `SupabaseUsuarios` (update por e-mail; select `email, avatar_url` paginado com `paginar`).
- `lib/avatares.ts` (servidor): `export async function avataresDosDonos(): Promise<Record<string, string>>` devolve `{}` no modo disco (`servidor().usuarios === null`) e o mapa de `usuarios.avatares()` no resto; erro vira `{}` (foto nunca quebra página).

- [ ] **Step 1: Escrever os testes que falham:** `avatarSeguro` aceita `https://lh3.googleusercontent.com/a/abc=s96-c` e recusa `http://…`, `https://evil.com/x.png`, `https://googleusercontent.com.evil.com/x`, `javascript:alert(1)`, string com 600 caracteres, número e `null`; `avatarDeClaims` prefere `avatar_url` a `picture` e devolve `null` sem `user_metadata`; contrato de usuários (memória e Supabase falso): `registrarAvatar` de e-mail existente aparece em `avatares()` com o e-mail normalizado, `registrarAvatar(email, null)` remove, e-mail inexistente não cria linha; teste do callback: login com claims contendo foto válida chama `registrarAvatar` uma vez, foto inválida não chama, e **se `registrarAvatar` lançar o login continua redirecionando normalmente**.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run test/autenticacao.test.ts test/nuvem/usuarios.test.ts` em core e `npx vitest run app/auth/callback/route.test.ts` em web.
- [ ] **Step 3: Implementar** a migration, os helpers, os métodos dos dois repositórios e, no callback, depois do `usuarioDeClaims` bem-sucedido e antes do redirect: importar `servidor` de forma tardia (`await import("@/lib/servidor")`, como em `sessao.ts`), chamar `registrarAvatar(identidade.email, avatarDeClaims(claims))` dentro de `try/catch` que ignora o erro. No modo disco (`usuarios === null`) não faz nada.
- [ ] **Step 4: Rodar** os testes acima e `supabase/testes/testar-usuarios.sh` se o docker estiver de pé (acrescentar ao `usuarios.sql` de teste uma asserção da coluna `avatar_url`). Expected: PASS.
- [ ] **Step 5: Commit** `feat: foto do Google guardada no login (coluna avatar_url, validada)`.

---

### Task 3: Agregação do painel (núcleo puro)

**Files:**
- Modify: `src/packages/core/src/metricas/custo.ts` (nova `custosPorTurno`)
- Create: `src/packages/core/src/metricas/painel.ts`
- Test: `src/packages/core/test/metricas-custo.test.ts`, `src/packages/core/test/metricas-painel.test.ts`

**Interfaces:**
- Consumes: `LinhaUso`, `LinhaPresenca`, `Limites`, `TempoSegundos` (`metricas/tipos.ts`); `classificarTempo`, `somarTempo`, `tempoUtil` (`metricas/tempo.ts`); `custoPorEtapa` (para o teste de invariante).
- Produces em `custo.ts`: `export interface CustoDatado { slug: string; etapa: string; autor: string | null; quando: string; usd: number; modelos: Record<string, number>; estimado: boolean }` e `export function custosPorTurno(usos: LinhaUso[]): CustoDatado[]`: linha nova (com `sessao` ou `custoTurnoUsd`) vira uma entrada em `fim` com `custoTurnoUsd` e seus `modelos`; linhas antigas de um mesmo (slug, etapa) viram **uma** entrada em `quando = maior fim do grupo`, `usd = maior custoUsd acumulado do grupo`, `modelos` da linha de maior acumulado, `estimado: true`. Invariante: para cada (slug, etapa), a soma de `usd` = `custoPorEtapa(...).get(etapa).usd`.
- Produces em `painel.ts` (tipos exatos):
```ts
export interface FiltroPainel { de: string; ate: string; donos: string[]; projetos: string[]; etapas: string[]; modelos: string[]; incluirTestes: boolean }
export interface EntradaProjeto { slug: string; nome: string; dono: string | null; teste: boolean; ativo: boolean; concluidoEm: string | null; pendencias: number }
export interface PontoSerie { inicio: string; total: number; porModelo: Record<string, number> }
export interface PainelMetricas {
  periodo: { de: string; ate: string; granularidade: "dia" | "semana" }
  totais: { custoUsd: number; estimado: boolean; tempoUtilSeg: number; custoAnteriorUsd: number; tempoUtilAnteriorSeg: number }
  concluidos: { media: number | null; mediana: number | null; n: number }
  contagem: { ativos: number; concluidos: number; comPendencia: number }
  serie: PontoSerie[]
  porEtapa: Array<{ etapa: string; fase: string; usd: number }>
  porProjeto: Array<{ slug: string; nome: string; dono: string | null; usd: number; porFase: Record<string, number>; tempoUtilSeg: number; ultimaAtividade: string | null }>
  tempoPorPessoa: Array<{ email: string; agenteSeg: number; ativoSeg: number; ociosoSeg: number }>
  tempoIgnoraModelo: boolean
}
export function agregarPainel(
  entrada: { projetos: EntradaProjeto[]; usos: LinhaUso[]; presencas: LinhaPresenca[]; faseDaEtapa: (etapa: string) => string; limites: Limites },
  filtro: FiltroPainel,
): PainelMetricas
```
Regras (decididas no spec): granularidade `"dia"` se o período tem ≤ 31 dias, senão `"semana"`; buckets no fuso `America/Sao_Paulo` (semana começa na segunda-feira; `inicio` é o instante ISO do começo do bucket). Período anterior = mesmo comprimento imediatamente antes de `de`; custo e tempo dele só entram em `totais.*Anterior*`. Filtros: `donos` e `projetos` selecionam projetos inteiros (e-mail comparado com `normalizarEmail`), `etapas` filtra turnos e blocos por etapa, `incluirTestes: false` exclui projetos com `teste`; `modelos` restringe o **custo** à parcela daqueles modelos (`modelos` de cada `CustoDatado`) e o tempo **não** filtra por modelo (`tempoIgnoraModelo = modelos.length > 0`). `concluidos`: média, mediana e N do custo total de vida dos projetos com `concluidoEm` dentro do período (projetos concluídos sem data ficam de fora da conta). `contagem` reflete o estado de hoje dos projetos visíveis pelos filtros de dono/projeto/teste e não muda com o período. `tempoPorPessoa` agrupa por e-mail da presença e do turno (blocos de `classificarTempo`), só dentro do período. Listas ordenadas: `porEtapa` por `usd` decrescente; `porProjeto` por `usd` decrescente; `serie` cronológica, **com os buckets sem gasto preenchidos com zero** (o gráfico não pode pular dias).

- [ ] **Step 1: Escrever os testes que falham:**
  - `custosPorTurno`: linhas novas viram uma entrada cada; linhas antigas do mesmo (slug, etapa) viram uma só, `estimado: true`, no maior `fim`; **soma por (slug, etapa) = `custoPorEtapa`** (invariante), inclusive com mistura de linhas novas e antigas na mesma etapa.
  - `agregarPainel`: `serie` com período de 7 dias tem 7 pontos, com zeros nos dias sem turno; um turno às `2026-11-10T01:00:00Z` cai no bucket de `2026-11-09` (Brasília); período de 60 dias agrupa por semana com `inicio` em segundas-feiras; **soma da série = soma de `porEtapa` = soma de `porProjeto` = `totais.custoUsd`** (com e sem filtro de modelo); filtro de modelo `["haiku"]` soma só a parcela e liga `tempoIgnoraModelo`; `donos` com e-mail de outra caixa (`Ana@X.com` vs `ana@x.com`) filtra igual; `incluirTestes:false` tira projeto de teste de tudo; `etapas:["briefing-benchmark"]` funciona e cai na fase "Arquivada"; **entrada vazia** (sem projetos, usos e presenças) devolve zeros, listas vazias e `concluidos = { media: null, mediana: null, n: 0 }` sem `NaN`; período anterior sem custo não gera divisão (os campos `*Anterior*` são só somas); projeto sem dono entra normalmente; `concluidos` conta só projetos com `concluidoEm` no período e usa custo de vida inteira.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run test/metricas-custo.test.ts test/metricas-painel.test.ts` em `src/packages/core`.
- [ ] **Step 3: Implementar** `custosPorTurno` e `agregarPainel` (puro, sem I/O; usar `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` para achar o dia local; uma passada nos usos e uma nos blocos de tempo).
- [ ] **Step 4: Rodar** os mesmos testes e `npx vitest run` do core. Expected: PASS, saída limpa.
- [ ] **Step 5: Commit** `feat(core): agregação do painel de métricas (série, etapas, projetos, pessoas)`.

---

### Task 4: Serviço, rota e cliente do painel

**Files:**
- Modify: `src/packages/core/src/servico-planejamento.ts` (novo método, perto de `metricasGerais` ~l.310)
- Create: `src/packages/core/src/metricas/cache-curto.ts`
- Create: `src/apps/web/app/api/admin/painel/route.ts`
- Create: `src/apps/web/lib/painel-filtro.ts`
- Modify: `src/apps/web/lib/api.ts` (tipos e `painelMetricas`)
- Test: `src/packages/core/test/metricas-cache-curto.test.ts`, `src/packages/core/test/servico-planejamento.test.ts` (ou arquivo de métricas do serviço), `src/apps/web/app/api/admin/painel.test.ts`, `src/apps/web/lib/painel-filtro.test.ts`

**Interfaces:**
- Consumes: `agregarPainel`, `FiltroPainel`, `EntradaProjeto`, `PainelMetricas` (Task 3); `faseDaEtapa` (Task 1); `avataresDosDonos` (Task 2); `exigirAdmin`, `usuariosDaNuvem`, `json`, `respostaDeErro` como em `app/api/admin/projetos/route.ts`.
- `cache-curto.ts`: `export class CacheCurto<T> { constructor(ttlMs: number, agora?: () => number); async obter(carregar: () => Promise<T>, forcar?: boolean): Promise<T> }` (uma carga em andamento é compartilhada; erro não fica em cache).
- `ServicoPlanejamento.painelDeMetricas(filtro: FiltroPainel, limites: Limites, opcoes?: { atualizar?: boolean }): Promise<{ painel: PainelMetricas; opcoes: { donos: string[]; projetos: Array<{ slug: string; nome: string }>; modelos: string[] } }>`: lê **uma vez** slugs, donos, usos, presenças e os estados (com `concluidoEm = estado.etapas.final.concluidaEm`, `ativo = etapaAtual !== null`, `pendencias`, `teste`) e guarda esse pacote num `CacheCurto` de 30 s (`atualizar: true` força); o filtro é aplicado depois, em memória, por `agregarPainel`. `opcoes.donos` são os e-mails distintos (ordenados), `modelos` os ids distintos achados nos usos.
- `painel-filtro.ts` (puro): `export type PeriodoRapido = "7d" | "30d" | "90d" | "ano"`; `export function filtroDeParametros(p: URLSearchParams, agora: Date): FiltroPainel` (padrão: 30 dias; `periodo=7d|30d|90d|ano` ou `de` e `ate` em `AAAA-MM-DD` para personalizado; `donos`, `projetos`, `etapas`, `modelos` separados por vírgula; `testes=1` liga `incluirTestes`; valores inválidos caem no padrão, nunca lançam); `export function parametrosDeFiltro(f: FiltroPainel, rapido: PeriodoRapido | "custom"): URLSearchParams` (inversa).
- Rota `GET /api/admin/painel`: `exigirAdmin()`, `usuariosDaNuvem()`, lê os mesmos parâmetros com `filtroDeParametros`, `?atualizar=1` força cache; resposta `json({ painel, opcoes, avatares })` (`avatares` de `avataresDosDonos()`).
- `api.ts`: `export interface RespostaPainel { painel: PainelMetricas; opcoes: { donos: string[]; projetos: Array<{ slug: string; nome: string }>; modelos: string[] }; avatares: Record<string, string> }` e `painelMetricas: (params: URLSearchParams) => chamar<RespostaPainel>("/api/admin/painel?" + params.toString(), { cache: "no-store" })`.

- [ ] **Step 1: Escrever os testes que falham:** `CacheCurto` (segunda chamada dentro do TTL não recarrega; depois do TTL recarrega; `forcar` recarrega; erro não fica em cache; duas chamadas simultâneas disparam uma carga); serviço com repositório em memória: um clique de filtro seguido de outro **não relê** `listarUsos` (espiar a chamada), `atualizar: true` relê; `filtroDeParametros` (padrão 30 dias; `periodo=7d`; `de/ate` válidos; datas inválidas e `ate < de` caem no padrão; listas por vírgula; round-trip com `parametrosDeFiltro`); rota (padrão de `app/api/admin/projetos.test.ts`): usuário comum recebe 403, sem login 401, modo disco devolve o erro de `usuariosDaNuvem`, admin recebe `painel`, `opcoes` e `avatares`.
- [ ] **Step 2: Rodar e ver falhar** (core e web).
- [ ] **Step 3: Implementar** na ordem: `CacheCurto`, método do serviço, `painel-filtro.ts`, rota, wrapper. A rota entra na varredura `rotas-exigem-usuario.test.ts` sozinha; confirmar que ele passa.
- [ ] **Step 4: Rodar** `npx vitest run` em core e em web (apenas os arquivos tocados + `rotas-exigem-usuario.test.ts`). Expected: PASS.
- [ ] **Step 5: Commit** `feat: rota de painel de métricas com filtros e cache curto`.

---

### Task 5: Kit de UI: gráficos, abas, avatar e tema escuro

**Files:**
- Modify: `src/package.json` / `src/apps/web/package.json` ou `src/packages/ui/package.json` (dependência `recharts`, instalada pelo CLI/`npm install` na pasta `src`)
- Create (pelo CLI): `src/packages/ui/src/components/{chart,tabs,avatar,toggle-group}.tsx`
- Modify: `src/packages/ui/src/styles/globals.css` (`--chart-1..5` no bloco `.dark`)
- Test: `src/apps/web/lib/paleta.test.ts` / `contraste.test.ts` (existentes; ajustar só se o CSS novo exigir)

**Interfaces:**
- Produces: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `type ChartConfig` de `@workspace/ui/components/chart`; `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`; `Avatar`, `AvatarImage`, `AvatarFallback`; `ToggleGroup`, `ToggleGroupItem` (nomes finais conforme o CLI gerar; os consumidores das Tasks 6 e 7 importam exatamente o que existir).

- [ ] **Step 1:** em `src/`, rodar `npx shadcn@latest add chart tabs avatar toggle-group -c apps/web` (CLI `4.x`, estilo `base-nova`). Confirmar que os arquivos caíram em `src/packages/ui/src/components/` e que `recharts` foi instalado; se o CLI sobrescrever arquivo existente, **recusar** e relatar.
- [ ] **Step 2: Escrever o teste que falha** (leitura de CSS, no padrão de `paleta.test.ts`): o bloco `.dark` de `globals.css` declara `--chart-1` a `--chart-5`, cada um com contraste ≥ 3:1 contra o fundo escuro `#070a12` (mesmo cálculo de `contraste.test.ts`), e os do `:root` continuam contra o fundo claro `#f5f6fa`.
- [ ] **Step 3: Implementar** valores escuros para `--chart-*` (mantendo a identidade: laranja, azul, verde, cinzas mais claros para fundo escuro) e conferir que `contraste.test.ts`, `paleta.test.ts` e `superficies.test.ts` continuam passando.
- [ ] **Step 4: Rodar** `npx vitest run lib/paleta.test.ts lib/contraste.test.ts lib/superficies.test.ts` e `npm run typecheck` em `src/`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): componentes de gráfico, abas, avatar e cores de gráfico no tema escuro`.

---

### Task 6: Janela de prospects (opção A)

**Files:**
- Modify: `src/apps/web/lib/filtro-prospects.ts` e `.test.ts`
- Create: `src/apps/web/components/marca/avatar-pessoa.tsx` e `avatar-pessoa.test.ts`
- Create: `src/apps/web/components/home/barra-etapas.tsx`
- Modify: `src/apps/web/components/home/card-prospect.tsx`, `grade-prospects.tsx` e `card-prospect.test.ts`
- Modify: `src/apps/web/app/page.tsx` e `page.test.tsx`
- Test: `src/apps/web/components/home/grade-prospects.test.ts` (novo)

**Interfaces:**
- Consumes: `avataresDosDonos` (Task 2), `Avatar*` e `Tabs` (Task 5), `nomeCurto`.
- `filtro-prospects.ts`: `FiltroProspects` passa a `{ busca: string; donos: string[]; etapas: EtapaId[]; soPendentes: boolean; email: string | null }` (`donos` e `etapas` vazios = todos); `filtrarProspects(lista, filtro): ResumoProspect[]` (busca por nome sem acento e sem caixa; `donos` por `normalizarEmail`); `export type Ordem = "atividade" | "nome" | "etapa"` e `ordenarProspects(lista, ordem): ResumoProspect[]` (atividade = `atualizadoEm` decrescente; etapa = `etapaAtual` na ordem de `ORDEM_ETAPAS`); `separarPorSituacao(lista): { emAndamento: ResumoProspect[]; concluidos: ResumoProspect[] }` (concluído = `etapaAtual === null`). O antigo `apenasMeus` deixa de existir: "Meus" vira `donos: [email]` na tela.
- `avatar-pessoa.tsx`: `export function AvatarPessoa({ email, nome, fotoUrl, tamanho }: { email: string | null; nome: string; fotoUrl?: string | null; tamanho?: "sm" | "md" })`; sem `fotoUrl` ou com a imagem falhando mostra iniciais (duas letras de `nome`) numa bolinha cuja cor vem de um hash estável do e-mail (paleta fixa de 6 cores do tema); `email: null` usa cinza neutro com "?". `export function iniciais(nome: string): string` e `export function corDoAvatar(email: string | null): string` puras e testadas. A imagem usa `referrerPolicy="no-referrer"` e `alt=""` (decorativa, o nome está ao lado).
- `barra-etapas.tsx`: `export function BarraEtapas({ concluidas, total, atual }: { concluidas: number; total: number; atual: boolean })`: `total` segmentos; `concluidas` verdes, o próximo laranja se `atual`, o resto neutro; `role="img"` com `aria-label` "3 de 8 etapas concluídas".
- `CardProspect({ prospect, fotoUrl })`: título (link esticado como hoje), analista (`AvatarPessoa` + `nomeCurto(dono)` ou "Sem dono") **para admin**, etapa atual em destaque pelo nome (`rotuloEtapaAtual`; concluído mostra "Concluído" em verde), `BarraEtapas`, "N de 8 etapas · atualizado em …", selo "N aprovação(ões) pendente(s)" e "Teste", menu ⋯ igual ao de hoje. Usuário comum: igual, sem a linha do analista.
- `GradeProspects({ prospects, etapas, avatares }: { …; avatares: Record<string, string> })`: cabeçalho como hoje; barra de busca e filtros (admin: **Analista** (select com os donos distintos e "Meus"), **Etapa**, "Com aprovação pendente", **Ordenar**; usuário comum: só busca, etapa e ordenar); seções **Em andamento** (aberta) e **Concluídos** (recolhida por padrão, botão com a contagem, `aria-expanded`), cada uma com contador; estados vazios por seção e "nenhum resultado" com botão "Limpar filtros".
- `page.tsx`: passa `avatares={await avataresDosDonos()}`; `page.test.tsx` ganha `usuarios: null` no mock de `servidor()` e ajusta o mock de `GradeProspects`.

- [ ] **Step 1: Escrever os testes que falham:** puros em `filtro-prospects.test.ts` (busca sem acento, `donos` com caixa diferente, `etapas`, `soPendentes`, os três `Ordem`, `separarPorSituacao`, lista de 200 prospects sem erro e ordem estável, prospect sem dono não quebra `donos`); `iniciais("Ana Souza") === "AS"`, `iniciais("matheus")` com uma palavra devolve uma letra, `corDoAvatar` é determinístico e igual para `Ana@X.com` e `ana@x.com`; jsdom em `avatar-pessoa.test.ts` (sem foto mostra iniciais; com foto renderiza `<img>` com `referrerpolicy="no-referrer"`; erro de carregar volta às iniciais); `card-prospect.test.ts` (admin vê analista e nome da etapa, usuário comum não vê analista, concluído mostra "Concluído"); `grade-prospects.test.ts` (seções separadas, "Concluídos" recolhida por padrão e abre ao clicar, filtro por analista reduz os cartões, "Limpar filtros" restaura, usuário comum não vê o filtro de analista).
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run lib/filtro-prospects.test.ts components/marca/avatar-pessoa.test.ts components/home app/page.test.tsx` em `src/apps/web`.
- [ ] **Step 3: Implementar** na ordem: filtro puro, `AvatarPessoa`, `BarraEtapas`, `CardProspect`, `GradeProspects`, `page.tsx`.
- [ ] **Step 4: Rodar** esses testes e `npm run typecheck` em `src/`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): home em seções com analista, foto, etapa por nome e filtros`.

---

### Task 7: Painel de Projetos com filtros e gráficos

**Files:**
- Modify: `src/apps/web/components/admin/painel-projetos.tsx` (reescrita; manter exports que outros arquivos usam: `EtapaRotulada`, `formatarDataHora`, `MarcaEstimado`, `ROTULO_BASE_PEQUENA`, `ordenarPorAtividade`, `filtrarPorNome`)
- Create: `src/apps/web/components/admin/painel/{barra-filtros,numeros-grandes,grafico-custo-tempo,rosca-etapas,barras-projetos,barras-pessoas,lista-projetos}.tsx`
- Create: `src/apps/web/lib/painel-csv.ts`
- Modify: `src/apps/web/app/admin/projetos/page.tsx`
- Test: `src/apps/web/lib/painel-csv.test.ts`, `src/apps/web/components/admin/painel/*.test.ts`, `src/apps/web/components/admin/painel-projetos.test.ts`

**Interfaces:**
- Consumes: `api.painelMetricas`, `RespostaPainel` (Task 4), `filtroDeParametros`/`parametrosDeFiltro` (Task 4), `Chart*`, `Tabs`, `ToggleGroup` (Task 5), `AvatarPessoa` (Task 6), `formatarUsd`/`formatarDuracao`.
- Estado de filtros **na URL** (`useSearchParams` e `router.replace`, sem recarregar), então o link da página reproduz a visão; a página busca `api.painelMetricas(params)` a cada mudança (com o cache do servidor) e mostra esqueleto enquanto carrega.
- `painel-csv.ts`: `export function painelParaCsv(r: RespostaPainel): string` (uma linha por projeto: projeto, analista, custo US$ com ponto decimal, tempo útil em segundos, última atividade ISO; separador `;`, aspas em campos com `;` ou `"`; começa com BOM UTF-8 para abrir no Excel).
- Componentes (todos recebem dados prontos por props, sem buscar nada, para testar e para verificar visualmente com fixture): `BarraFiltros` (período: `ToggleGroup` 7 dias/30 dias/90 dias/Ano + "Personalizado" que mostra dois `<input type="date">`; selects de Analista, Projeto, Etapa, Modelo; caixa "Incluir testes"; chips dos filtros ativos com ×; botão "Limpar"; botão "Atualizar" que manda `atualizar=1`; botão "Exportar CSV"); `NumerosGrandes` (custo no período com variação vs. anterior, tempo útil idem, custo médio por concluído com mediana e N, ativos/concluídos/pendências; variação só aparece se o valor anterior > 0, senão "sem período anterior"; custo estimado mostra a marca "estimado"); `GraficoCustoTempo` (área empilhada por modelo, `ChartContainer` com `h-[260px] w-full`, eixos com `tickFormatter` em US$ e data local `dd/MM`, tooltip com total e por modelo); `RosaEtapas` (rosca com total no centro como texto HTML sobreposto, não dentro do SVG; legenda em lista HTML; clique numa fatia liga o filtro de etapa); `BarrasProjetos` (horizontais, empilhadas por fase, top 8 com "ver todos" na lista; clique filtra o projeto); `BarrasPessoas` (empilhadas agente/ativo/ocioso com legenda; clique só destaca, nota "tempo não filtra por modelo" quando `tempoIgnoraModelo`; nota discreta de que custos antigos sem autor ficam de fora); `ListaProjetos` (abas Em andamento/Concluídos/Todos com contagens, busca, colunas Projeto, Analista com foto, Etapa atual pelo nome, Custo, Tempo útil, Atividade; linha leva a `/admin/projetos/[slug]`; ordenação por clique no cabeçalho).
- Estados: sem dados na nuvem ou modo disco mostra o `Empty` do kit com texto "Ainda não há uso registrado neste período"; cada gráfico com todos os valores zero mostra o mesmo texto no lugar do gráfico; erro mostra `Alert`.
- Cores: série e fases usam `var(--chart-N)` via `ChartConfig`; nenhuma cor hexadecimal solta nos componentes.

- [ ] **Step 1: Escrever os testes que falham:** `painelParaCsv` (cabeçalho, escape de `;` e `"`, BOM, números com ponto, painel vazio devolve só o cabeçalho); jsdom por componente com dados de fixture: `NumerosGrandes` (variação aparece com anterior > 0 e vira "sem período anterior" com zero, nunca `NaN`/`Infinity`), `RosaEtapas` (legenda lista fases com percentuais que somam 100 ±1; clicar numa fatia chama `aoFiltrarEtapa` com o id), `BarraFiltros` (clicar em "7 dias" gera `periodo=7d`; chip com × remove só aquele filtro; "Personalizado" mostra os dois campos de data), `ListaProjetos` (abas separam concluídos, busca, ordenação), `painel-projetos.test.ts` (o painel monta com `api.painelMetricas` simulado, mostra o estado vazio quando tudo é zero e o `Alert` em erro); manter verde o teste existente dos exports (`ordenarPorAtividade`, `filtrarPorNome`, `ROTULO_BASE_PEQUENA`).
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run lib/painel-csv.test.ts components/admin` em `src/apps/web`.
- [ ] **Step 3: Implementar** na ordem: CSV, `NumerosGrandes`, `BarraFiltros`, cada gráfico, `ListaProjetos`, o painel (estado na URL e filtro cruzado: clicar fatia/barra/projeto adiciona o filtro correspondente a `parametrosDeFiltro`, com chip visível para limpar), `page.tsx`. Ler `node_modules/next/dist/docs/` sobre `useSearchParams` dentro de `Suspense` antes de usar.
- [ ] **Step 4: Verificação visual obrigatória (Review Focus 1):** com uma rota temporária **de desenvolvimento** (`src/apps/web/app/admin/_demo/page.tsx`, só renderizada com `NODE_ENV === "development"`, alimentada por uma fixture em `src/apps/web/components/admin/painel/fixture-painel.ts` com ~12 projetos, 3 modelos, 90 dias, e uma variante vazia), subir o app em modo disco com login desligado (ver os modos em `src/packages/core/src/sistema.ts`; **nunca** com o `.env` da produção), capturar telas em 360, 768 e 1440 px nos temas claro e escuro e **olhar cada imagem** procurando: texto de eixo ou legenda esticado/espremido, traço de espessura desigual, rosca elíptica, rótulos cortados, barras sem rótulo legível, sobreposição. Corrigir o que achar, anexar os caminhos das capturas ao relatório e **remover a rota `_demo`** antes do commit (a fixture pode ficar como dado de teste).
- [ ] **Step 5: Rodar** `npx vitest run` em web e `npm run typecheck` em `src/`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): painel de Projetos com filtros e gráficos de custo e tempo`.

---

### Task 8: Detalhe do projeto: termos explicados, selo de modelo e barras simples

**Files:**
- Modify: `src/apps/web/components/admin/detalhe-projeto.tsx` e `detalhe-projeto.test.ts`
- Create: `src/apps/web/components/admin/legenda-termos.tsx`

**Interfaces:**
- Consumes: `SeloModelo` (`components/admin/selo-modelo.tsx`, exige `lista: ListaDeModelos`; usar o wrapper existente de `api.ts` para `GET /api/admin/modelos`), `Tooltip` do kit, `Table`.
- `legenda-termos.tsx`: `export const TERMOS = { agente: "…", ativo: "…", ocioso: "…", descartado: "…" }` com os significados definidos em `metricas/tempo.ts` (agente: turno do agente rodando; ativo: aba visível e interação recente; ocioso: sem interação por 5 min por padrão; descartado: ocioso por 15 min seguidos; tempo útil = agente + ativo) e `export function Termo({ id, children })` que envolve o rótulo num `Tooltip` acessível por teclado.
- No detalhe: cabeçalhos "Agente", "Analista ativo", "Ocioso" e "Descartado" usam `Termo`; a coluna Modelos usa `SeloModelo` com o custo ao lado; na tabela "Por etapa" a coluna Custo ganha uma barra horizontal fina proporcional ao maior custo entre as etapas; em "Por pessoa" o mesmo para custo dos turnos. Estrutura e dados não mudam.

- [ ] **Step 1: Escrever os testes que falham:** `TERMOS` tem as quatro chaves e nenhum texto vazio; o detalhe mostra o tooltip com o significado de "Ocioso" ao focar o cabeçalho; modelo aparece como selo (não como id cru); barra de custo da etapa mais cara tem largura 100% e a de custo zero tem 0%; o teste existente de `textoSemModelos` e `comparacoesDaEtapa` continua verde.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run components/admin/detalhe-projeto.test.ts`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `npx vitest run components/admin` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): detalhe do projeto com termos explicados, selo de modelo e barras`.

---

### Task 9: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Suítes completas:** `cd src && npm test && npm run typecheck && npm run lint`; `python3 -m pytest scripts/tests -q`; `node --test scripts/backup/linhas.test.mjs`; se o docker estiver de pé, `supabase/testes/testar-usuarios.sh`. Expected: tudo verde (se `lint` já falhava antes, comparar com `git stash` e relatar só o novo).
- [ ] **Step 2: Buscas finais:** `grep -rnE 'preserveAspectRatio="none"' src/apps/web src/packages/ui/src` vazio; `grep -rnE "#[0-9a-fA-F]{6}" src/apps/web/components/admin/painel` vazio (só `var(--…)`); nenhuma rota `_demo` em `src/apps/web/app`.
- [ ] **Step 3: Revisão visual final:** reexecutar as capturas da Task 7 sobre o head e conferir de novo nos três tamanhos e dois temas, incluindo a home com 30 prospects de fixture (admin e usuário comum) e a variante vazia do painel.
- [ ] **Step 4: Migration:** a coluna `avatar_url` só existe depois de `20261112120000_usuarios_avatar.sql` ser aplicada no Supabase. **Parar e pedir confirmação do usuário** antes de aplicá-la em produção e de qualquer deploy na VPS (ordem: aplicar a migration, depois `git pull`, `docker build` com `nohup` e `docker compose up -d app`; o app antigo ignora a coluna nova, então a migration pode ir antes sem parar o app).
- [ ] **Step 5: Abrir o merge** conforme escolha do usuário (merge local ou PR).
