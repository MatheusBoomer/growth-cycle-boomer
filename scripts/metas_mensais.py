"""Metas dos primeiros meses do plano de ação, calculadas a partir da projeção aprovada (Skill 08).

Lê só as colunas de entrada (B a F) da aba do cenário em `projecao-de-cenarios.xlsx` e refaz a
cadeia de KPIs do `projecao.py`, sem usar os valores em cache das fórmulas:

    sessões pagas = investimento / custo por sessão paga
    sessões totais = sessões pagas / % de sessões pagas
    vendas = sessões totais x taxa de conversão
    receita = vendas x ticket médio

O resultado vira o bloco `metas_mensais` do JSON do plano (os outros campos ficam como estão).
Os números saem em pt-BR (1.234,56): conversão com duas casas, % pagas com uma.
Os meses da planilha são relativos ("Mês m-12"): o mês 1 da projeção é o mês de `fim_ciclo` do plano
menos 11 meses (os 12 meses do ciclo terminam em `fim_ciclo`) e os rótulos saem sozinhos, em pt-BR
curto ("Out/26"). `--rotulos` é opcional e, quando vem, precisa ser igual aos gerados.

    python3 scripts/metas_mensais.py --plano <json> --projecao <xlsx> --cenario Realista --meses 3 \\
        --checks "11/11/2026,11/12/2026,11/01/2027"
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

import openpyxl
from openpyxl.utils.exceptions import InvalidFileException

from plano_acao_comum import ErroPlano, formatar_percentual, ler_data

# Cenário do plano -> aba da planilha (o Realista é a aba "Meta").
ABA_DO_CENARIO = {"Realista": "Meta", "Pessimista": "Pessimista", "Otimista": "Otimista"}
PRIMEIRA_LINHA = 2
MESES_DA_PROJECAO = 12
MESES_ABREVIADOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
COLUNAS = [
    "Mês", "Check em", "Receita (R$)", "Invest. (R$)", "Ticket (R$)",
    "Conv.", "CPS (R$)", "% pagas", "Sessões", "Vendas",
]


def _numero(valor, onde: str) -> float:
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ErroPlano(f"{onde} da projeção não é um número (veio {valor!r}).")
    return float(valor)


def calcular_meses(projecao: Path, cenario: str, meses: int) -> list[dict]:
    """Os `meses` primeiros meses do cenário, com os KPIs calculados a partir das entradas."""
    if cenario not in ABA_DO_CENARIO:
        raise ErroPlano(f"Cenário desconhecido: {cenario!r}. Use Realista, Pessimista ou Otimista.")
    if meses < 1:
        raise ErroPlano(f"O número de meses precisa ser pelo menos 1 (veio {meses}).")
    if meses > MESES_DA_PROJECAO:
        raise ErroPlano(f"A projeção tem {MESES_DA_PROJECAO} meses; não dá para pedir {meses}.")
    try:
        wb = openpyxl.load_workbook(projecao, data_only=False, read_only=True)
    except FileNotFoundError:
        raise ErroPlano(f"Projeção não encontrada: {projecao}")
    except (OSError, zipfile.BadZipFile, InvalidFileException) as e:
        raise ErroPlano(f"Não foi possível abrir a projeção ({projecao}): {e}")
    try:
        aba = ABA_DO_CENARIO[cenario]
        if aba not in wb.sheetnames:
            raise ErroPlano(f"A projeção não tem a aba {aba!r} (cenário {cenario}).")
        linhas = list(wb[aba].iter_rows(
            min_row=PRIMEIRA_LINHA, max_row=PRIMEIRA_LINHA + meses - 1, min_col=2, max_col=6, values_only=True,
        ))
    finally:
        wb.close()

    resultado = []
    for i in range(meses):
        celulas = linhas[i] if i < len(linhas) else ()
        celulas = tuple(celulas) + (None,) * (5 - len(celulas))
        onde = f"Linha {PRIMEIRA_LINHA + i} da aba {aba}"
        invest, ticket, conversao, cps, pct_pagas = (
            _numero(v, f"{onde}, coluna {col},") for v, col in zip(celulas, "BCDEF")
        )
        if cps <= 0 or pct_pagas <= 0:
            raise ErroPlano(f"{onde}: custo por sessão paga e % de sessões pagas precisam ser maiores que zero.")
        sessoes = invest / cps / pct_pagas
        vendas = sessoes * conversao
        resultado.append({
            "mes_indice": i + 1, "investimento": invest, "ticket": ticket, "conversao": conversao,
            "cps": cps, "pct_pagas": pct_pagas, "sessoes": sessoes, "vendas": vendas,
            "receita": vendas * ticket,
        })
    return resultado


def rotulos_dos_meses(fim_ciclo: str, meses: int) -> list[str]:
    """Rótulos ("Out/26") dos `meses` primeiros meses; o mês 1 é o de `fim_ciclo` menos 11 meses."""
    fim = ler_data(fim_ciclo, "fim_ciclo")
    indice = fim.year * 12 + (fim.month - 1) - (MESES_DA_PROJECAO - 1)
    return [f"{MESES_ABREVIADOS[(indice + i) % 12]}/{(indice + i) // 12 % 100:02d}" for i in range(meses)]


def _br(valor: float, casas: int) -> str:
    """Número em pt-BR com ponto de milhar e vírgula decimal: 1234.5 -> '1.234,50' (com 2 casas)."""
    return f"{valor:,.{casas}f}".replace(",", "_").replace(".", ",").replace("_", ".")


def montar_bloco(linhas: list[dict], rotulos_mes: list[str], checks: list[str], cenario: str) -> dict:
    """Bloco `metas_mensais` do plano: uma linha por mês e uma de total."""
    if len(rotulos_mes) != len(linhas):
        raise ErroPlano(f"São {len(linhas)} meses, mas vieram {len(rotulos_mes)} rótulos de mês.")
    if len(checks) != len(linhas):
        raise ErroPlano(f"São {len(linhas)} meses, mas vieram {len(checks)} datas de checks.")
    inteiro = lambda v: _br(v, 0)  # noqa: E731
    tabela = [
        [
            rotulo, check, inteiro(l["receita"]), inteiro(l["investimento"]),
            _br(l["ticket"], 2), _br(l["conversao"] * 100, 2) + "%", _br(l["cps"], 2),
            formatar_percentual(l["pct_pagas"]), inteiro(l["sessoes"]), inteiro(l["vendas"]),
        ]
        for l, rotulo, check in zip(linhas, rotulos_mes, checks)
    ]
    soma = lambda campo: sum(l[campo] for l in linhas)  # noqa: E731
    tabela.append([
        f"{len(linhas)} meses", "", inteiro(soma("receita")), inteiro(soma("investimento")),
        "", "", "", "", inteiro(soma("sessoes")), inteiro(soma("vendas")),
    ])
    return {"cenario": cenario, "colunas": list(COLUNAS), "linhas": tabela, "observacao": None}


def _lista(texto: str) -> list[str]:
    return [parte.strip() for parte in texto.split(",") if parte.strip()]


def _gravar_json(caminho: Path, dados: dict) -> None:
    """Grava por arquivo temporário na mesma pasta e troca, para nunca deixar o JSON pela metade."""
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", delete=False, dir=caminho.parent, prefix=".metas-", suffix=".json"
    ) as f:
        temporario = Path(f.name)
        try:
            json.dump(dados, f, ensure_ascii=False, indent=2)
            f.write("\n")
        except BaseException:
            f.close()
            temporario.unlink(missing_ok=True)
            raise
    try:
        umask = os.umask(0)
        os.umask(umask)
        os.chmod(temporario, 0o666 & ~umask)  # o temporário nasce 0600; o final segue o umask
        temporario.replace(caminho)
    except BaseException:
        temporario.unlink(missing_ok=True)
        raise


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Grava as metas dos primeiros meses (metas_mensais) no plano de ação.")
    p.add_argument("--plano", required=True, type=Path)
    p.add_argument("--projecao", required=True, type=Path)
    p.add_argument("--cenario", default="Realista")
    p.add_argument("--meses", default="3")
    p.add_argument(
        "--rotulos",
        help='opcional: rótulos dos meses separados por vírgula; precisam ser iguais aos gerados a partir de fim_ciclo (ex.: "Nov/26,Dez/26,Jan/27")',
    )
    p.add_argument("--checks", required=True, help='datas dos checks separadas por vírgula, ex.: "02/12/2026,30/12/2026"')
    a = p.parse_args(argv)
    try:
        try:
            meses = int(a.meses)
        except ValueError:
            raise ErroPlano(f"O número de meses precisa ser inteiro (veio {a.meses!r}).")
        try:
            plano = json.loads(a.plano.read_text(encoding="utf-8"))
        except FileNotFoundError:
            raise ErroPlano(f"Plano não encontrado: {a.plano}")
        except json.JSONDecodeError as e:
            raise ErroPlano(f"O plano não é um JSON válido (linha {e.lineno}): {e.msg}")
        except (OSError, UnicodeDecodeError) as e:
            raise ErroPlano(f"Não foi possível ler o plano ({a.plano}): {e}")
        if not isinstance(plano, dict):
            raise ErroPlano("O plano precisa ser um objeto JSON.")
        linhas = calcular_meses(a.projecao, a.cenario, meses)
        if not plano.get("fim_ciclo"):
            raise ErroPlano("O plano não tem fim_ciclo; sem ele não dá para saber o mês 1 da projeção.")
        rotulos = rotulos_dos_meses(plano["fim_ciclo"], meses)
        if a.rotulos is not None and _lista(a.rotulos) != rotulos:
            raise ErroPlano(
                f"Os rótulos informados ({', '.join(_lista(a.rotulos)) or 'vazio'}) não batem com os do ciclo "
                f"({', '.join(rotulos)}); o mês 1 é o de fim_ciclo menos 11 meses. Tire --rotulos ou corrija."
            )
        plano["metas_mensais"] = montar_bloco(linhas, rotulos, _lista(a.checks), a.cenario)
        try:
            _gravar_json(a.plano, plano)
        except OSError as e:
            raise ErroPlano(f"Não foi possível gravar o plano ({a.plano}): {e}")
    except ErroPlano as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
