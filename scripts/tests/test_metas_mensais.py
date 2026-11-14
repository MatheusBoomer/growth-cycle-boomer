from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl
import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import metas_mensais as m  # noqa: E402
from plano_acao_comum import ErroPlano  # noqa: E402

PROJECAO = (
    RAIZ / "clientes" / "_fixtures" / "verdeluz" / "base" / "entrega"
    / "ativos-aprovados" / "projecao" / "projecao-de-cenarios.xlsx"
)
ROTULOS = ["Nov/26", "Dez/26", "Jan/27"]
CHECKS = ["02/12/2026", "30/12/2026", "05/02/2027"]
ABA = {"Realista": "Meta", "Pessimista": "Pessimista", "Otimista": "Otimista"}


def _entradas(cenario: str, linha: int):
    ws = openpyxl.load_workbook(PROJECAO, data_only=False)[ABA[cenario]]
    return [ws.cell(row=linha, column=col).value for col in range(2, 7)]


def _br(valor: float, casas: int) -> str:
    """Formato pt-BR 1.234,56 montado por outro caminho que o da implementação (separador '_')."""
    return f"{valor:_.{casas}f}".replace(".", ",").replace("_", ".")


def _receita(cenario: str, linha: int) -> float:
    b, c, d, e, f = _entradas(cenario, linha)
    return b / e / f * d * c


def test_receita_do_mes_1_segue_a_cadeia_de_formulas():
    meses = m.calcular_meses(PROJECAO, "Realista", 3)
    assert len(meses) == 3
    assert meses[0]["mes_indice"] == 1
    assert meses[0]["receita"] == pytest.approx(_receita("Realista", 2))
    assert meses[2]["receita"] == pytest.approx(_receita("Realista", 4))


def test_demais_campos_do_mes_1():
    b, c, d, e, f = _entradas("Realista", 2)
    mes = m.calcular_meses(PROJECAO, "Realista", 1)[0]
    assert (mes["investimento"], mes["ticket"], mes["conversao"], mes["cps"], mes["pct_pagas"]) == (b, c, d, e, f)
    assert mes["sessoes"] == pytest.approx(b / e / f)
    assert mes["vendas"] == pytest.approx(b / e / f * d)


@pytest.mark.parametrize("cenario", ["Pessimista", "Otimista"])
def test_cenarios_pessimista_e_otimista_leem_a_aba_de_mesmo_nome(cenario):
    mes = m.calcular_meses(PROJECAO, cenario, 2)[1]
    assert mes["receita"] == pytest.approx(_receita(cenario, 3))


def test_nao_depende_do_valor_em_cache_das_formulas(tmp_path):
    wb = openpyxl.load_workbook(PROJECAO)
    destino = tmp_path / "projecao.xlsx"
    wb.save(destino)  # salvar com openpyxl descarta os valores em cache das fórmulas
    mes = m.calcular_meses(destino, "Realista", 1)[0]
    assert mes["receita"] == pytest.approx(_receita("Realista", 2))


def test_treze_meses_falha_porque_a_projecao_tem_doze():
    with pytest.raises(ErroPlano, match="A projeção tem 12 meses"):
        m.calcular_meses(PROJECAO, "Realista", 13)


def test_cenario_inexistente_falha():
    with pytest.raises(ErroPlano, match="Cenário"):
        m.calcular_meses(PROJECAO, "Catastrófico", 3)


def test_zero_meses_falha():
    with pytest.raises(ErroPlano):
        m.calcular_meses(PROJECAO, "Realista", 0)


def test_montar_bloco_formata_e_soma():
    meses = m.calcular_meses(PROJECAO, "Realista", 3)
    bloco = m.montar_bloco(meses, ROTULOS, CHECKS, "Realista")
    assert bloco["cenario"] == "Realista"
    assert bloco["observacao"] is None
    assert bloco["colunas"] == [
        "Mês", "Check em", "Receita (R$)", "Invest. (R$)", "Ticket (R$)",
        "Conv.", "CPS (R$)", "% pagas", "Sessões", "Vendas",
    ]
    assert len(bloco["linhas"]) == 4
    assert all(len(l) == len(bloco["colunas"]) for l in bloco["linhas"])
    assert all(isinstance(c, str) for l in bloco["linhas"] for c in l)

    b, c, d, e, f = _entradas("Realista", 2)
    primeira = bloco["linhas"][0]
    assert primeira[0] == "Nov/26" and primeira[1] == "02/12/2026"
    assert primeira[2] == _br(_receita("Realista", 2), 0)
    assert primeira[3] == _br(b, 0)
    assert primeira[4] == _br(c, 2)
    assert primeira[5] == _br(d * 100, 2) + "%"
    assert primeira[6] == _br(e, 2)
    assert primeira[7] == f"{round(f * 100)}%"
    assert primeira[8] == _br(b / e / f, 0)
    assert primeira[9] == _br(b / e / f * d, 0)

    total = bloco["linhas"][3]
    assert total[0] == "3 meses"
    soma_receita = sum(_receita("Realista", r) for r in (2, 3, 4))
    soma_invest = sum(_entradas("Realista", r)[0] for r in (2, 3, 4))
    soma_sessoes = sum(_entradas("Realista", r)[0] / _entradas("Realista", r)[3] / _entradas("Realista", r)[4] for r in (2, 3, 4))
    assert total[2] == _br(soma_receita, 0)
    assert total[3] == _br(soma_invest, 0)
    assert total[8] == _br(soma_sessoes, 0)


