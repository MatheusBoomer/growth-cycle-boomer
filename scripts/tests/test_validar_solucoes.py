from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import validar_solucoes as vs  # noqa: E402


def registro_valido() -> dict:
    return {
        "versao": 1,
        "prospect": "Marca Teste",
        "problemas": [
            {
                "id": "P1",
                "tema": "quebra",
                "titulo": "Quebra 7x acima do mercado",
                "origem": "03 · Taxa de quebra",
                "dado": "36,1% da receita captada não vira caixa (R$ 19,1M/ano)",
                "benchmark": "até 5%",
                "hipoteses": [
                    {"id": "H1", "texto": "Boleto como meio de pagamento"},
                    {"id": "H2", "texto": "Ruptura de estoque"},
                ],
                "solucoes": [
                    {"id": "P1.S1", "acao": "Ativar recuperação automática de PIX e boleto", "hipotese": "H1"},
                    {"id": "P1.S2", "acao": "Checar ruptura de estoque continuamente", "hipotese": "H2"},
                ],
                "impacto": {"tipo": "R$", "valor": "+R$ 16,4M/ano", "calculo": "receita captada × (36,1% − 5%)"},
                "frente": "Eficiência Operacional",
            },
            {
                "id": "P2",
                "tema": "funil",
                "titulo": "Funil sem medição",
                "origem": "03 · Conversão",
                "dado": "GA4 sem eventos de carrinho e checkout",
                "benchmark": "carrinho 6–10%",
                "hipoteses": [{"id": "H1", "texto": "Limiar de dados ativo no GA4"}],
                "solucoes": [{"id": "P2.S1", "acao": "Desativar o limiar de dados no GA4", "hipotese": "H1"}],
                "impacto": {"tipo": "nao_quantificavel", "justificativa": "sem eventos de funil não há base"},
                "frente": "Monitoramento e Governança",
            },
        ],
        "pontos_fortes": [
            {"titulo": "Carrinho → checkout acima do mercado", "dado": "80,56% × 35–40%", "uso": "Problema está nas pontas"}
        ],
    }


def test_registro_valido_passa_com_aviso_do_nao_quantificavel():
    erros, avisos = vs.validar_registro(registro_valido())
    assert erros == []
    assert any("P2" in a and "não quantificado" in a for a in avisos)


@pytest.mark.parametrize(
    "alterar, trecho",
    [
        (lambda r: r["problemas"][0].update(solucoes=[]), "1 a 3 soluções (tem 0)"),
        (lambda r: r["problemas"][0]["solucoes"].extend([
            {"id": "P1.S3", "acao": "a", "hipotese": "H1"},
            {"id": "P1.S4", "acao": "b", "hipotese": "H1"},
        ]), "1 a 3 soluções (tem 4)"),
        (lambda r: r["problemas"][0].update(hipoteses=[]), "pelo menos 1 hipótese"),
        (lambda r: r["problemas"][0]["solucoes"][0].update(hipotese="H9"), "hipótese \"H9\", que não existe"),
        (lambda r: r["problemas"][0].update(frente="CRM"), "frente \"CRM\" inválida"),
        (lambda r: r["problemas"][0]["impacto"].pop("calculo"), "precisa de calculo"),
        (lambda r: r["problemas"][1]["impacto"].pop("justificativa"), "precisa de justificativa"),
        (lambda r: r["problemas"][1].update(id="P1"), "id repetido"),
        (lambda r: r["problemas"][0].update(id="problema-1"), "formato P<n>"),
        (lambda r: r["problemas"][0]["solucoes"][0].update(id="P2.S9"), "precisa começar com P1."),
        (lambda r: r["problemas"][0].update(dado=""), "campo dado obrigatório"),
        (lambda r: r.update(problemas=[]), "lista \"problemas\""),
    ],
)
def test_registro_invalido_aponta_o_problema(alterar, trecho):
    r = copy.deepcopy(registro_valido())
    alterar(r)
    erros, _ = vs.validar_registro(r)
    assert any(trecho in e for e in erros), erros


def test_hipotese_nao_texto_vira_erro_legivel():
    r = registro_valido()
    r["problemas"][0]["solucoes"][0]["hipotese"] = ["H1"]
    erros, _ = vs.validar_registro(r)
    assert any("não existe neste problema" in e for e in erros), erros


def test_hipotese_de_outro_problema_nao_vale():
    # P2 tem H1; P1 só tem H1 e H2. Uma solução do P2 apontando para H2 precisa falhar.
    r = registro_valido()
    r["problemas"][1]["solucoes"][0]["hipotese"] = "H2"
    erros, _ = vs.validar_registro(r)
    assert any("P2" in e and "H2" in e for e in erros), erros


def test_markdown_traz_problema_hipoteses_solucoes_e_impacto():
    md = vs.gerar_markdown(registro_valido())
    assert md.startswith("# Soluções do diagnóstico: Marca Teste\n")
    assert "## P1 · Quebra 7x acima do mercado" in md
    assert "- H2 Ruptura de estoque" in md
    assert "- P1.S1 Ativar recuperação automática de PIX e boleto (hipótese H1)" in md
    assert "**Impacto:** +R$ 16,4M/ano (receita captada × (36,1% − 5%))" in md
    assert "**Impacto:** não quantificável (sem eventos de funil não há base)" in md
    assert "## Pontos fortes" in md
    assert "—" not in md


def test_cli_registro_valido_gera_a_secao(tmp_path, capsys):
    reg = tmp_path / "solucoes.json"
    reg.write_text(json.dumps(registro_valido(), ensure_ascii=False), encoding="utf-8")
    saida = tmp_path / "secoes" / "05-solucoes.md"
    assert vs.main(["--modo", "registro", "--registro", str(reg), "--markdown", str(saida)]) == 0
    assert saida.read_text(encoding="utf-8").startswith("# Soluções do diagnóstico")
    out = capsys.readouterr().out
    assert "AVISO:" in out and "OK: 2 problemas, 3 soluções." in out


def test_cli_registro_invalido_nao_gera_secao(tmp_path, capsys):
    r = registro_valido()
    r["problemas"][0]["solucoes"] = []
    reg = tmp_path / "solucoes.json"
    reg.write_text(json.dumps(r, ensure_ascii=False), encoding="utf-8")
    saida = tmp_path / "05-solucoes.md"
    assert vs.main(["--modo", "registro", "--registro", str(reg), "--markdown", str(saida)]) == 1
    assert not saida.exists()
    assert "ERRO:" in capsys.readouterr().err


@pytest.mark.parametrize("conteudo, trecho", [(None, "não encontrado"), ("{ruim", "não é um JSON válido")])
def test_cli_arquivo_ausente_ou_malformado(tmp_path, capsys, conteudo, trecho):
    reg = tmp_path / "solucoes.json"
    if conteudo is not None:
        reg.write_text(conteudo, encoding="utf-8")
    assert vs.main(["--modo", "registro", "--registro", str(reg)]) == 1
    err = capsys.readouterr().err
    assert err.startswith("ERRO:") and trecho in err and "Traceback" not in err
