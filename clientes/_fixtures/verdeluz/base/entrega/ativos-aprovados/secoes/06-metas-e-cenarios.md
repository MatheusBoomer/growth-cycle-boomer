# Metas e cenários (OUT/26 a SET/27)

Cliente de teste, dados fictícios (FICTÍCIO). Cálculo feito por `scripts/projecao.py` (distribuição sazonal sem flat e cadeia sessões, vendas e receita validada contra a meta de cada cenário). A base é a receita captada do site, com a tradução para a receita aprovada na tabela.

## 1. Meta do projeto

- **Meta Realista: R$ 1.586.601 de receita captada em 12 meses, +30,0% sobre o ano atual (R$ 1.220.462).** Em receita aprovada, R$ 1.499.338 (+31,4% sobre R$ 1.141.132), com a quebra caindo para 5,5%.
- **Horizonte:** 12 meses, na mesma ordem do histórico (OUT a SET), posição a posição: OUT/26 comparado a OUT/25, e assim por diante.
- **Classificação técnica: agressiva.** O ano atual termina com a receita 9,1% menor no segundo semestre, o CAC subiu 127% e o LTV/CAC do último mês é 2,77x. O Realista só fecha se a ruptura do sérum não se repetir, se o CAC voltar ao teto de R$ 80 e se a recuperação de carrinho e a régua de recompra entrarem. Uma meta conservadora seria de +10% a +15%.
- **A meta de 40% das sócias é o cenário Otimista (teto).** As sócias disseram que 40% é "ambicioso, mas possível se a ruptura for resolvida" e que a meta Realista poderia ficar em torno de 30% se não for. O analista adotou 30% como Realista.
- **Apresentação ao prospect:** mostrar os três cenários, com o Realista em destaque.

## 2. Meta mês a mês

A distribuição usa o peso sazonal do histórico, nunca uma divisão igual por 12. Duas escolhas do analista, registradas:

- **MAR e ABR normalizados:** o histórico desses meses está deprimido pela ruptura do sérum. Para o Realista e o Otimista, a receita de MAR e ABR do ano atual foi dividida por 0,78 (queda declarada de 22%) antes de calcular os pesos. No Pessimista, a ruptura se repete e os pesos são os do histórico bruto.
- **Entrada gradual:** os primeiros meses ficam perto do patamar atual e a meta sobe ao longo do ano (OUT/26 em +8,9% e SET/27 em +44,3% no Realista). As melhorias levam tempo para fazer efeito.

Por isso a variação de MAR e ABR sobre o ano atual é alta no Realista (+60,2% e +64,3%): a base de comparação está deprimida pela ruptura. Em NOV e MAI o Realista cresce menos (+12,1% e +31,4%), porque esses meses já eram fortes.

![Receita do ano atual vs. Realista](../graficos/meta-realista-vs-ano-atual.png)

## 3. Os três cenários

| | Ano atual | Pessimista | **Realista** | Otimista |
|---|---|---|---|---|
| Receita captada | R$ 1.220.462 | R$ 1.098.416 | **R$ 1.586.601** | R$ 1.708.647 |
| Variação | | -10,0% | **+30,0%** | +40,0% |
| Quebra média | 6,5% | 7,5% | 5,5% | 5,0% |
| Receita aprovada | R$ 1.141.132 | R$ 1.016.035 | R$ 1.499.338 | R$ 1.623.215 |
| Investimento em mídia | R$ 262.000 | R$ 429.574 | R$ 341.683 | R$ 335.849 |
| ROAS global (captada) | 4,66x | 2,56x | 4,64x | 5,09x |
| Sessões | 442.615 | 420.256 | 454.723 | 489.602 |
| Conversão média | 1,41% | 1,35% | 1,75% | 1,73% |
| Ticket médio | R$ 195,46 | R$ 193,58 | R$ 199,47 | R$ 202,30 |
| Vendas | 6.244 | 5.674 | 7.954 | 8.446 |
| Meses com R$ 100 mil ou mais | 4 | 3 | 10 | 10 |

### KPIs influenciadores por cenário

| | Pessimista | Realista | Otimista |
|---|---|---|---|
| Custo por sessão paga (início para fim) | R$ 1,70 para R$ 1,90 | R$ 1,60 para R$ 1,40 | R$ 1,55 para R$ 1,30 |
| Dependência de mídia paga (início para fim) | 55% para 58% | 54% para 45% | 53% para 42% |
| Ticket médio sobre o histórico | -2% no fim | +4% no fim | +7% no fim |
| Conversão (mês a mês) | Média de 1,35%, com 1,00% em ABR (nova ruptura) | Média de 1,75%: 1,4% em JAN, 1,9% em MAI e 2,3% em NOV | Média de 1,73%: 1,4% em JAN, 1,9% em MAI e 2,3% em NOV |

