"""Exemplo compartilhado da revisão pós-apresentação (etapa 10) usado pelos testes das tarefas seguintes.

Parte do plano de `plano_v2_exemplo.plano_valido()` (ações 1 a 6) e conta uma reunião em que:
o dono da ação 2 muda (complemento 1), a ação 3 muda no `como` (conflito 1, opção C), a ação 6
é removida (conflito 2, opção B) e a ação 7 nasce de um ponto em aberto (ponto em aberto 1).
"""
from __future__ import annotations

import copy

from plano_v2_exemplo import plano_valido

_TRANSCRICAO = """\
Reunião de apresentação do Growth Cycle - Marca Teste

[00:02:10] Rafael Menezes: Bom dia, pessoal. Vou passar pelo diagnóstico e depois pelo plano de ação, e quem quiser pode interromper.
[00:12:30] Marina Alves: A recuperação de PIX e boleto é o que mais me interessa. A nossa equipe de operações está sobrecarregada, então prefiro que a Boomer configure o fluxo de lembretes.
[00:14:05] Camila Duarte: Sem problema, a gente assume a configuração e o cliente só aprova o texto dos lembretes.
[00:23:40] Marina Alves: Sobre separar as campanhas por classe A, B e C, já testamos isso no ano passado e a verba ficou presa em campanhas que não escalavam.
[00:24:20] Rafael Menezes: Entendo. Podemos separar por classe, mas com uma janela de teste de 14 dias antes de redistribuir a verba.
[00:31:15] Paulo Ribeiro: Uma ideia que a gente nunca explorou é montar kits de amostra com os produtos de entrada. Vou pensar com o time comercial se isso é viável.
[00:38:50] Marina Alves: Não queremos mais uma reunião mensal de revisão, o relatório quinzenal que já recebemos resolve.
[00:44:00] Paulo Ribeiro: Sobre o orçamento extra para mídia, preciso confirmar com o financeiro antes de dar uma resposta.
[00:47:30] Camila Duarte: Vamos enviar o relatório de eventos do GA4 com carrinho e checkout até sexta-feira.
[00:52:10] Marina Alves: Também queremos que a Boomer cuide do site novo da loja, vocês topam?
[00:53:00] Rafael Menezes: Obrigado a todos, seguimos por e-mail com os próximos passos.
"""


def transcricao_exemplo() -> str:
    return _TRANSCRICAO


