# Catálogo de skills — desenho

Data: 2026-11-08 · Peça 4 de 4 da melhoria "área de administrador"

## Objetivo

Uma aba só do admin onde a equipe lê as skills ativas, entende como cada processo funciona por um
fluxograma e registra notas de melhoria. Depois, o admin traz essas notas para uma conversa com o Claude
Code, que muda as skills com revisão e deploy.

## Decisões (com maquete no companheiro visual)

| Pergunta | Decisão |
|---|---|
| O que o admin faz | Lê e anota (notas no banco). Não edita a skill pela tela; as skills continuam no Git |
| Fonte do fluxograma | Um arquivo `fluxo.mmd` (Mermaid) escrito à mão ao lado de cada skill |
| O que entra | Visão geral do processo, as 10 etapas, os subagentes ativos e as regras compartilhadas |
| Layout | Lista à esquerda, fluxograma no centro, notas à direita; texto completo num painel |
| Desenho | Mermaid no navegador, carregado sob demanda só nesta aba |

## 1. Itens do catálogo

Os itens são uma lista fixa no código, com `id`, grupo, título, resumo de uma linha e os caminhos de
texto e fluxo:

| id | Grupo | Texto | Fluxo |
|---|---|---|---|
| `visao-geral` | Processo | (só fluxo e resumo) | `.claude/skills/_shared/fluxo-geral.mmd` |
| `etapa:01` … `etapa:09`, `etapa:final` | Etapas | `.claude/skills/<pasta da skill>/SKILL.md`, com a pasta tirada de `etapas.json` (`skill`) | `.claude/skills/<pasta>/fluxo.mmd` |
| `subagente:analista-dados` | Subagentes | `.claude/agents/analista-dados.md` | `.claude/agents/analista-dados.fluxo.mmd` |
| `subagente:pesquisador-benchmark` | Subagentes | `.claude/agents/pesquisador-benchmark.md` | `.claude/agents/pesquisador-benchmark.fluxo.mmd` |
| `regra:padrao-visual` | Regras | `.claude/skills/_shared/padrao-visual.md` | nenhum |
| `regra:regras-de-validacao` | Regras | `.claude/skills/_shared/regras-de-validacao.md` | nenhum |
| `regra:repertorio-solucoes` | Regras | `.claude/skills/_shared/repertorio-solucoes.md` | nenhum |

- O `designer-apresentacao` (desativado) fica de fora.
- O texto é lido do disco a cada pedido. O `.claude` já vai na imagem da VPS (`COPY .claude /app/.claude`).
- Um `id` fora da lista nunca vira caminho de arquivo: só os caminhos da tabela são lidos.

## 2. Fluxogramas

- São 13 arquivos Mermaid (`flowchart TD`): a visão geral, as 10 etapas e os 2 subagentes.
- Cada fluxo de etapa mostra:
  - os insumos pedidos;
  - as fases ou passos da skill;
  - cada checkpoint de aprovação do analista;
  - os subagentes acionados;
  - as decisões (ex.: `Analista aprova?` com `sim`/`não, ajustar`);
  - a entrega final e o handoff para a próxima etapa.
- A visão geral mostra as etapas 01→10, o que cada uma entrega para a seguinte e onde entram os
  subagentes.
- Os fluxos dos subagentes mostram em quais etapas são acionados e o que fazem.
- Legenda comum, com classes Mermaid definidas em todos os arquivos:
  - `classDef checkpoint` laranja: aprovação do analista;
  - `classDef subagente` azul;
  - `classDef entrega` verde: entrega e handoff.
- Os fluxos são escritos lendo cada `SKILL.md` inteiro. Isso faz parte da implementação e é revisado
  como código.

## 3. Notas de melhoria

### Tabela `planejamento.notas_skills`

| Coluna | Tipo |
|---|---|
| `id` | `bigint` identity, primary key |
| `item` | `text not null` (um `id` do catálogo) |
| `texto` | `text not null`, com `check (char_length(texto) between 1 and 2000)` |
| `autor` | `text not null` |
| `criada_em` | `timestamptz not null default now()` |
| `resolvida_em` | `timestamptz` |
| `resolvida_por` | `text` |

- Índice em `(item, resolvida_em)`.
- RLS ligado, sem políticas, acesso só por `service_role`. Nada fora do schema `planejamento`.
- Entra no backup como tabela global (sem `slug`).

### Exportar

O botão `Copiar notas abertas` copia um texto em Markdown, agrupado por item, na ordem do catálogo:
```
## 03 · Diagnóstico de performance
- Checagem por bloco e não por gráfico (Matheus Moreira, 08/11)
```
Sem notas abertas, o texto é `Nenhuma nota aberta.`

O Claude Code também lê as notas direto do banco quando o usuário pede.

## 4. Tela (`/admin/skills`)

