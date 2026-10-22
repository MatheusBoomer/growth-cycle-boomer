"""Textos dos documentos brutos da Verdeluz (marca 100% FICTÍCIA): kickoff, formulário pré-kickoff e site simulado."""

from __future__ import annotations

FALANTES = {
    "C": "Camila (Analista, agência)",
    "R": "Rafael (Gestor de tráfego, freelancer)",
    "M": "Marina (Sócia, Verdeluz)",
    "L": "Luiza (Sócia, Verdeluz)",
    "B": "Bruna (E-commerce, Verdeluz)",
}

# (falante, fala). Texto bruto de ferramenta de gravação: com ruído, repetição e assunto fora do tema, de propósito.
KICKOFF: list[tuple[str, str]] = [
    ("C", "Oi, gente, bom dia. Estão me ouvindo? Acho que o meu microfone está baixinho."),
    ("M", "Bom dia, Camila! Te ouvimos sim. A Luiza está entrando agora, ela ficou presa no trânsito, aquela chuva em Curitiba de manhã não perdoa."),
    ("L", "Cheguei, cheguei. Desculpa o atraso, gente. Posso só pegar um café aqui? Dois minutinhos. [risos]"),
    ("C", "Fica à vontade. Enquanto isso eu apresento quem está comigo hoje: o Rafael, que já cuida do tráfego de vocês e vai ajudar a gente a entender o histórico, e eu, a Camila, que vou conduzir o planejamento estratégico."),
    ("R", "Oi, pessoal. Eu sou o Rafael, freelancer, cuido de Meta e Google da Verdeluz desde o começo do ano passado. Tá picotando um pouco a minha conexão, se eu travar me avisem."),
    ("C", "Perfeito. Então vamos ao objetivo desta reunião, que é a gente se conhecer, entender o negócio por dentro e alinhar o que vocês esperam do planejamento de 12 meses. Depois eu vou pedir alguns arquivos, mas isso fica para o final. Pode ser?"),
    ("M", "Pode ser. Quer que eu comece contando a história da marca?"),
    ("C", "Quero sim, conta do começo."),
    ("M", "Então. A Verdeluz nasceu em 2021, eu e a Luiza. Eu venho de formulação, trabalhei em laboratório de cosmético, e a Luiza veio de finanças e operações. A gente se cansou de ver skincare caro que prometia muito e vinha cheio de coisa que a gente não queria passar na pele. A ideia foi fazer cosmético vegano, sem teste em animais, com ativo de verdade e preço de gente normal."),
    ("L", "E honesto, né, Marina. Fórmula curta, bula clara. A gente sempre brigou para ter a concentração do ativo escrita na embalagem, porque isso virou o nosso jeito de vender."),
    ("M", "Isso. Hoje a gente tem uns 58 produtos ativos. A produção é num laboratório parceiro aqui na região metropolitana, com as nossas fórmulas, e a gente tem selo vegano de entidade certificadora. O carro-chefe é o sérum de vitamina C, depois o hidratante facial gel-creme e o protetor solar FPS 50."),
    ("C", "Esses três são o grosso da venda?"),
    ("L", "São. Se eu fosse chutar, mais da metade da receita passa por eles, direta ou nos kits. Os kits viraram uma coisa forte, principalmente o Kit Rotina Essencial e o Kit Glow."),
    ("C", "Entendi. E em números, como está o negócio hoje? Faturamento, ticket, esse tipo de coisa."),
    ("L", "A gente está na faixa de uns R$ 125 mil por mês, então dá uns R$ 1,5 milhão por ano. Foi um ano bom."),
    ("M", "Contando o que a gente captou, né, Lu. Tem a parte que cai, cartão recusado, PIX que ninguém paga."),
    ("L", "Verdade. Mas na ordem de grandeza é isso. O ticket médio fica perto de R$ 200, um pouco menos na Black Friday porque o pessoal compra com desconto."),
    ("C", "Anotei: aproximadamente R$ 125 mil por mês e ticket perto de R$ 200. Depois eu comparo com a planilha que vocês vão me mandar, tá? Isso é só para eu ter uma ordem de grandeza agora."),
    ("L", "Claro, claro. A planilha vai ter o número certinho."),
    ("C", "Qual plataforma de e-commerce vocês usam?"),
    ("B", "Oi, eu sou a Bruna, cuido do e-commerce e do atendimento. A gente está na Nuvemshop desde o começo. Aceita cartão em até 6 vezes, PIX com 5% de desconto e boleto, mas boleto é muito pouco, uns 5%."),
    ("C", "Boa, Bruna. E quantas pessoas trabalham na Verdeluz hoje?"),
    ("M", "Sete. Eu, a Luiza, a Bruna, o Caio no marketing e nas redes, duas pessoas na expedição e uma no atendimento e pós-venda."),
    ("L", "Ah, e a reforma do escritório, né, Marina, que ainda não terminou. Se aparecer barulho de furadeira, é isso."),
    ("M", "[risos] Já está avisado. Mas é só no andar de cima."),
    ("C", "Tranquilo. Vamos falar de canais. De onde vem a venda? Só site?"),
    ("B", "Só site. A gente já pensou em marketplace, mas nunca entrou. Tem Instagram, uma conta que cresce bem, e começamos o TikTok faz uns meses, mas ainda sem venda direta lá."),
    ("R", "Do lado de mídia paga, a gente roda Meta e Google. Hoje a divisão está mais ou menos em 62% Meta e 38% Google. Google é Search de marca e genérico, Shopping e Performance Max. Meta é conversão, catálogo, remarketing e as campanhas de sazonal."),
    ("C", "E quanto vocês investem por mês, mais ou menos?"),
    ("R", "Entre R$ 20 e 25 mil. Nos meses de Black Friday e Dia das Mães sobe."),
    ("L", "Esse é o número que está me incomodando. Em outubro do ano passado a gente colocava bem menos e vendia quase a mesma coisa."),
    ("C", "Pode detalhar isso? Vendia quase a mesma coisa com menos mídia?"),
    ("L", "Assim: no começo do ano passado a gente pagava uns R$ 50 por cliente novo. Hoje passa de R$ 100. Eu não tenho o número exato, mas é isso que eu sinto no caixa."),
    ("R", "Eu confirmo a tendência. O custo por sessão subiu nos dois canais, o leilão do Meta está mais caro, e eu fui aumentando a verba para segurar o volume. Só que o retorno por real caiu junto. (inaudível) ... a gente entrou numa roda."),
    ("C", "Rafael, pode repetir a última parte? Você falou uma coisa e a conexão cortou."),
    ("R", "Disse que a gente entrou numa roda: sobe a verba para segurar o volume, o custo por cliente sobe, o retorno cai. Eu até pensei em segurar a verba, mas a Marina e a Luiza queriam fechar a meta do semestre."),
    ("M", "Isso foi decisão nossa, não do Rafael. A gente tinha pedido volume."),
    ("C", "Entendido. Vamos listar as dores que vocês sentem. Eu vou deixar vocês falarem e depois organizo. Quem começa?"),
    ("M", "Eu começo pela ruptura. Em março e abril o sérum de vitamina C ficou fora do ar. Foram quase duas semanas em março e mais ou menos uma semana e meia em abril. O laboratório atrasou a embalagem e a gente não tinha estoque de segurança."),
    ("L", "Foi um susto. O sérum é o produto que mais traz gente nova. Quando ele sai, a venda dos kits que têm ele dentro também cai. A receita dos dois meses desabou, uns 20 e poucos por cento abaixo do que a gente esperava."),
    ("B", "E o pior é que a mídia continuou rodando. A gente anunciava um produto que estava indisponível, o pessoal clicava e não comprava."),
    ("R", "Eu pausei o que pude, mas só soube da ruptura quando a Bruna avisou. A gente precisa de um alinhamento de estoque com a mídia."),
    ("C", "Boa pauta para o plano de ação. Outras dores?"),
    ("L", "A Black Friday. Eu amo e odeio. A gente vende muito, mas dá 35% de desconto e frete grátis para todo mundo. No fim sobra pouco. E o mês seguinte sofre, o pessoal já comprou."),
    ("M", "A gente fica dependente dessa data. Novembro sozinho vira quase um sexto do ano."),
    ("C", "Vocês têm uma ideia da margem bruta?"),
    ("L", "Margem bruta de produto, sem mídia, é uns 68%. Nos kits cai um pouco, uns 62%. Mas eu preciso confirmar com a contabilidade, não é número fechado."),
    ("C", "Anotado como estimativa. Mais dores?"),
    ("B", "Carrinho abandonado. A gente tem uns 78% de abandono, o que é comum, mas a gente só tem um e-mail de recuperação, uma hora depois. Nada de segunda tentativa, nada de WhatsApp."),
    ("M", "E tem o cartão recusado. A Bruna vê pedido de cartão que não passa e o cliente some."),
    ("B", "Sim. Tem pedido que fica aguardando PIX e expira também. Eu não sei medir direito quanto a gente perde com isso."),
    ("C", "A gente consegue medir. Eu vou pedir uma planilha com a receita captada e a aprovada separadas por meio de pagamento. Isso vai mostrar onde está a quebra."),
    ("L", "Ótimo, porque isso eu nunca consegui ver em um lugar só."),
    ("C", "Vocês já tentaram alguma coisa para resolver essas dores?"),
    ("M", "Cupom de primeira compra, o PRIMEIRA10. Funciona para trazer, mas dá desconto para quem compraria mesmo assim."),
    ("B", "E o e-mail de carrinho abandonado, que é esse único disparo. A gente usa uma ferramenta de e-mail, mas só tem esse fluxo montado e uma newsletter mensal."),
    ("M", "Também fizemos parceria com microinfluenciadoras, a maioria em permuta. Dá conteúdo bonito, mas a gente não sabe medir venda. Só sente que dá uma subida quando uma delas posta."),
    ("R", "Eu tentei colocar link com UTM nas bios, mas nem todas postam do jeito combinado."),
    ("C", "E quanto vocês gastam com essas parcerias?"),
    ("M", "A maioria é permuta, só produto. Umas três ou quatro cobram, entre R$ 800 e R$ 1.500 por pacote de posts. A gente não tem um orçamento fixo."),
    ("L", "Isso me incomoda. Em alguns meses a gente gasta uns R$ 4 mil em influenciadora e eu não sei o que voltou."),
    ("R", "Se a gente usar cupom individual por pessoa, dá para medir. Eu já sugeri, mas a gente nunca padronizou."),
    ("C", "Boa ideia, vou anotar como oportunidade de mensuração. Vocês usam GA4 e o pixel do Meta bem configurados?"),
    ("R", "GA4 sim, com e-commerce ativado. O pixel do Meta está com a API de conversões instalada. O que eu sei é que o GA4 registra uns 4% a mais de vendas que a Nuvemshop, e não consegui descobrir por quê."),
    ("B", "Provavelmente pedido que muda de status. Eu posso olhar quando você mandar um exemplo."),
    ("C", "Isso é bem comum. Quando eu receber os dados, eu confiro e te aviso se a diferença for grande."),
    ("L", "E a gente nem falou do TikTok. A Marina quer vender lá, eu acho cedo."),
    ("M", "Eu acho que é onde está o público de 18 a 24, que o Instagram já não pega. Mas eu entendo que antes temos que arrumar o básico."),
    ("C", "Entendi. Então hoje a retenção, o CRM, é bem enxuto."),
    ("L", "É. Eu acho que a recompra poderia ser maior. Pelos números que eu vi, em torno de 30% dos clientes compram mais de uma vez."),
    ("M", "E quem compra o kit, volta mais. Isso a gente sentiu, mas nunca fechou a conta."),
    ("C", "Essa conta eu consigo fazer com a base de clientes. Vocês exportam sem CPF, e-mail e telefone, só o ID e o total gasto."),
    ("B", "Consigo. A Nuvemshop exporta o relatório e eu tiro essas colunas."),
    ("C", "Perfeito, esse é um cuidado importante: nada de dado pessoal nas planilhas."),
    ("C", "Agora os concorrentes. Quem vocês olham?"),
    ("M", "A Sallve é a que mais tira o meu sono. Eles têm comunidade forte, linha de sérum e protetor, e dominam o Instagram. A Simple Organic é referência em vegano e natural, com bastante canal de revenda. E a Care Natural Beauty, que briga bastante no preço e no vegano."),
    ("L", "Eu acho que a gente tem fórmulas parecidas com as deles e um ticket de entrada mais baixo, mas eles são muito melhores em marca."),
    ("R", "Em mídia, a Sallve está anunciando o tempo todo, com vídeo curto de rotina. Eu fico olhando a Biblioteca de Anúncios de vez em quando."),
    ("C", "A gente vai fazer exatamente isso de forma estruturada mais para frente. Agora, falando de metas: o que vocês querem daqui a 12 meses?"),
    ("M", "Crescer uns 40%. Sair de uns R$ 1,2 milhão e poucos para algo perto de R$ 1,7 milhão, sem destruir a margem."),
    ("L", "Esse é o ponto: crescer sem depender tanto de desconto. Eu quero que a Black Friday seja um mês bom e não um mês que paga o ano."),
    ("C", "Para vocês, o que é mais importante: volume, margem ou previsibilidade?"),
    ("L", "Previsibilidade e margem. Volume sem margem eu já aprendi que não adianta."),
    ("M", "Concordo. E reduzir esse risco de ruptura, de produto que acaba."),
    ("C", "Vocês estão abertos a mudar coisas estruturais? Plataforma, política de frete, preços?"),
    ("L", "Plataforma, não. A Nuvemshop atende e a gente não quer migração agora, a Bruna ia ter um trabalho enorme. Frete e kits, sim, a gente topa mexer. Preço, só com muita conta."),
    ("M", "E marketplace eu abriria a conversa, mas não é prioridade."),
    ("C", "Registrado. Última rodada: tem alguma coisa que eu deveria saber e que a gente ainda não falou?"),
    ("B", "O site tem a página de frete e trocas bem escondida, e eu recebo muita pergunta sobre isso no atendimento. Frete grátis acima de R$ 249 no Sul e Sudeste, e acima de R$ 349 nas outras regiões."),
    ("L", "Falando em frete, a gente tem reclamação de prazo para o Nordeste. Os Correios demoram."),
    ("M", "Ah, e a nossa vitrine. A Bruna quer trocar as fotos, mas a gente nunca tem tempo."),
    ("B", "É verdade. As fotos de alguns kits são antigas."),
    ("L", "Já que a gente está nisso, deixa eu falar do laboratório. O prazo de produção lá é de uns 45 dias, e a gente só pede reposição quando o estoque já está baixo. Em março a gente pediu tarde demais."),
    ("M", "E a embalagem do sérum vem de um fornecedor só. Se atrasa, para tudo."),
    ("C", "Vocês têm estoque de segurança definido para os três produtos principais?"),
    ("L", "Não, é no feeling. Eu acompanho numa planilha, a Bruna olha o sistema, e a gente se fala quando lembra."),
    ("B", "Eu avisei da ruptura quando o estoque do sistema zerou, mas o produto ficou aparecendo no Google Shopping mais um dia."),
    ("R", "Isso é problema meu também. O feed do Merchant atualiza uma vez ao dia e eu deveria ter pausado antes."),
    ("M", "Gente, desculpa, interrompo só um segundo: a entrega do almoço chegou aqui na porta. Pode ser que eu saia da câmera."),
    ("C", "Sem problema, a gente espera. [pausa de uns 20 segundos]"),
    ("M", "Voltei. Onde a gente estava? Ah, o laboratório. Eu tenho conversa marcada com eles na semana que vem para renegociar prazo."),
    ("C", "Ótimo, isso entra como ponto de atenção para o plano. Falando em calendário, como foi a Black Friday do ano passado?"),
    ("L", "Foi a nossa melhor semana. Faturou mais de R$ 140 mil só em novembro do ano passado, e este ano passou de R$ 180 mil. Mas a margem do mês foi péssima."),
    ("M", "Foi 35% de desconto no Kit Rotina Essencial e no sérum, mais frete grátis sem valor mínimo."),
    ("R", "Aí o ROAS da Black Friday até parece bom, mas quando você desconta o frete e o desconto, sobra pouco. Eu falei isso na época."),
    ("L", "Eu sei, Rafael, foi decisão nossa. Este ano eu quero testar um desconto menor com brinde."),
    ("C", "Anotado como hipótese para a etapa de soluções. E o Dia das Mães, quanto pesa?"),
    ("B", "Pesa bastante. Maio costuma ser o segundo melhor mês, depois de novembro. O Natal também, com os kits de presente."),
    ("M", "O Kit Presente Natal esgotou duas semanas antes do Natal. Foi outra ruptura, menor."),
    ("C", "Anotei. E sobre avaliações e prova social, vocês coletam?"),
    ("B", "Coletamos pelo próprio site. O sérum tem mais de 900 avaliações. Mas a gente não usa isso nos anúncios direito."),
    ("M", "O Caio quer fazer um conteúdo com depoimentos, mas ainda não saiu do papel."),
    ("L", "Falando em Caio, ele está de férias na semana que vem, então qualquer coisa de redes sociais, falem com a Marina."),
    ("C", "Boas pistas. Para fechar, eu preciso de alguns arquivos de vocês. Primeiro, o histórico mensal dos últimos 12 meses de mídia e vendas, com investimento em Google e Meta, receita captada e aprovada, sessões e conversão. Segundo, o relatório de produtos vendidos no período, para eu montar a curva ABC. Terceiro, a receita por meio de pagamento. E depois, a base de clientes sem dado pessoal."),
    ("R", "O histórico de mídia eu tiro do Meta e do Google, mas as sessões e a conversão eu pego do GA4. Pode ser?"),
    ("C", "Pode, Rafael. Só me avise se tiver diferença grande entre o GA4 e a plataforma, que é comum."),
    ("L", "Quando precisar da planilha de vendas, a Bruna manda. Ela tem acesso a tudo."),
    ("B", "Mando ainda esta semana."),
    ("C", "Ótimo. Outra coisa que eu quero deixar combinada é o prazo. A ideia é entregar o documento do planejamento em aproximadamente três semanas, com uma reunião de apresentação no final."),
    ("L", "Perfeito. A gente tem reunião de resultados todo primeiro dia útil do mês, se quiser encaixar na semana seguinte."),
    ("M", "Camila, uma pergunta: esse planejamento já vai ter números de quanto a gente precisa investir em mídia?"),
    ("C", "Vai. A ideia é cruzar o histórico com a sazonalidade e projetar cenários: pessimista, realista e otimista. E o plano de ação lista o que fazer, quem faz e em que ordem."),
    ("B", "Ótimo. Eu gostaria de ver o que dá para fazer no site sem mexer na plataforma."),
    ("C", "Vai estar no plano de ação também. Lembrando que tudo parte da premissa de não trocar a Nuvemshop."),
    ("R", "Só um último pedido: se puderem, nesse planejamento deixem claro o que é da mídia e o que é do site e do estoque. Quando junta tudo, a conta cai na mídia, e nem sempre é culpa dela."),
    ("L", "Rafael, a gente sabe. [risos] Mas é um bom ponto, vamos separar."),
    ("C", "Perfeito. Resumindo o que eu entendi: negócio de skincare vegano, só site, Nuvemshop, equipe de sete, mídia entre R$ 20 e 25 mil por mês, divisão Meta e Google, três produtos que carregam a maior parte, dores em CAC subindo, Black Friday que consome margem, ruptura do sérum em março e abril, carrinho abandonado e quebra de pagamento. Meta de crescer em torno de 40% com previsibilidade e margem, sem trocar de plataforma. Está certo?"),
    ("M", "Está. Só acrescentaria a fidelização, que a gente quer melhorar."),
    ("C", "Anotado. Vou organizar tudo e voltar com a contextualização estratégica. Obrigada, pessoal, e bom café para vocês duas. [risos]"),
    ("L", "Obrigada, Camila! Até a próxima."),
    ("R", "Valeu, tchau."),
]

