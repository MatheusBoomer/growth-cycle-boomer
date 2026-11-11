"""Base comum do plano de ação v2: constantes, leitura de datas, pisos de ROAS e tabela-resumo.

Usada pelo validador e pelos geradores (.docx e .xlsx), para que todos leiam o
plano do mesmo jeito.
"""
from __future__ import annotations

import re
from datetime import date, datetime

HORIZONTES = ("Imediato", "Curto prazo", "Médio prazo")
FRENTES = (
    "Mídia Paga / Canal Principal",
    "Eficiência Operacional",
    "Produto / Mix / Portfólio",
    "Redução de Dependências",
    "Monitoramento e Governança",
)
# Os 10 campos obrigatórios da ação. `depende_de` é lista e conta como o 7º campo na exibição.
CAMPOS_ACAO = (
    "acao",
    "achado_origem",
    "alavanca",
    "como",
    "dono",
    "inicio",
    "entrega",
    "evidencia",
    "kpi_meta",
    "gatilho",
)

_PADRAO_DATA = re.compile(r"^\d{2}/\d{2}/\d{4}$")


class ErroPlano(Exception):
    """Problema no conteúdo do plano, com mensagem pronta para o analista."""


def ler_data(texto: str, onde: str) -> date:
    """Lê uma data no formato dd/mm/aaaa; qualquer outra coisa vira ErroPlano."""
    erro = ErroPlano(f'{onde}: data "{texto}" fora do formato dd/mm/aaaa.')
    if not isinstance(texto, str) or not _PADRAO_DATA.match(texto):
        raise erro
    try:
        return datetime.strptime(texto, "%d/%m/%Y").date()
    except ValueError:
        raise erro from None


def acoes(plano: dict) -> list[tuple[str, dict]]:
    """(nome do horizonte, ação) na ordem do JSON."""
    return [(h.get("nome", ""), a) for h in plano.get("horizontes", []) for a in h.get("acoes", [])]


def acoes_cronologicas(plano: dict) -> list[dict]:
    """Ações ordenadas por início; empate resolvido pelo número."""
    return sorted(
        (a for _, a in acoes(plano)),
        key=lambda a: (ler_data(a["inicio"], f"Ação {a.get('numero')}, início"), a.get("numero", 0)),
    )


def pisos_roas(margem: float | None, quebra: float | None) -> dict:
    """Piso de ROAS aprovada (1/margem) e captada (aprovada/(1-quebra)).

    Sem margem válida (ausente, <= 0 ou > 1) os dois ficam None; `captada` é None
    também quando não há quebra utilizável. Nunca divide por zero.
    """
    if not isinstance(margem, (int, float)) or isinstance(margem, bool) or margem <= 0 or margem > 1:
        return {"aprovada": None, "captada": None}
    aprovada = 1 / margem
    captada = None
    if isinstance(quebra, (int, float)) and not isinstance(quebra, bool) and 0 <= quebra < 1:
        captada = aprovada / (1 - quebra)
    return {"aprovada": aprovada, "captada": captada}


def tabela_resumo(plano: dict) -> list[dict]:
    """Linhas da tabela-resumo em ordem cronológica de início."""
    horizonte_de = {id(a): h for h, a in acoes(plano)}
    return [
        {
            "numero": a["numero"],
            "acao": a["acao"],
            "frente": a["frente"],
            "horizonte": horizonte_de[id(a)],
            "periodo": f"{a['inicio']} a {a['entrega']}",
            "dono": a["dono"],
        }
        for a in acoes_cronologicas(plano)
    ]


def texto_depende(acao: dict) -> str:
    """'Nenhuma', 'Ação 2' ou 'Ações 2, 5'."""
    deps = acao.get("depende_de") or []
    if not deps:
        return "Nenhuma"
    if len(deps) == 1:
        return f"Ação {deps[0]}"
    return "Ações " + ", ".join(str(d) for d in deps)
