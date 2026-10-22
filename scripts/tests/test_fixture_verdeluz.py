from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import openpyxl
import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import validar_insumo as vi  # noqa: E402
from fixture_verdeluz import gerar_dados  # noqa: E402

TOL = 0.03


@pytest.fixture(scope="module")
def gerado(tmp_path_factory):
    pasta = tmp_path_factory.mktemp("dados")
    return pasta, gerar_dados.gerar(pasta)


def perto(valor: float, alvo: float, tol: float = TOL) -> bool:
    return abs(valor / alvo - 1) <= tol


def validar(insumo: str, arquivo: Path) -> dict:
    saida = subprocess.run(
        [sys.executable, str(RAIZ / "scripts/validar_insumo.py"), "--insumo", insumo, "--arquivo", str(arquivo)],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(saida)


def historico(pasta: Path) -> dict[str, list]:
    ws = openpyxl.load_workbook(pasta / "historico-mensal.xlsx", data_only=True).worksheets[0]
    cab = [c.value for c in ws[2]]
    linhas = [r for r in ws.iter_rows(min_row=3, max_row=14, values_only=True)]
    return {str(nome).strip(): [l[i] for l in linhas] for i, nome in enumerate(cab) if nome}


def test_ancoras_dentro_da_tolerancia(gerado):
    _, t = gerado
    assert perto(t["sessoes"], 440_000)
    assert perto(t["captada"], 1_220_000)
    assert perto(t["investimento"], 262_000)
    assert perto(t["pedidos"], 6_150)
    assert perto(t["novos"], 3_790)
    assert perto(t["clientes"], 10_400, 0.01)
    assert perto(t["pedidos_base"], 16_900, 0.01)
    assert perto(t["ltv"], 311)
    assert abs((1 - t["aprovada"] / t["captada"]) - 0.065) < 0.003


def test_historico_valida(gerado):
    pasta, _ = gerado
    r = validar("historico-mensal", pasta / "historico-mensal.xlsx")
    assert r["ok"], r["problemas"]
    assert r["resumo"].startswith("12 meses (OUTUBRO a SETEMBRO)")


def test_demais_planilhas_validam(gerado):
    pasta, _ = gerado
    for insumo in ("produtos-curva-abc", "quebra-pagamento", "clientes-historico"):
        r = validar(insumo, pasta / f"{insumo}.xlsx")
        assert r["ok"], (insumo, r["problemas"])


def test_quebra_fecha_com_historico(gerado):
    pasta, _ = gerado
    h = historico(pasta)
    ws = openpyxl.load_workbook(pasta / "quebra-pagamento.xlsx", data_only=True).worksheets[0]
    captada: dict[str, float] = {}
    aprovada: dict[str, float] = {}
    for data, _meio, cap, apr in ws.iter_rows(min_row=2, values_only=True):
        captada[data] = captada.get(data, 0) + cap
        aprovada[data] = aprovada.get(data, 0) + apr
    meses = h["DATA"]
    assert [m.strip() for m in meses] == list(captada)
    for i, mes in enumerate(captada):
        assert abs(captada[mes] - h["RECEITA BRUTA (Ecommerce)"][i]) <= 1
        assert abs(aprovada[mes] - h["RECEITA APROVADA"][i]) <= 1


def test_mix_de_pagamento_anual(gerado):
    pasta, _ = gerado
    ws = openpyxl.load_workbook(pasta / "quebra-pagamento.xlsx", data_only=True).worksheets[0]
    por_meio: dict[str, float] = {}
    for _d, meio, cap, _a in ws.iter_rows(min_row=2, values_only=True):
        por_meio[meio] = por_meio.get(meio, 0) + cap
    total = sum(por_meio.values())
    assert abs(por_meio["Cartão de crédito"] / total - 0.57) < 0.01
    assert abs(por_meio["PIX"] / total - 0.38) < 0.01
    assert abs(por_meio["Boleto"] / total - 0.05) < 0.01


def test_novos_e_recorrentes_fecham_com_os_pedidos(gerado):
    pasta, _ = gerado
    h = historico(pasta)
    for i, pedidos in enumerate(h["VENDAS TOTAIS (ECOM)"]):
        novos = round(pedidos * h["% NOVOS CLIENTES"][i])
        assert abs(novos + h["CLIENTES RECORRENTES"][i] - pedidos) <= 1


def test_base_de_clientes(gerado):
    pasta, t = gerado
    ws = openpyxl.load_workbook(pasta / "clientes-historico.xlsx", data_only=True).worksheets[0]
    linhas = list(ws.iter_rows(min_row=2, values_only=True))
    assert [c.value for c in ws[1]] == ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"]
    assert len(linhas) == t["clientes"]
    assert abs(sum(l[2] for l in linhas) / len(linhas) - 1.62) < 0.03
    recorrentes = sum(1 for l in linhas if l[2] >= 2) / len(linhas)
    assert abs(recorrentes - 0.31) < 0.01
    assert len({l[0] for l in linhas}) == len(linhas)


def test_curva_abc(gerado):
    pasta, _ = gerado
    ws = openpyxl.load_workbook(pasta / "produtos-curva-abc.xlsx", data_only=True).worksheets[0]
    cab = [c.value for c in ws[1]]
    assert cab == ["#", "REFERÊNCIA", "PRODUTO", "VALOR", "ESTOQUE", "VENDAS", "VALOR TOTAL VENDAS", "HOTSITES",
                   "PORCENTAGEM INDIVIDUAL", "PORCENTAGEM ACUMULADA", "CLASSE"]
    linhas = list(ws.iter_rows(min_row=2, values_only=True))
    assert len(linhas) == 58
    total = sum(l[6] for l in linhas)
    ordenado = sorted(linhas, key=lambda l: -l[6])
    assert [l[6] for l in linhas] == [l[6] for l in ordenado]
    assert abs(sum(l[6] for l in linhas[:3]) / total - 0.51) < 0.015
    classe_a = [l for l in linhas if l[10] == "A"]
    assert len(classe_a) == 9
    assert abs(sum(l[6] for l in classe_a) / total - 0.78) < 0.015
    kits = sum(l[6] for l in linhas if l[2].upper().startswith("KIT "))
    assert abs(kits / total - 0.24) < 0.015
    assert "SÉRUM VITAMINA C" in linhas[0][2].upper()
    assert 0.92 < total / gerado[1]["captada"] < 0.99


def test_ruptura_do_serum_reduz_marco_e_abril(gerado):
    _, t = gerado
    for mes in ("MARÇO", "ABRIL"):
        assert 0.75 <= t["receita_por_mes"][mes] / t["receita_sem_ruptura"][mes] <= 0.81


def test_cac_sobe_ao_longo_do_ano(gerado):
    _, t = gerado
    assert perto(t["cac_por_mes"][0], 48, 0.05)
    assert perto(t["cac_por_mes"][-1], 108, 0.05)


def test_sessoes_pagas_cabem_nas_totais(gerado):
    pasta, _ = gerado
    h = historico(pasta)
    for i, total in enumerate(h["SESSÕES TOTAIS"]):
        assert h["SESSÕES GG"][i] + h["SESSÕES META"][i] < total * 0.75


def test_sazonalidade(gerado):
    _, t = gerado
    media = t["captada"] / 12
    r = t["receita_por_mes"]
    assert 1.7 < r["NOVEMBRO"] / media < 2.0
    assert 1.15 < r["DEZEMBRO"] / media < 1.4
    assert 1.2 < r["MAIO"] / media < 1.45
    assert r["JANEIRO"] / media < 0.85 and r["FEVEREIRO"] / media < 0.85


def test_sem_dado_pessoal(gerado):
    pasta, _ = gerado
    for arquivo in pasta.glob("*.xlsx"):
        wb = openpyxl.load_workbook(arquivo, data_only=True)
        for ws in wb.worksheets:
            for linha in ws.iter_rows(values_only=True):
                for valor in linha:
                    assert not vi.tipos_pii(valor), (arquivo.name, valor)


def test_determinismo(tmp_path):
    a = gerar_dados.gerar(tmp_path / "a")
    b = gerar_dados.gerar(tmp_path / "b")
    assert a == b
