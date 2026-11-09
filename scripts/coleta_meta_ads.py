#!/usr/bin/env python3
"""
scripts/coleta_meta_ads.py: coleta de anúncios da Biblioteca de Anúncios do
Meta via Apify, para o benchmark da etapa desativada briefing-e-benchmark
(`.claude/skills/_desativadas/`).

    python3 scripts/coleta_meta_ads.py coletar --link "<link da página na Biblioteca>" --marca "Nome" --saida clientes/<slug>/dados/benchmark-meta [--limite 5]

O link é o da página da marca na Biblioteca de Anúncios (com view_all_page_id=),
informado pelo analista: o script não busca páginas pela API, para não gastar
com descoberta. `--page-id N` também é aceito no lugar do link.

coletar: baixa os anúncios ativos da página, aplica as regras da etapa desativada
briefing-e-benchmark (`.claude/skills/_desativadas/`)
(até 5 criativos distintos, no máximo 1 catálogo, sem anúncio sem mídia),
baixa imagens, extrai quadros de vídeo e grava anuncios.json, bruto.json,
resumo.md e midia/ em <saida>/<marca>/.

Erros saem em stderr, em português, com código 1. O token da Apify vem de
APIFY_TOKEN (ambiente ou .env da raiz) e nunca é impresso.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import warnings
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

# O Python do macOS usa LibreSSL, e o urllib3 avisa disso a cada execução; o
# aviso não afeta a coleta e só polui a saída que o agente lê.
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL")

import requests  # noqa: E402

from meta_ads_apify import ClienteApify, ErroColeta, entrada_ator, extrair_total, ler_token, page_id_do_link, url_pagina
from meta_ads_midia import apagar_midia, baixar_midia, ffmpeg_disponivel
from meta_ads_selecao import (
    FORMATO_DPA,
    Anuncio,
    Selecionado,
    normalizar_anuncio,
    selecionar,
    slug_marca,
)

# Cada anúncio buscado é cobrado pela Apify: 15 dá folga para descartar duplicados e mídia
# quebrada e ainda chegar aos 5 criativos analisados.
AMOSTRA_COLETA = 15
LIMITE_PADRAO = 5
# As duas chamadas de `coletar` somadas ficam abaixo dos 10 min do Bash do agente, com folga
# para os downloads: o agente recebe a mensagem de tempo esgotado em vez de um timeout mudo.
LIMITE_CONTAGEM_S = 150
LIMITE_COLETA_S = 330


def notas_de_coleta(total: Optional[int], anuncios: List[Anuncio], selecionados: List[Selecionado],
                    contagem: Dict[str, int], limite: int = LIMITE_PADRAO) -> List[str]:
    if not anuncios:
        return []
    notas: List[str] = []
    if total is None:
        notas.append("A Apify não informou o total de anúncios ativos; use o número de anúncios da amostra como mínimo no ranking.")
    elif total < limite:
        notas.append(f"Só {total} anúncios ativos no momento da coleta.")
    if contagem["duplicados"]:
        notas.append(f'{contagem["duplicados"]} anúncios repetiam um criativo já selecionado e foram descartados.')
    if not any(a.formato == FORMATO_DPA for a in anuncios):
        notas.append("Nenhum anúncio de catálogo (DPA) disponível.")
    if contagem["catalogos_pulados"]:
        notas.append(f'{contagem["catalogos_pulados"]} anúncios de catálogo a mais foram pulados (limite de 1 por anunciante).')
    if contagem["sem_midia"]:
        notas.append(f'{contagem["sem_midia"]} anúncios descartados por mídia indisponível.')
    return notas


def _data_br(iso: Optional[str]) -> str:
    return f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}" if iso and len(iso) >= 10 else "—"


def escrever_resumo(marca: str, pagina: str, page_id: str, total: Optional[int], na_amostra: int, hoje: date,
                    selecionados: List[Selecionado], notas: List[str], pasta: Path) -> str:
    l = [
        f"# Coleta Meta Ads — {marca}",
        "",
        f"- Página: {pagina} (page_id {page_id})",
        f"- Página na Biblioteca: {url_pagina(page_id)}",
        f"- Anúncios ativos (total): {total if total is not None else 'não informado pela Apify'}",
        f"- Anúncios da página na amostra: {na_amostra} (limite {AMOSTRA_COLETA})",
        f"- Coletado em: {hoje.strftime('%d/%m/%Y')}",
        f"- Anúncios selecionados: {len(selecionados)}",
        f"- Pasta da coleta (os caminhos de mídia abaixo são relativos a ela): {pasta}",
        "",
    ]
    if notas:
        l += ["## Notas de coleta", ""] + [f"- {n}" for n in notas] + [""]
    l += ["## Anúncios", ""]
    if not selecionados:
        l.append("Nenhum anúncio ativo encontrado no momento da coleta.")
        return "\n".join(l) + "\n"
    for i, s in enumerate(selecionados, start=1):
        a = s.anuncio
        l += [
            f"### {i}. {a.ad_id} · {a.formato}",
            "",
            f"- Link: {a.link}",
            f"- Início: {_data_br(a.inicio)} · Versões: {a.versoes if a.versoes is not None else '—'} · Impressões: {a.impressoes or '—'}",
            f"- Plataformas: {', '.join(a.plataformas) or '—'}",
            f"- CTA: {a.cta or '—'} · Domínio: {a.dominio or '—'}",
            f"- Título: {a.titulo or '—'}",
            f"- Copy: {a.texto or '—'}",
            "- Mídia (abra cada arquivo com Read antes de descrever):",
        ]
        l += [f"  - {arq}" for arq in s.midia.arquivos]
        if s.midia.quadros_falharam:
            l.append("- Aviso: não foi possível extrair quadros do vídeo; descreva a partir da capa.")
        l.append("")
    return "\n".join(l)


def _para_json(s: Selecionado) -> Dict[str, Any]:
    d = asdict(s.anuncio)
    d["link"] = s.anuncio.link
    d["midia"] = s.midia.arquivos
    d["quadros_falharam"] = s.midia.quadros_falharam
    return d


def coletar(page_id: str, marca: str, saida: Path, limite: int, cliente: Any, sessao: Any, hoje: date) -> Dict[str, Any]:
    if not ffmpeg_disponivel():
        raise ErroColeta("ffmpeg não encontrado. Instale com: brew install ffmpeg")
    pasta = saida / slug_marca(marca)
    pasta.mkdir(parents=True, exist_ok=True)
    try:
        total = extrair_total(
            cliente.executar(entrada_ator(url_pagina(page_id), 1, apenas_total=True), limite_segundos=LIMITE_CONTAGEM_S)
        )
    except ErroColeta:
        total = None
    brutos = cliente.executar(entrada_ator(url_pagina(page_id), AMOSTRA_COLETA), limite_segundos=LIMITE_COLETA_S)
    anuncios = [a for a in (normalizar_anuncio(b) for b in brutos if isinstance(b, dict)) if a]
    da_pagina = [a for a in anuncios if a.page_id == str(page_id)]
    if da_pagina:
        anuncios = da_pagina
    # Só agora, com a coleta nova em mãos, a mídia da coleta anterior sai.
    shutil.rmtree(pasta / "midia", ignore_errors=True)
    selecionados, contagem = selecionar(
        anuncios,
        limite,
        lambda a: baixar_midia(a, pasta, sessao),
        lambda a, _m: apagar_midia(pasta, a),
    )
    if anuncios and not selecionados:
        raise ErroColeta(
            f"A página tem {len(anuncios)} anúncios na amostra, mas nenhuma mídia pôde ser baixada "
            "(links do Facebook expirados ou recusados). Não registre como \"sem anúncios\": "
            "tente de novo em alguns minutos e, se repetir, avise o analista."
        )
    notas = notas_de_coleta(total, anuncios, selecionados, contagem, limite)
    pagina = anuncios[0].pagina if anuncios else marca
    (pasta / "bruto.json").write_text(json.dumps(brutos, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "anuncios.json").write_text(
        json.dumps([_para_json(s) for s in selecionados], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (pasta / "resumo.md").write_text(
        escrever_resumo(marca, pagina, str(page_id), total, len(anuncios), hoje, selecionados, notas, pasta), encoding="utf-8"
    )
    return {"pasta": str(pasta), "total": total, "selecionados": len(selecionados), "notas": notas}


def criar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Coleta de anúncios da Biblioteca do Meta via Apify (etapa desativada briefing-e-benchmark).")
    sub = p.add_subparsers(dest="comando", required=True)
    c = sub.add_parser("coletar")
    pagina = c.add_mutually_exclusive_group(required=True)
    pagina.add_argument("--link", help="link da página da marca na Biblioteca de Anúncios (com view_all_page_id=)")
    pagina.add_argument("--page-id")
    c.add_argument("--marca", required=True)
    c.add_argument("--saida", required=True, type=Path)
    c.add_argument("--limite", type=int, default=LIMITE_PADRAO)
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = criar_parser().parse_args(argv)
    try:
        page_id = args.page_id or page_id_do_link(args.link)
        sessao = requests.Session()
        cliente = ClienteApify(ler_token(), sessao=sessao)
        r = coletar(page_id, args.marca, args.saida, args.limite, cliente, sessao, date.today())
        total = r["total"] if r["total"] is not None else "não informado"
        print(f'Coleta de {args.marca}: {r["selecionados"]} anúncios selecionados (total ativo: {total}).')
        print(f'Resumo: {r["pasta"]}/resumo.md')
        for n in r["notas"]:
            print(f"- {n}")
    except ErroColeta as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
