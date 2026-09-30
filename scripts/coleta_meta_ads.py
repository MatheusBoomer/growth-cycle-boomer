#!/usr/bin/env python3
"""
scripts/coleta_meta_ads.py: coleta de anúncios da Biblioteca de Anúncios do
Meta via Apify, para o benchmark da Skill 06.

    python3 scripts/coleta_meta_ads.py descobrir --marca "Nome" [--site dominio.com.br] --saida clientes/<slug>/dados/benchmark-meta
    python3 scripts/coleta_meta_ads.py coletar --page-id N --marca "Nome" --saida clientes/<slug>/dados/benchmark-meta [--limite 10]

descobrir: lista as páginas que anunciam com o nome da marca e diz se a
oficial ficou "confirmada" (nome + domínio do site) ou se é preciso perguntar
ao analista ("ambigua" / "nao_encontrada").

coletar: baixa os anúncios ativos da página, aplica as regras da Skill 06
(até 10 criativos distintos, no máximo 1 catálogo, sem anúncio sem mídia),
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

from meta_ads_apify import ClienteApify, ErroColeta, entrada_ator, extrair_total, ler_token, url_busca, url_pagina
from meta_ads_midia import apagar_midia, baixar_midia, ffmpeg_disponivel
from meta_ads_selecao import (
    FORMATO_DPA,
    Anuncio,
    Selecionado,
    agrupar_paginas,
    classificar_descoberta,
    normalizar_anuncio,
    selecionar,
    slug_marca,
)

AMOSTRA_DESCOBERTA = 30
AMOSTRA_COLETA = 40
# As duas chamadas de `coletar` somadas ficam abaixo dos 10 min do Bash do agente, com folga
# para os downloads: o agente recebe a mensagem de tempo esgotado em vez de um timeout mudo.
LIMITE_CONTAGEM_S = 150
LIMITE_COLETA_S = 330


def _buscar(termo: str, cliente: Any):
    itens = cliente.executar(entrada_ator(url_busca(termo), AMOSTRA_DESCOBERTA))
    return agrupar_paginas([a for a in (normalizar_anuncio(i) for i in itens if isinstance(i, dict)) if a])


def descobrir(marca: str, site: Optional[str], saida: Path, cliente: Any) -> Dict[str, Any]:
    termo = marca.strip()
    candidatas = _buscar(termo, cliente)
    if not candidatas and " " in termo:
        termo = termo.replace(" ", "")
        candidatas = _buscar(termo, cliente)
    resultado = classificar_descoberta(marca, site, candidatas)
    resultado.update({
        "marca": marca,
        "site": site,
        "termo_buscado": termo,
        "candidatas": [asdict(c) for c in candidatas],
    })
    pasta = saida / slug_marca(marca)
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "descoberta.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def texto_descoberta(r: Dict[str, Any]) -> str:
    linhas = [
        f'Marca: {r["marca"]} (busca: "{r["termo_buscado"]}")',
        f'Resultado: {r["status"]}. {r["motivo"]}',
    ]
    if r["page_id"]:
        linhas.append(f'Página confirmada: page_id {r["page_id"]} ({url_pagina(r["page_id"])})')
    if r["candidatas"]:
        linhas += ["", "| Página | page_id | Curtidas | Categoria | Domínios | Anúncios na amostra |", "|---|---|---|---|---|---|"]
        for c in r["candidatas"]:
            curtidas = c["curtidas"] if c["curtidas"] is not None else "—"
            linhas.append(
                f'| {c["nome"]} | {c["page_id"]} | {curtidas} | {", ".join(c["categorias"]) or "—"} '
                f'| {", ".join(c["dominios"]) or "—"} | {c["anuncios"]} |'
            )
    return "\n".join(linhas)


def notas_de_coleta(total: Optional[int], anuncios: List[Anuncio], selecionados: List[Selecionado],
                    contagem: Dict[str, int]) -> List[str]:
    if not anuncios:
        return []
    notas: List[str] = []
    if total is None:
        notas.append("A Apify não informou o total de anúncios ativos; use o número de anúncios da amostra como mínimo no ranking.")
    elif total < 10:
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
    notas = notas_de_coleta(total, anuncios, selecionados, contagem)
    pagina = anuncios[0].pagina if anuncios else marca
    (pasta / "bruto.json").write_text(json.dumps(brutos, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "anuncios.json").write_text(
        json.dumps([_para_json(s) for s in selecionados], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (pasta / "resumo.md").write_text(
        escrever_resumo(marca, pagina, str(page_id), total, len(anuncios), hoje, selecionados, notas, pasta), encoding="utf-8"
    )
    return {"pasta": str(pasta), "total": total, "selecionados": len(selecionados), "notas": notas}


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Coleta de anúncios da Biblioteca do Meta via Apify (Skill 06).")
    sub = p.add_subparsers(dest="comando", required=True)
    d = sub.add_parser("descobrir")
    d.add_argument("--marca", required=True)
    d.add_argument("--site")
    d.add_argument("--saida", required=True, type=Path)
    c = sub.add_parser("coletar")
    c.add_argument("--page-id", required=True)
    c.add_argument("--marca", required=True)
    c.add_argument("--saida", required=True, type=Path)
    c.add_argument("--limite", type=int, default=10)
    args = p.parse_args(argv)
    try:
        sessao = requests.Session()
        cliente = ClienteApify(ler_token(), sessao=sessao)
        if args.comando == "descobrir":
            print(texto_descoberta(descobrir(args.marca, args.site, args.saida, cliente)))
        else:
            r = coletar(args.page_id, args.marca, args.saida, args.limite, cliente, sessao, date.today())
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
