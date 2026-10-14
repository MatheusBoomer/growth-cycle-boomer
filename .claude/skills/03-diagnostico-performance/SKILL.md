---
name: diagnostico-performance
description: Analisa o histórico de 12 meses de mídia paga, receita, sessões, conversão e Curva ABC de produtos do prospect, com gráficos e checagem manual obrigatória em cada etapa. Use após a contextualizacao-estrategica, com o histórico mensal e o relatório de produtos em mãos.
---

# Skill 03 — Diagnóstico de Performance

Skill 3 de 10. Corresponde aos Prompts 2 (Macro Financeiro) e 3 (Aquisição,
Dependência e Conversão) do processo original. Ainda estamos no Diagnóstico
Atual — **não proponha metas, plano de mídia ou soluções nesta etapa.**

Delega todo cálculo e geração de gráfico ao subagente `analista-dados`. Esta
skill orquestra e interpreta; não faz conta diretamente.

## Antes de começar (checklist do analista)

- [ ] `dados/historico-mensal.xlsx` anexado — planilha com os últimos 12
      meses, com investimento, receita, ROAS,
      sessões e conversão já quebrados por Google e Meta
- [ ] `dados/produtos-curva-abc.xlsx` anexado — relatório de produtos
      vendidos no ano (necessário só para a Curva ABC, etapa 4)
- [ ] Conferir manualmente cada gráfico e benchmark gerado antes de deixar a
      skill avançar — ver `regras-de-validacao.md`

## Fase 1 — Macro Financeiro

Analisar, nesta ordem obrigatória:

1. **Investimento total em mídia paga** — comportamento mês a mês, ritmo de
   escala ou retração, sazonalidade percebida.
2. **Receita Total (captada) vs Receita Aprovada** — diferença entre curvas,
   impacto financeiro da quebra, meses críticos, tendência estrutural.
3. **Taxa de quebra** — percentual médio, meses fora da média, se ultrapassa
   o limite saudável (~5%), possíveis causas estruturais.
4. **ROAS** — Global e por plataforma (Google, Meta): tendência, estabilidade,
   compressão em escala, diferença entre plataformas.

Para cada KPI: gerar gráfico mês a mês seguindo `padrao-visual.md`, incluir
linha de média do período e benchmark quando aplicável, então **parar e pedir
checagem manual** antes de escrever a análise (ver `regras-de-validacao.md`).

## Fase 2 — Aquisição, Dependência e Conversão

Usar a mesma planilha de dados gerais já enviada; não repedir. Analisar, nesta
ordem:

1. **Sessões** — globais e por plataforma, tendência, sazonalidade,
   concentração por canal, crescimento orgânico vs pago. Gerar um gráfico de linha com a conclusão incluindo sessões totais e por plataforma (Google e Meta).
2. **Dependência de mídia paga** — % de sessões pagas vs totais. Comparar
   obrigatoriamente com benchmark de mercado (ver tabela abaixo). Gerar um gráfico de mês a mês
3. **Taxa de conversão** — Global (benchmark 1–2%), Google (2–4%), Meta
   (1–2%). Plataformas acima ou abaixo do intervalo, indícios estruturais. Gerar um gráfico para cada levantamento de benchmark.
4. **Curva ABC** — usar `dados/produtos-curva-abc.xlsx`. Gerar: gráfico de
   barras com faturamento acumulado por Curva A/B/C; gráfico de barras com
   Top 10 produtos por faturamento; Tabela com os produtos por curva A/B/C.

### Benchmark de dependência de mídia paga por estágio

| Tipo de e-commerce / estágio | Dependência média saudável |
|---|---|
| E-commerce iniciante (0–6 meses) | 70–85% |
| Marcas DTC consolidadas (12–24 meses) | 45–60% |
| Marcas maduras / com CRM ativo | 30–45% |

### Conectar os KPIs

Ao final, conectar explicitamente: Sessões → Conversão → Receita; Dependência
paga → Sustentabilidade; Curva ABC → Capacidade real de escalar. Sem essa
conexão causal, a etapa não está concluída.

## Restrições

- Não falar de CAC ou LTV nesta skill — isso é a Skill 04.
- Não propor metas, plano de mídia ou ações corretivas.

## Critério de conclusão

- Todos os gráficos e tabelas gerados e confirmados manualmente.
- Cada gráfico/seção de análise aprovado salvo em `entrega/ativos-aprovados/`
  (ver `regras-de-validacao.md`).
- KPIs conectados causalmente entre si.
- Nenhuma solução foi antecipada.

## Encerramento e handoff

Ao concluir, marque "03 · Diagnóstico de performance" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída! Para começarmos a Skill 04, preciso de uma planilha
(Excel) com o histórico de vendas por cliente, o maior período que você
tiver. Só uma coisa importante antes de me mandar: tira qualquer CPF,
e-mail, telefone, endereço ou dado de cartão — deixa só o ID ou nome do
cliente, com valor total gasto e número de pedidos por cliente.

Quando estiver pronto, rode `/04-unidade-economica`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