- Aba `Skills` em `abas-admin.tsx`, depois de `Modelos`.
- **Esquerda:**
  - lista agrupada em `Processo`, `Etapas`, `Subagentes` e `Regras compartilhadas`;
  - o número de notas abertas ao lado de cada item, quando for maior que 0;
  - abre em `visao-geral`.
- **Centro:**
  - título e resumo de uma linha;
  - fluxograma desenhado pelo Mermaid, com import dinâmico só no navegador;
  - abaixo do fluxograma, a legenda `Laranja: aprovação do analista · Azul: subagente · Verde: entrega`;
  - botão `Ver texto completo`, que abre o texto em Markdown num painel lateral (`Sheet`) com o
    componente `markdown.tsx` existente.
  - Nos itens sem fluxo (regras), o centro mostra direto o texto em Markdown.
  - Erro de sintaxe no fluxo: aviso `Não foi possível desenhar o fluxograma.`, e o resto da página
    segue.
- **Direita:**
  - campo `Nova nota` com botão `Adicionar`;
  - notas abertas, das mais novas às mais antigas, cada uma com texto, `<nome> · <dd/mm>` e
    `Marcar como resolvida`;
  - as resolvidas ficam recolhidas em `Resolvidas (<n>)`, com `Reabrir`.
- Topo da aba: botão `Copiar notas abertas`, com o toast `Notas copiadas.`
- **Telas estreitas:** a lista vira um `Select`, e as notas ficam abaixo do fluxograma.
- **Modo fs:** textos e fluxos aparecem; a coluna de notas mostra `A administração de pessoas só existe
  com os dados na nuvem.`

## 5. Rotas, erros e testes

### Rotas (todas com `exigirAdmin` como primeira instrução)

| Rota | Conteúdo |
|---|---|
| `GET /api/admin/skills` | `{ itens: Array<{ id, grupo, titulo, resumo, temFluxo, notasAbertas }> }` |
| `GET /api/admin/skills/[id]` | `{ id, titulo, resumo, texto: string \| null, fluxo: string \| null, notas: Nota[] }` |
| `POST /api/admin/skills/[id]/notas` | `{ texto }` → `201 { nota }` |
| `PATCH /api/admin/skills/notas/[notaId]` | `{ resolvida: boolean }` → `{ nota }` |

`[id]` chega codificado na URL (ex.: `etapa%3A03`).

### Erros

| Situação | Resposta |
|---|---|
| Item fora do catálogo | 404 `Item não encontrado.` |
| Nota com texto vazio ou com mais de 2000 caracteres | 400 |
| Nota inexistente | 404 |
| Usuário comum | 403 |
| Modo fs em rota de notas | 400 `A administração de pessoas só existe com os dados na nuvem.` |
| Arquivo de texto ou de fluxo ausente no disco | `texto`/`fluxo` vêm `null` (sem erro) |

### Testes

- **Catálogo:**
  - todos os caminhos de texto da tabela existem no repositório;
  - toda etapa e todo subagente ativo tem fluxo, e a visão geral também;
  - todo fluxo declara as três `classDef` (`checkpoint`, `subagente`, `entrega`).
- **Validade dos fluxos:** um teste do web carrega o parser do Mermaid (`mermaid.parse`) em ambiente de
  teste e confere os 13 arquivos. Se o parser não rodar em Node, um teste mais simples confere que todo
  arquivo começa com `flowchart TD` e que todo nó usado numa aresta é declarado.
- **Leitura:** um `id` desconhecido dá 404 e nenhuma leitura de disco acontece fora da lista.
- **Notas:**
  - criar, listar, resolver e reabrir (memória, Supabase falso e suíte viva opt-in);
  - texto vazio e texto com 2001 caracteres dão 400;
  - `notasAbertas` conta só as não resolvidas.
- **Exportar:** o texto agrupado por item na ordem do catálogo, e `Nenhuma nota aberta.`
- **Rotas:** 403, 404, 400 e o fluxo completo de uma nota. A varredura de rotas classifica as novas
  como admin.
- **Build:** `next build` numa worktree isolada sem o `.env` da raiz, antes do PR. O Mermaid não pode
  entrar no bundle do servidor nem quebrar o build.

### Deploy

1. Aplicar a migração de `notas_skills` antes da imagem nova.
2. Rodar o comando de sempre na VPS.
3. Aceitação:
   1. abrir a aba Skills;
   2. conferir a visão geral e o fluxo de 2 ou 3 etapas;
   3. criar uma nota, resolvê-la e reabri-la;
   4. usar `Copiar notas abertas`.

## Fora do escopo

- Editar o texto das skills pela tela.
- Histórico de versões das skills (o Git já guarda).
- Fluxograma das regras compartilhadas.
- Gerar fluxos automaticamente.
