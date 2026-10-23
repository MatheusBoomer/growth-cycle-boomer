# Diário da produção da Verdeluz (cliente de teste)

Registro do que foi respondido como analista em cada etapa. O script `montar-fixture` transforma cada seção em roteiro (`roteiros/NN.md`) e lê o handoff de cada etapa daqui. Cada etapa tem exatamente três subseções: `### O que enviar`, `### O que responder ao agente` e `### Handoff`. A tabela de etapas dos entregáveis fica no fim do arquivo.

## Etapa 01

### O que enviar

- **Transcrição do kickoff:** o arquivo `kickoff-transcricao-bruta.docx` da pasta do kit.
- **Formulário pré-kickoff (opcional):** o arquivo `formulario-cliente.docx`.
- **Site:** informe o link `https://www.verdeluz.example`. O site é simulado: o texto das páginas já está no cliente de teste e o agente é avisado disso.

### O que responder ao agente

Nada é obrigatório. Se o agente perguntar sobre o site, diga que é simulado e que o texto está em `site-simulado.md`. Aprove a transcrição limpa quando ela estiver organizada por tema, sem ruído (café, trânsito, áudio picotando, pausas).

### Handoff

Nesta sessão, já tenho tudo o que precisava do kickoff. Não preciso de nada novo agora. Só fique pronto para responder com profundidade a algumas perguntas estratégicas que vou fazer no fim da próxima etapa: quanto melhor a resposta, melhor o diagnóstico.

Quando estiver pronto, rode `/02-contextualizacao-estrategica`.

## Etapa 02

### O que enviar

Nada a enviar nesta etapa.

### O que responder ao agente

O agente conduz o entendimento do negócio e faz até 10 perguntas estratégicas, uma por vez. Respostas usadas na produção deste cliente (adapte com suas palavras, mantendo o sentido):

1. **Qual é o motivo de compra principal?** O resultado visível no rosto com ativo de verdade. O vegano é um filtro de confiança, não o argumento principal. Cerca de 60% das avaliações citam textura e resultado.
2. **Quem é o público?** Mulheres de 25 a 44 anos (cerca de 80%), rotina de três passos, classes B e C+. Homens perto de 7%. O público de 18 a 24 anos vem aos poucos pelo TikTok e não é prioridade.
3. **O que explica a ruptura do sérum e qual é o plano?** O prazo do laboratório é de 45 dias e a embalagem tem fornecedor único. O plano é manter estoque de segurança de 60 dias para os três líderes e negociar um segundo fornecedor de embalagem. O laboratório topa priorizar o sérum.
4. **Como será a Black Friday daqui para frente?** A Verdeluz não quer mais depender dela. Aceita reduzir o desconto para cerca de 20% com brinde e manter o sérum fora de desconto profundo.
5. **A margem por SKU é confiável?** Ainda não: a margem dos kits e do protetor precisa ser confirmada. A contabilidade fecha o mês no dia 10, e a Luiza envia a margem por SKU da Curva A nas etapas de soluções e metas.
6. **Como é a recompra e o CRM hoje?** O sérum dura cerca de 60 dias e não há lembrete de reposição. Há uma ferramenta de e-mail com um fluxo (carrinho abandonado) e uma newsletter. WhatsApp para recompra é possível, com consentimento do cliente.
7. **E a gestão de mídia?** O Rafael continua como executor, sob a coordenação da agência, durante os 12 meses.
8. **Qual é a capacidade interna para executar o plano?** A Bruna dedica cerca de metade do tempo ao site, o Caio faz um conteúdo por semana e a expedição não tem folga. Cabem poucos testes por trimestre.
9. **Quais mudanças estruturais são possíveis?** Plataforma: não. Frete e kits: sim. Preço: só com conta feita. Marketplace: conversa para depois.
10. **Quão agressiva pode ser a meta?** Crescer 40% em 12 meses é "ambicioso, mas possível se a ruptura for resolvida". Se não for, a meta Realista pode ficar em torno de 30%.

