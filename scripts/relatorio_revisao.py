"""Relatório em Markdown da revisão pós-apresentação (etapa 10): o que mudou entre o plano da 08 e o final.

`montar_relatorio(plano_08, plano_final, revisao)` devolve o Markdown (sem tabelas) com as seções
`O que mudou`, `Metas e cenário`, `Cobertura da meta` e `Pendências`. Cada mudança de ação traz o
motivo: o primeiro item da revisão que cita a ação (complemento, conflito, ponto em aberto ou
compromisso, nessa ordem). Tem linha de comando:

    python3 scripts/relatorio_revisao.py --plano-08 <json> --plano-final <json> --revisao <json>
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from plano_acao_comum import GRUPOS_REVISAO as _GRUPOS
from plano_acao_comum import acoes, diferencas, numeros_citados
from validar_plano_acao import ErroEntrada, _ler_json

_SEM_MOTIVO = "sem motivo registrado"

def _lista(valor) -> list:
    return valor if isinstance(valor, list) else []


def _inteiro(valor) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool)


def _itens(revisao: dict, chave: str):
    """Itens dict de um grupo da revisão, na ordem do JSON."""
    return [i for i in _lista(revisao.get(chave)) if isinstance(i, dict)]


def _rotulo_do_item(rotulo: str, chave: str, item: dict) -> str:
    base = f"{rotulo} {item.get('numero')}"
    if chave == "conflitos":
        decisao = item.get("decisao")
        return f"{base}: Opção {decisao}" if decisao else f"{base}: sem decisão"
    return base


def _motivos(revisao: dict) -> dict[int, str]:
    """Número da ação -> motivo do primeiro item que a cita, na ordem dos grupos."""
    motivos: dict[int, str] = {}
    for chave, rotulo in _GRUPOS:
        for item in _itens(revisao, chave):
            for n in sorted(numeros_citados(chave, item)):
                motivos.setdefault(n, _rotulo_do_item(rotulo, chave, item))
    return motivos


def _nomes(plano: dict) -> dict[int, str]:
    return {a.get("numero"): str(a.get("acao", "")) for _, a in acoes(plano)}


def _linha_acao(numero: int, nome: str, motivo: str, campos: list[str] | None = None) -> str:
    sufixo = f" (campos: {', '.join(campos)})" if campos else ""
    return f"- Ação {numero} · {nome}: {motivo}{sufixo}"


def _secao_mudancas(plano_08: dict, plano_final: dict, revisao: dict, mudancas: dict) -> list[str]:
    motivos = _motivos(revisao)
    nomes_08, nomes_final = _nomes(plano_08), _nomes(plano_final)
    grupos = (
        ("Incluídas", mudancas["incluidas"], nomes_final, {}),
        ("Alteradas", sorted(mudancas["alteradas"]), nomes_final, mudancas["alteradas"]),
        ("Removidas", mudancas["removidas"], nomes_08, {}),
    )
    linhas = ["## O que mudou", ""]
    for titulo, numeros, nomes, campos in grupos:
        linhas += [f"### {titulo}", ""]
        linhas += [
            _linha_acao(n, nomes.get(n, ""), motivos.get(n, _SEM_MOTIVO), campos.get(n))
            for n in numeros
        ] or ["- nenhuma"]
        linhas.append("")
    return linhas


def _metas(plano: dict) -> dict[str, dict]:
    abertura = plano.get("abertura")
    metas = _lista(abertura.get("metas")) if isinstance(abertura, dict) else []
    return {m["kpi"]: m for m in metas if isinstance(m, dict) and isinstance(m.get("kpi"), str)}


def _meta_texto(meta: dict | None, vazio: str) -> str:
    if meta is None:
        return vazio
    texto = f"{meta.get('de')} → {meta.get('para')}"
    return f"{texto} até {meta['ate']}" if meta.get("ate") else texto


def _linha_divergencia(d: dict) -> str:
    texto = f"- {d.get('item', '(sem item)')}"
    if d.get("antes") is not None or d.get("depois") is not None:
        texto += f": {d.get('antes')} → {d.get('depois')}"
    slides = [s for s in _lista(d.get("slides")) if isinstance(s, str)]
    if slides:
        texto += f" · slides: {', '.join(slides)}"
    return texto


def _secao_metas(plano_08: dict, plano_final: dict, revisao: dict, mudancas: dict) -> list[str]:
    antes, depois = _metas(plano_08), _metas(plano_final)
    divergencias = [d for d in _lista(revisao.get("divergencias_cenario")) if isinstance(d, dict)]
    linhas = ["## Metas e cenário", ""]
    if not mudancas["metas_alteradas"] and not divergencias:
        return linhas + ["Nenhuma mudança de meta, verba ou cenário.", ""]
    for kpi in mudancas["metas_alteradas"]:
        linhas.append(
            f"- {kpi}: antes {_meta_texto(antes.get(kpi), 'não existia')}; "
            f"depois {_meta_texto(depois.get(kpi), 'meta removida')}"
        )
    if divergencias:
        linhas += ["", "### Divergências"] if mudancas["metas_alteradas"] else ["### Divergências"]
        linhas += [""] + [_linha_divergencia(d) for d in divergencias]
    return linhas + [""]


def _alavancas(plano: dict, kpi: str) -> list[int]:
    """Números das ações alavanca da meta cuja `alavanca` contém o kpi (sem diferenciar maiúsculas)."""
    alvo = kpi.casefold()
    return [
        a["numero"] for _, a in acoes(plano)
        if a.get("alavanca_da_meta") is True and isinstance(a.get("alavanca"), str)
        and alvo in a["alavanca"].casefold() and _inteiro(a.get("numero"))
    ]


def _texto_alavancas(numeros: list[int]) -> str:
    return ", ".join(f"Ação {n}" for n in numeros) if numeros else "⚠️ sem ação"


def _secao_cobertura(plano_08: dict, plano_final: dict) -> list[str]:
    linhas = ["## Cobertura da meta", ""]
    kpis = list(_metas(plano_final))
    for kpi in kpis:
        antes, depois = _alavancas(plano_08, kpi), _alavancas(plano_final, kpi)
        linha = f"- {kpi}: antes {_texto_alavancas(antes)}; depois {_texto_alavancas(depois)}"
        if len(depois) < len(antes):
            linha += " (enfraqueceu)"
        linhas.append(linha)
    return linhas + ([] if kpis else ["Nenhuma meta no plano final."]) + [""]


def _secao_pendencias(revisao: dict) -> list[str]:
    linhas = ["## Pendências", ""]
    pendencias = []
    for item in _itens(revisao, "abertos"):
        destino = item.get("destino")
        if isinstance(destino, dict) and destino.get("tipo") == "confirmar":
            pendencias.append(f"- Ponto em aberto {item.get('numero')} · {item.get('tema')}: confirmar até {destino.get('ate')}")
    return linhas + (pendencias or ["Nenhuma pendência."]) + [""]


def montar_relatorio(plano_08: dict, plano_final: dict, revisao: dict) -> str:
    """Markdown do que mudou do plano da 08 para o final, com o motivo de cada mudança."""
    mudancas = diferencas(plano_08, plano_final)
    linhas = [
        *_secao_mudancas(plano_08, plano_final, revisao, mudancas),
        *_secao_metas(plano_08, plano_final, revisao, mudancas),
        *_secao_cobertura(plano_08, plano_final),
        *_secao_pendencias(revisao),
    ]
    return "\n".join(linhas).rstrip("\n") + "\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Relatório do que mudou na revisão pós-apresentação (etapa 10).")
    p.add_argument("--plano-08", required=True, type=Path)
    p.add_argument("--plano-final", required=True, type=Path)
    p.add_argument("--revisao", required=True, type=Path)
    a = p.parse_args(argv)
    try:
        plano_08 = _ler_json(a.plano_08, "plano da 08")
        plano_final = _ler_json(a.plano_final, "plano final")
        revisao = _ler_json(a.revisao, "registro da revisão")
        for nome, dado in (("plano da 08", plano_08), ("plano final", plano_final), ("registro da revisão", revisao)):
            if not isinstance(dado, dict):
                raise ErroEntrada(f"o {nome} precisa ser um objeto JSON.")
        print(montar_relatorio(plano_08, plano_final, revisao), end="")
    except ErroEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    except (AttributeError, KeyError, TypeError, ValueError) as e:
        print(f"ERRO: os arquivos não têm a estrutura esperada de plano e de revisão ({e}).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