![Cenários](../graficos/cenarios-pessimista-realista-otimista.png)

![Tabela dos cenários](../graficos/tabela-cenarios-projecao.png)

## 4. Soluções consideradas por cenário

- **Pessimista:** nenhuma solução executada. A verba sobe para segurar volume (R$ 429,6 mil, +64%), o custo por sessão continua subindo, a quebra chega a 7,5% e a ruptura do sérum se repete em MAR e ABR.
- **Realista:** P1.S1 e P1.S3 (regra de escala e separação de aquisição e recompra), P2.S1 e P2.S3 (estoque de segurança e alerta de estoque ligado à mídia), P3.S1 e P3.S2 (régua de reposição e reativação), P4.S1 e P4.S2 (antifraude e lembrete de PIX), P5.S1 e P5.S2 (recuperação de carrinho em 3 toques e frete por CEP). Entram também P7.S1 e P7.S2, como pré-requisito de medição (sem impacto quantificado).
- **Otimista:** soma ao Realista P1.S2, P2.S2, P3.S3, P4.S3, P5.S3 e P8.S1 a P8.S3 (realocação de verba, segundo fornecedor, migração para kit, boleto com vencimento menor, prova social, novos kits, revisão da Curva C e order bump).
- P6 (Black Friday e desconto) e P7.S3 ficam fora dos cenários por falta de impacto quantificado. Dependem da margem por SKU.

## 5. Lógica, risco e alavanca principal

- **Pessimista (-10,0%):** é o cenário em que nada muda. O CAC e o custo por sessão continuam subindo, a conversão dos canais pagos continua caindo e o ROAS global desce a 2,56x. A verba aumenta 64% e a receita cai 10%. O risco é pagar mais todo mês por menos venda.
- **Realista (+30,0%):** o crescimento vem de eficiência, não de mais verba proporcional. O investimento sobe 30,4% (R$ 341,7 mil), concentrado na Black Friday (R$ 49,3 mil em NOV) e em MAI, e o ROAS volta à média do ano atual (4,64x), embora o último mês tenha fechado em 3,06x. A conversão média sobe de 1,41% para 1,75% e a dependência de mídia paga cai de 55% para 45%.
- **Otimista (+40,0%):** a meta declarada das sócias. Pede todas as alavancas ao mesmo tempo, com o ROAS global em 5,09x. É teto, não meta.
- **Onde está o risco:** a ruptura do sérum (se voltar, MAR e ABR derrubam o ano), o CAC (o teto de R$ 80 precisa ser cumprido) e a conversão (precisa chegar perto de 1,8% no platô).
- **Alavanca principal:** a recuperação de carrinho e a régua de recompra, que sustentam a conversão e reduzem a dependência de mídia paga, mais o estoque de segurança, que evita a repetição da queda de MAR e ABR.
- **Papel de cada KPI:** a conversão é a variável que fecha a meta de cada mês (como a skill prevê, um KPI compensa os outros). O custo por sessão e a dependência definem quantas sessões a verba compra. O ticket sobe só pela migração para kit.

## Ressalvas

- A sazonalidade vem de um único ano de histórico (picos em NOV e MAI), e esse ano teve a ruptura de MAR e ABR.
- A planilha de projeção compara cada mês com o mesmo mês do ano atual. O investimento do ano atual cresceu ao longo do ano (R$ 14,5 mil em OUT/25 e R$ 32,9 mil em SET/26), por isso o investimento do Realista em OUT/26 (R$ 27,6 mil) aparece +91% sobre OUT/25 e em SET/27 (R$ 24,3 mil) aparece -26% sobre SET/26. Ler o investimento pelo total do ano.
- Premissas de agência a validar: recompra de 5% a 10% (P3), ticket de +5% a +10% (P8), quebra média de cada cenário e a normalização de MAR e ABR pela queda de 22% declarada.
- A meta só fecha com a medição conciliada (P7.S1). Sem ela, nenhum cenário é verificável com precisão.
- Os impactos das soluções se sobrepõem e não se somam: o crescimento dos cenários vem da combinação, calculada pela cadeia de KPIs.
