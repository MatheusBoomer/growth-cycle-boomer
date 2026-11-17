# Unidade econômica · Fase 2: LTV histórico e LTV/CAC

Aqui registramos o que o dado mostra, o benchmark e a suspeita de causa. Soluções ficam para a etapa de Soluções.

## 1. LTV histórico

### Base usada
- Relatório de clientes do site, desde o início da operação (2021) até SET/26. Não é só a janela de 12 meses do diagnóstico.
- 10.400 clientes únicos, com valor total gasto e número de pedidos consolidados por cliente.
- Receita histórica: R$ 3,24 mi, em 16.900 pedidos.
- Sem WhatsApp, sem influenciadoras e sem permutas: só pedidos do site.

### Fórmula
LTV histórico = ticket médio por pedido × média de pedidos por cliente = receita histórica ÷ número de clientes.

- Ticket médio por pedido: R$ 191,8 (R$ 3,24 mi ÷ 16.900 pedidos).
- Média de pedidos por cliente: 1,63 (16.900 ÷ 10.400).
- **LTV histórico: R$ 311,7 por cliente** (R$ 3,24 mi ÷ 10.400).

### Como ler esse número
- Coerência com o ticket: o ticket histórico (R$ 191,8) está dentro da faixa mensal do diagnóstico (R$ 171 a R$ 215).
- Recorrência: 69% dos clientes (7.176) compraram uma única vez. 31% (3.224) compraram duas vezes ou mais. Isso confirma a estimativa de cerca de 30% de recompra do kickoff.
- Os 31% que recompram geram 57,5% da receita histórica.
- Robustez da base: 10.400 clientes é uma base grande, mas o valor é puxado por uma cauda. A mediana é de R$ 219,1 por cliente, abaixo da média de R$ 311,7. Os 10% de clientes que mais gastaram respondem por 30,1% da receita.
- Ressalva: é LTV de receita, não de margem. A margem bruta declarada (68%, e 62% nos kits) ainda não foi confirmada. Com 68%, o LTV em margem seria de cerca de R$ 212, uma estimativa.

## 2. Teste de consistência
- Ranking dos 5 clientes com maior gasto histórico conferido pelo analista contra o relatório da Nuvemshop, sem divergência (valores, pedidos e IDs).
- Os 5 maiores gastos vão de R$ 2,7 mil a R$ 3,4 mil e somam 0,4% da receita histórica. Nenhum cliente isolado distorce o LTV.

## 3. LTV/CAC

- CAC do último mês do diagnóstico (SET): R$ 112,7.
- **LTV/CAC = R$ 311,7 ÷ R$ 112,7 = 2,77.**
- Benchmark (`benchmarks-kpi.md`): menor que 3 é ruim, de 3 a 5 é normal, acima de 5 é escala. Fonte a confirmar: referência de mercado.
- **Classificação: ruim** (abaixo de 3).

### Como a relação evoluiu (LTV histórico fixo contra o CAC de cada mês)
- Acima de 5 (escala) de OUT a FEV: 6,3x, 7,8x, 5,5x, 5,4x e 5,1x.
- Entre 3 e 5 (normal) de MAR a AGO: 4,9x em MAR, caindo para 3,1x em AGO.
- Abaixo de 3 (ruim) só em SET: 2,8x.
- Com a média do período (R$ 71,9) a relação seria 4,3x, normal. O número do último mês é o que vale para a classificação, porque é o custo de trazer um cliente hoje.
- O CAC que daria 3x é de R$ 103,9. SET passou desse valor em 8%.

### Como ler esse número
- Capacidade de escala: em SET, cada R$ 1 de mídia traz R$ 2,77 de receita de vida inteira, antes de custo de produto, frete e taxas. Em margem, a relação seria menor (cerca de 1,9x com 68%, estimativa).
- Risco estrutural: o CAC sobe todo mês e o LTV não sobe junto. A recorrência sustenta o LTV (31% de recompra, sem régua de reposição), mas não acompanha o custo de aquisição.
- Suspeita de causa: o LTV é puxado para baixo pela compra única (69%) e pela ausência de CRM ativo, enquanto o CAC sobe com a escala da mídia (ver Fase 1). A confirmar com a Luiza e a Bruna.

## Pontos para confirmar
- Margem por produto (kits e protetor sem confirmação) para refazer a relação em margem nas etapas seguintes.
- O LTV histórico mistura safras antigas e recentes: o relatório não traz data de compra, então não dá para separar o LTV por safra.