Quando o agente propuser a contextualização consolidada, aprove.

### Handoff

Nesta sessão, o entendimento do negócio ficou fechado. Para começarmos a Skill 03, preciso que você me mande duas planilhas (Excel): uma com o histórico dos últimos 12 meses de mídia paga e vendas, com investimento, receita, ROAS, sessões e conversão, separados por Google e Meta, e outra com o relatório de produtos vendidos no ano, para eu montar a Curva ABC. Se conseguir, mande também uma terceira, opcional: a receita captada e aprovada de cada mês separada por meio de pagamento (PIX, cartão, boleto).

Quando estiver tudo pronto, rode `/03-diagnostico-performance`.

## Etapa 03

### O que enviar

- **Histórico mensal dos últimos 12 meses (Excel):** o arquivo `historico-mensal.xlsx` da pasta do kit.
- **Relatório de produtos vendidos no ano (Excel):** o arquivo `produtos-curva-abc.xlsx`.
- **Quebra por meio de pagamento (Excel, opcional):** o arquivo `quebra-pagamento.xlsx`. Envie, porque ele habilita o recorte por cartão, PIX e boleto.

### O que responder ao agente

O agente mostra cada gráfico e pede que você confirme se os valores batem com a planilha. Confira alguns pontos e confirme. Decisões usadas na produção deste cliente:

- **Período:** seguir com os 12 meses enviados (OUT/25 a SET/26), sem comparar com o ano anterior.
- **Taxa de quebra:** calculada como 1 menos receita aprovada dividida pela captada.
- **ROAS global:** receita captada do site dividida pelo investimento total. O ROAS por plataforma (GA4) vale só para ver a tendência.
- **Benchmark de dependência de mídia paga:** DTC consolidada (45% a 60%), porque o CRM ainda é incipiente.
- **Faturamento declarado no kickoff (R$ 125 mil por mês):** vale o histórico, que mostra R$ 101,7 mil por mês captados. A meta parte do dado real.
- **Ruptura de MAR e ABR:** não recalcular a queda declarada, só registrar que os dois meses ficaram no patamar de JAN e FEV.
- **Curva ABC:** mesmo período do histórico. O relatório cobre 96% da receita captada e essa diferença pode ser aceita. Para a apresentação, usar as tabelas divididas em três (curvas A, B e C).

### Handoff

Nesta sessão, o diagnóstico de performance ficou fechado. Para começarmos a Skill 04, preciso de uma planilha (Excel) com o histórico de vendas por cliente, o maior período que você tiver. Só uma coisa importante antes de me mandar: tira qualquer CPF, e-mail, telefone, endereço ou dado de cartão, e deixa só o ID ou o nome do cliente, com o valor total gasto e o número de pedidos por cliente.

Quando estiver pronto, rode `/04-unidade-economica`.

## Etapa 04

### O que enviar

- **Cliente histórico (Excel):** o arquivo `clientes-historico.xlsx` da pasta do kit. Ele tem só ID, nome, número de pedidos e valor total, sem CPF, e-mail, telefone, endereço ou dado de cartão.

### O que responder ao agente

- **Janela e base:** a base cobre toda a operação (2021 até SET/26), só pedidos do site. O diagnóstico usa a janela de 12 meses.
- **CAC:** investimento total em mídia dividido pelos clientes novos do mês. Não inclui influenciadoras pagas nem permutas.
- **Teste do Top 5 por gasto:** confirme contra o relatório da Nuvemshop. No cliente de teste, o ranking confere (sem divergência).
- **Benchmark:** classificar o LTV/CAC pela faixa do projeto (abaixo de 3 ruim, 3 a 5 normal, acima de 5 escala), com o CAC do último mês.
- **Ressalva:** o LTV é de receita, não de margem.

### Handoff

