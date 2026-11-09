# Briefing e benchmark (etapa 07 desativada)

Esta era a etapa 07 do planejamento: consolidava o briefing e fazia o benchmark de anúncios dos concorrentes na Biblioteca de Anúncios do Meta, com a coleta feita pela Apify (`scripts/coleta_meta_ads.py`).

Ela está desativada no Growth Cycle: o planejamento segue de metas e cenários (06) direto para a mídia paga, que passou a ser a 07. A pasta fica aqui, fora de `.claude/skills/`, para que o Claude Code não a reconheça como skill e o app não a mostre como etapa.

| Arquivo | O que é |
|---|---|
| `SKILL.md` | a skill, como era |
| `fluxo.mmd` | o fluxograma dela |
| `comando.md` | o comando `/07-briefing-e-benchmark`, como era em `.claude/commands/` |

## Como reativar

1. Mova a pasta de volta para `.claude/skills/07-briefing-e-benchmark/` e o `comando.md` para `.claude/commands/07-briefing-e-benchmark.md`. Como a numeração mudou, as skills seguintes precisam voltar a ser 08, 09 e 10 (mídia paga, plano de ação, apresentação final), com os comandos e os fluxogramas.
2. Recoloque a etapa em `.claude/skills/_shared/etapas.json`, em `ORDEM_ETAPAS` (`src/packages/core/src/tipos.ts`), na lista do catálogo (`src/packages/core/src/catalogo-skills.ts`) e em `.claude/skills/_shared/fluxo-geral.mmd`, renumerando as etapas seguintes nos mesmos lugares. O `sugestoes-modelos.json` também usa esses ids.
3. Os prospects já migrados para a numeração nova guardam o que a etapa produziu em `entrega/arquivo-etapa-07/`; o que o analista quiser reaproveitar precisa voltar à mão para o lugar de origem.
4. Configure o `APIFY_TOKEN` no `.env` da raiz (modelo em `.env.example`) e instale o `ffmpeg` (`brew install ffmpeg`). O app deixou de verificar os dois, então a verificação do sistema (`verificacao-sistema.tsx` e `/api/sistema`) também precisa voltar.
5. Rode `npm test` em `src/apps/web` e em `src/packages/core`: os testes de fluxogramas e de catálogo conferem a lista de etapas.
