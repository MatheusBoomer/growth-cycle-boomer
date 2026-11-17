# Metas e cenários: Verdeluz Cosméticos Veganos

Período projetado: OUT/26 a SET/27, comparado mês a mês com OUT/25 a SET/26. Tudo em receita captada do site (R$ 1.220.462 no ano atual), antes da quebra de pagamento.

## A meta

- **Meta do projeto (Realista):** +30%, ou R$ 1.586.601 em 12 meses.
- **Classificação técnica:** agressiva. O investimento subiu 127% e a receita só 7,3% no último ano, e o LTV/CAC de SET/26 está em 2,77.
- **O +40% das sócias (R$ 1.708.647)** é o cenário Otimista, tratado como teto.
- **Os três cenários** são apresentados ao prospect, com o Realista em destaque.

## Como a meta foi quebrada mês a mês

A meta não cresce igual em todos os meses. Cada mês cresce sobre o mesmo mês do ano atual com três componentes:

- **Inércia do ano atual: +7,3%.** É a alta da receita captada de OUT a SET no histórico, sem alavanca nova.
- **Efeito das soluções (rampa).** Entra de forma gradual: perto de zero em OUT a DEZ e pleno a partir do meio do ano.
- **Bônus de ruptura em MAR e ABR.** Parte da perda de cerca de 22% daqueles meses volta quando o estoque de segurança (P2) funciona: 37,5% da perda no Pessimista, 50% no Realista e 70% no Otimista.

A sazonalidade do histórico foi mantida bruta: MAR e ABR não foram normalizados pela ruptura. NOV não recebe bônus, porque o desconto da Black Friday cai para cerca de 20%.

| Crescimento sobre o ano atual | Menor mês | Maior mês |
|---|---|---|
| Pessimista (+15%) | +7,3% (OUT e NOV) | +26,7% (ABR) |
| Realista (+30%) | +8,9% (OUT) | +53,3% (MAR e ABR) |
| Otimista (+40%) | +11,5% (OUT) | +68,7% (MAR e ABR) |

## Os três cenários

| | Ano atual | Pessimista | Realista | Otimista |
|---|---|---|---|---|
| Receita captada | R$ 1,22 mi | R$ 1,40 mi (+15%) | R$ 1,59 mi (+30%) | R$ 1,71 mi (+40%) |
| Investimento | R$ 262 mil | R$ 424 mil | R$ 461 mil | R$ 414 mil |
| ROAS global | 4,66x | 3,31x | 3,45x | 4,13x |
| Custo por sessão paga | R$ 1,32 | R$ 1,86 | R$ 1,72 | R$ 1,60 |
| Conversão média | 1,41% | 1,50% | 1,54% | 1,61% |
| Ticket médio | R$ 195,5 | R$ 197,8 | R$ 199,5 | R$ 202,6 |
| Sessões pagas no total | 44,8% | 48,2% | 51,9% | 49,4% |
| CAC médio | R$ 68,5 | R$ 97,7 | R$ 94,8 | R$ 80,3 |
| CAC máximo no mês | R$ 112,7 (SET) | R$ 120,5 (SET) | R$ 112,2 (SET) | R$ 96,5 (OUT) |
| LTV/CAC no pior mês | 2,8 | 2,6 | 2,8 | 3,2 |

## Soluções consideradas em cada cenário

- **Pessimista:** execução parcial e lenta. P1.S1, P1.S3, P2.S1, P2.S3, P3.S1 e P3.S2 a 75% da intensidade, com efeito só a partir do mês 3.
  - Sem P4: a quebra de pagamento segue em 7,1%.
  - O cenário "nada é feito" (-10%) saiu da apresentação, por decisão do analista.
- **Realista:** as soluções de execução mais simples, a 100%. P1.S1, P1.S3, P2.S1, P2.S3, P3.S1, P3.S2, P4.S1 e P4.S2.
- **Otimista:** as do Realista, com intensidade maior e rampa mais rápida, mais P1.S2, P2.S2, P3.S3 e P4.S3.

## O papel de cada KPI Influenciador

- **Investimento em mídia.** É a variável que fecha a receita de cada mês. Acompanha a sazonalidade e sobe em degraus, com NOV e MAI como os meses de maior verba.
- **Custo por sessão paga.** No histórico sobe cerca de R$ 0,06 por mês e acompanha a escala. P1 (teto de CAC e escalar em degraus) contém essa deriva e reduz o custo em 8% em regime no Realista (12,5% no Otimista).
- **% de sessões pagas (dependência).** É calculado, não escolhido: sai das sessões pagas e das sessões não pagas. A régua de recompra (P3) acrescenta sessões não pagas (+15% no Realista, +25% no Otimista).
- **Taxa de conversão.** Sobe com a ruptura resolvida (P2) e com a recompra (P3): +9% em regime no Realista (+15% no Otimista). Em MAR e ABR volta a 1,46%, contra 1,05% e 1,00% do ano atual.
- **Ticket médio.** Sobe +3% no Realista (+5% no Otimista) com kits e frete, e as sócias aceitaram mexer nos dois. Sem mexer no preço.

Receita, vendas e sessões totais são calculadas pela cadeia do `projecao.py` e nunca preenchidas à mão. Os três cenários fecham a meta anual com diferença abaixo de R$ 0,20.

## Onde está o risco

- **Verba bem acima do ano atual.** O Realista pede R$ 461 mil, 76% acima dos R$ 262 mil, com média de cerca de R$ 38 mil por mês.
- **CAC acima do teto de R$ 103,9** em AGO (R$ 105,1) e SET (R$ 112,2) no Realista. O teto passa a ser a regra do ano (média de R$ 94,8), com tolerância mensal a definir no plano de mídia.
- **Deriva do custo por sessão.** A premissa é que P1 a contém. Se o custo continuar subindo R$ 0,06 por mês, mais meses passam do teto de CAC e a verba necessária para a mesma receita aumenta.
- **Crescimento de MAR e ABR (+53%) e de MAI a SET (+39%)** depende de o estoque de segurança e da régua de recompra estarem funcionando a tempo.
- **Dependência de mídia paga.** No Realista as sessões pagas chegam a 51,9% do total, acima dos 44,8% do ano atual. A meta cresce mais por mídia do que por canal próprio, e isso fica para o plano de mídia tratar.
- **Receita bruta.** Tudo está em receita captada. A margem por produto (kits e protetor) ainda não foi confirmada, então não há leitura em margem.

## Onde está a alavanca principal

- **Realista:** a recompra (P3) e o estoque de segurança (P2) são as que mais pesam no crescimento depois de JAN. O teto de CAC (P1) segura o custo por sessão.
- **Otimista:** a ruptura resolvida por completo (P2.S2) com a recompra mais forte (P3.S3) e o custo por sessão 12,5% menor, com ROAS de 4,13x e o CAC mais baixo dos três.
- **Pessimista:** o cliente executa só parte das soluções e mais devagar. Ainda cresce 15%, mas gasta R$ 424 mil e chega a R$ 120,5 de CAC em SET.

## Quebra de pagamento (memo, fora dos números de receita)

P4 atua na receita aprovada, não na captada. Com a quebra assumida em cada cenário, a receita aprovada fica em R$ 1,30 mi (Pessimista, 7,1%), R$ 1,49 mi (Realista, 6,2% em média) e R$ 1,61 mi (Otimista, 5,5%). Ano atual: R$ 1,14 mi.

## Pontos em aberto

- Margem por produto, para refazer cenários em margem.
- Quebra por meio de pagamento (P4.S1 existe para medir).
- Tolerância mensal do teto de CAC, a definir no plano de mídia (etapa 07).
