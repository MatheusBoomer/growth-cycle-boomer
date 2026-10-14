#!/usr/bin/env python3
"""
scripts/validar_solucoes.py: garante em código a regra de ouro do treinamento
"Do diagnóstico à solução": nenhum problema sai do diagnóstico sem solução.

    python3 scripts/validar_solucoes.py --modo registro --registro contexto/solucoes.json [--markdown <secao.md>]
    python3 scripts/validar_solucoes.py --modo plano --registro contexto/solucoes.json --plano <plano.json>

registro: confere hipóteses, 1 a 3 soluções, impacto e frente de cada problema
e, com --markdown, gera a seção aprovável a partir do registro.
plano: confere que toda solução do registro virou ação do plano de ação.
ERRO: (código 1) bloqueia; AVISO: não bloqueia.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Optional, Tuple

FRENTES = (
    "Mídia Paga / Canal Principal",
    "Eficiência Operacional",
    "Produto / Mix / Portfólio",
    "Redução de Dependências",
    "Monitoramento e Governança",
)
TIPOS_IMPACTO = ("R$", "%", "nao_quantificavel")
MIN_SOLUCOES, MAX_SOLUCOES = 1, 3
RE_PROBLEMA = re.compile(r"^P\d+$")
RE_HIPOTESE = re.compile(r"^H\d+$")
RE_SOLUCAO = re.compile(r"^P\d+\.S\d+$")


def _texto(valor) -> bool:
    return isinstance(valor, str) and bool(valor.strip())


def _validar_impacto(impacto, onde: str, erros: List[str], avisos: List[str]) -> None:
    if not isinstance(impacto, dict):
        erros.append(f"{onde}: impacto obrigatório (R$, % ou nao_quantificavel com justificativa).")
        return
    tipo = impacto.get("tipo")
    if tipo not in TIPOS_IMPACTO:
        erros.append(f"{onde}: tipo de impacto \"{tipo}\" inválido. Use R$, % ou nao_quantificavel.")
        return
    if tipo == "nao_quantificavel":
        if _texto(impacto.get("justificativa")):
            avisos.append(f"{onde}: impacto não quantificado ({impacto['justificativa'].strip()}).")
        else:
            erros.append(f"{onde}: impacto nao_quantificavel precisa de justificativa.")
        return
    for campo in ("valor", "calculo"):
        if not _texto(impacto.get(campo)):
            erros.append(f"{onde}: impacto em {tipo} precisa de {campo}.")


def validar_registro(registro) -> Tuple[List[str], List[str]]:
    erros: List[str] = []
    avisos: List[str] = []
    problemas = registro.get("problemas") if isinstance(registro, dict) else None
    if not isinstance(problemas, list) or not problemas:
        return ["o registro não tem a lista \"problemas\" (ou ela está vazia)."], avisos
    ids_problema = set()
    ids_solucao = set()
    for i, p in enumerate(problemas, start=1):
        if not isinstance(p, dict):
            erros.append(f"Problema #{i}: formato inválido.")
            continue
        pid = p.get("id")
        onde = f"Problema {pid}" if _texto(pid) else f"Problema #{i}"
        if not _texto(pid) or not RE_PROBLEMA.match(pid):
            erros.append(f"{onde}: id precisa ter o formato P<n> (ex.: P1).")
        elif pid in ids_problema:
            erros.append(f"{onde}: id repetido.")
        else:
            ids_problema.add(pid)
        for campo in ("titulo", "origem", "dado", "benchmark"):
            if not _texto(p.get(campo)):
                erros.append(f"{onde}: campo {campo} obrigatório.")

        ids_hipotese = set()
        hipoteses = p.get("hipoteses")
        if not isinstance(hipoteses, list) or not hipoteses:
            erros.append(f"{onde}: precisa de pelo menos 1 hipótese de causa antes das soluções.")
        else:
            for h in hipoteses:
                hid = h.get("id") if isinstance(h, dict) else None
                if not _texto(hid) or not RE_HIPOTESE.match(hid) or not _texto(h.get("texto")):
                    erros.append(f"{onde}: toda hipótese precisa de id H<n> e texto.")
                    continue
                if hid in ids_hipotese:
                    erros.append(f"{onde}: hipótese {hid} repetida.")
                ids_hipotese.add(hid)

        solucoes = p.get("solucoes")
        quantidade = len(solucoes) if isinstance(solucoes, list) else 0
        if not MIN_SOLUCOES <= quantidade <= MAX_SOLUCOES:
            erros.append(f"{onde}: precisa de 1 a 3 soluções (tem {quantidade}).")
        for s in solucoes if isinstance(solucoes, list) else []:
            sid = s.get("id") if isinstance(s, dict) else None
            if not _texto(sid) or not RE_SOLUCAO.match(sid):
                erros.append(f"{onde}: toda solução precisa de id no formato P<n>.S<m>.")
                continue
            if _texto(pid) and not sid.startswith(f"{pid}."):
                erros.append(f"{onde}: a solução {sid} precisa começar com {pid}.")
            if sid in ids_solucao:
                erros.append(f"{onde}: solução {sid} repetida.")
            ids_solucao.add(sid)
            if not _texto(s.get("acao")):
                erros.append(f"{onde}, solução {sid}: campo acao obrigatório.")
            hip = s.get("hipotese")
            if not isinstance(hip, str) or hip not in ids_hipotese:
                erros.append(f"{onde}, solução {sid}: aponta para a hipótese \"{hip}\", que não existe neste problema.")

        _validar_impacto(p.get("impacto"), onde, erros, avisos)
        if p.get("frente") not in FRENTES:
            erros.append(f"{onde}: frente \"{p.get('frente')}\" inválida. Use uma de: {', '.join(FRENTES)}.")
    if not _texto(registro.get("prospect")):
        erros.append("campo prospect obrigatório.")
    fortes = registro.get("pontos_fortes")
    if fortes is not None:
        if not isinstance(fortes, list):
            erros.append("pontos_fortes precisa ser uma lista.")
        else:
            for i, f in enumerate(fortes, start=1):
                if not isinstance(f, dict) or not all(_texto(f.get(c)) for c in ("titulo", "dado", "uso")):
                    erros.append(f"Ponto forte #{i}: campos titulo, dado e uso obrigatórios.")
    return erros, avisos


class ErroEntrada(Exception):
    """Arquivo ausente, JSON inválido ou argumento faltando."""


def _impacto_md(impacto: dict) -> str:
    if impacto["tipo"] == "nao_quantificavel":
        return f"**Impacto:** não quantificável ({impacto['justificativa'].strip()})"
    return f"**Impacto:** {impacto['valor'].strip()} ({impacto['calculo'].strip()})"


def gerar_markdown(registro: dict) -> str:
    """Seção aprovável gerada do registro já validado; nunca editar à mão."""
    linhas = [f"# Soluções do diagnóstico: {registro.get('prospect', '').strip()}", ""]
    for p in registro["problemas"]:
        linhas += [
            f"## {p['id']} · {p['titulo'].strip()}",
            "",
            f"**Origem:** {p['origem'].strip()}  ",
            f"**Dado:** {p['dado'].strip()}  ",
            f"**Benchmark:** {p['benchmark'].strip()}  ",
            f"**Frente:** {p['frente']}",
            "",
            "**Hipóteses de causa**",
            "",
            *[f"- {h['id']} {h['texto'].strip()}" for h in p["hipoteses"]],
            "",
            "**Soluções**",
            "",
            *[f"- {s['id']} {s['acao'].strip()} (hipótese {s['hipotese']})" for s in p["solucoes"]],
            "",
            _impacto_md(p["impacto"]),
            "",
        ]
    fortes = registro.get("pontos_fortes") or []
    if fortes:
        linhas += ["## Pontos fortes", ""]
        linhas += [f"- **{f['titulo'].strip()}:** {f['dado'].strip()}. {f['uso'].strip()}" for f in fortes]
    return "\n".join(linhas).rstrip() + "\n"


def _ler_json(caminho: Path, nome: str):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ErroEntrada(f"{nome} não encontrado: {caminho}")
    except json.JSONDecodeError as e:
        raise ErroEntrada(f"o {nome} não é um JSON válido (linha {e.lineno}): {e.msg}")


def validar_plano(registro: dict, plano) -> Tuple[List[str], List[str]]:
    erros: List[str] = []
    if not isinstance(plano, dict) or not isinstance(plano.get("horizontes"), list):
        return ["o plano não tem a lista \"horizontes\"."], []
    ids = [s["id"] for p in registro["problemas"] for s in p["solucoes"]]
    conhecidos = set(ids)
    cobertos = set()
    tabela = {linha.get("acao"): linha for linha in plano.get("tabela") or [] if isinstance(linha, dict)}
    for horizonte in plano["horizontes"]:
        for acao in horizonte.get("acoes") or []:
            nome = acao.get("acao") or "(sem nome)"
            for campo in ("quando", "por_quem"):
                if not _texto(acao.get(campo)):
                    erros.append(f"Ação \"{nome}\": campo {campo} obrigatório.")
            linha = tabela.get(acao.get("acao"))
            if linha is None:
                erros.append(f"Ação \"{nome}\": não aparece na tabela-resumo (mesmo nome em \"acao\").")
            elif not _texto(linha.get("frente")):
                erros.append(f"Ação \"{nome}\": frente vazia na tabela-resumo.")
            solucoes = acao.get("solucoes", [])
            if not isinstance(solucoes, list):
                erros.append(f"Ação \"{nome}\": \"solucoes\" precisa ser uma lista de ids (ex.: [\"P1.S1\"]).")
                continue
            for sid in solucoes:
                if sid in conhecidos:
                    cobertos.add(sid)
                else:
                    erros.append(f"Ação \"{nome}\": cita a solução {sid}, que não existe no registro.")
    for sid in ids:
        if sid not in cobertos:
            erros.append(f"Solução {sid} do registro não virou nenhuma ação do plano.")
    return erros, []


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Valida o registro de soluções e o plano de ação.")
    p.add_argument("--modo", required=True, choices=["registro", "plano"])
    p.add_argument("--registro", required=True, type=Path)
    p.add_argument("--plano", type=Path)
    p.add_argument("--markdown", type=Path)
    a = p.parse_args(argv)
    try:
        registro = _ler_json(a.registro, "registro")
        erros, avisos = validar_registro(registro)
        if a.modo == "plano" and not erros:
            if a.plano is None:
                raise ErroEntrada("--modo plano precisa de --plano.")
            erros_plano, avisos_plano = validar_plano(registro, _ler_json(a.plano, "plano"))
            erros += erros_plano
            avisos += avisos_plano
    except ErroEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    for aviso in avisos:
        print(f"AVISO: {aviso}")
    if erros:
        alvo = "plano de ação" if a.modo == "plano" else "registro de soluções"
        print(f"ERRO: {alvo} inválido:\n" + "\n".join(f"- {e}" for e in erros), file=sys.stderr)
        return 1
    if a.markdown:
        a.markdown.parent.mkdir(parents=True, exist_ok=True)
        a.markdown.write_text(gerar_markdown(registro), encoding="utf-8")
        print(f"Seção gerada: {a.markdown}")
    total = sum(len(x["solucoes"]) for x in registro["problemas"])
    print(f"OK: {len(registro['problemas'])} problemas, {total} soluções.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