def revisao_valida() -> dict:
    return {
        "versao": 1,
        "prospect": "Marca Teste",
        "data_hoje": "11/11/2026",
        "data_reuniao": "09/11/2026",
        "participantes": {
            "boomer": [
                {"nome": "Rafael Menezes", "funcao": "Gestor de contas"},
                {"nome": "Camila Duarte", "funcao": "Analista de dados"},
            ],
            "cliente": [
                {"nome": "Marina Alves", "funcao": "Diretora comercial"},
                {"nome": "Paulo Ribeiro", "funcao": "Gerente de operações"},
            ],
        },
        "resumo": (
            "O cliente aprovou o rumo do plano, passou a configuração dos lembretes de PIX e boleto "
            "para a Boomer, pediu um teste antes de redistribuir a verba e dispensou a reunião mensal."
        ),
        "complementos": [
            {
                "numero": 1,
                "acoes": [2],
                "o_que_mudou": "A equipe de operações do cliente está sobrecarregada, então a Boomer passa a configurar o fluxo de lembretes.",
                "trecho": {
                    "texto": "prefiro que a Boomer configure o fluxo de lembretes",
                    "quem": "Marina Alves (cliente)",
                    "posicao": "≈12 min",
                },
            }
        ],
        "conflitos": [
            {
                "numero": 1,
                "acao": 3,
                "recomendacao_plano": "Separar as campanhas por classe A, B e C e redistribuir a verba conforme a margem.",
                "trecho": {
                    "texto": "já testamos isso no ano passado e a verba ficou presa em campanhas que não escalavam",
                    "quem": "Marina Alves (cliente)",
                    "posicao": "≈23 min",
                },
                "impacto": "A ação 3 sustenta o ROAS, que é uma alavanca da meta.",
                "opcoes": {
                    "A": "Manter a reestruturação como está no plano.",
                    "B": "Abandonar a separação por classe.",
                    "C": "Separar por classe com 14 dias de teste antes de redistribuir a verba.",
                },
                "recomendacao_boomer": "C",
                "decisao": "C",
                "remove_acao": False,
                "alavanca_descoberta": None,
                "substituta": None,
                "acoes_afetadas": [3],
            },
            {
                "numero": 2,
                "acao": 6,
                "recomendacao_plano": "Reunião mensal com o cliente para revisar metas, ações e gatilhos.",
                "trecho": {
                    "texto": "Não queremos mais uma reunião mensal de revisão",
                    "quem": "Marina Alves (cliente)",
                    "posicao": "≈38 min",
                },
                "impacto": "A ação 6 é de governança e não é alavanca da meta; o relatório quinzenal cobre o acompanhamento.",
                "opcoes": {
                    "A": "Manter a reunião mensal.",
                    "B": "Remover a ação e acompanhar pelo relatório quinzenal.",
                },
                "recomendacao_boomer": "A",
                "decisao": "B",
                "remove_acao": True,
                "alavanca_descoberta": None,
                "substituta": None,
                "acoes_afetadas": [6],
            },
        ],
        "abertos": [
            {
                "numero": 1,
                "tema": "Kits de amostra com os produtos de entrada",
                "trecho": {
                    "texto": "Vou pensar com o time comercial se isso é viável",
                    "quem": "Paulo Ribeiro (cliente)",
                    "posicao": "≈31 min",
                },
                "destino_sugerido": "Virar ação de levantamento de viabilidade",
                "destino": {"tipo": "acao", "acoes": [7]},
            },
            {
                "numero": 2,
                "tema": "Orçamento extra para mídia",
                "trecho": {
                    "texto": "preciso confirmar com o financeiro antes de dar uma resposta",
                    "quem": "Paulo Ribeiro (cliente)",
                    "posicao": "≈44 min",
                },
                "destino_sugerido": "Confirmar com o cliente",
                "destino": {"tipo": "confirmar", "ate": "20/11/2026"},
            },
        ],
        "compromissos": [
            {
                "numero": 1,
                "texto": "Enviar o relatório de eventos do GA4 com carrinho e checkout até sexta-feira.",
                "trecho": {
                    "texto": "Vamos enviar o relatório de eventos do GA4 com carrinho e checkout até sexta-feira",
                    "quem": "Camila Duarte (Boomer)",
                    "posicao": "≈47 min",
                },
                "no_plano": True,
                "fora_do_escopo": False,
                "acoes": [1],
                "tratamento": None,
            },
            {
                "numero": 2,
                "texto": "O cliente pediu que a Boomer cuide do site novo da loja.",
                "trecho": {
                    "texto": "queremos que a Boomer cuide do site novo da loja",
                    "quem": "Marina Alves (cliente)",
                    "posicao": "≈52 min",
                },
                "no_plano": False,
                "fora_do_escopo": True,
                "acoes": [],
                "tratamento": "Fora do escopo: alinhar com o cliente na próxima reunião.",
            },
        ],
        "divergencias_cenario": [],
    }


def plano_final_valido() -> dict:
    plano = copy.deepcopy(plano_valido())
    imediato, curto, medio = plano["horizontes"]
    # Complemento 1: a Boomer passa a configurar o fluxo de lembretes.
    imediato["acoes"][1]["dono"] = "Automação de CRM · Boomer"
    # Conflito 1, opção C: teste de 14 dias antes de redistribuir a verba.
    curto["acoes"][0]["como"] = (
        "Separar campanhas por classe A, B e C, rodar 14 dias de teste com a verba atual e só então "
        "redistribuir conforme a margem de cada classe."
    )
    # Conflito 2, opção B: a rotina mensal sai do plano.
    medio["acoes"] = [a for a in medio["acoes"] if a["numero"] != 6]
    # Ponto em aberto 1: nasce a ação 7.
    curto["acoes"].append({
        "numero": 7,
        "frente": "Produto / Mix / Portfólio",
        "acao": "Levantar com o time comercial a viabilidade de kits de amostra",
        "achado_origem": "Ideia de kits de amostra surgida na apresentação do plano",
        "alavanca": "Ticket médio",
        "alavanca_da_meta": False,
        "como": "Reunir com o comercial do cliente, listar os produtos de entrada e estimar custo e margem de cada kit.",
        "dono": "Comercial · Cliente",
        "inicio": "16/11/2026",
        "entrega": "04/12/2026",
        "depende_de": [],
        "evidencia": "Planilha com custo, margem e viabilidade de cada kit",
        "kpi_meta": "Decisão sobre o lançamento dos kits",
        "gatilho": "Se a margem do kit ficar abaixo de 20% então descartar o kit e manter só a venda avulsa",
        "solucoes": [],
    })
    return plano
