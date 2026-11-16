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

_PADRAO_DATA = re.compile(r"^\d{2}/\d{2}/\d{4}$", re.ASCII)
# Caracteres que o XML 1.0 não admite (e que o openpyxl recusa): controles menos \t, \n e \r.
_CONTROLES_ILEGAIS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")


def limpar_texto(texto):
    """Remove caracteres de controle ilegais em XML; mantém \t e \n. Valor que não é texto passa direto."""
    if not isinstance(texto, str):
        return texto
    return _CONTROLES_ILEGAIS.sub("", texto)


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


def acoes_cronologicas_com_horizonte(plano: dict) -> list[tuple[str, dict]]:
    """(horizonte, ação) ordenados por início; empate resolvido pelo número."""
    return sorted(
        acoes(plano),
        key=lambda par: (
            ler_data(par[1]["inicio"], f"Ação {par[1].get('numero')}, início"),
            par[1].get("numero", 0),
        ),
    )


def acoes_cronologicas(plano: dict) -> list[dict]:
    """Ações ordenadas por início; empate resolvido pelo número."""
    return [a for _, a in acoes_cronologicas_com_horizonte(plano)]


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
    return [
        {
            "numero": a["numero"],
            "acao": a["acao"],
            "frente": a["frente"],
            "horizonte": horizonte,
            "periodo": f"{a['inicio']} a {a['entrega']}",
            "dono": a["dono"],
        }
        for horizonte, a in acoes_cronologicas_com_horizonte(plano)
    ]


def fases(plano: dict) -> list[dict]:
    """Fases do plano na ordem do JSON; lista vazia quando o plano não tem `fases`."""
    return list(plano.get("fases") or [])


def fase_da_acao(plano: dict, numero: int) -> dict | None:
    """A fase que lista a ação `numero`, ou None."""
    for fase in fases(plano):
        if numero in (fase.get("acoes") or []):
            return fase
    return None


def nome_da_acao(plano: dict, numero: int) -> str:
    """Nome da ação `numero`; texto vazio quando ela não existe."""
    for _, acao in acoes(plano):
        if acao.get("numero") == numero:
            return acao.get("acao", "")
    return ""


def texto_depende(acao: dict, plano: dict | None = None) -> str:
    """'Nenhuma', 'Ação 2' ou 'Ações 2, 5'; com `plano`, cada ação leva o nome:
    'Ação 2 (Nome); Ação 5 (Nome)'."""
    deps = acao.get("depende_de") or []
    if not deps:
        return "Nenhuma"
    if plano is not None:
        partes = []
        for d in deps:
            nome = nome_da_acao(plano, d)
            partes.append(f"Ação {d} ({nome})" if nome else f"Ação {d}")
        return "; ".join(partes)
    if len(deps) == 1:
        return f"Ação {deps[0]}"
    return "Ações " + ", ".join(str(d) for d in deps)


def visao_geral(plano: dict) -> list[dict]:
    """Uma linha por fase para a tabela de visão geral."""
    return [
        {
            "numero": o.get("numero"),
            "nome": o.get("nome"),
            "janela": f"{o.get('inicio')} a {o.get('fim')}",
            "calendario_midia": o.get("calendario_midia"),
            "foco": o.get("objetivo"),
            "total_acoes": len(o.get("acoes") or []),
        }
        for o in fases(plano)
    ]


def decisoes_do_cliente(plano: dict) -> list[dict]:
    """Ações com `decisao_cliente`, ordenadas pela data limite e, no empate, pelo número."""
    linhas = []
    for _, a in acoes(plano):
        decisao = a.get("decisao_cliente")
        if not decisao:
            continue
        linhas.append(
            {
                "numero": a.get("numero"),
                "acao": a.get("acao"),
                "ate": decisao.get("ate"),
                "recomendacao": decisao.get("recomendacao"),
            }
        )
    return sorted(
        linhas,
        key=lambda d: (ler_data(d["ate"], f"Ação {d['numero']}, decisão do cliente"), d["numero"]),
    )


def quando_curto(acao: dict, ano_base: int) -> str:
    """'12/11 a 13/11': dia/mês; a data de ano diferente de `ano_base` leva '/aa' ('29/01/27')."""

    def curta(texto: str, onde: str) -> str:
        d = ler_data(texto, f"Ação {acao.get('numero')}, {onde}")
        return d.strftime("%d/%m") if d.year == ano_base else d.strftime("%d/%m/%y")

    return f"{curta(acao['inicio'], 'início')} a {curta(acao['entrega'], 'entrega')}"


def formatar_decimal(valor: float, casas: int = 2) -> str:
    """Número com vírgula decimal e sem separador de milhar: 5.0 -> '5,00'."""
    return f"{valor:.{casas}f}".replace(".", ",")


def formatar_percentual(fracao: float) -> str:
    """Fração como percentual: inteiro quando redondo ('20%'), senão uma casa ('5,5%')."""
    pct = round(fracao * 100, 1)
    if pct == int(pct):
        return f"{int(pct)}%"
    return f"{formatar_decimal(pct, 1)}%"


