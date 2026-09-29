#!/usr/bin/env python3
"""
scripts/validar_insumo.py: confere uma planilha de insumo contra o modelo oficial.

Chamado pela interface ao receber um upload (e utilizável pelas skills no
terminal). Nunca imprime valores de célula: mensagens citam só coluna e linha,
para não reproduzir dado pessoal (ver CLAUDE.md raiz).

    python3 scripts/validar_insumo.py --insumo historico-mensal --arquivo planilha.xlsx

Saída (stdout): {"ok": bool, "problemas": [...], "avisos": [...], "resumo": str | null}
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
SCHEMAS_PADRAO = RAIZ / ".claude/skills/_shared/modelos-insumo/schemas.json"
MODELOS_PADRAO = RAIZ / ".claude/skills/_shared/modelos-insumo"

PADROES_PII = {
    "CPF": re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),
    "e-mail": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "telefone": re.compile(r"\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b"),
    "cartão": re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"),
}
CABECALHOS_PII = [re.compile(p) for p in (
    r"\bcpf\b", r"\be-?mail\b", r"\btelefone\b", r"\bcelular\b", r"\bendereco\b", r"\bcep\b", r"\bcartao\b",
)]


def normalizar(texto: Any) -> str:
    t = unicodedata.normalize("NFD", str(texto or ""))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t).strip().lower()


def vazio(valor: Any) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def ler_linha(ws, numero: int) -> List[str]:
    for linha in ws.iter_rows(min_row=numero, max_row=numero, values_only=True):
        return ["" if v is None else str(v).strip() for v in linha]
    return []


def colunas_esperadas(schema: Dict[str, Any], modelos_dir: Path) -> Tuple[List[str], bool]:
    modelo = modelos_dir / schema["modelo"]
    if not modelo.exists():
        return list(schema.get("colunas_obrigatorias", [])), False
    wb = openpyxl.load_workbook(modelo, data_only=True)
    ws = wb.worksheets[0]
    cabecalho = ler_linha(ws, schema["linha_cabecalho"])
    if "linha_marcadores" in schema:
        marcadores = ler_linha(ws, schema["linha_marcadores"])
        alvo = normalizar(schema["marcador_obrigatorio"])
        obrigatorias = [c for c, m in zip(cabecalho, marcadores) if c and normalizar(m) == alvo]
        return list(schema.get("colunas_obrigatorias", [])) + obrigatorias, True
    return [c for c in cabecalho if c], True


# Excel costuma guardar CPF e telefone como número: compara pelo total de dígitos.
DIGITOS_PII = {"CPF": (11,), "telefone": (10, 11), "cartão": (16,)}


def tipos_pii(valor: Any) -> List[str]:
    if isinstance(valor, str):
        return [tipo for tipo, padrao in PADROES_PII.items() if padrao.search(valor)]
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        return []
    if isinstance(valor, float) and not valor.is_integer():
        return []
    digitos = len(str(abs(int(valor))))
    return [tipo for tipo, tamanhos in DIGITOS_PII.items() if digitos in tamanhos]


def procurar_pii(linhas: List[Tuple[int, Any]], cabecalho: List[str], aba: Optional[str]) -> List[str]:
    achados: Dict[Tuple[str, str], List[int]] = {}
    for numero, linha in linhas:
        for i, valor in enumerate(linha):
            for tipo in tipos_pii(valor):
                if i < len(cabecalho) and cabecalho[i]:
                    coluna = f"na coluna “{cabecalho[i]}”"
                else:
                    coluna = f"na coluna {i + 1}"
                if aba:
                    coluna += f" da aba “{aba}”"
                achados.setdefault((tipo, coluna), []).append(numero)
    problemas = []
    for (tipo, coluna), numeros in achados.items():
        lista = ", ".join(str(n) for n in numeros[:5]) + ("…" if len(numeros) > 5 else "")
        rotulo = "linha" if len(numeros) == 1 else "linhas"
        problemas.append(f"Encontrei o que parece ser {tipo} {coluna} ({rotulo} {lista}). Remova antes de enviar.")
    return problemas


def validar(insumo_id: str, arquivo: Path, schemas_path: Path, modelos_dir: Path) -> Dict[str, Any]:
    schemas = json.loads(Path(schemas_path).read_text(encoding="utf-8"))
    schema = schemas.get(insumo_id)
    if schema is None:
        return {"ok": False, "problemas": [f"Não há regra de validação para “{insumo_id}”."], "avisos": [], "resumo": None}
    try:
        # sem read_only: exportações de e-commerce costumam vir sem a dimensão da planilha,
        # e o modo read_only então enxerga só a primeira célula
        wb = openpyxl.load_workbook(arquivo, data_only=True)
    except Exception:
        return {"ok": False, "avisos": [], "resumo": None,
                "problemas": ["Não consegui abrir a planilha. Confirme que é um arquivo Excel (.xlsx) e que não está protegido por senha."]}

    ws = wb.worksheets[0]
    linha_cab = int(schema["linha_cabecalho"])
    cabecalho = ler_linha(ws, linha_cab)
    indice = {normalizar(c): i for i, c in enumerate(cabecalho) if c}
    obrigatorias, tem_modelo = colunas_esperadas(schema, Path(modelos_dir))
    problemas: List[str] = []
    avisos: List[str] = []
    if not tem_modelo:
        avisos.append("O modelo oficial desta planilha ainda não está no projeto; conferi só as colunas básicas.")

    faltando = [c for c in dict.fromkeys(obrigatorias) if normalizar(c) not in indice]
    for c in faltando:
        problemas.append(f"Coluna “{c}” não encontrada na linha {linha_cab}. Use o modelo sem renomear as colunas.")
    for c in cabecalho:
        if c and any(p.search(normalizar(c)) for p in CABECALHOS_PII):
            problemas.append(f"A coluna “{c}” parece conter dado pessoal. Apague essa coluna antes de enviar.")

    linhas = list(ws.iter_rows(min_row=linha_cab + 1, values_only=True))
    resumo: Optional[str] = None

    if "coluna_mes" in schema:
        i_mes = indice.get(normalizar(schema["coluna_mes"]))
        if i_mes is not None:
            meses = [l for l in linhas if i_mes < len(l) and not vazio(l[i_mes])][: int(schema["meses_esperados"])]
            if len(meses) < int(schema["meses_esperados"]):
                problemas.append(f"Esperados {schema['meses_esperados']} meses, encontrados {len(meses)}.")
            for c in dict.fromkeys(obrigatorias):
                i = indice.get(normalizar(c))
                if i is None or i == i_mes:
                    continue
                vazios = [str(l[i_mes]).strip() for l in meses if i >= len(l) or vazio(l[i])]
                if vazios:
                    problemas.append(f"Coluna “{c}” vazia em {', '.join(vazios)}.")
            if meses:
                resumo = f"{len(meses)} meses ({str(meses[0][i_mes]).strip()} a {str(meses[-1][i_mes]).strip()})"
    else:
        dados = [(n, l) for n, l in enumerate(linhas, start=linha_cab + 1) if any(not vazio(v) for v in l)]
        if len(dados) < int(schema.get("min_linhas", 1)):
            problemas.append("A planilha não tem linhas de dados abaixo do cabeçalho.")
        resumo = f"{len(dados)} linha{'s' if len(dados) != 1 else ''} de dados"
        if schema.get("sensivel"):
            problemas.extend(procurar_pii(dados, cabecalho, None))
            # dado pessoal em outra aba também entra no arquivo que o agente lê
            for extra in wb.worksheets[1:]:
                linhas_extra = [(n, l) for n, l in enumerate(extra.iter_rows(values_only=True), start=1)]
                problemas.extend(procurar_pii(linhas_extra, [], extra.title))

    return {"ok": not problemas, "problemas": problemas, "avisos": avisos, "resumo": resumo}


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--insumo", required=True)
    parser.add_argument("--arquivo", required=True)
    parser.add_argument("--schemas", default=str(SCHEMAS_PADRAO))
    parser.add_argument("--modelos", default=str(MODELOS_PADRAO))
    args = parser.parse_args(argv)
    resultado = validar(args.insumo, Path(args.arquivo), Path(args.schemas), Path(args.modelos))
    json.dump(resultado, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
