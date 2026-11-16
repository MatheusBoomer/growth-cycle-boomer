"""Testes do gerador do PDF do documento de validação (scripts/gerar_documento_validacao.py).

Todos os dados são inventados. Os gráficos são PNGs criados com Pillow em tmp_path.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import gerar_documento_validacao as gdv  # noqa: E402


# ---------- apoio ----------

def _png(caminho: Path, largura: int = 1600, altura: int = 900) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (largura, altura), "white")
    ImageDraw.Draw(img).line([(80, altura - 80), (largura - 80, 120)], fill=(30, 90, 200), width=6)
    img.save(caminho)


def _prospect(tmp_path: Path, nomes: list[str]) -> Path:
    pasta = tmp_path / "clientes" / "ficticio"
    for nome in nomes:
        _png(pasta / "entrega" / "ativos-aprovados" / "graficos" / nome)
    return pasta


def _dados(arquivos: list[str], **extra) -> dict:
    dados = {
        "prospect": "Loja Ficticia Ltda",
        "periodo": "Janeiro/2026 a Dezembro/2026",
        "secoes": [
            {
                "titulo": "Receita e investimento",
                "graficos": [
                    {"arquivo": a, "observacao": f"O mês {i} aparece como pico, confirme se está correto."}
                    for i, a in enumerate(arquivos, start=1)
                ],
            }
        ],
        "limitacoes": {
            "titulo": "Ausência do Google Analytics e limitações",
            "itens": [{"titulo": "Sem sessões totais", "texto": "a taxa de conversão total não está disponível."}],
        },
    }
    dados.update(extra)
    return dados


def _textos_pdf(pdf: bytes) -> str:
    """Junta os textos desenhados no PDF (sem compressão) para as asserções."""
    bruto = pdf.decode("latin-1")
    partes: list[str] = []
    for m in re.finditer(r"\(((?:\\.|[^\\()])*)\)\s*Tj", bruto):
        s = m.group(1)
        s = re.sub(r"\\([0-7]{1,3})", lambda o: chr(int(o.group(1), 8)), s)
        s = re.sub(r"\\(.)", r"\1", s)
        partes.append(s.encode("latin-1").decode("cp1252"))
    return "\n".join(partes)


def _paginas(pdf: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page\b", pdf))


def _gerar(dados: dict, pasta: Path, saida: Path) -> bytes:
    gdv.gerar(dados, pasta, saida, _comprimir=False)
    return saida.read_bytes()


# ---------- testes ----------

def test_gera_pdf_valido(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    saida = tmp_path / "out" / "doc.pdf"
    pdf = _gerar(_dados(["a.png"]), pasta, saida)
    assert pdf.startswith(b"%PDF")
    texto = _textos_pdf(pdf)
    assert "Loja Ficticia Ltda" in texto
    assert "Observação" in texto
    assert "Página 1 de" in texto
    assert "AUSÊNCIA DO GOOGLE ANALYTICS E LIMITAÇÕES" in texto
    assert "Confirme os dados antes da apresentação" in texto


def test_observacao_e_opcional(tmp_path):
    pasta = _prospect(tmp_path, ["a.png", "b.png"])
    dados = _dados(["a.png", "b.png"])
    dados["secoes"][0]["graficos"][0]["observacao"] = None
    dados["secoes"][0]["graficos"][1]["observacao"] = ""
    saida = tmp_path / "doc.pdf"
    pdf = _gerar(dados, pasta, saida)
    assert pdf.startswith(b"%PDF")
    assert "Observação" not in _textos_pdf(pdf)


def test_secao_sem_grafico_e_omitida(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    dados = _dados(["a.png"])
    dados["secoes"].append({"titulo": "Secao Vazia Unica", "graficos": []})
    pdf = _gerar(dados, pasta, tmp_path / "doc.pdf")
    texto = _textos_pdf(pdf).upper()
    assert "SECAO VAZIA UNICA" not in texto
    assert "RECEITA E INVESTIMENTO" in texto


def test_limitacoes_nulas_omite_o_bloco(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    pdf = _gerar(_dados(["a.png"], limitacoes=None), pasta, tmp_path / "doc.pdf")
    texto = _textos_pdf(pdf)
    assert "LIMITAÇÕES" not in texto
    assert "Confirme os dados antes da apresentação" in texto


def test_grafico_inexistente_vira_erro_e_nao_deixa_pdf(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    saida = tmp_path / "out" / "doc.pdf"
    with pytest.raises(gdv.ErroDocumento) as exc:
        gdv.gerar(_dados(["a.png", "nao-existe.png"]), pasta, saida)
    assert "nao-existe.png" in str(exc.value)
    assert not saida.exists()
    assert not list((tmp_path / "out").glob("*")) if (tmp_path / "out").exists() else True


@pytest.mark.parametrize("nome", ["../fora.png", "sub/a.png", "..", "a\\b.png"])
def test_arquivo_com_caminho_e_recusado(tmp_path, nome):
    pasta = _prospect(tmp_path, ["a.png"])
    with pytest.raises(gdv.ErroDocumento):
        gdv.validar_entrada(_dados([nome]), pasta)


@pytest.mark.parametrize("texto", ["cliente@x.com", "123.456.789-09", "12345678909", "(11) 91234-5678"])
def test_observacao_com_email_cpf_ou_telefone_vira_erro(tmp_path, texto):
    pasta = _prospect(tmp_path, ["a.png"])
    dados = _dados(["a.png"])
    dados["secoes"][0]["graficos"][0]["observacao"] = f"Contato {texto} aparece."
    saida = tmp_path / "doc.pdf"
    with pytest.raises(gdv.ErroDocumento):
        gdv.gerar(dados, pasta, saida)
    assert not saida.exists()


def test_observacao_comum_com_numeros_e_aceita(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    dados = _dados(["a.png"])
    dados["secoes"][0]["graficos"][0]["observacao"] = "R$ 460.703 · 81.2% da receita"
    gdv.validar_entrada(dados, pasta)


def test_campos_obrigatorios_e_secoes_nao_lista(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    sem_prospect = _dados(["a.png"])
    del sem_prospect["prospect"]
    with pytest.raises(gdv.ErroDocumento):
        gdv.validar_entrada(sem_prospect, pasta)
    with pytest.raises(gdv.ErroDocumento):
        gdv.validar_entrada(_dados(["a.png"], periodo=""), pasta)
    with pytest.raises(gdv.ErroDocumento):
        gdv.validar_entrada(_dados(["a.png"], secoes="não é lista"), pasta)
    with pytest.raises(gdv.ErroDocumento):
        gdv.validar_entrada(_dados(["a.png"], secoes=[{"titulo": "X", "graficos": []}]), pasta)


def test_caractere_fora_da_fonte_vira_erro(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    dados = _dados(["a.png"])
    dados["secoes"][0]["graficos"][0]["observacao"] = "Subiu \U0001F680 muito."
    with pytest.raises(gdv.ErroDocumento):
        gdv.validar_entrada(dados, pasta)


def test_texto_com_marcacao_nao_quebra(tmp_path):
    pasta = _prospect(tmp_path, ["a.png"])
    dados = _dados(["a.png"])
    dados["secoes"][0]["graficos"][0]["observacao"] = "Vendas <b>caíram & voltaram</b> em março."
    pdf = _gerar(dados, pasta, tmp_path / "doc.pdf")
    # o reportlab quebra o texto em pedaços nos sinais < e >, então comparo sem espaços
    plano = re.sub(r"\s+", "", _textos_pdf(pdf))
    assert "<b>caíram&voltaram</b>" in plano


def test_muitos_graficos_geram_varias_paginas_com_total_correto(tmp_path):
    nomes = [f"g{i}.png" for i in range(8)]
    pasta = _prospect(tmp_path, nomes)
    pdf = _gerar(_dados(nomes), pasta, tmp_path / "doc.pdf")
    total = _paginas(pdf)
    assert total >= 3
    rodapes = re.findall(r"Página (\d+) de (\d+)", _textos_pdf(pdf))
    assert [int(n) for n, _ in rodapes] == list(range(1, total + 1))
    assert {int(m) for _, m in rodapes} == {total}


def test_main_devolve_0_e_gera_o_arquivo(tmp_path, capsys):
    pasta = _prospect(tmp_path, ["a.png"])
    entrada = tmp_path / "entrada.json"
    entrada.write_text(json.dumps(_dados(["a.png"])), encoding="utf-8")
    saida = tmp_path / "rascunhos" / "documento-validacao.pdf"
    codigo = gdv.main(["--input", str(entrada), "--pasta-prospect", str(pasta), "--output", str(saida)])
    assert codigo == 0
    assert saida.read_bytes().startswith(b"%PDF")


def test_main_devolve_1_e_mensagem_em_portugues_com_json_invalido(tmp_path, capsys):
    pasta = _prospect(tmp_path, ["a.png"])
    entrada = tmp_path / "entrada.json"
    entrada.write_text("{isto nao e json", encoding="utf-8")
    saida = tmp_path / "doc.pdf"
    codigo = gdv.main(["--input", str(entrada), "--pasta-prospect", str(pasta), "--output", str(saida)])
    err = capsys.readouterr().err
    assert codigo == 1
    assert "JSON" in err and "inválido" in err
    assert not saida.exists()


def test_main_devolve_1_com_grafico_faltando(tmp_path, capsys):
    pasta = _prospect(tmp_path, ["a.png"])
    entrada = tmp_path / "entrada.json"
    entrada.write_text(json.dumps(_dados(["faltou.png"])), encoding="utf-8")
    saida = tmp_path / "doc.pdf"
    codigo = gdv.main(["--input", str(entrada), "--pasta-prospect", str(pasta), "--output", str(saida)])
    assert codigo == 1
    assert "faltou.png" in capsys.readouterr().err
    assert not saida.exists()
