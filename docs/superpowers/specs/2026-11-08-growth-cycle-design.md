# Growth Cycle: novo nome, etapa 07 oculta e renumeração

Data: 2026-11-08. Status: desenho aprovado pelo usuário, aguardando revisão do spec.

## Objetivo

1. O produto passa a se chamar **Growth Cycle** (hoje "Planejamento Estratégico").
2. A etapa 07 (`07-briefing-e-benchmark`) sai do processo: quem preenche o benchmark de anúncios não é mais o analista. A etapa fica **oculta, com os arquivos guardados**.
3. As etapas seguintes são renumeradas, e a apresentação final perde a seção "Benchmarking".

## Decisões do usuário

- A etapa 07 é ocultada e os arquivos ficam guardados (reativável), não apagados.
- A renumeração é completa: pastas, comandos, ids, arquivos de entrega, banco, testes. Não é só o número exibido.
- Os prospects existentes (disco e Supabase) são migrados.
- "Growth Cycle" substitui o nome em tudo que é nome. O uso comum da palavra "planejamento" em frases continua.
- O molde do deck (`molde-apresentacao.pptx`) é editado no código, com renderização para conferir.

## 1. Nome

Trocar "Planejamento Estratégico" (e variações de caixa e plural) por "Growth Cycle" em:

- título da aba (`app/layout.tsx`), login, barras do app e da home, painel de etapa;
- lista da home: "Growth Cycles" e "Nenhum Growth Cycle ainda";
- nome do arquivo baixado: `Growth Cycle - <prospect>.pptx` (`painel-etapa.tsx`, `nome-download.test.ts`);
- prompts do agente (`src/packages/core/src/prompts.ts`);
- `CLAUDE.md`, `README.md`, `Dockerfile`, skills, comandos e subagentes em `.claude/`;
- capa e textos do deck (`scripts/`, fixtures).

Não muda: nome da pasta do repositório, schema `planejamento` do banco, nome do MCP `planejamento`, migrations já aplicadas, specs e planos antigos em `docs/`, worktree `cliente-de-teste`, conteúdo de `clientes/`.

## 2. Etapa 07 oculta

- Mover `.claude/skills/07-briefing-e-benchmark/` e `.claude/commands/07-briefing-e-benchmark.md` para `.claude/skills/_desativadas/briefing-e-benchmark/`, com um `README.md` que explica como reativar.
- Remover a etapa de `etapas.json`, de `ORDEM_ETAPAS`, de `src/packages/core/src/catalogo-skills.ts`, do `fluxo-geral.mmd` e do `CLAUDE.md` (ordem de execução, pré-requisitos da Skill 07).
- Remover da verificação do sistema as checagens de `APIFY_TOKEN` e `ffmpeg` (`verificacao-sistema.tsx` e teste). `.env.example` e o README deixam de listar esses pré-requisitos como obrigatórios.
- Os scripts da Apify (`scripts/coleta_meta_ads.py` e correlatos) e `_shared/benchmark-*.md` ficam onde estão, sem uso.
- A skill 06 passa a apontar para a nova 07 no handoff.

## 3. Renumeração

| Antes | Depois |
|---|---|
| 07 Briefing e benchmark | oculta |
| 08 Mídia paga | 07 Mídia paga |
| 09 Plano de ação | 08 Plano de ação |
| 10 Apresentação final (id `final`) | 09 Apresentação final (id `final` continua) |

Renomear pastas de skill, comandos, `skill` e `numero` em `etapas.json`, `rotuloStatus`, arquivos de entrega (`secoes/08-midia-paga.md` vira `secoes/07-midia-paga.md`, e assim por diante), fluxogramas (`fluxo.mmd` de cada skill e `fluxo-geral.mmd`), `sugestoes-modelos.json`, testes e fixtures (`scripts/fixture_verdeluz/`, `montar-fixture.ts`).

### Migração de dados

Um script idempotente, com `--dry-run` e backup antes, em `scripts/` (disco) e uma migration SQL do Supabase.

- **Disco, por prospect em `clientes/`:** `.app/estado.json` (mapa de etapas e `etapaAtual`), `contexto/status-planejamento.md` (regenerado), nomes de arquivos de entrega e `contexto/decisoes/`.
- **Supabase:** `etapa_atual`, `eventos_conversa.etapa`, presença/tempo por etapa, `config_modelos` (chave primária `(etapa, alvo)`), custos e notas por etapa.
- **Ordem, para não colidir chaves:** arquivar a 07 antiga (id legado `briefing-benchmark`, não exibido, para preservar o total de custos), depois 08→07, depois 09→08.
- **Estado do prospect:** quem estava na 07 antiga (em andamento ou liberada) passa para a nova 07, liberada. Etapas concluídas mantêm o status.
- O script roda primeiro numa cópia local dos prospects. Aplicar na nuvem e fazer o deploy na VPS só com confirmação explícita do usuário.

## 4. Apresentação final

- Deck de 6 para 5 seções: 01 Cenário atual, 02 Desafios, 03 Metas, 04 Cenários e impactos, 05 Plano de ação.
- `10-apresentacao-final` vira `09-apresentacao-final`: remover a linha "03. Benchmarking" das duas tabelas, renumerar divisórias (01. a 05.), ajustar o texto "jornada (6 seções)" para 5 e retirar a regra "Benchmark: um slide `benchmark` por concorrente".
- Slide "Jornada" do molde: remover o item "Benchmarking" do XML do slide 2, redistribuir os 5 itens e renderizar para conferir. Se a imagem de fundo (`image1.png`) tiver numeração embutida e o resultado ficar torto, parar e avisar o usuário.
- O tipo `benchmark` fica no `ESQUEMA` de `scripts/gerar_apresentacao.py`, sem uso no roteiro padrão, para não quebrar testes e permitir reativação.
- Decks já entregues (adda, sottile-novo-modelo) não são regerados.

## 5. Verificação

- `npm test` em `src/apps/web` (inclui `lib/fluxos.test.ts`, que passa de 13 para 12 fluxos) e em `src/packages/core` (inclui `catalogo-skills.test.ts`, `maquina-estados.test.ts`, `status-md.test.ts`).
- Testes Python: `scripts/tests/` (molde e gerador do deck).
- Migração em `--dry-run` sobre cópia dos prospects, conferindo estado, status e nomes de arquivo antes e depois.
- Renderização do slide Jornada e de um deck de amostra.
- `grep` final por "Planejamento Estratégico" e "07-briefing" fora das exclusões acima.
- Regra do projeto: skill e fluxograma mudam juntos, no mesmo commit.

## Riscos

- Renumeração completa toca banco e prospects salvos: por isso backup, dry-run e execução só após confirmação.
- A edição do molde .pptx pode exigir ajuste visual manual.
- Trocar ids de etapa invalida sessões do agente em andamento (cada etapa tem a própria conversa). Prospects com etapa em andamento devem ser migrados com o app parado.
