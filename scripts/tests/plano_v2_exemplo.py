"""Exemplo compartilhado do plano de ação v2 usado pelos testes das tarefas seguintes."""
from __future__ import annotations


def registro_valido() -> dict:
    return {
        "versao": 1,
        "prospect": "Marca Teste",
        "problemas": [
            {
                "id": "P1",
                "tema": "quebra",
                "titulo": "Quebra 7x acima do mercado",
                "origem": "03 · Taxa de quebra",
                "dado": "36,1% da receita captada não vira caixa (R$ 19,1M/ano)",
                "benchmark": "até 5%",
                "hipoteses": [
                    {"id": "H1", "texto": "Boleto como meio de pagamento"},
                    {"id": "H2", "texto": "Ruptura de estoque"},
                ],
                "solucoes": [
                    {"id": "P1.S1", "acao": "Ativar recuperação automática de PIX e boleto", "hipotese": "H1"},
                    {"id": "P1.S2", "acao": "Checar ruptura de estoque continuamente", "hipotese": "H2"},
                ],
                "impacto": {"tipo": "R$", "valor": "+R$ 16,4M/ano", "calculo": "receita captada × (36,1% − 5%)"},
                "frente": "Eficiência Operacional",
            },
            {
                "id": "P2",
                "tema": "funil",
                "titulo": "Funil sem medição",
                "origem": "03 · Conversão",
                "dado": "GA4 sem eventos de carrinho e checkout",
                "benchmark": "carrinho 6–10%",
                "hipoteses": [{"id": "H1", "texto": "Limiar de dados ativo no GA4"}],
                "solucoes": [{"id": "P2.S1", "acao": "Desativar o limiar de dados no GA4", "hipotese": "H1"}],
                "impacto": {"tipo": "nao_quantificavel", "justificativa": "sem eventos de funil não há base"},
                "frente": "Monitoramento e Governança",
            },
        ],
        "pontos_fortes": [
            {"titulo": "Carrinho → checkout acima do mercado", "dado": "80,56% × 35–40%", "uso": "Problema está nas pontas"}
        ],
    }


def _acao(numero, frente, acao, achado, alavanca, da_meta, como, dono, inicio, entrega,
          depende, evidencia, kpi, gatilho, solucoes):
    return {
        "numero": numero,
        "frente": frente,
        "acao": acao,
        "achado_origem": achado,
        "alavanca": alavanca,
        "alavanca_da_meta": da_meta,
        "como": como,
        "dono": dono,
        "inicio": inicio,
        "entrega": entrega,
        "depende_de": depende,
        "evidencia": evidencia,
        "kpi_meta": kpi,
        "gatilho": gatilho,
        "solucoes": solucoes,
    }


def plano_valido() -> dict:
    return {
        "versao": 2,
        "prospect": "Marca Teste",
        "data_referencia": "22/10/2026",
        "janela_prova": {"inicio": "26/10/2026", "fim": "25/01/2027"},
        "fim_ciclo": "30/09/2027",
        "empresa_agencia": "Boomer",
        "agencia_parceira": None,
        "abertura": {
            "cenario": "Realista",
            "metas": [
                {"kpi": "Taxa de quebra", "de": "36,1%", "para": "25%", "ate": "25/01/2027", "fonte": "06 · Realista, JAN/27"},
            ],
            "cabe_nos_3_meses": ["Recuperação de PIX e boleto", "Medição do funil no GA4"],
            "nao_cabe": [],
            "premissas": ["Verba de mídia mantida no patamar atual"],
            "margem_contribuicao": 0.20,
            "taxa_quebra": 0.20,
        },
        "horizontes": [
            {
                "nome": "Imediato",
                "titulo": "Primeiros dias",
                "intro": None,
                "acoes": [
                    _acao(
                        1, "Monitoramento e Governança",
                        "Desativar o limiar de dados no GA4",
                        "GA4 sem eventos de carrinho e checkout",
                        "Medição do funil", False,
                        "Entrar nas configurações de dados do GA4 e desligar o limiar; conferir os eventos no dia seguinte.",
                        "Analista de dados · Boomer", "26/10/2026", "28/10/2026", [],
                        "Relatório de eventos do GA4 com carrinho e checkout preenchidos",
                        "Eventos de funil visíveis no GA4",
                        "Se os eventos de carrinho não aparecerem em 3 dias então escalar o caso ao suporte do GA4",
                        ["P2.S1"],
                    ),
                    _acao(
                        2, "Eficiência Operacional",
                        "Ativar recuperação automática de PIX e boleto",
                        "36,1% da receita captada não vira caixa",
                        "Taxa de quebra", True,
                        "Configurar o fluxo de lembrete de PIX e boleto na plataforma de e-commerce.",
                        "Operações · Cliente", "26/10/2026", "30/10/2026", [],
                        "Fluxo ativo na plataforma e primeiros pedidos recuperados",
                        "Taxa de quebra abaixo de 25%",
                        "Se a recuperação trouxer menos de 5% dos pedidos pendentes então revisar o texto e o horário do lembrete",
                        ["P1.S1"],
                    ),
                ],
            },
            {
                "nome": "Curto prazo",
                "titulo": "Primeiros três meses",
                "intro": "Ações que sustentam a meta dentro da janela de prova.",
                "acoes": [
                    _acao(
                        3, "Mídia Paga / Canal Principal",
                        "Reestruturar as campanhas de aquisição por Curva ABC",
                        "Verba concentrada em poucos produtos",
                        "ROAS", True,
                        "Separar campanhas por classe A, B e C e redistribuir a verba conforme a margem de cada classe.",
                        "Gestor de tráfego · Boomer", "02/11/2026", "30/11/2026", [1],
                        "Painel de campanhas por classe com a verba redistribuída",
                        "ROAS acima do piso aprovado",
                        "Se o ROAS de uma classe ficar abaixo do piso por 14 dias então reduzir a verba dela em 20%",
                        [],
                    ),
                    _acao(
                        4, "Produto / Mix / Portfólio",
                        "Checar ruptura de estoque continuamente",
                        "Ruptura de estoque como hipótese da quebra",
                        "Taxa de quebra", True,
                        "Cruzar o estoque com os produtos anunciados toda semana e pausar anúncio de item sem estoque.",
                        "Operações · Cliente", "12/11/2026", "15/12/2026", [],
                        "Planilha semanal de estoque cruzada com os anúncios ativos",
                        "Pedidos cancelados por falta de estoque",
                        "Se um produto anunciado ficar sem estoque então pausar o anúncio no mesmo dia",
                        ["P1.S2"],
                    ),
                    _acao(
                        5, "Redução de Dependências",
                        "Diversificar os canais de aquisição além da mídia paga",
                        "Receita concentrada em um único canal",
                        "Participação de canais próprios", False,
                        "Estruturar e-mail e CRM para recompra e reduzir a dependência de tráfego pago.",
                        "CRM · Boomer", "01/12/2026", "31/01/2027", [],
                        "Calendário de disparos e relatório de receita por canal",
                        "Participação de canais próprios na receita",
                        "Se a receita de canais próprios ficar abaixo de 10% do total então ampliar a frequência dos disparos",
                        [],
                    ),
                ],
            },
            {
                "nome": "Médio prazo",
                "titulo": "Até o fim do ciclo",
                "intro": None,
                "acoes": [
                    _acao(
                        6, "Monitoramento e Governança",
                        "Implantar a rotina mensal de revisão do plano",
                        "Falta de acompanhamento contínuo dos indicadores",
                        "Governança", False,
                        "Reunião mensal com o cliente para revisar metas, ações e gatilhos, registrando decisões.",
                        "Gestor de projetos · Boomer", "01/02/2027", "30/06/2027", [],
                        "Ata mensal com decisões e responsáveis",
                        "Ações do plano concluídas no prazo",
                        "Se duas ações atrasarem no mesmo mês então replanejar as datas na reunião seguinte",
                        [],
                    ),
                ],
            },
        ],
    }


