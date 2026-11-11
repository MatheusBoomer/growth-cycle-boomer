"""Validador do plano de ação v2 (Skill 08): regras que bloqueiam a entrega.

`validar(plano, registro, rascunho=False)` devolve `(erros, avisos)` e nunca levanta
exceção por causa do conteúdo do plano: JSON malformado vira mensagem de erro.
Cobertura das soluções, avisos e linha de comando ficam para a etapa seguinte.
"""
from __future__ import annotations

from datetime import date

from plano_acao_comum import CAMPOS_ACAO, FRENTES, HORIZONTES, ErroPlano, ler_data, pisos_roas

_SEPARADOR_DONO = " · "
_MARCAS = ("[VALIDAR", "[PREENCHER")


def _vazio(valor) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def _fmt(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def _marcacoes(no, caminho: str = "plano"):
    """Gera (caminho, texto) de toda string do plano que contém [VALIDAR ou [PREENCHER."""
    if isinstance(no, str):
        if any(m in no for m in _MARCAS):
            yield caminho, no
    elif isinstance(no, dict):
        for k, v in no.items():
            yield from _marcacoes(v, f"{caminho}.{k}")
    elif isinstance(no, list):
        for i, v in enumerate(no):
            yield from _marcacoes(v, f"{caminho}[{i}]")


def _ciclos(grafo: dict[int, list[int]]) -> list[list[int]]:
    """Ciclos do grafo por DFS iterativa; cada um sai como [a, b, ..., a]."""
    cor: dict[int, int] = {}  # ausente = não visitado, 1 = no caminho, 2 = concluído
    achados: list[list[int]] = []
    vistos: set[frozenset[int]] = set()
    for raiz in sorted(grafo):
        if raiz in cor:
            continue
        caminho = [raiz]
        cor[raiz] = 1
        iteradores = [iter(grafo[raiz])]
        while caminho:
            try:
                prox = next(iteradores[-1])
            except StopIteration:
                cor[caminho.pop()] = 2
                iteradores.pop()
                continue
            if cor.get(prox) == 1:
                ciclo = caminho[caminho.index(prox):] + [prox]
                chave = frozenset(ciclo)
                if chave not in vistos:
                    vistos.add(chave)
                    achados.append(ciclo)
            elif prox not in cor:
                cor[prox] = 1
                caminho.append(prox)
                iteradores.append(iter(grafo.get(prox, [])))
    return achados


def validar(plano, registro, rascunho: bool = False) -> tuple[list[str], list[str]]:
    """Valida o plano v2. `registro` ainda não é usado (cobertura vem na etapa seguinte)."""
    erros: list[str] = []
    if not isinstance(plano, dict):
        return ["O plano precisa ser um objeto JSON com os campos da versao 2."], []

    def data(texto, onde, prefixo="") -> date | None:
        try:
            return ler_data(texto, onde)
        except ErroPlano as e:
            erros.append(f"{prefixo}{e}")
            return None

    if plano.get("versao") != 2 or isinstance(plano.get("versao"), bool):
        erros.append(f'O plano precisa ser da versao 2 (campo versao está {plano.get("versao")!r}).')

    referencia = data(plano.get("data_referencia"), "data_referencia")
    fim_ciclo = data(plano.get("fim_ciclo"), "fim_ciclo")
    janela_ini = janela_fim = None
    janela = plano.get("janela_prova")
    if isinstance(janela, dict):
        janela_ini = data(janela.get("inicio"), "janela_prova.inicio")
        janela_fim = data(janela.get("fim"), "janela_prova.fim")
    else:
        erros.append("janela_prova ausente: informe inicio e fim em dd/mm/aaaa.")

    abertura = plano.get("abertura")
    margem = None
    if abertura is None or isinstance(abertura, dict):
        abertura = abertura or {}
        margem = abertura.get("margem_contribuicao")
        metas = abertura.get("metas")
        if isinstance(metas, list):
            for i, meta in enumerate(metas, start=1):
                if isinstance(meta, dict):
                    data(meta.get("ate"), f"abertura.metas[{i}].ate")
                else:
                    erros.append(f"abertura.metas[{i}]: a meta precisa ser um objeto com kpi, de, para, ate e fonte.")
        elif metas is not None:
            erros.append("abertura.metas precisa ser uma lista.")
    else:
        erros.append("abertura precisa ser um objeto.")

    horizontes = plano.get("horizontes")
    if not isinstance(horizontes, list):
        horizontes = []
    nomes = [h.get("nome") if isinstance(h, dict) else None for h in horizontes]
    if nomes != list(HORIZONTES):
        erros.append(f"Os horizontes precisam ser, nesta ordem: {', '.join(HORIZONTES)}.")

    # Reúne as ações com número e rótulo antes de checar uma a uma.
    lista: list[dict] = []
    for h in horizontes:
        if not isinstance(h, dict):
            continue
        brutas = h.get("acoes")
        if not isinstance(brutas, list):
            erros.append(f'Horizonte "{h.get("nome")}": acoes precisa ser uma lista.')
            continue
        for a in brutas:
            if isinstance(a, dict):
                lista.append(a)
            else:
                erros.append(f'Horizonte "{h.get("nome")}": cada ação precisa ser um objeto.')

    def eh_numero(n) -> bool:
        return isinstance(n, int) and not isinstance(n, bool)

    por_numero: dict[int, dict] = {}
    for a in lista:
        n = a.get("numero")
        if eh_numero(n):
            por_numero.setdefault(n, a)

    prospect = plano.get("prospect")
    empresas = {"Cliente"}
    for chave in ("empresa_agencia", "agencia_parceira"):
        if isinstance(plano.get(chave), str) and plano[chave].strip():
            empresas.add(plano[chave].strip())
    if isinstance(prospect, str) and prospect.strip():
        empresas.add(prospect.strip())

    vistos: set[int] = set()
    datas: dict[int, tuple[date | None, date | None]] = {}
    for a in lista:
        n = a.get("numero")
        nome = a.get("acao") if isinstance(a.get("acao"), str) else ""
        pre = f'Ação {n if eh_numero(n) else "?"} ("{nome}"): '

        if not eh_numero(n):
            erros.append(f"{pre}número inválido: use um inteiro único por ação.")
        elif n in vistos:
            erros.append(f"{pre}número {n} repetido.")
        else:
            vistos.add(n)

        for campo in CAMPOS_ACAO:
            if _vazio(a.get(campo)):
                erros.append(f"{pre}campo {campo} vazio.")

        if a.get("frente") not in FRENTES:
            erros.append(f'{pre}frente "{a.get("frente")}" fora das cinco frentes: {"; ".join(FRENTES)}.')

        ini = fim = None
        if not _vazio(a.get("inicio")):
            ini = data(a["inicio"], "inicio", pre)
        if not _vazio(a.get("entrega")):
            fim = data(a["entrega"], "entrega", pre)
        if eh_numero(n):
            datas.setdefault(n, (ini, fim))
        if ini and referencia and ini < referencia:
            erros.append(f"{pre}início {_fmt(ini)} antes da data de referência {_fmt(referencia)}.")
        if ini and fim and fim < ini:
            erros.append(f"{pre}entrega antes do início ({_fmt(fim)} < {_fmt(ini)}).")
        if fim and fim_ciclo and fim > fim_ciclo:
            erros.append(f"{pre}entrega {_fmt(fim)} depois do fim do ciclo ({_fmt(fim_ciclo)}).")

        dono = a.get("dono")
        if isinstance(dono, str) and dono.strip():
            disciplina, sep, empresa = dono.partition(_SEPARADOR_DONO)
            if not sep or not disciplina.strip() or not empresa.strip():
                erros.append(f'{pre}dono "{dono}" fora do formato disciplina · empresa.')
            elif empresa.strip() not in empresas:
                erros.append(
                    f'{pre}empresa "{empresa.strip()}" do dono não é uma das aceitas: '
                    f'{", ".join(sorted(empresas))}.'
                )

        gatilho = a.get("gatilho")
        if isinstance(gatilho, str) and gatilho.strip():
            g = gatilho.strip().lower()
            if not (g.startswith("se ") and " então " in g):
                erros.append(f'{pre}gatilho precisa seguir o formato "Se … então …".')

        if a.get("alavanca_da_meta") is True and janela_ini and janela_fim:
            fora = [
                f"{rotulo} {_fmt(d)}"
                for rotulo, d in (("início", ini), ("entrega", fim))
                if d and not (janela_ini <= d <= janela_fim)
            ]
            if fora:
                erros.append(
                    f"{pre}é alavanca da meta, mas {' e '.join(fora)} ficam fora da janela de prova "
                    f"({_fmt(janela_ini)} a {_fmt(janela_fim)}); a janela termina em {_fmt(janela_fim)}."
                )

    # Dependências: existência, ordem das datas e ciclos.
    grafo: dict[int, list[int]] = {}
    for a in lista:
        n = a.get("numero")
        nome = a.get("acao") if isinstance(a.get("acao"), str) else ""
        pre = f'Ação {n if eh_numero(n) else "?"} ("{nome}"): '
        deps = a.get("depende_de")
        if deps is None:
            deps = []
        if not isinstance(deps, list):
            erros.append(f"{pre}depende_de precisa ser uma lista de números de ação.")
            continue
        ini_desta = datas.get(n, (None, None))[0] if eh_numero(n) else None
        validas: list[int] = []
        for d in deps:
            if not eh_numero(d):
                erros.append(f"{pre}depende da ação {d!r}, que não é um número de ação.")
            elif d == n:
                erros.append(f"{pre}depende da ação {d}, que é ela mesma.")
            elif d not in por_numero:
                erros.append(f"{pre}depende da ação {d}, que não existe no plano.")
            else:
                validas.append(d)
                entrega_dep = datas.get(d, (None, None))[1]
                if ini_desta and entrega_dep and entrega_dep > ini_desta:
                    erros.append(
                        f"{pre}depende da ação {d}, que só termina em {_fmt(entrega_dep)}, "
                        f"depois do início desta ação ({_fmt(ini_desta)})."
                    )
        if eh_numero(n) and n not in grafo:
            grafo[n] = validas
    for ciclo in _ciclos(grafo):
        erros.append("Há ciclo de dependência entre as ações: " + " → ".join(str(x) for x in ciclo) + ".")

    if not rascunho:
        for caminho, texto in _marcacoes(plano):
            marca = next(m for m in _MARCAS if m in texto)
            erros.append(
                f'Há marcação {marca}] pendente em {caminho}: resolva com o analista antes de gerar a versão final.'
            )

    if margem is None:
        if not rascunho:
            erros.append(
                "A margem de contribuição está ausente: sem ela o piso de ROAS fica [PREENCHER]. "
                "Informe abertura.margem_contribuicao."
            )
    elif pisos_roas(margem, None)["aprovada"] is None:
        erros.append(f"A margem de contribuição {margem!r} é inválida: use um número maior que 0 e até 1.")

    return erros, []