FORMULARIO: list[tuple[str, str]] = [
    ("Nome fantasia", "Verdeluz Cosméticos Veganos"),
    ("Razão social", "Verdeluz Comércio de Cosméticos Ltda. (nome fictício)"),
    ("Cidade e estado", "Curitiba, PR"),
    ("Ano de fundação", "2021"),
    ("Site", "https://www.verdeluz.example"),
    ("Plataforma de e-commerce", "Nuvemshop"),
    ("Quantas pessoas trabalham na empresa?", "7"),
    ("O que vocês vendem?", "Skincare vegano e sem teste em animais: séruns, hidratantes, protetores solares, limpeza, corpo e kits."),
    ("Quantos produtos ativos?", "Cerca de 58"),
    ("Produtos mais vendidos", "Sérum de vitamina C, hidratante facial gel-creme, protetor solar FPS 50, Kit Rotina Essencial e Kit Glow."),
    ("Ticket médio", "Perto de R$ 200"),
    ("Faturamento mensal aproximado", "Cerca de R$ 125 mil"),
    ("Canais de venda", "Apenas site próprio. Instagram e TikTok para conteúdo."),
    ("Meios de pagamento", "Cartão de crédito em até 6x, PIX com 5% de desconto e boleto."),
    ("Investimento mensal em mídia paga", "Entre R$ 20 mil e R$ 25 mil, em Meta e Google."),
    ("Quem cuida da mídia paga?", "Gestor de tráfego freelancer."),
    ("Principais concorrentes", "Sallve, Simple Organic, Care Natural Beauty."),
    ("Principal dificuldade hoje", "O custo para trazer cliente novo está subindo e a Black Friday consome muita margem."),
    ("Meta para os próximos 12 meses", "Crescer cerca de 40% com previsibilidade e sem destruir a margem."),
    ("Existe alguma restrição?", "Não pretendem trocar de plataforma agora."),
]

