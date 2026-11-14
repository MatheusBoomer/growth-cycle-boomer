#!/usr/bin/env python3
"""
scripts/gerar_apresentacao.py: gera a apresentação final (.pptx) a partir do
roteiro aprovado (roteiro-apresentacao.json), duplicando os slides-modelo do
molde da agência e preenchendo textos e imagens.

    python3 scripts/gerar_apresentacao.py --roteiro <roteiro.json> --prospect clientes/<slug> --output <arquivo.pptx>

Valida o roteiro antes de gerar (erros: código 1, nada é gravado). Avisos
(slide pulado por pendência, texto que provavelmente estoura a caixa) saem na
tela. Grava mapa-slides.json ao lado do .pptx (áreas dos campos em % do slide).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

from pptx import Presentation

import apresentacao_pptx as ap
import linhas_plano_acao as plano

RAIZ = Path(__file__).resolve().parent.parent
CAMINHO_MOLDE = RAIZ / ".claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx"
EXTENSOES_IMAGEM = {".png", ".jpg", ".jpeg"}
LIMITE_OCUPACAO = 1.1
# Títulos grandes de capa e divisória quebram em duas linhas por desenho (ver p.42 do deck de referência).
TIPOS_SEM_AVISO_DE_ESTOURO = {"capa", "divisoria"}

# Caracteres por item do roteiro (sem os prefixos "Hipótese: " e "Solução: " que o gerador acrescenta).
LIMITES_DESAFIO = {"titulo": 60, "problema": 140, "hipoteses": 90, "solucoes": 100, "impacto": 100}

# Colunas de cada linha do slide tabela_plano, na ordem do slide.
COLUNAS_PLANO = ("num", "acao", "horizonte", "quando", "quem", "frente")

# campo -> ("texto" | "lista" | "imagem" | "imagens" | "bloco" | "link" | "link_opcional" | "tabela", mínimo, máximo)
ESQUEMA: Dict[str, Dict[str, tuple]] = {
    "capa": {"prospect": ("texto", 1, 1)},
    "jornada": {},
    "divisoria": {"numero": ("texto", 1, 1), "titulo": ("texto", 1, 1)},
    "grafico": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "imagem": ("imagem", 1, 1), "conclusoes": ("lista", 1, 3)},
    "tabela_lateral": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "imagem": ("imagem", 1, 1), "conclusoes": ("lista", 1, 3)},
    "imagem_larga": {"titulo": ("texto", 1, 1), "imagem": ("imagem", 1, 1), "texto": ("texto", 1, 1)},
    "analises_2_colunas": {"esquerda": ("bloco", 1, 4), "direita": ("bloco", 1, 4)},
    "bullets": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "itens": ("lista", 1, 6)},
    "cartoes": {"titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "cartoes": ("lista", 3, 3)},
    # tipo reservado, sem uso no roteiro padrão (o deck de 5 seções não tem benchmarking)
    "benchmark": {
        "titulo": ("texto", 1, 1), "subtitulo": ("texto", 1, 1), "concorrente": ("texto", 1, 1),
        "imagens": ("imagens", 1, 3), "conclusoes": ("lista", 1, 3), "link": ("link", 1, 1),
    },
    "desafio": {
        "titulo": ("texto", 1, 1), "problema": ("texto", 1, 1), "hipoteses": ("lista", 1, 5),
        "solucoes": ("lista", 1, 3), "impacto": ("texto", 1, 1),
    },
    # tabela nativa do plano de ação; `link` leva ao documento detalhado e pode faltar (o gerador avisa)
    "tabela_plano": {"linhas": ("tabela", 1, 16), "link": ("link_opcional", 0, 1)},
    "obrigado": {},
}


class ErroRoteiro(Exception):
    """Roteiro inválido; a mensagem lista os problemas, um por linha."""


def _textos(valor) -> bool:
    return isinstance(valor, list) and all(isinstance(v, str) and v.strip() for v in valor)


def _validar_imagem(rel, pasta: Path, onde: str, erros: List[str]) -> None:
    if not isinstance(rel, str) or not rel.strip():
        erros.append(f"{onde}: caminho de imagem vazio.")
        return
    alvo = (pasta / rel).resolve()
    if Path(rel).is_absolute() or pasta.resolve() not in alvo.parents:
        erros.append(f"{onde}: imagem fora da pasta do prospect ({rel}).")
    elif alvo.suffix.lower() not in EXTENSOES_IMAGEM:
        erros.append(f"{onde}: a imagem precisa ser png ou jpg ({rel}).")
    elif not alvo.is_file():
        erros.append(f"{onde}: imagem não encontrada ({rel}).")


def _validar_tabela(linhas, minimo: int, maximo: int, onde: str, erros: List[str]) -> None:
    if not isinstance(linhas, list) or not minimo <= len(linhas) <= maximo:
        erros.append(f"{onde}: precisa ter de {minimo} a {maximo} linhas.")
        return
    for n, linha in enumerate(linhas, start=1):
        if not isinstance(linha, dict):
            erros.append(f"{onde}, linha {n}: formato inválido.")
            continue
        for coluna in COLUNAS_PLANO:
            valor = linha.get(coluna)
            if not isinstance(valor, (str, int)) or isinstance(valor, bool) or not str(valor).strip():
                erros.append(f"{onde}, linha {n}: a coluna {coluna} precisa de um texto.")


def _validar_desafio(s: dict, i: int, erros: List[str]) -> None:
    if "problema_id" in s and (not isinstance(s["problema_id"], str) or not s["problema_id"].strip()):
        erros.append(f"Slide {i} (desafio), campo problema_id: precisa ser um texto (ex.: P1).")
    for campo, limite in LIMITES_DESAFIO.items():
        valor = s.get(campo)
        itens = valor if isinstance(valor, list) else [valor]
        for item in itens:
            if isinstance(item, str) and len(item) > limite:
                erros.append(
                    f"Slide {i} (desafio), campo {campo}: item com {len(item)} caracteres; "
                    f"o limite é {limite}. Condense o texto."
                )


def validar_roteiro(roteiro: dict, pasta_prospect: Path, tipos_do_molde: set) -> Tuple[List[str], List[str]]:
    erros: List[str] = []
    avisos: List[str] = []
    slides = roteiro.get("slides") if isinstance(roteiro, dict) else None
    if not isinstance(slides, list) or not slides:
        return ["Slide -: o roteiro não tem a lista \"slides\"."], avisos
    for i, s in enumerate(slides, start=1):
        if not isinstance(s, dict):
            erros.append(f"Slide {i}: formato inválido.")
            continue
        tipo = s.get("tipo")
        if tipo not in ESQUEMA or tipo not in tipos_do_molde:
            erros.append(f"Slide {i}: tipo \"{tipo}\" não existe no molde.")
            continue
        if s.get("pendencia"):
            continue
        for campo, (modo, minimo, maximo) in ESQUEMA[tipo].items():
            onde = f"Slide {i} ({tipo}), campo {campo}"
            valor = s.get(campo)
            if valor is None and modo == "link_opcional":
                continue
            if valor is None:
                erros.append(f"{onde}: obrigatório.")
            elif modo in ("link", "link_opcional") and (not isinstance(valor, str) or not valor.startswith(("https://", "http://"))):
                erros.append(f"{onde}: o link precisa começar com https://.")
            elif modo == "tabela":
                _validar_tabela(valor, minimo, maximo, onde, erros)
            elif modo in ("texto", "link") and (not isinstance(valor, str) or not valor.strip()):
                erros.append(f"{onde}: precisa ser um texto.")
            elif modo == "link" and not valor.startswith(("https://", "http://")):
                erros.append(f"{onde}: o link precisa começar com https://.")
            elif modo == "lista" and (not _textos(valor) or not minimo <= len(valor) <= maximo):
                erros.append(f"{onde}: precisa ter de {minimo} a {maximo} itens de texto.")
            elif modo == "imagem":
                _validar_imagem(valor, pasta_prospect, onde, erros)
            elif modo == "imagens":
                if not isinstance(valor, list) or not minimo <= len(valor) <= maximo:
                    erros.append(f"{onde}: precisa ter de {minimo} a {maximo} imagens.")
                else:
                    for img in valor:
                        _validar_imagem(img, pasta_prospect, onde, erros)
            elif modo == "bloco":
                if not isinstance(valor, dict) or not isinstance(valor.get("titulo"), str) or not _textos(valor.get("itens")) \
                        or not minimo <= len(valor["itens"]) <= maximo:
                    erros.append(f"{onde}: precisa de \"titulo\" e de {minimo} a {maximo} \"itens\".")
        if tipo == "desafio":
            _validar_desafio(s, i, erros)
    return erros, avisos


def _preencher(prs, slide, tipo: str, dados: dict, pasta: Path, numero: int, avisos: List[str]) -> None:
    c = ap.campos(slide)
    if tipo == "desafio":
        ap.preencher_texto(c["titulo"], dados["titulo"])
        ap.preencher_bloco(c["esquerda"], f"**Problema:** {dados['problema']}", [f"Hipótese: {h}" for h in dados["hipoteses"]])
        ap.preencher_bloco(c["direita"], f"**Impacto:** {dados['impacto']}", [f"Solução: {x}" for x in dados["solucoes"]])
    else:
        _preencher_campos(slide, c, tipo, dados, pasta)
    if tipo in TIPOS_SEM_AVISO_DE_ESTOURO:
        return
    if tipo == "tabela_plano":
        altura = plano.altura_estimada(dados["linhas"])
        if altura > plano.ALTURA_UTIL:
            avisos.append(f"Slide {numero}, campo tabela: o texto provavelmente não cabe ({altura / plano.ALTURA_UTIL:.0%} do espaço); divida em mais slides ou encurte as ações.")
        if not dados.get("link"):
            avisos.append(f"Slide {numero}: a tabela do plano de ação está sem o link do documento detalhado.")
    for nome, forma in ap.campos(slide).items():
        if forma.has_text_frame and ap.ocupacao(forma) > LIMITE_OCUPACAO:
            avisos.append(f"Slide {numero}, campo {nome}: o texto provavelmente não cabe na caixa ({ap.ocupacao(forma):.0%} do espaço).")


def _preencher_campos(slide, c, tipo: str, dados: dict, pasta: Path) -> None:
    for campo, (modo, _, _) in ESQUEMA[tipo].items():
        valor = dados.get(campo)
        if tipo == "capa":
            ap.substituir_token(slide, "{{prospect}}", valor)
        elif modo == "texto" and campo in c:
            ap.preencher_texto(c[campo], valor)
        elif modo == "lista" and tipo == "cartoes":
            for j, texto in enumerate(valor, start=1):
                ap.preencher_texto(c[f"cartao_{j}"], texto)
        elif modo == "lista":
            ap.preencher_lista(c[campo], valor)
        elif modo == "bloco":
            ap.preencher_bloco(c[campo], valor["titulo"], valor["itens"])
        elif modo == "imagem":
            ap.trocar_imagem(slide, c[campo], pasta / valor)
        elif modo == "imagens":
            for j in range(1, 4):
                forma = c.get(f"imagem_{j}")
                if forma is None:
                    continue
                if j <= len(valor):
                    ap.trocar_imagem(slide, forma, pasta / valor[j - 1])
                else:
                    forma._element.getparent().remove(forma._element)
        elif modo == "link":
            ap.definir_link(c[campo], valor)
        elif modo == "tabela":
            ap.preencher_tabela(c["tabela"],[[str(linha[coluna]) for coluna in COLUNAS_PLANO] for linha in valor])
        elif modo == "link_opcional":
            if valor:
                ap.definir_link(c[campo], valor, so_primeiro_trecho=True)
            else:  # sem endereço, a frase "Clique aqui" não leva a lugar nenhum: sai do slide
                c[campo]._element.getparent().remove(c[campo]._element)


def _graficos_fora_do_roteiro(roteiro: dict, pasta: Path) -> List[str]:
    """Gráficos e tabelas aprovados que nenhum slide usa: todo aprovado deve entrar no deck."""
    usados = set()
    for s in roteiro["slides"]:
        for valor in [s.get("imagem")] + list(s.get("imagens") or []):
            if isinstance(valor, str):
                usados.add((pasta / valor).resolve())
    aprovados = sorted((pasta / "entrega/ativos-aprovados/graficos").glob("*.png"))
    return [p.name for p in aprovados if p.resolve() not in usados]


def _problemas_fora_do_roteiro(roteiro: dict, pasta: Path, avisos: List[str]) -> None:
    """Todo problema do registro de soluções deve ter um slide desafio na seção 02. Desafios."""
    caminho = pasta / "contexto/solucoes.json"
    if not caminho.is_file():
        return
    try:
        problemas = json.loads(caminho.read_text(encoding="utf-8"))["problemas"]
        if not isinstance(problemas, list):
            raise TypeError("problemas não é uma lista")
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError):
        avisos.append("contexto/solucoes.json não pôde ser lido; confira o registro de soluções.")
        return
    ids = [p["id"] for p in problemas if isinstance(p, dict) and isinstance(p.get("id"), str)]
    usados = {s["problema_id"] for s in roteiro["slides"] if s.get("tipo") == "desafio" and isinstance(s.get("problema_id"), str)}
    fora = [i for i in ids if i not in usados]
    if fora:
        avisos.append(f"{len(fora)} problemas do registro de soluções não entraram no deck: {', '.join(fora)}.")


def _acoes_fora_do_roteiro(roteiro: dict, pasta: Path, avisos: List[str]) -> None:
    """Toda ação da tabela-resumo do plano de ação aprovado deve entrar nos slides tabela_plano."""
    caminho = pasta / plano.CAMINHO_DOCX
    if not caminho.is_file():
        return
    try:
        aprovadas = [l["acao"] for l in plano.ler_tabela_docx(caminho)]
    except (plano.ErroPlano, OSError, ValueError, KeyError) as e:
        avisos.append(f"O plano de ação aprovado não pôde ser lido para a conferência de cobertura: {e}")
        return
    no_deck = {" ".join(str(l["acao"]).split()) for s in roteiro["slides"] if s.get("tipo") == "tabela_plano" and not s.get("pendencia") for l in s["linhas"]}
    fora = [a for a in aprovadas if a not in no_deck]
    if fora:
        avisos.append(f"{len(fora)} ações do plano de ação aprovado não entraram nos slides de tabela: {'; '.join(fora[:5])}{'…' if len(fora) > 5 else ''}.")


def gerar(roteiro: dict, pasta_prospect: Path, saida: Path, molde: Path = CAMINHO_MOLDE) -> dict:
    prs = Presentation(molde)
    modelos = {ap.tipo_do_slide(s): s for s in prs.slides}
    erros, avisos = validar_roteiro(roteiro, pasta_prospect, set(modelos))
    if erros:
        raise ErroRoteiro("\n".join(erros))
    mapa = []
    numero = 0
    for indice, s in enumerate(roteiro["slides"]):
        if s.get("pendencia"):
            avisos.append(f"Slide do roteiro #{indice + 1} ({s['tipo']}) pulado: {s['pendencia']}")
            continue
        numero += 1
        novo = ap.duplicar_slide(prs, modelos[s["tipo"]])
        _preencher(prs, novo, s["tipo"], s, pasta_prospect, numero, avisos)
        mapa.append({
            "numero": numero,
            "tipo": s["tipo"],
            "roteiro": indice,
            "campos": {nome: ap.caixa_percentual(prs, forma) for nome, forma in ap.campos(novo).items()},
        })
    for modelo in modelos.values():
        ap.remover_slide(prs, modelo)
    fora = _graficos_fora_do_roteiro(roteiro, pasta_prospect)
    if fora:
        avisos.append(f"{len(fora)} gráficos aprovados não entraram no roteiro: {', '.join(fora)}.")
    _problemas_fora_do_roteiro(roteiro, pasta_prospect, avisos)
    _acoes_fora_do_roteiro(roteiro, pasta_prospect, avisos)
    saida.parent.mkdir(parents=True, exist_ok=True)
    prs.save(saida)
    caminho_mapa = saida.with_name("mapa-slides.json")
    caminho_mapa.write_text(json.dumps({"slides": mapa}, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"slides": numero, "avisos": avisos, "mapa": caminho_mapa}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Gera a apresentação final (.pptx) a partir do roteiro.")
    p.add_argument("--roteiro", required=True, type=Path)
    p.add_argument("--prospect", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--molde", type=Path, default=CAMINHO_MOLDE)
    a = p.parse_args(argv)
    try:
        roteiro = json.loads(a.roteiro.read_text(encoding="utf-8"))
        r = gerar(roteiro, a.prospect, a.output, a.molde)
    except json.JSONDecodeError as e:
        print(f"ERRO: o roteiro não é um JSON válido (linha {e.lineno}): {e.msg}", file=sys.stderr)
        return 1
    except ErroRoteiro as e:
        print(f"ERRO: roteiro inválido:\n{e}", file=sys.stderr)
        return 1
    print(f"Apresentação gerada: {a.output} ({r['slides']} slides)")
    for aviso in r["avisos"]:
        print(f"- Aviso: {aviso}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