def plano_com_ondas() -> dict:
    """plano_valido() com 3 ondas (janelas em ordem, cada ação começa dentro da onda que a lista),
    checkpoints nas ondas 1 e 2 (a última não tem) e decisões do cliente nas ações 3 e 5."""
    plano = plano_valido()
    acoes_por_numero = {a["numero"]: a for _, a in ((h["nome"], a) for h in plano["horizontes"] for a in h["acoes"])}
    acoes_por_numero[1]["acao"] = "Liberar os acessos"
    acoes_por_numero[3]["depende_de"] = [1]
    acoes_por_numero[5]["depende_de"] = [2, 3]
    acoes_por_numero[3]["decisao_cliente"] = {
        "ate": "30/10/2026",
        "recomendacao": "Aprovar a redistribuição da verba por classe da Curva ABC.",
    }
    acoes_por_numero[5]["decisao_cliente"] = {
        "ate": "27/11/2026",
        "recomendacao": "Autorizar o e-mail e o CRM como canais de recompra.",
    }
    plano["ondas"] = [
        {
            "numero": 1,
            "nome": "Contenção",
            "inicio": "26/10/2026",
            "fim": "01/11/2026",
            "calendario_midia": "Contenção",
            "objetivo": "Destravar acessos e a medição do funil antes de mexer na verba.",
            "acoes": [1, 2],
            "checkpoint": {
                "data": "30/10/2026",
                "duracao": "30 minutos",
                "pauta": "Acessos liberados e eventos de funil no GA4.",
                "para_liberar": "Acessos entregues e eventos de carrinho visíveis no GA4.",
                "quem_decide": "Gestor de projetos · Boomer e responsável pela operação do cliente",
            },
        },
        {
            "numero": 2,
            "nome": "Escala",
            "inicio": "02/11/2026",
            "fim": "30/11/2026",
            "calendario_midia": "Escala",
            "objetivo": "Reestruturar as campanhas por Curva ABC e proteger o estoque anunciado.",
            "acoes": [3, 4],
            "checkpoint": {
                "data": "27/11/2026",
                "duracao": "45 minutos",
                "pauta": "ROAS por classe e ruptura de estoque.",
                "para_liberar": "ROAS acima do piso aprovado nas classes A e B.",
                "quem_decide": "Gestor de tráfego · Boomer e diretoria do cliente",
            },
        },
        {
            "numero": 3,
            "nome": "Manutenção",
            "inicio": "01/12/2026",
            "fim": "30/06/2027",
            "calendario_midia": "Pico e Manutenção",
            "objetivo": "Diversificar os canais e manter a rotina de revisão do plano.",
            "acoes": [5, 6],
            "checkpoint": None,
        },
    ]
    return plano
