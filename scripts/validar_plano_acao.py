"""Validador do plano de ação v2 (Skill 08): regras que bloqueiam a entrega.

`validar(plano, registro, rascunho=False)` devolve `(erros, avisos)` e nunca levanta
exceção por causa do conteúdo do plano: JSON malformado vira mensagem de erro.
Também confere a cobertura das soluções do registro, devolve avisos que não bloqueiam e
tem linha de comando:

    python3 scripts/validar_plano_acao.py --plano <plano.json> --registro <solucoes.json> [--rascunho]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from plano_acao_comum import CAMPOS_ACAO, acoes, FRENTES, HORIZONTES, ErroPlano, ler_data, pisos_roas

_SEPARADOR_DONO = " · "
_MARCAS = ("[VALIDAR", "[PREENCHER")
_VERBOS_VAGOS = ("otimizar", "acompanhar", "priorizar", "direcionar", "melhorar")
_VERBOS_DIAGNOSTICO = ("auditar", "mapear", "investigar")
_MAX_DIAS_IMEDIATO = 7


class ErroEntrada(Exception):
    """Arquivo de entrada ausente, ilegível ou que não é JSON."""


def _ler_json(caminho: Path, nome: str):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ErroEntrada(f"{nome} não encontrado: {caminho}")
    except json.JSONDecodeError as e:
        raise ErroEntrada(f"o {nome} não é um JSON válido (linha {e.lineno}): {e.msg}")
    except (OSError, UnicodeDecodeError) as e:
        raise ErroEntrada(f"não foi possível ler o {nome} ({caminho}): {e}")


def _ids_do_registro(registro) -> list[str] | None:
    """Ids de solução do registro, na ordem; None se o registro não tem a lista de problemas."""
    if not isinstance(registro, dict) or not isinstance(registro.get("problemas"), list):
        return None
    ids: list[str] = []
    for p in registro["problemas"]:
        if not isinstance(p, dict) or not isinstance(p.get("solucoes"), list):
            continue
        for sol in p["solucoes"]:
            if isinstance(sol, dict) and isinstance(sol.get("id"), str):
                ids.append(sol["id"])
    return ids


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
    """Valida o plano v2 contra o registro de soluções; devolve (erros, avisos)."""
    erros: list[str] = []
    avisos: list[str] = []
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
    horizonte_da_acao: dict[int, str] = {}  # id(objeto da ação) -> nome do horizonte
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
                horizonte_da_acao[id(a)] = h.get("nome")
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
            elif campo not in ("inicio", "entrega") and not isinstance(a[campo], str):
                erros.append(f"{pre}campo {campo} precisa ser texto (veio {a[campo]!r}).")

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

        if "alavanca_da_meta" in a and not isinstance(a["alavanca_da_meta"], bool):
            erros.append(f'{pre}alavanca_da_meta precisa ser true ou false (veio {a["alavanca_da_meta"]!r}).')

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

        if horizonte_da_acao.get(id(a)) == "Imediato" and ini and fim and (fim - ini).days > _MAX_DIAS_IMEDIATO:
            avisos.append(
                f"{pre}está no Imediato, mas leva {(fim - ini).days} dias "
                f"(mais de {_MAX_DIAS_IMEDIATO} dias); reveja o horizonte ou quebre a ação."
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

    # Cobertura: toda solução do registro vira ação, e toda solução citada existe.
    ids = _ids_do_registro(registro)
    if ids is None:
        erros.append('O registro de soluções não tem a lista "problemas"; não dá para conferir a cobertura.')
    else:
        conhecidos, cobertos = set(ids), set()
        for a in lista:
            n = a.get("numero")
            pre = f'Ação {n if eh_numero(n) else "?"} ("{a.get("acao") if isinstance(a.get("acao"), str) else ""}"): '
            sols = a.get("solucoes")
            if sols is None:
                sols = []
            if not isinstance(sols, list):
                erros.append(f'{pre}solucoes precisa ser uma lista de ids de solução (ex.: ["P1.S1"]).')
                continue
            for sid in sols:
                if not isinstance(sid, str):
                    erros.append(f'{pre}cada item de solucoes precisa ser um id de solução em texto (ex.: "P1.S1").')
                elif sid in conhecidos:
                    cobertos.add(sid)
                else:
                    erros.append(f"{pre}cita a solução {sid}, que não existe no registro.")
        for sid in ids:
            if sid not in cobertos:
                erros.append(f"Solução {sid} do registro não virou nenhuma ação do plano.")

    # Avisos: não bloqueiam, mas o analista precisa ver.
    dependidas = {
        d
        for a in lista
        for d in (a.get("depende_de") if isinstance(a.get("depende_de"), list) else [])
        if eh_numero(d)
    }
    for a in lista:
        n = a.get("numero")
        nome = a.get("acao") if isinstance(a.get("acao"), str) else ""
        pre = f'Ação {n if eh_numero(n) else "?"} ("{nome}"): '
        palavras = nome.split()
        primeira = palavras[0].lower() if palavras else ""
        if primeira in _VERBOS_VAGOS:
            avisos.append(f'{pre}começa com o verbo vago "{primeira}"; diga o que será feito, com objeto e resultado.')
        if primeira in _VERBOS_DIAGNOSTICO and not (eh_numero(n) and n in dependidas):
            avisos.append(
                f'{pre}é uma ação de diagnóstico ("{primeira}") e nenhuma outra ação depende dela; '
                "ligue o que ela descobre a uma ação seguinte via depende_de."
            )
    for frente in FRENTES:
        if not any(a.get("frente") == frente for a in lista):
            avisos.append(f'A frente "{frente}" não tem nenhuma ação no plano.')

    if not rascunho:
        for caminho, texto in _marcacoes(plano):
            marca = next(m for m in _MARCAS if m in texto)
            erros.append(
                f'Há marcação {marca}] pendente em {caminho}: resolva com o analista antes de gerar a versão final.'
            )

    if margem is None:
        if rascunho:
            avisos.append(
                "A margem de contribuição está ausente: o piso de ROAS vai sair como [PREENCHER] até "
                "informar abertura.margem_contribuicao."
            )
        else:
            erros.append(
                "A margem de contribuição está ausente: sem ela o piso de ROAS fica [PREENCHER]. "
                "Informe abertura.margem_contribuicao."
            )
    elif pisos_roas(margem, None)["aprovada"] is None:
        erros.append(f"A margem de contribuição {margem!r} é inválida: use um número maior que 0 e até 1.")

    return erros, avisos


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Valida o plano de ação v2 (Skill 08).")
    p.add_argument("--plano", required=True, type=Path)
    p.add_argument("--registro", required=True, type=Path)
    p.add_argument("--rascunho", action="store_true", help="aceita marcações [VALIDAR]/[PREENCHER] e margem ausente")
    a = p.parse_args(argv)
    try:
        plano = _ler_json(a.plano, "plano")
        registro = _ler_json(a.registro, "registro")
    except ErroEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    erros, avisos = validar(plano, registro, rascunho=a.rascunho)
    for aviso in avisos:
        print(f"AVISO: {aviso}")
    if erros:
        for erro in erros:
            print(f"ERRO: {erro}", file=sys.stderr)
        return 1
    total = len(_ids_do_registro(registro) or [])
    print(f"OK: {len(acoes(plano))} ações, {total} soluções cobertas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
