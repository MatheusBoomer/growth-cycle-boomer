#!/usr/bin/env python3
"""
Monta o roteiro da apresentação final da Verdeluz (cliente de teste) a partir do que foi aprovado nas etapas 01 a 09 e grava
`entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json`. Todo texto condensa as seções aprovadas; nenhum número é novo.

    python3 scripts/fixture_verdeluz/roteiro_10.py --cliente clientes/verdeluz-producao
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

G = "entrega/ativos-aprovados/graficos/"
NOME = "Verdeluz Cosméticos Veganos (FICTÍCIO)"


def grafico(arq, titulo, subtitulo, conclusoes, fonte, tipo="grafico"):
    return {"tipo": tipo, "titulo": titulo, "subtitulo": subtitulo, "imagem": G + arq, "conclusoes": conclusoes, "fonte": fonte}


def divisoria(numero, titulo):
    return {"tipo": "divisoria", "numero": numero, "titulo": titulo}


def bullets(titulo, subtitulo, itens, fonte):
    return {"tipo": "bullets", "titulo": titulo, "subtitulo": subtitulo, "itens": itens, "fonte": fonte}


def desafio(pid, titulo, problema, hipoteses, solucoes, impacto):
    return {"tipo": "desafio", "problema_id": pid, "titulo": titulo, "problema": problema, "hipoteses": hipoteses, "solucoes": solucoes, "impacto": impacto, "fonte": "secoes/05-solucoes.md"}


def montar() -> dict:
    s = []
    s += [{"tipo": "capa", "prospect": NOME}, {"tipo": "jornada"}]

    # 01. Cenário atual
    s.append(divisoria("01.", "CENÁRIO **ATUAL**"))
    s += [
        grafico("investimento-midia-mensal.png", "Cenário Atual · Investimento", "Investimento em mídia de **R$ 262 mil** em 12 meses",
                ["R$ 262 mil no ano, média de R$ 21,8 mil por mês", "SET/26 é o maior mês (R$ 32,9 mil), sem data comercial", "Último trimestre 31% acima do primeiro"], "secoes/03-macro-financeiro.md"),
        grafico("receita-captada-vs-aprovada.png", "Cenário Atual · Receita", "Receita **captada** contra **aprovada**",
                ["Captada de R$ 1,22 mi e aprovada de R$ 1,14 mi", "R$ 79,3 mil não foram aprovados no período", "Captada 9,1% menor no segundo semestre"], "secoes/03-macro-financeiro.md"),
        grafico("taxa-quebra-mensal.png", "Cenário Atual · Taxa de quebra", "Quebra média de **6,5%**, acima do benchmark",
                ["Média de 6,5% contra o benchmark de até 5%", "Sobe de 5,5% (JAN) para 7,1% (SET)", "No limite de 5%, seriam R$ 18,3 mil a mais aprovados"], "secoes/03-macro-financeiro.md"),
        grafico("quebra-por-meio-pagamento.png", "Cenário Atual · Quebra por meio de pagamento", "Cartão e boleto concentram a **perda**",
                ["Cartão: quebra de 7,5% e 66% da perda (R$ 52,4 mil)", "Boleto: quebra de 17,0%, com 5% da receita", "PIX: 3,6%, abaixo do benchmark de 5%"], "secoes/03-macro-financeiro.md"),
        {"tipo": "analises_2_colunas",
         "esquerda": {"titulo": "Investimento", "itens": ["R$ 262 mil em 12 meses, 62% no Meta e 38% no Google", "A verba cresce desde JUN, além da sazonalidade", "Último trimestre com 31% mais verba que o primeiro"]},
         "direita": {"titulo": "Receita", "itens": ["Captada de R$ 1,22 mi, abaixo dos R$ 1,5 mi falados no kickoff", "NOV concentra 15,6% do ano", "MAR e ABR ficam no patamar dos vales, com a ruptura do sérum"]},
         "fonte": "secoes/03-macro-financeiro.md"},
        grafico("roas-global.png", "Cenário Atual · ROAS global", "ROAS global médio de **4,66x**, em queda",
                ["De 6,48x (OUT) para 3,06x (SET), -53%", "Só NOV e DEZ interrompem a queda", "Verba do último trimestre 31% maior que a do primeiro"], "secoes/03-macro-financeiro.md"),
        grafico("roas-plataformas.png", "Cenário Atual · ROAS por plataforma", "ROAS por **plataforma** (GA4, último clique)",
                ["Google: média de 2,52x, de 3,68x para 1,96x", "Meta: média de 1,22x, abaixo de 1x de JUL a SET", "O último clique subestima o Meta: ler a tendência"], "secoes/03-macro-financeiro.md"),
        grafico("sessoes-por-plataforma.png", "Cenário Atual · Sessões", "**442 mil** sessões no ano, estáveis entre semestres",
                ["Sessões -1,0% entre semestres, com mais verba", "Meta 30,3%, Google 14,4% e demais origens 55,2%", "Tráfego não pago parado em 16 mil a 19 mil por mês"], "secoes/03-aquisicao-dependencia-conversao.md"),
        grafico("dependencia-midia-paga.png", "Cenário Atual · Dependência de mídia paga", "Dependência de mídia paga **sobe** para 55%",
                ["Média de 44,8% (benchmark de 45% a 60%)", "Sobe de 48,0% (OUT) para 54,8% (SET)", "Alta em AGO e SET sem data comercial"], "secoes/03-aquisicao-dependencia-conversao.md"),
        grafico("conversao-global.png", "Cenário Atual · Conversão global", "Conversão global de **1,41%**, dentro da faixa",
                ["1,41%, dentro da faixa de 1% a 2%", "1,00% em ABR e 1,05% em MAR, com a ruptura do sérum", "NOV chega a 2,05% na Black Friday"], "secoes/03-aquisicao-dependencia-conversao.md"),
        grafico("conversao-google.png", "Cenário Atual · Conversão Google", "Conversão do Google no **limite inferior**",
                ["2,05%, no limite da faixa de 2% a 4%", "Abaixo de 2% de JUN a SET", "Cai de 2,20% para 1,90% ao longo do ano"], "secoes/03-aquisicao-dependencia-conversao.md"),
        grafico("conversao-meta.png", "Cenário Atual · Conversão Meta", "Conversão do Meta **abaixo da faixa**",
                ["0,80%, contra a faixa de 1% a 2%", "Abaixo de 1% nos 12 meses", "Cai de 0,90% (OUT) para 0,70% (SET)"], "secoes/03-aquisicao-dependencia-conversao.md"),
        {"tipo": "analises_2_colunas",
         "esquerda": {"titulo": "Conversão por canal", "itens": ["Global de 1,41%, dentro da faixa", "Google de 2,05%, no limite inferior", "Meta de 0,80%, abaixo da faixa nos 12 meses"]},
         "direita": {"titulo": "Leitura", "itens": ["O tráfego próprio converte bem; o comprado perde qualidade", "A ruptura do sérum derruba a conversão em MAR e ABR", "Sem dado de funil: o abandono de 78% é declarado"]},
         "fonte": "secoes/03-aquisicao-dependencia-conversao.md"},
        grafico("curva-abc-faturamento.png", "Cenário Atual · Curva ABC", "Curva ABC com **58 SKUs**",
                ["A: 9 SKUs e 78,9% do faturamento", "B: 11 SKUs e 15,7%; C: 38 SKUs e 5,4%", "Três líderes somam 51,0% e os kits 24,0%"], "secoes/03-aquisicao-dependencia-conversao.md"),
        grafico("top10-produtos.png", "Cenário Atual · Top 10 produtos", "Os 10 maiores produtos somam **81,3%**",
                ["Sérum de vitamina C: 22,0% (R$ 257,8 mil)", "Hidratante gel-creme 16,0% e protetor FPS 50 13,0%", "O sérum tem 38 unidades, cerca de 7 dias de venda"], "secoes/03-aquisicao-dependencia-conversao.md"),
        grafico("tabela-curva-abc-a.png", "Cenário Atual · Curva A", "Curva A: **9 SKUs** e 78,9% do faturamento",
                ["Os 9 SKUs somam 78,9% do faturamento", "Quatro kits entre os 9, com os três líderes", "O sérum é o ponto de maior risco de ruptura"], "secoes/03-aquisicao-dependencia-conversao.md", "tabela_lateral"),
        grafico("tabela-curva-abc-b.png", "Cenário Atual · Curva B", "Curva B: **11 SKUs** e 15,7% do faturamento",
                ["Vai da água micelar (2,4%) ao protetor toque seco (0,7%)", "Papel: expandir a cesta e alimentar o remarketing", "Quatro séruns e dois hidratantes entre os 11"], "secoes/03-aquisicao-dependencia-conversao.md", "tabela_lateral"),
        grafico("tabela-curva-abc-c.png", "Cenário Atual · Curva C", "Curva C: **38 SKUs** e 5,4% do faturamento",
                ["38 SKUs somam 5,4% (cerca de R$ 63 mil)", "Preço médio de R$ 63,98 e R$ 1.664 por SKU ao ano", "Candidatos a brinde, kit ou descontinuação"], "secoes/03-aquisicao-dependencia-conversao.md", "tabela_lateral"),
        grafico("cac-mensal.png", "Cenário Atual · CAC", "O CAC **dobra** em 12 meses",
                ["De R$ 49,53 para R$ 112,68 (+127%)", "Média ponderada de R$ 68,53", "Verba +43% e clientes novos -17% no 2º semestre"], "secoes/04-unidade-economica.md"),
        grafico("novos-vs-recorrentes.png", "Cenário Atual · Novos e recorrentes", "Pedidos de clientes **novos** e **recorrentes**",
                ["61,2% dos pedidos vêm de clientes novos", "A participação de recorrentes sobe porque os novos caem", "Pedidos de recorrentes caem 4,3% entre semestres"], "secoes/04-unidade-economica.md"),
        bullets("Cenário Atual · Unidade econômica", "LTV/CAC no último mês de **2,77x**",
                ["LTV histórico de R$ 311,67 (ticket R$ 191,80 e 1,62 pedido por cliente)", "31,0% da base é recorrente; os recorrentes valem R$ 578,17, três vezes a compra única",
                 "LTV/CAC de 2,77x em SET/26 (ruim) e de 4,55x na média do ano", "Compra única: 1,70x. Recorrente: 5,13x", "Em AGO/26 a relação já estava em 3,11x"], "secoes/04-unidade-economica.md"),
    ]

    # 02. Desafios
    s.append(divisoria("02.", "DESAFIOS"))
    s += [
        bullets("Desafios · Prioridades", "Os **oito** desafios do diagnóstico (1 de 2)",
                ["P1 Mídia paga: CAC +127% e ROAS -53% (R$ 31,6 mil a R$ 66,2 mil)", "P2 Estoque: ruptura do sérum (R$ 43,7 mil por ruptura evitada)",
                 "P3 Retenção: 69% da base compra uma vez (R$ 68,8 mil a R$ 137,6 mil)", "P4 Pagamento: quebra de 6,5% (R$ 6,1 mil a R$ 18,3 mil)"], "secoes/05-solucoes.md"),
        bullets("Desafios · Prioridades", "Os **oito** desafios do diagnóstico (2 de 2)",
                ["P5 Funil: carrinho e página (R$ 86,5 mil a R$ 173,0 mil)", "P6 Black Friday e desconto (impacto a quantificar com a margem)",
                 "P7 Mensuração: atribuição, influenciadoras e funil (habilitador)", "P8 Mix: poucos kits e cauda C (R$ 61,0 mil a R$ 122,0 mil)",
                 "Os impactos se sobrepõem e não se somam"], "secoes/05-solucoes.md"),
        desafio("P1", "Mídia paga: **o CAC dobra e o ROAS cai 53%**", "CAC de R$ 49,53 para R$ 112,68 e ROAS de 6,48x para 3,06x, com 43% mais verba e 17% menos clientes novos.",
                ["Verba ampliada atinge públicos mais frios no Meta (conversão de 0,90% para 0,70%)", "Conversão do Google cai por páginas instáveis e pela ruptura do sérum", "Não há regra de escala nem teto de CAC"],
                ["Escala em degraus de 15% por quinzena, com teto de CAC de R$ 80", "Realocar 15% da prospecção do Meta para Shopping, PMax e remarketing", "Separar campanhas de aquisição e de recompra, com ROAS-alvo próprio"],
                "R$ 31,6 mil a R$ 66,2 mil de mídia por ano"),
        desafio("P2", "Estoque: **ruptura do sérum e 3 produtos com 51%**", "O sérum, com 22% do faturamento, ficou fora do ar em MAR e ABR e hoje tem cerca de 7 dias de estoque.",
                ["Prazo do laboratório de 45 dias e reposição pedida com estoque baixo", "A embalagem do sérum depende de um único fornecedor", "Mídia e feed do Google não se ligam ao estoque"],
                ["Estoque de segurança de 60 dias para os três líderes, com ponto de pedido mensal", "Segundo fornecedor de embalagem e prioridade de produção no laboratório", "Alerta que pausa campanha e feed com cobertura abaixo de 7 dias"],
                "R$ 43,7 mil por ruptura evitada"),
        desafio("P3", "Retenção: **69% da base compra uma vez só**", "7.176 clientes compraram uma vez. Os recorrentes valem R$ 578 contra R$ 192, mas não há régua de recompra.",
                ["Sem lembrete de reposição, mesmo com ciclo de uso previsível (sérum, 60 dias)", "CRM com um fluxo de carrinho e uma newsletter mensal", "Quem compra avulso não é levado ao kit"],
                ["Régua de reposição por produto: sérum aos 45 dias, demais aos 55", "Reativar os 7.176 clientes de compra única com a oferta do kit", "Convidar o comprador de avulso a migrar para o kit, com frete grátis"],
                "R$ 68,8 mil a R$ 137,6 mil por ano"),
        desafio("P4", "Pagamento: **quebra de 6,5%, em alta**", "Quebra de 6,5% (benchmark de 5%), de 5,5% para 7,1%. O cartão pesa 66% da perda e o boleto quebra 17%.",
                ["Antifraude e recusa do emissor derrubam pedidos de cartão sem nova tentativa", "O PIX expira sem lembrete nem novo código", "Boleto com vencimento longo e sem lembrete"],
                ["Auditar antifraude e recusas por emissor e reprocessar cartões recusados", "Lembrete 30 minutos antes de o PIX expirar, com novo código em um clique", "Boleto com vencimento de 2 dias, lembrete e PIX priorizado"],
                "R$ 6,1 mil a R$ 18,3 mil por ano"),
        desafio("P5", "Funil: **vazamento no carrinho e na página**", "Conversão do Meta de 0,80% e do Google abaixo de 2% desde JUN; abandono de 78% com um único e-mail.",
                ["Um único toque de recuperação deixa a maioria dos carrinhos sem segunda chance", "Dúvidas de frete e prazo travam a compra antes do checkout", "Prova social e fotos atuais não aparecem onde o cliente decide"],
                ["Recuperação de carrinho em 3 toques (1 h, 24 h e 72 h)", "Frete por CEP, prazo e frete grátis na página de produto", "Avaliações e depoimentos nas páginas dos líderes e dos kits"],
                "R$ 86,5 mil a R$ 173,0 mil por ano (+0,1 a +0,2 p.p.)"),
        desafio("P6", "Sazonalidade: **Black Friday e desconto**", "NOV concentra 15,6% do ano, com 35% de desconto e frete sem mínimo; o cupom de 1ª compra desconta quem compraria.",
                ["Desconto profundo ensina o cliente a esperar a Black Friday", "O cupom de primeira compra é aplicado a quem já compraria", "As datas menores do calendário não são usadas"],
                ["Black Friday com até 20% e brinde, sérum com no máximo 10%", "Lista de espera para vender à base própria antes da mídia fria", "Duas ou três datas menores com campanhas de kit"],
                "Não quantificado até validar a margem por SKU"),
        desafio("P7", "Mensuração: **atribuição, influenciadoras e funil**", "O GA4 registra 4% mais vendas que a Nuvemshop, o Meta no GA4 fica abaixo de 1x e não há dado de funil.",
                ["O GA4 conta pedidos que depois mudam de status", "O último clique subestima o Meta", "Sem cupom ou UTM por influenciadora, não há retorno medido"],
                ["Painel mensal único conciliando GA4 e Nuvemshop por status do pedido", "Cupom e UTM próprios para cada influenciadora", "Eventos de funil no GA4: produto, carrinho, checkout, pagamento e compra"],
                "Não quantificado: ação habilitadora das demais"),
        desafio("P8", "Mix: **poucos kits e cauda C sem retorno**", "Os kits somam 24% (7 kits) e a Curva C tem 38 SKUs com 5,4% do faturamento (cerca de R$ 63 mil).",
                ["Faltam kits que unam os líderes (sérum com protetor)", "Boa parte da cauda C não tem função clara", "Produtos de baixo valor não são ofertados no carrinho"],
                ["Dois novos kits a partir da Curva A, com margem validada", "Revisar os 38 SKUs da Curva C: descontinuar, brinde ou adicional", "Item adicional de baixo valor no carrinho dos três líderes"],
                "R$ 61,0 mil a R$ 122,0 mil por ano (ticket +5% a +10%)"),
        {"tipo": "cartoes", "titulo": "Desafios · Pilares", "subtitulo": "Três **pilares** organizam o plano",
         "cartoes": ["**Aquisição eficiente:** mídia, funil e pagamento (P1, P4 e P5)", "**Produto e estoque:** ruptura e mix (P2 e P8)", "**Retenção:** CRM, calendário e medição (P3, P6 e P7)"],
         "fonte": "secoes/05-solucoes.md"},
        bullets("Desafios · Iniciativas dos pilares", "Seis **iniciativas** para começar",
                ["Aquisição: teto de CAC e regra de escala em degraus", "Aquisição: recuperação de carrinho em 3 toques e frete por CEP",
                 "Produto: estoque de segurança de 60 dias para os três líderes", "Produto: dois novos kits e revisão da Curva C",
                 "Retenção: régua de reposição e reativação da compra única", "Retenção: painel único de KPIs e cupom por influenciadora"], "plano-de-acao/plano-de-acao-estrategico.docx"),
    ]

    # 03. Benchmarking
    s.append(divisoria("03.", "ANÁLISE DE **BENCHMARKING**"))
    s += [
        bullets("Benchmarking · Sallve", "Kit com desconto **limitado** e rotina guiada",
                ["Lição: oferta de kit montado (até 15% OFF) e ordem de uso no blog", "Evidência: site e blog da marca, observados em 22/10/2026 (sem coleta de anúncios)",
                 "Testar: Black Friday com kit montado de até 15% no lugar de 35% (P6 e P8)", "Testar: página de ordem de uso no pós-compra (P3)"], "secoes/07-benchmark.md"),
        bullets("Benchmarking · Simple Organic", "Comunidade e **revenda**",
                ["Lição: programa aberto de comunidade e presença em varejista online", "Evidência: perfil e site da marca, observados em 22/10/2026 (sem coleta de anúncios)",
                 "Testar: piloto de 10 embaixadoras com cupom e UTM por 60 dias (P7)", "Testar: vitrine de best-sellers com os líderes e os kits (P8)"], "secoes/07-benchmark.md"),
        bullets("Benchmarking · Care Natural Beauty", "Selo de confiança e **brinde**",
                ["Lição: selo de terceiros autodeclarado como prova e publicação associada com brinde", "Evidência: perfil e site da marca, observados em 22/10/2026 (sem coleta de anúncios)",
                 "Testar: nécessaire Verdeluz como brinde acima de um valor mínimo (P6)", "Testar: selo vegano e avaliações nas páginas dos líderes (P5)"], "secoes/07-benchmark.md"),
        bullets("Benchmarking · Análises", "Quatro **destaques** para a Verdeluz",
                ["Sallve usa kit com desconto limitado; a Care aparece com brinde e cupom", "Prova de confiança visível faz parte do argumento de venda",
                 "Programa estruturado de embaixadoras transforma influência em número", "Sem coleta de anúncios: formato, funil e intensidade ficam para a coleta real"], "secoes/07-benchmark.md"),
    ]

    # 04. Metas
    s.append(divisoria("04.", "**METAS**"))
    s += [
        grafico("tabela-cenarios-projecao.png", "Metas · Cenários", "Meta Realista de **R$ 1,59 mi** (+30,0%)",
                ["Pessimista R$ 1,10 mi (-10,0%), Realista R$ 1,59 mi (+30,0%)", "Otimista R$ 1,71 mi (+40,0%): a meta das sócias é o teto", "Meta agressiva: depende de não repetir a ruptura"], "secoes/06-metas-e-cenarios.md", "tabela_lateral"),
        grafico("meta-realista-vs-ano-atual.png", "Metas · Realista contra o ano atual", "Meta **mês a mês**, com a sazonalidade do histórico",
                ["Entrada gradual: OUT em +8,9% e SET em +44,3%", "MAR e ABR sobem +60% sobre uma base deprimida pela ruptura", "NOV e MAI seguem os picos do ano"], "secoes/06-metas-e-cenarios.md"),
        grafico("cenarios-pessimista-realista-otimista.png", "Metas · Os três cenários", "Os três **cenários** de receita captada",
                ["Pessimista: nada muda e a receita cai 10%", "Realista: eficiência e retenção sustentam +30%", "Otimista: todas as alavancas, +40%"], "secoes/06-metas-e-cenarios.md"),
    ]

    # 05. Cenários e impactos
    s.append(divisoria("05.", "**CENÁRIOS** E IMPACTOS **ESPERADOS**"))
    s += [
        bullets("Cenários · Metodologia", "Sessões, vendas e receita **calculadas** pelos KPIs influenciadores",
                ["KPIs influenciadores: investimento, ticket, conversão, custo por sessão e dependência", "KPIs de resultado: sessões, vendas e receita, calculados pela cadeia",
                 "A conversão fecha a meta de cada mês; o investimento sai das sessões", "Distribuição sazonal, nunca flat, com MAR e ABR normalizados", "Soluções do registro entram como alavancas de cada cenário"], "secoes/06-metas-e-cenarios.md"),
        bullets("Cenários · Considerações", "O que precisa **acontecer** para o Realista",
                ["Investimento de R$ 341,7 mil (+30,4%) e ROAS médio de 4,64x", "Conversão média de 1,75% e dependência de 54% para 45%", "Quebra de 6,5% para 5,5% e ticket de R$ 199,47",
                 "Risco: ruptura do sérum, CAC fora do teto e conversão abaixo de 1,8%", "Alavanca principal: recuperação de carrinho, recompra e estoque"], "secoes/06-metas-e-cenarios.md"),
        grafico("alocacao-verba-plataforma.png", "Mídia paga · Alocação de verba", "Verba de **R$ 341,7 mil** por plataforma",
                ["Meta R$ 191 mil (55,9%) e Google R$ 150,7 mil (44,1%)", "Google sobe 51% e Meta 18% sobre o ano atual", "Pico de NOV: R$ 49,3 mil (14,4% do ano)"], "secoes/08-midia-paga.md"),
        grafico("tabela-alocacao-verba-plataforma.png", "Mídia paga · Alocação mensal", "Cada mês com a sua **justificativa**",
                ["Meta a 62% em NOV e 60% em MAI, para ganhar alcance", "Google a 48% nos vales, onde a intenção pesa mais", "Total de R$ 341.683 em 12 meses"], "secoes/08-midia-paga.md", "tabela_lateral"),
        {"tipo": "imagem_larga", "titulo": "Mídia paga · Estratégia por Curva ABC", "imagem": G + "tabela-curva-abc-estrategia.png",
         "texto": "A Curva C não recebe verba direta: uma venda paga custa R$ 109,90 e o preço médio é R$ 63,98.", "fonte": "secoes/08-midia-paga.md"},
        grafico("tabela-calendario-estrategico.png", "Mídia paga · Calendário estratégico", "Dois **picos**, três escalas e dois vales",
                ["Picos em NOV (Black Friday) e MAI (Dia das Mães)", "Escala em DEZ, ABR e SET; contenção em JAN e FEV", "Estoque de segurança vigiado antes de cada pico"], "secoes/08-midia-paga.md", "tabela_lateral"),
        grafico("roas-esperado-plataforma.png", "Mídia paga · ROAS esperado", "ROAS global médio de **4,64x** no Realista",
                ["De 3,70x (OUT) para 5,96x (SET), com entrada gradual", "Google médio de 2,82x e Meta de 1,23x (GA4)", "Risco de compressão em JAN, FEV, ABR e JUN"], "secoes/08-midia-paga.md"),
        bullets("Mídia paga · Dependência", "Sessões pagas de **54,8%** para **45%**",
                ["Meta de 45% das sessões pagas em SET/27, de 54% em OUT/26", "CRM: régua de reposição e reativação de 7.176 clientes", "Conteúdo de rotina ligado aos kits e programa de embaixadoras",
                 "Marketplace fora do horizonte, pela premissa do cliente", "Sem a redução, a dependência vai a 58% e o ROAS a 2,56x"], "secoes/08-midia-paga.md"),
    ]

    # 06. Plano de ação
    s.append(divisoria("06.", "PLANO **DE AÇÃO**"))
    s += [
        bullets("Plano de ação · Horizonte 1", "Imediato: **26/10 a 30/10/2026**",
                ["Teto de CAC de R$ 80 e regra de escala da verba (Agência)", "Estoque de segurança de 60 dias e alerta de cobertura (Agência e Cliente)",
                 "Painel único de KPIs conciliando GA4 e Nuvemshop (Agência)", "Margem por SKU da Curva A enviada pela Luiza (Cliente)", "Cupom e UTM próprios para cada influenciadora (Agência e Cliente)"], "plano-de-acao/plano-de-acao-estrategico.docx"),
        bullets("Plano de ação · Horizonte 2", "Curto prazo: **02/11 a 27/11/2026**, até a Black Friday",
                ["Campanhas de aquisição e recompra separadas; 15% do Meta realocado", "Black Friday com brinde, até 20% de desconto e lista de espera", "Recuperação de carrinho em 3 toques e frete por CEP",
                 "Antifraude, reprocesso de cartões e lembrete de PIX", "Segundo fornecedor de embalagem e régua de reposição", "Eventos de funil no GA4 e reunião mensal de resultados"], "plano-de-acao/plano-de-acao-estrategico.docx"),
        bullets("Plano de ação · Horizonte 3", "Médio prazo: **DEZ/2026 a MAI/2027**, até o Dia das Mães",
                ["Reativação dos 7.176 clientes de compra única em JAN e FEV", "Convite do avulso para o kit e prova social nas páginas", "Boleto com vencimento menor e PIX priorizado",
                 "Duas ou três datas menores no calendário", "Dois novos kits e revisão da Curva C antes do Dia das Mães", "Item adicional no carrinho dos três líderes"], "plano-de-acao/plano-de-acao-estrategico.docx"),
    ]
    s.append({"tipo": "obrigado"})
    return {"versao": 1, "prospect": NOME, "slides": s}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cliente", required=True, type=Path)
    args = parser.parse_args()
    roteiro = montar()
    destino = args.cliente / "entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(roteiro, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(roteiro['slides'])} slides no roteiro: {destino}")
