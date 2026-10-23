# Diagnóstico de performance: macro financeiro (OUT/25 a SET/26)

Cliente de teste, dados fictícios (FICTÍCIO). Fonte: histórico mensal de 12 meses e relatório de quebra por meio de pagamento. Esta seção registra dado, benchmark e suspeita de causa. Não propõe metas nem soluções.

## 1. Investimento em mídia paga

- **Total de R$ 262.000** em 12 meses, média de R$ 21.833 por mês. Meta recebe 61,8% (R$ 161,9 mil) e Google 38,2% (R$ 100,1 mil). A declaração do kickoff (R$ 20 mil a R$ 25 mil por mês) confere com a média.
- O investimento sobe nos meses de data comercial: NOV/25 (R$ 28,3 mil) e MAI/26 (R$ 31,5 mil). O menor mês é JAN/26 (R$ 13,8 mil).
- **SET/26 é o maior mês do ano (R$ 32,9 mil), sem nenhuma data comercial.** O último trimestre (JUL a SET) soma R$ 83,6 mil, 31% acima do primeiro (OUT a DEZ, que inclui a Black Friday: R$ 63,7 mil).
- Leitura: a verba vem em escala contínua desde JUN. Ela não acompanha só a sazonalidade, como o kickoff já indicava ("a verba foi aumentada para segurar o volume").

## 2. Receita captada vs. receita aprovada

- **Receita captada: R$ 1.220.462** (média de R$ 101,7 mil por mês). **Receita aprovada: R$ 1.141.132** (média de R$ 95,1 mil). **R$ 79,3 mil não foram aprovados** no período.
- Sazonalidade clara: NOV/25 concentra R$ 190,3 mil captados (15,6% do ano), MAI/26 R$ 135,3 mil (11,1%) e DEZ/25 R$ 126,1 mil (10,3%). JAN e FEV são os vales (cerca de R$ 76 mil).
- **A receita cai de um semestre para o outro:** de R$ 639,4 mil (OUT a MAR) para R$ 581,0 mil (ABR a SET) na captada, -9,1%. Na aprovada, de R$ 598,5 mil para R$ 542,7 mil, -9,3%.
- **MAR e ABR ficaram em R$ 77,5 mil cada**, o mesmo patamar dos vales de JAN e FEV. É o período em que o sérum de vitamina C ficou indisponível: as sócias estimaram uma queda de "uns 20 e poucos por cento" e o dado é coerente com isso (a estimativa não foi recalculada aqui, por falta de base de comparação).
- **Dado declarado contra dado real.** No kickoff, o faturamento foi citado como R$ 125 mil por mês e "uns R$ 1,5 milhão por ano". O histórico mostra R$ 101,7 mil por mês captados (R$ 1,22 milhão no ano), ou seja, o valor declarado está 23% acima do captado e 31% acima do aprovado. A base da meta ("pouco mais de R$ 1,2 milhão") confere com o dado real.
- Ticket médio do site: R$ 195,46 (receita captada dividida por 6.244 pedidos).

## 3. Taxa de quebra (captada para aprovada)

- **Média de 6,5%** contra o benchmark de até 5% (referência de mercado). Só OUT/25 ficou abaixo (4,9%); os outros 11 meses estão acima.
- A taxa **sobe de forma contínua**: 5,5% em JAN/26 para 7,1% em SET/26 (+1,6 ponto percentual em 8 meses). O maior valor é NOV/25 (7,9%), na Black Friday.
- No limite de 5%, a receita aprovada seria **R$ 18,3 mil maior** no período.
- Suspeita de causa: aumento de recusas de cartão e de pedidos não pagos (PIX e boleto), ver o recorte por meio de pagamento abaixo. Um possível efeito de antifraude ou de parcelamento não pôde ser testado com estes dados.

### 3b. Quebra por meio de pagamento

| Meio | % da receita captada | Taxa de quebra | Evolução (OUT para SET) | Parte da perda | Não aprovado |
|---|---|---|---|---|---|
| Cartão de crédito | 57,1% | 7,5% | 5,7% para 8,2% | 66% | R$ 52,4 mil |
| PIX | 37,9% | 3,6% | 2,7% para 3,9% | 21% | R$ 16,6 mil |
| Boleto | 5,0% | 17,0% | 12,9% para 18,6% | 13% | R$ 10,3 mil |

- O cartão pesa dois terços da perda por volume. O boleto é o meio de maior taxa (mais de três vezes o benchmark geral), embora pese pouco no total. O PIX está abaixo do benchmark geral de 5%.
- Os três meios pioram ao longo do ano, no mesmo ritmo. Isso sugere uma causa comum, além da especificidade de cada meio.
- Ressalva: o benchmark de 5% é geral. Não há faixa validada por meio de pagamento (item pendente em `benchmarks-kpi.md`).

## 4. ROAS

- **ROAS global** (receita captada do site dividida pelo investimento total): média de **4,66x**. Cai de 6,48x em OUT/25 para **3,06x em SET/26 (-53%)**. Só NOV (6,71x) e DEZ interrompem a queda, pelo efeito sazonal. Por trimestre: 6,44x (OUT a DEZ) para 3,33x (JUL a SET).
- **Por plataforma (GA4, último clique):** Google tem média de 2,52x (de 3,68x para 1,96x). Meta tem média de 1,22x (de 2,01x para 0,84x), abaixo de 1x de JUL a SET.
- A queda é uniforme nas duas plataformas, sem ruptura abrupta, o que aponta para perda de eficiência estrutural (custo de acesso e taxa de compra) e não para um evento isolado.
- Ressalva de atribuição: o ROAS por plataforma usa o último clique do GA4 e provavelmente subestima o Meta, que costuma influenciar a compra sem ser o último clique. Serve para comparar tendência entre meses, não o nível. A referência confiável é o ROAS global.
- O GA4 registra 4,0% mais vendas que a Nuvemshop (6.494 contra 6.244), como o gestor de tráfego havia relatado.

## Achados para a etapa 05 (dado, benchmark e suspeita de causa)

1. ROAS global caiu 53% (6,48x para 3,06x) enquanto a verba do último trimestre foi 31% maior que a do primeiro.
2. Quebra média de 6,5% (benchmark até 5%), em alta (5,5% para 7,1%). Cartão e boleto estão acima do benchmark e respondem por 79% da perda.
3. Receita captada 9,1% menor no segundo semestre.
4. MAR e ABR sem a alta esperada, coerente com a ruptura do sérum.
5. Faturamento declarado (R$ 125 mil por mês) 23% acima do captado: a meta de crescimento precisa partir do dado real.
6. Atribuição: GA4 e Nuvemshop divergem em 4%, e o Meta no GA4 está abaixo de 1x.
