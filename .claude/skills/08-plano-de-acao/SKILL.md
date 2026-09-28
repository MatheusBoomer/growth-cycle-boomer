---
name: plano-de-acao
description: Organiza cronologicamente tudo que foi proposto no planejamento em um plano de ação priorizado, com responsável, prazo e forma de execução para cada item. Última etapa de conteúdo antes da montagem da apresentação final. Use após midia-paga, com o planejamento completo aprovado.
---

# Skill 08 — Plano de Ação Estratégico

Skill 8 de 8 — última etapa de conteúdo. Corresponde ao Prompt 10 do processo
original (numerado internamente como "Prompt 8" nos documentos antigos —
ignore essa numeração). Só organização e sequenciamento do que já foi
decidido — não cria novo direcionamento estratégico.

## Antes de começar (checklist do analista)

- [ ] Skills 01 a 07 concluídas e aprovadas.
- [ ] Confirmar a **data de hoje**, para que nenhuma ação seja proposta em
      período já passado.
- [ ] Confirmar o **cenário base** (Realista, salvo indicação contrária).
- [ ] Confirmar as **2–3 frentes prioritárias** — os maiores problemas do
      diagnóstico que precisam de solução mais urgente, para que o Horizonte
      1 esteja focado no que realmente move o negócio.

## Objetivo

Para cada ação, responder quatro perguntas: **O Quê** (tarefa), **Quando**
(período), **Por Quem** (agência, cliente, ou ambos), **Como** (instrução
prática de execução, sem ambiguidade).

## Base de dados obrigatória

Tudo que já foi decidido nas etapas anteriores (`contexto/decisoes/`) e nesta
conversa: problemas e oportunidades do
diagnóstico, estratégia por Curva ABC, calendário estratégico, planejamento
financeiro de mídia, estratégia de redução de dependências, achados de
benchmark aplicáveis, cenários e KPIs influenciadores. Não buscar dado novo.

## Estrutura — 3 horizontes temporais

- **Horizonte 1 — Imediato:** primeira semana após aprovação. Ações de maior
  impacto que desbloqueiam tudo que vem depois.
- **Horizonte 2 — Curto Prazo:** até o primeiro grande marco do calendário
  estratégico (primeiro mês de Pico ou Escala). Ajustes estruturais, testes,
  ações que dependem de execução do cliente.
- **Horizonte 3 — Médio Prazo:** constrói a base para os períodos de maior
  eficiência identificados no diagnóstico — comunidade, retenção,
  lançamentos, preparação para os meses de maior oportunidade.

## Critérios de priorização

1. Impacto direto nos KPIs Resultado.
2. Impacto nos KPIs Influenciadores.
3. Desbloqueio de outras ações — pré-requisitos vêm antes.
4. Responsabilidade clara — um responsável principal por ação, mesmo que
   outro apoie.

## Frentes obrigatórias (adaptar nomes ao contexto do prospect)

1. Mídia Paga / Canal Principal de Aquisição
2. Eficiência Operacional (taxa de quebra, conversão, CRO)
3. Produto / Mix / Portfólio
4. Redução de Dependências
5. Monitoramento e Governança (dashboard de KPIs, cadência, gatilhos de
   escala/contenção)

## Formato de entrega, por ação

```
AÇÃO: [nome da ação]
HORIZONTE: [Imediato / Curto Prazo / Médio Prazo]
O QUÊ: [descrição clara e objetiva]
QUANDO: [semana, mês ou período específico]
POR QUEM: [Agência / Cliente / Agência + Cliente]
COMO: [instrução prática — o suficiente para o cliente executar sem dúvida]
```

Consolidar ao final em uma tabela-resumo com todas as ações organizadas
cronologicamente: Ação | Horizonte | Quando | Quem | Frente.

## Output obrigatório — arquivo .docx (não é opcional)

O entregável final desta skill é sempre um arquivo `.docx` com a pautação da
Boomer — nunca só texto no chat ou markdown solto. Gerar esse arquivo é
critério de conclusão da skill, sempre, mesmo que o analista não peça
explicitamente.

- **Modelo:** `.claude/skills/_shared/[MODELO] Plano de Ação Estratégico.docx`
  — não editar o modelo; ele só fornece o banner da agência, as fontes
  (Montserrat embutida) e os estilos (título, cabeçalhos de horizonte,
  destaque amarelo do rótulo AÇÃO, tabela com cabeçalho azul-marinho
  `#1c2f5f` e linhas zebradas branco/`#eef2f8`).
- **Motor de montagem:** `scripts/preencher_plano_acao_docx.py` — nunca
  escrever o `.docx` na mão nem editar XML diretamente. Montar o JSON de
  entrada (prospect, os 3 horizontes com título/intro/ações, e a
  tabela-resumo) a partir do que já foi aprovado na conversa, e rodar:

  ```
  python scripts/preencher_plano_acao_docx.py \
    --modelo ".claude/skills/_shared/[MODELO] Plano de Ação Estratégico.docx" \
    --input <json_montado> \
    --output "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx"
  ```

- **Saída:** `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx`
  do prospect (nome estável, sobrescreve — ver `regras-de-validacao.md`).
- Cada horizonte no JSON precisa do título (com o período already confirmado
  com o analista) e, para Horizonte 2 e 3, a frase de intro de contexto (cinza,
  ver modelo) — Horizonte 1 normalmente não tem intro. Cada ação vai com os 4
  campos (`o_que`, `quando`, `por_quem`, `como`) exatamente como aprovados no
  chat, sem reescrever o conteúdo.
- Depois de gerar, confirmar com o analista que o `.docx` está correto antes
  de considerar a skill concluída — a checagem manual de sempre vale também
  para este arquivo.

## Restrições

- Não propor ações fora do escopo do que foi diagnosticado e planejado.
- Não criar ação genérica sem base em algum indicador do diagnóstico.
- Não descer a nível operacional (criativos, copies, configuração técnica de
  plataforma).
- Não propor ações para período já passado em relação à data atual.

## Critério de conclusão

- Toda frente identificada no diagnóstico tem ao menos uma ação
  correspondente.
- Cada ação tem responsável, prazo e forma de execução definidos.
- Tabela-resumo completa e cronologicamente coerente com a data atual.
- Um analista deveria conseguir ler o plano e saber o que fazer no primeiro
  dia útil após a apresentação.
- Arquivo `.docx` gerado pelo `scripts/preencher_plano_acao_docx.py` a partir
  do modelo da Boomer, aprovado pelo analista e salvo em
  `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx`.

## Encerramento e handoff

Ao concluir, marque "08 · Plano de ação" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída — esta era a última etapa de conteúdo! Não preciso de nada
novo — só confirma se o modelo de apresentação já está publicado no Canva, e
eu já monto o deck final.

Quando estiver pronto, rode `/apresentacao-final`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