Nesta sessão, a unidade econômica ficou fechada e não preciso de arquivo novo agora. Na próxima etapa vou abrir cada problema que encontramos no diagnóstico em hipóteses, soluções e impacto em reais; vale lembrar o que o prospect já tentou para resolver cada um.

Quando estiver pronto, rode `/05-solucoes`.

## Etapa 05

### O que enviar

Nada a enviar nesta etapa.

### O que responder ao agente

O agente lista os problemas e os pontos fortes do diagnóstico e pede para você confirmar e ordenar por prioridade. Depois pergunta o que o cliente já tentou. Respostas usadas na produção deste cliente:

- **Problemas:** confirme os 8 que o agente propuser, com estes agrupamentos: eficiência da mídia reúne CAC, ROAS e dependência de mídia paga; mensuração reúne atribuição do GA4, influenciadoras e funil.
- **Prioridade:** P1 Eficiência da mídia, P2 Ruptura do sérum, P3 Recompra e CRM, P4 Quebra de pagamento, P5 Funil, P6 Black Friday e desconto, P7 Mensuração, P8 Mix.
- **Pontos fortes:** os cinco entram como argumento do plano (conversão global dentro da faixa, recorrente vale 3 vezes mais, PIX com quebra baixa, prova social robusta, margem bruta declarada).
- **O que o cliente já tentou:** o cupom PRIMEIRA10 (traz cliente, mas dá desconto a quem compraria de qualquer forma), um e-mail de carrinho abandonado, microinfluenciadoras sem medição e aumento de verba para segurar volume. Nenhuma solução precisa ser descartada por tentativa anterior, mas cupom e aumento de verba não resolveram.
- **Impactos:** os impactos dos problemas P1, P4, P5 e P8 se sobrepõem e não se somam. Aceite a justificativa de impacto não quantificado em P6 (falta a margem por SKU) e em P7 (ação habilitadora).

### Handoff

Nesta sessão, cada problema do diagnóstico ganhou hipóteses, soluções e impacto. Não preciso de arquivo novo: só pensa numa meta clara (qual número, em quanto tempo) e tenha em mente a receita do ano passado e alguma sazonalidade importante do negócio, porque vou te perguntar isso logo no início da próxima etapa. As soluções com impacto vão virar alavancas dos cenários.

Quando estiver pronto, rode `/06-metas-e-cenarios`.

## Etapa 06

### O que enviar

Nada a enviar nesta etapa.

### O que responder ao agente

Logo no início o agente pergunta a meta, o horizonte e a sazonalidade. Respostas usadas na produção deste cliente:

- **Meta:** crescer em receita captada do site. A meta das sócias é +40% em 12 meses, mas a Luiza aceita cerca de 30% se a ruptura do sérum não for resolvida.
- **Cenário Realista:** **+30% de receita captada em 12 meses (R$ 1.586.601)**. O agente deve classificar como agressiva. O +40% (R$ 1.708.647) é o cenário Otimista, tratado como teto, e o Pessimista (-10%) é o cenário em que nada é feito.
- **Horizonte:** 12 meses, na mesma ordem do histórico (OUT/26 a SET/27), comparando posição a posição com OUT/25 a SET/26. As melhorias entram de forma gradual: os primeiros meses ficam perto do patamar atual.
- **Sazonalidade:** picos em NOV (Black Friday), DEZ e MAI (Dia das Mães); vales em JAN e FEV. Em MAR e ABR o histórico está deprimido pela ruptura do sérum: para o Realista e o Otimista, normalize esses dois meses pela queda de 22% declarada; no Pessimista a ruptura se repete.
- **Receita do ano anterior:** a do histórico (R$ 1,22 milhão captados), e não os "R$ 1,5 milhão" falados no kickoff.
- **Disposição para mudanças estruturais:** não trocar a plataforma. Frete e kits podem mudar. Preço só com conta feita.
- **Apresentação:** mostrar ao prospect os três cenários, com o Realista em destaque.
- **Soluções por cenário:** Realista com as de execução mais simples (P1.S1, P1.S3, P2.S1, P2.S3, P3.S1, P3.S2, P4.S1, P4.S2, P5.S1, P5.S2), Otimista com as demais, Pessimista com nenhuma. P6 e P7 ficam fora dos cenários por falta de impacto quantificado.
- Confira se a soma de cada cenário bate com a meta e se a distribuição mensal respeita a sazonalidade, e depois aprove os gráficos, a tabela e a planilha.

