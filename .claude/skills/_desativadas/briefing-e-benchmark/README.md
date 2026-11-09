# Briefing e benchmark (etapa 07 desativada)

Esta era a etapa 07 do planejamento: consolidava o briefing e fazia o benchmark de anúncios dos concorrentes na Biblioteca de Anúncios do Meta, com a coleta feita pela Apify (`scripts/coleta_meta_ads.py`).

Ela está desativada no Growth Cycle: o planejamento segue de metas e cenários (06) direto para a mídia paga, que passou a ser a 07. A pasta fica em `.claude/skills/_desativadas/`, fora das pastas de skill que o Claude Code e o app leem (`.claude/skills/<NN>-<nome>/`), para que o Claude Code não a reconheça como skill e o app não a mostre como etapa.

| Arquivo | O que é |
|---|---|
| `SKILL.md` | a skill, como era |
| `fluxo.mmd` | o fluxograma dela |
| `comando.md` | o comando `/07-briefing-e-benchmark`, como era em `.claude/commands/` |
| `benchmark_07.py` | o benchmark ilustrativo da antiga 07 da Verdeluz (cliente de teste), só como referência: não alimenta mais o fixture |

## O que continua no repositório, fora desta pasta

Nada disso é usado pelas etapas ativas; fica para a reativação.

| Caminho | O que é |
|---|---|
| `scripts/coleta_meta_ads.py` | a coleta na Biblioteca de Anúncios pela Apify (`coletar`) |
| `scripts/meta_ads_apify.py`, `scripts/meta_ads_selecao.py`, `scripts/meta_ads_midia.py` | o cliente da Apify, as regras de seleção dos criativos e o download/quadros de vídeo (ffmpeg) |
| `scripts/tests/test_coleta_meta_ads.py`, `test_meta_ads_apify.py`, `test_meta_ads_selecao.py`, `test_meta_ads_midia.py` | os testes desses scripts (seguem rodando no `pytest`) |
| `.claude/skills/_shared/benchmark-coleta-e-analise.md` | o roteiro de coleta e análise que a skill seguia |
| `.claude/skills/_shared/relatorio-benchmark.md`, `.claude/skills/_shared/benchmark-template.html` | o relatório HTML do benchmark e o template dele |
| `docs/referencias/benchmark-meta-ads/` | cópia da skill `benchmark-meta-ads` (versão com navegador) que deu origem às regras e ao template |
| `src/packages/core/src/atividade.ts` | ainda traduz as chamadas de `coleta_meta_ads.py` em texto de atividade no chat |

## Pré-requisitos (quando ativa)

O benchmark de anúncios coleta a Biblioteca de Anúncios do Meta pelo ator `apify/facebook-ads-scraper`. Uma vez por máquina:

1. Crie uma conta em apify.com e gere um token em **Settings → API & Integrations**.
2. Na raiz do projeto: `cp .env.example .env` e preencha `APIFY_TOKEN=`.
3. Instale o ffmpeg: `brew install ffmpeg`.

O token nunca aparece em arquivo gerado nem na conversa.

O analista informa o link da página de cada concorrente na Biblioteca de Anúncios (com `view_all_page_id=`): o script não gasta API procurando páginas.

Custo de referência: um benchmark completo (4 concorrentes + prospect, 5 criativos analisados por marca) usa por volta de 80 anúncios na Apify.

## Como reativar

1. Mova a pasta de volta para `.claude/skills/07-briefing-e-benchmark/` e o `comando.md` para `.claude/commands/07-briefing-e-benchmark.md`. Como a numeração mudou, as skills seguintes precisam voltar a ser 08, 09 e 10 (mídia paga, plano de ação, apresentação final), com os comandos e os fluxogramas. Ou, para não renumerar nada, reative com um id que não colida com nenhuma etapa atual.
2. Recoloque a etapa em `.claude/skills/_shared/etapas.json`, em `ORDEM_ETAPAS` (`src/packages/core/src/tipos.ts`), na lista do catálogo (`src/packages/core/src/catalogo-skills.ts`) e em `.claude/skills/_shared/fluxo-geral.mmd`, renumerando as etapas seguintes nos mesmos lugares. O `sugestoes-modelos.json` também usa esses ids. A etapa recolocada em `etapas.json` precisa do campo `"fase"` (o `validarCatalogo` recusa o catálogo sem ele); com o id `briefing-benchmark`, o painel de Projetos a rotula "(arquivada)" (`rotuloEtapa`, em `src/apps/web/components/admin/painel/graficos-dados.ts`, olha esse id e a fase `Arquivada`), então dê a ela uma fase de verdade e ajuste `ETAPA_ARQUIVADA` ali (ou use o id que não colide, do passo 1).
3. Cuidado com os prospects já migrados (`versaoEtapas: 2` no estado): neles a mídia paga e o plano de ação estão gravados como 07 e 08, no estado, nos eventos, no uso, na presença, nos arquivos e em `config_modelos`. Reativar com a renumeração antiga (07 = briefing, 08 = mídia paga, 09 = plano) exige uma migração inversa do estado em disco e no banco; sem ela, o app leria a mídia paga como briefing. O caminho mais simples é o id que não colide, do passo 1.
4. Os prospects migrados guardam o que a etapa produziu em `entrega/arquivo-etapa-07/` (e os eventos, o uso e a presença dela com o id `briefing-benchmark`); o que o analista quiser reaproveitar precisa voltar à mão para o lugar de origem.
5. Siga os pré-requisitos acima (`APIFY_TOKEN` e `ffmpeg`). O app deixou de verificar os dois, então a verificação do sistema (`verificacao-sistema.tsx` e `/api/sistema`) também precisa voltar.
6. Rode `npm test` em `src/apps/web` e em `src/packages/core`: os testes de fluxogramas e de catálogo conferem a lista de etapas.