def test_conversao_com_duas_casas_e_milhar_com_ponto():
    meses = m.calcular_meses(PROJECAO, "Realista", 3)
    meses[0]["conversao"] = 0.0034
    meses[1]["conversao"] = 0.0156
    meses[1]["pct_pagas"] = 0.951
    meses[0]["receita"] = 1234567.891
    meses[0]["ticket"] = 1234.5
    bloco = m.montar_bloco(meses, ROTULOS, CHECKS, "Realista")
    assert bloco["linhas"][0][5] == "0,34%"
    assert bloco["linhas"][1][5] == "1,56%"
    assert bloco["linhas"][1][7] == "95,1%"
    assert bloco["linhas"][0][2] == "1.234.568"
    assert bloco["linhas"][0][4] == "1.234,50"
    for linha in bloco["linhas"]:  # nenhuma célula fica com 4 dígitos seguidos (milhar sem ponto)
        assert not any(re.search(r"\d{4}", celula) for celula in linha[2:] if not celula.endswith("%"))


def test_montar_bloco_exige_um_rotulo_e_um_check_por_mes():
    meses = m.calcular_meses(PROJECAO, "Realista", 3)
    with pytest.raises(ErroPlano, match="rótulos"):
        m.montar_bloco(meses, ROTULOS[:2], CHECKS, "Realista")
    with pytest.raises(ErroPlano, match="checks"):
        m.montar_bloco(meses, ROTULOS, CHECKS[:1], "Realista")


def _plano(tmp_path) -> Path:
    p = tmp_path / "plano.json"
    p.write_text(json.dumps({"abertura": {"titulo": "x"}, "outra": [1, 2]}, ensure_ascii=False), encoding="utf-8")
    return p


def _args(plano, **extra):
    a = {
        "--plano": str(plano), "--projecao": str(PROJECAO), "--cenario": "Realista", "--meses": "3",
        "--rotulos": ",".join(ROTULOS), "--checks": ",".join(CHECKS),
    }
    a.update(extra)
    return [x for par in a.items() for x in par]


def test_cli_grava_o_bloco_e_preserva_as_outras_chaves(tmp_path, capsys):
    plano = _plano(tmp_path)
    assert m.main(_args(plano)) == 0
    assert capsys.readouterr().out.strip() == "OK"
    dados = json.loads(plano.read_text(encoding="utf-8"))
    assert dados["abertura"] == {"titulo": "x"} and dados["outra"] == [1, 2]
    assert dados["metas_mensais"]["cenario"] == "Realista"
    assert len(dados["metas_mensais"]["linhas"]) == 4
    assert list(tmp_path.iterdir()) == [plano]  # sem temporário sobrando


def test_cli_passa_no_validador_do_plano(tmp_path):
    import validar_plano_acao as v

    plano = _plano(tmp_path)
    m.main(_args(plano))
    erros: list[str] = []
    bloco = json.loads(plano.read_text(encoding="utf-8"))["metas_mensais"]
    assert v._validar_tabela(bloco, "metas_mensais", erros) is True
    assert erros == []


@pytest.mark.parametrize("extra, trecho", [
    ({"--meses": "13"}, "A projeção tem 12 meses"),
    ({"--cenario": "Catastrófico"}, "Cenário"),
    ({"--rotulos": "Nov/26,Dez/26"}, "rótulos"),
    ({"--meses": "tres"}, "meses"),
])
def test_cli_falha_com_erro_em_portugues_e_nao_altera_o_json(tmp_path, capsys, extra, trecho):
    plano = _plano(tmp_path)
    antes = plano.read_bytes()
    assert m.main(_args(plano, **extra)) == 1
    captura = capsys.readouterr()
    assert captura.err.startswith("ERRO:") and trecho in captura.err
    assert captura.out == ""
    assert plano.read_bytes() == antes
    assert list(tmp_path.iterdir()) == [plano]


def test_cli_falha_com_projecao_ou_plano_inexistentes(tmp_path, capsys):
    assert m.main(_args(tmp_path / "nao-existe.json")) == 1
    assert capsys.readouterr().err.startswith("ERRO:")
    plano = _plano(tmp_path)
    assert m.main(_args(plano, **{"--projecao": str(tmp_path / "nada.xlsx")})) == 1
    assert capsys.readouterr().err.startswith("ERRO:")
