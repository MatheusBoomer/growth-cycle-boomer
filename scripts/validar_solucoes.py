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

import re
from typing import List, Tuple

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
    return erros, avisos