SITE_SIMULADO = """# Site simulado da Verdeluz (FICTÍCIO)

> Texto das páginas do site fictício https://www.verdeluz.example, escrito para o cliente de teste. Não existe site real.
> Use este arquivo no lugar da raspagem do site.

## Home

**Verdeluz | Skincare vegano com ativo de verdade**

Fórmulas curtas, concentração do ativo na embalagem e preço de gente normal. Sem teste em animais, sem ingrediente de origem animal.

- Frete grátis acima de R$ 249 (Sul e Sudeste) e acima de R$ 349 (demais regiões)
- PIX com 5% de desconto, cartão em até 6x sem juros
- Selo vegano de entidade certificadora

Destaques da vitrine: Sérum de Vitamina C 15%, Hidratante Facial Gel-Creme, Protetor Solar Facial FPS 50, Kit Rotina Essencial, Kit Glow.

Banner de campanha atual: "Rotina completa com 15% off no primeiro kit" (cupom PRIMEIRA10 para a primeira compra).

## Página de produto: Sérum de Vitamina C 15% (30 ml)

**R$ 129,90** ou 6x de R$ 21,65 sem juros. Código SER001.

Sérum antioxidante com 15% de vitamina C estável, ácido ferúlico e vitamina E. Ajuda a uniformizar o tom e a dar luminosidade. Uso diário, pela manhã, antes do protetor solar.

- Vegano, sem testes em animais
- Concentração do ativo na embalagem
- Avaliação média 4,8 (mais de 900 avaliações)

Observação do produto: "Estoque limitado. Aviso quando voltar." (botão para ser avisado quando estiver em falta)

Aparece em: Kit Rotina Essencial, Kit Glow e Kit Antioxidante.

## Página de produto: Protetor Solar Facial FPS 50 (50 g)

**R$ 79,90** ou 6x de R$ 13,32 sem juros. Código PRO001.

Protetor solar de toque seco, sem resíduo branco, com filtros de amplo espectro. Indicado para uso diário, inclusive sob maquiagem.

- Vegano, sem testes em animais
- Resistente à água por 40 minutos
- Avaliação média 4,7 (mais de 600 avaliações)

## Frete e trocas

**Frete grátis** para pedidos acima de R$ 249 no Sul e no Sudeste e acima de R$ 349 nas demais regiões. Abaixo disso o frete é calculado pelo CEP.

Envio pelos Correios e por transportadora parceira. Prazo médio: 2 a 5 dias úteis no Sul e Sudeste, 6 a 12 dias úteis no Nordeste e Norte.

**Trocas e devoluções:** até 7 dias corridos após o recebimento, com o produto lacrado. Em caso de defeito, a troca é imediata. Em compras no cartão, o estorno segue o prazo da operadora.

(Esta página fica no rodapé do site, sem destaque na vitrine.)
"""
