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