def texto_piso_roas(plano: dict) -> list[str]:
    """Linhas do piso de ROAS para a abertura do plano (.docx e .xlsx)."""
    abertura = plano.get("abertura") or {}
    margem = abertura.get("margem_contribuicao")
    quebra = abertura.get("taxa_quebra")
    pisos = pisos_roas(margem, quebra)
    if pisos["aprovada"] is None:
        return ["Piso de ROAS: [PREENCHER: margem de contribuição]"]
    linhas = [
        f"Piso de ROAS sobre a receita aprovada: {formatar_decimal(pisos['aprovada'])} "
        f"(1 ÷ margem de {formatar_percentual(margem)})."
    ]
    if pisos["captada"] is not None:
        linhas.append(
            f"Sobre a receita captada: {formatar_decimal(pisos['captada'])} "
            f"(com quebra de {formatar_percentual(quebra)})."
        )
    return linhas


# Campos comparados por `diferencas`, além dos de CAMPOS_ACAO.
# `fase` não está na ação: é derivada (número da fase que lista a ação, ou None).
_CAMPOS_COMPARADOS = CAMPOS_ACAO + (
    "frente", "horizonte", "fase", "depende_de", "alavanca_da_meta", "solucoes", "decisao_cliente",
)


_CAMPOS_DAS_FASES = ("fase",)  # só existe com fases; `decisao_cliente` tem regra própria em `diferencas`


def _numero_da_fase(plano: dict, numero) -> int | None:
    """Número da fase que lista a ação, ou None (plano sem fases ou ação fora de todas)."""
    fases_plano = plano.get("fases")
    if not isinstance(fases_plano, list):
        return None
    for fase in fases_plano:
        if isinstance(fase, dict) and isinstance(fase.get("acoes"), list) and numero in fase["acoes"]:
            return fase.get("numero")
    return None


def _acoes_por_numero(plano: dict) -> dict[int, dict]:
    """Ações por número, com o nome do horizonte em `horizonte` e o número da fase em `fase`."""
    return {
        a.get("numero"): {**a, "horizonte": nome, "fase": _numero_da_fase(plano, a.get("numero"))}
        for nome, a in acoes(plano)
    }


def _metas_por_kpi(plano: dict) -> dict:
    return {m.get("kpi"): m for m in plano.get("abertura", {}).get("metas", [])}


def diferencas(plano_a: dict, plano_b: dict) -> dict:
    """O que mudou de `plano_a` para `plano_b`.

    Devolve {"incluidas": [números só em b], "removidas": [números só em a],
    "alteradas": {número: [campos que mudaram]}, "metas_alteradas": [kpis]}.
    `fase` (número da fase que lista a ação) só entra na comparação quando os dois planos têm fases.
    `decisao_cliente` entra quando os dois têm fases ou quando nenhum tem (o validador aceita o campo
    sem fases); só o par misto (um com fases, outro sem) deixa os dois campos de fora, para plano antigo
    contra plano em fases não gerar diferença falsa.
    Ações são pareadas por `numero`; metas, por `kpi` (meta incluída, removida ou com
    `de`/`para`/`ate` diferente conta como alterada).
    """
    a, b = _acoes_por_numero(plano_a), _acoes_por_numero(plano_b)
    # `fase` só existe no formato em fases: só se compara quando os dois planos o têm. `decisao_cliente`
    # também vale quando nenhum tem fases; no par misto os dois ficam de fora.
    tem_a, tem_b = bool(plano_a.get("fases")), bool(plano_b.get("fases"))
    nos_dois_com_fases = tem_a and tem_b
    misto = tem_a != tem_b
    comparados = [
        c for c in _CAMPOS_COMPARADOS
        if (nos_dois_com_fases or c not in _CAMPOS_DAS_FASES) and not (misto and c == "decisao_cliente")
    ]
    alteradas = {}
    for numero in sorted(set(a) & set(b)):
        campos = [campo for campo in comparados if a[numero].get(campo) != b[numero].get(campo)]
        if campos:
            alteradas[numero] = campos
    ma, mb = _metas_por_kpi(plano_a), _metas_por_kpi(plano_b)
    metas = [
        kpi for kpi in [*ma, *(k for k in mb if k not in ma)]
        if kpi not in ma or kpi not in mb
        or any(ma[kpi].get(campo) != mb[kpi].get(campo) for campo in ("de", "para", "ate"))
    ]
    return {
        "incluidas": sorted(set(b) - set(a)),
        "removidas": sorted(set(a) - set(b)),
        "alteradas": alteradas,
        "metas_alteradas": metas,
    }


# Grupos de itens do registro da revisão (etapa 10): (chave no JSON, rótulo das mensagens e do motivo).
GRUPOS_REVISAO = (
    ("complementos", "Complemento"),
    ("conflitos", "Conflito"),
    ("abertos", "Ponto em aberto"),
    ("compromissos", "Compromisso"),
)


def _inteiro(valor) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool)


def numeros_citados(chave: str, item: dict) -> set[int]:
    """Números de ação que um item da revisão cita: `acao`, `acoes`, `acoes_afetadas` e, num ponto
    em aberto com destino do tipo `acao`, `destino.acoes`. `chave` é o grupo do item (`GRUPOS_REVISAO`)."""
    citados: set[int] = set()
    if _inteiro(item.get("acao")):
        citados.add(item["acao"])
    for campo in ("acoes", "acoes_afetadas"):
        if isinstance(item.get(campo), list):
            citados.update(n for n in item[campo] if _inteiro(n))
    destino = item.get("destino")
    if (chave == "abertos" and isinstance(destino, dict) and destino.get("tipo") == "acao"
            and isinstance(destino.get("acoes"), list)):
        citados.update(n for n in destino["acoes"] if _inteiro(n))
    return citados