### Handoff

Nesta sessão, a meta e os cenários ficaram fechados. Não preciso de nada novo, só pensa numa lista de concorrentes que você quer que eu pesquise na próxima etapa.

Quando estiver pronto, rode `/07-briefing-e-benchmark`.

## Etapa 07

### O que enviar

Nada a enviar obrigatoriamente. Se quiser testar a coleta real de anúncios, tenha o `APIFY_TOKEN` configurado e copie, da Biblioteca de Anúncios do Meta, o link da página (com `view_all_page_id=`) de cada concorrente.

### O que responder ao agente

- **Concorrentes:** Sallve, Simple Organic e Care Natural Beauty. O quarto é opcional e fica a seu critério; prefira uma marca com muitos anúncios ativos.
- **Links da Biblioteca:** com o token da Apify, informe os links das páginas dos concorrentes. Sem o token, avise o agente: a coleta não roda e o benchmark fica ilustrativo, com as informações públicas dos sites e perfis das marcas.
- **A Verdeluz é fictícia e não tem página na Biblioteca de Anúncios.** O agente já é avisado disso. Se ele pedir o link do prospect, diga que a marca fica registrada sem anúncios.
- **Perguntas estratégicas:** as 7 padrão do relatório.
- **Cenário-base:** confirme que o cenário Realista segue como base.
- Revise o briefing (as 9 seções, com os números aprovados nas etapas anteriores), o relatório HTML e a camada Lição, Evidência e O que testar. Aprove cada um.

### Handoff

Nesta sessão, o briefing e o benchmark ficaram consolidados. Não preciso de nada novo, só confirma se seguimos com o cenário Realista como base para a próxima etapa. Se quiser, pode me mandar prints de tela (imagens) das campanhas atuais das plataformas, mas isso é opcional.

Quando estiver pronto, rode `/08-midia-paga`.

## Etapa 08

### O que enviar

- **Prints das campanhas (imagens, opcional):** os quatro arquivos `print-01.png` a `print-04.png` da pasta do kit, que simulam o Meta Ads (campanhas e públicos) e o Google Ads (campanhas e produtos no Merchant Center).

### O que responder ao agente

- **Cenário-base:** Realista.
- **Alocação de verba:** aceite que o Google suba de 38% para cerca de 44% da verba, com o Meta a 62% em NOV e 60% em MAI, e confirme que os valores batem com o cenário Realista e com o histórico.
- **Curva ABC:** A com 70% da verba, B com 25% e a Curva C sem campanha própria (só brinde, order bump e kits). Confirme a conta do custo de uma venda paga (cerca de R$ 110) contra o preço médio de um SKU da Curva C (cerca de R$ 64).
- **Calendário:** pico em NOV e MAI, escala em DEZ, ABR e SET, contenção em JAN e FEV.
- **Meta de dependência de mídia paga:** 45% das sessões em SET/27. Marketplace fora do horizonte.
- **Prints:** peça a análise e aceite os pontos de atenção (ROAS do Meta na plataforma contra o GA4, o sérum com estoque baixo recebendo verba).
- **Referências de mercado:** o agente pesquisa referências nacionais e internacionais. Confira as fontes antes de aprovar.

### Handoff

Nesta sessão, o planejamento de mídia paga ficou fechado. Não preciso de nada novo, só confirma comigo a data de hoje, se seguimos com o cenário Realista, e quais são as 2 ou 3 frentes mais urgentes que você quer priorizar no plano de ação.

Quando estiver pronto, rode `/09-plano-de-acao`.
