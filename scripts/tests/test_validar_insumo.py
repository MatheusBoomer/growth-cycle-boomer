from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import openpyxl
import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
from validar_insumo import validar  # noqa: E402

MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO",
         "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"]


def salvar(caminho: Path, linhas: list[list]) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    for linha in linhas:
        ws.append(linha)
    wb.save(caminho)
    return caminho


@pytest.fixture()
def ambiente(tmp_path: Path):
    modelos = tmp_path / "modelos"
    modelos.mkdir()
    schemas = tmp_path / "schemas.json"
    schemas.write_text((RAIZ / ".claude/skills/_shared/modelos-insumo/schemas.json").read_text(encoding="utf-8"),
                       encoding="utf-8")
    salvar(modelos / "historico-mensal.xlsx", [
        [None, None, "Fórmula", "Preench. Manual", "Preench. Manual"],
        [None, "DATA ", "INVESTIMENTO TOTAL", "INVESTIMENTO META", "SESSOES META"],
    ])
    salvar(modelos / "clientes-historico.xlsx", [["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"]])
    salvar(modelos / "quebra-pagamento.xlsx", [["DATA", "MEIO DE PAGAMENTO", "RECEITA CAPTADA", "RECEITA APROVADA"]])
    return tmp_path, schemas, modelos


def historico(tmp_path: Path, meses: int = 12, vazio_em: str | None = None) -> Path:
    linhas = [
        [None, None, "Fórmula", "Preench. Manual", "Preench. Manual"],
        [None, "DATA", "INVESTIMENTO TOTAL", "INVESTIMENTO META", "SESSOES META"],
    ]
    for mes in MESES[:meses]:
        linhas.append([2025, mes, 100.0, 100.0, None if mes == vazio_em else 500])
    return salvar(tmp_path / "enviado.xlsx", linhas)


def test_historico_completo(ambiente):
    tmp, schemas, modelos = ambiente
    r = validar("historico-mensal", historico(tmp), schemas, modelos)
    assert r["ok"] is True, r
    assert r["resumo"] == "12 meses (JANEIRO a DEZEMBRO)"


def test_historico_faltando_meses(ambiente):
    tmp, schemas, modelos = ambiente
    r = validar("historico-mensal", historico(tmp, meses=10), schemas, modelos)
    assert r["ok"] is False
    assert "Esperados 12 meses, encontrados 10." in r["problemas"]


def test_historico_coluna_manual_vazia(ambiente):
    tmp, schemas, modelos = ambiente
    r = validar("historico-mensal", historico(tmp, vazio_em="MARÇO"), schemas, modelos)
    assert "Coluna “SESSOES META” vazia em MARÇO." in r["problemas"]


def test_coluna_do_modelo_ausente(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "e.xlsx", [["x"], [None, "DATA", "INVESTIMENTO TOTAL", "INVESTIMENTO META"]] +
                     [[2025, m, 1, 1] for m in MESES])
    r = validar("historico-mensal", arquivo, schemas, modelos)
    assert any("SESSOES META" in p and "não encontrada" in p for p in r["problemas"])


def test_clientes_com_email_nao_vaza_valor(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"],
        [1, "Ana Souza", 2, 300.0],
        [2, "bruno@exemplo.com", 1, 90.0],
    ])
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert r["ok"] is False
    texto = " ".join(r["problemas"])
    assert "e-mail" in texto and "linha 3" in texto
    assert "bruno@exemplo.com" not in texto


def test_cabecalho_de_dado_pessoal(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)", "CPF"],
        [1, "Ana", 2, 300.0, None],
    ])
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert any("“CPF”" in p for p in r["problemas"])


def test_sem_modelo_usa_schema_e_avisa(ambiente):
    tmp, schemas, modelos = ambiente
    (modelos / "clientes-historico.xlsx").unlink()
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"],
        [1, "Ana", 2, 300.0],
    ])
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert r["ok"] is True
    assert r["resumo"] == "1 linha de dados"
    assert r["avisos"]


def test_arquivo_que_nao_e_excel(ambiente):
    tmp, schemas, modelos = ambiente
    falso = tmp / "falso.xlsx"
    falso.write_text("isto não é excel", encoding="utf-8")
    r = validar("clientes-historico", falso, schemas, modelos)
    assert r["ok"] is False
    assert "Não consegui abrir" in r["problemas"][0]


def test_cli_imprime_json(ambiente):
    tmp, schemas, modelos = ambiente
    saida = subprocess.run(
        [sys.executable, str(RAIZ / "scripts/validar_insumo.py"), "--insumo", "historico-mensal",
         "--arquivo", str(historico(tmp)), "--schemas", str(schemas), "--modelos", str(modelos)],
        capture_output=True, text=True, check=True,
    )
    assert json.loads(saida.stdout)["ok"] is True


def test_clientes_com_cpf_e_telefone_numericos(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)", "Documento", "Contato"],
        [1, "Ana", 2, 300.0, 12345678909, 11987654321],
    ])
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert r["ok"] is False
    texto = " ".join(r["problemas"])
    assert "CPF" in texto and "“Documento”" in texto
    assert "telefone" in texto and "“Contato”" in texto
    assert "12345678909" not in texto


def test_clientes_com_email_em_outra_aba(ambiente):
    tmp, schemas, modelos = ambiente
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"])
    ws.append([1, "Ana", 2, 300.0])
    extra = wb.create_sheet("Contatos")
    extra.append(["cliente", "contato"])
    extra.append([1, "ana@exemplo.com"])
    arquivo = tmp / "c.xlsx"
    wb.save(arquivo)
    r = validar("clientes-historico", arquivo, schemas, modelos)
    assert r["ok"] is False
    assert any("e-mail" in p and "Contatos" in p for p in r["problemas"])


def test_valores_monetarios_nao_viram_pii(ambiente):
    tmp, schemas, modelos = ambiente
    arquivo = salvar(tmp / "c.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"],
        [1234567, "Ana", 2, 12345678.9],
        [2, "Bia", 1, 99.0],
    ])
    assert validar("clientes-historico", arquivo, schemas, modelos)["ok"] is True


def test_quebra_pagamento_exige_as_colunas(ambiente):
    tmp_path, schemas, modelos = ambiente
    ok = salvar(tmp_path / "ok.xlsx", [
        ["DATA", "MEIO DE PAGAMENTO", "RECEITA CAPTADA", "RECEITA APROVADA"],
        ["JANEIRO", "PIX", 1000.0, 700.0],
    ])
    assert validar("quebra-pagamento", ok, schemas, modelos)["ok"] is True
    ruim = salvar(tmp_path / "ruim.xlsx", [["DATA", "RECEITA CAPTADA"], ["JANEIRO", 1000.0]])
    r = validar("quebra-pagamento", ruim, schemas, modelos)
    assert r["ok"] is False
    assert any("MEIO DE PAGAMENTO" in p for p in r["problemas"]), r["problemas"]
