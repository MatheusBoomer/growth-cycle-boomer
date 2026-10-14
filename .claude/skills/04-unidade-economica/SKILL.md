---
name: unidade-economica
description: Calcula CAC, LTV histórico e a relação LTV/CAC do prospect a partir do relatório de clientes, com sanitização obrigatória de dados sensíveis (PII) e teste de consistência contra a plataforma de origem. Use após diagnostico-performance, com o relatório histórico por cliente em mãos.
---

# Skill 04 — Unidade Econômica e Estabilidade

Skill 4 de 10. Corresponde ao Prompt 4 do processo original. Isolada das
demais skills de diagnóstico por ser a única que processa dado potencialmente
sensível (PII). Ainda estamos no Diagnóstico Atual — não propor metas,
cenários, plano de mídia ou soluções.

## Antes de começar (checklist do analista)

- [ ] `dados/clientes-historico.xlsx` anexado — relatório completo de vendas
      por cliente, com o **maior histórico possível**, idealmente desde o
      início da operação (necessário para o LTV histórico real, não só do
      período do diagnóstico)
- [ ] **Antes de anexar**, confirme que o arquivo passou por tratamento:
      colunas desnecessárias removidas, cada linha representando um cliente
      único, valor total gasto e número total de pedidos consolidados por
      cliente, duplicidades removidas, identificador consistente

## ⚠️ Dados sensíveis

Este arquivo **não deve conter** CPF, e-mail, telefone, endereço ou dado de
cartão. Usar apenas ID do cliente, ou nome completo caso não haja ID. Se o
arquivo enviado contiver esses campos, interrompa e peça ao analista para
reenviar sem eles — não prossiga processando dado sensível mesmo que pareça
inofensivo fazer a conta com ele.

## Objetivo

Analisar: CAC global; clientes novos vs recorrentes (janela do diagnóstico);
LTV histórico da marca (histórico completo); relação LTV/CAC (LTV histórico
× CAC do último mês analisado).

## Processo

1. **CAC** — gráfico mês a mês, linha de média do período, checagem manual.
2. **Clientes novos vs recorrentes** — gráfico mês a mês (% novos, %
   recorrentes), usando a janela do diagnóstico atual (12 meses). Checagem
   manual.
3. **LTV histórico** — usando o relatório completo (não só os 12 meses):
   calcular ticket médio histórico por cliente, média de pedidos por
   cliente, LTV histórico médio. Explicitar a fórmula usada, o número total
   de clientes considerados e o período histórico utilizado. **Não gerar
   gráfico para LTV** — é um número consolidado, não uma série temporal.
4. **Teste de consistência (obrigatório):** gerar ranking Top-5 clientes por
   maior gasto histórico (ID/Nome, valor total, número de pedidos) e pedir
   ao analista para confirmar contra o ranking da própria plataforma de
   e-commerce. Se houver divergência, **interromper** até corrigir — ver
   `regras-de-validacao.md`.
5. **LTV/CAC** — calcular a relação usando LTV histórico e CAC do último mês
   do diagnóstico. Classificar:

| Relação LTV/CAC | Classificação |
|---|---|
| < 3 | Ruim — necessidade de melhoria na captação |
| 3 a 5 | Normal — dentro da média de mercado |
| > 5 | Oportunidade de escala |

## Estrutura da análise

1. CAC — tendência, estabilidade, pressão estrutural.
2. Novos vs Recorrentes — dependência estrutural de aquisição, indícios reais
   de retenção.
3. LTV Histórico — coerência com ticket médio, nível real de recorrência,
   robustez da base.
4. LTV/CAC — classificação segundo a tabela acima, capacidade real de
   escala, risco estrutural.

## Restrições

- Não propor metas, plano de mídia, melhorias ou otimizações. Estamos
  apenas diagnosticando.

## Critério de conclusão

- CAC validado, LTV histórico corretamente calculado com fórmula explícita.
- Ranking Top-5 confirmado contra a plataforma (ou divergência resolvida).
- LTV/CAC classificado.
- Análise salva em `entrega/ativos-aprovados/secoes/` após aprovação.

## Encerramento e handoff

Ao concluir, marque "04 · Unidade econômica" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída! Não preciso de arquivo novo agora. Na próxima etapa vou
abrir cada problema que encontramos no diagnóstico em hipóteses, soluções e
impacto em reais; vale lembrar o que o prospect já tentou para resolver cada
um.

Quando estiver pronto, rode `/05-solucoes`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo aviso.
