from __future__ import annotations

import copy
import json
import re
import sys
import zipfile
from datetime import date, datetime
from pathlib import Path
from xml.dom.minidom import parseString

import openpyxl
import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import plano_acao_comum as c  # noqa: E402
import plano_v2_exemplo as ex  # noqa: E402
import gerar_plano_acao as g  # noqa: E402
from plano_acao_docx import MODELO_DOCX_PADRAO  # noqa: E402


def _entradas(tmp_path, plano=None, registro=None):
    p = tmp_path / "plano.json"
    r = tmp_path / "solucoes.json"
    p.write_text(json.dumps(plano or ex.plano_valido(), ensure_ascii=False), encoding="utf-8")
    r.write_text(json.dumps(registro or ex.registro_valido(), ensure_ascii=False), encoding="utf-8")
    return p, r


def _rodar(tmp_path, capsys, plano=None, registro=None, extra=(), saida_docx=None, saida_xlsx=None):
    p, r = _entradas(tmp_path, plano, registro)
    docx = saida_docx or tmp_path / "out" / "plano-de-acao-estrategico.docx"
    xlsx = saida_xlsx or tmp_path / "out" / "plano-de-acao-estrategico.xlsx"
    codigo = g.main(["--plano", str(p), "--registro", str(r),
                     "--saida-docx", str(docx), "--saida-xlsx", str(xlsx), *extra])
    cap = capsys.readouterr()
    return codigo, cap, docx, xlsx


def _paragrafos_docx(docx: Path) -> list[str]:
    with zipfile.ZipFile(docx) as z:
        dom = parseString(z.read("word/document.xml"))
    return ["".join(t.firstChild.data if t.firstChild else "" for t in p.getElementsByTagName("w:t"))
            for p in dom.getElementsByTagName("w:p")]


def _conjunto_docx(docx: Path) -> set:
    ps = _paragrafos_docx(docx)
    saida = set()
    for i, p in enumerate(ps):
        m = re.match(r"^AÇÃO (\d+): (.*)$", p)
        if not m:
            continue
        campos = {}
        for q in ps[i + 1:i + 12]:
            rotulo, _, valor = q.partition(":")
            campos[rotulo] = valor.strip()
        inicio, _, entrega = campos["INÍCIO E ENTREGA"].partition(" a ")
        saida.add((int(m.group(1)), m.group(2), inicio, entrega, campos["DONO"], campos["KPI E META"]))
    return saida


def _fmt(v) -> str:
    if isinstance(v, (datetime, date)):
        return v.strftime("%d/%m/%Y")
    return v


def _conjunto_xlsx(xlsx: Path) -> set:
    ws = openpyxl.load_workbook(xlsx)["Plano de Ação"]
    saida = set()
    for linha in ws.iter_rows(min_row=2, values_only=True):
        if linha[0] is None:
            continue
        saida.add((linha[0], linha[3], _fmt(linha[8]), _fmt(linha[9]), linha[7], linha[12]))
    return saida


def test_docx_e_xlsx_iguais(tmp_path, capsys):
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys)
    assert codigo == 0, cap.err
    esperado = {(a["numero"], a["acao"], a["inicio"], a["entrega"], a["dono"], a["kpi_meta"])
                for _, a in c.acoes(ex.plano_valido())}
    assert len(esperado) == 6
    assert _conjunto_docx(docx) == esperado
    assert _conjunto_xlsx(xlsx) == esperado
    assert "OK: .docx e .xlsx gerados com 6 ações." in cap.out
    assert cap.err == ""


def test_erro_nao_gera_nada(tmp_path, capsys):
    plano = ex.plano_valido()
    plano["horizontes"][0]["acoes"][0]["como"] = ""
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys, plano=plano)
    assert codigo == 1
    assert "ERRO:" in cap.err
    assert not docx.exists() and not xlsx.exists()
    assert (list((tmp_path / "out").glob("*")) == []) if (tmp_path / "out").exists() else True


def test_falha_no_xlsx_nao_deixa_docx(tmp_path, capsys):
    modelo = tmp_path / "modelo.xlsx"
    wb = openpyxl.Workbook()
    wb.active.title = "Outra"
    wb.save(modelo)
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys, extra=("--modelo-xlsx", str(modelo)))
    assert codigo == 1
    assert 'precisa das abas' in cap.err and "Traceback" not in cap.err
    assert not docx.exists() and not xlsx.exists()
    if (tmp_path / "out").exists():
        assert list((tmp_path / "out").iterdir()) == []


def test_caractere_ilegal_no_texto_gera_os_dois_arquivos(tmp_path, capsys):
    plano = ex.plano_valido()
    plano["horizontes"][0]["acoes"][0]["como"] = "passo 1\x0b passo 2"
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys, plano=plano)
    assert codigo == 0, cap.err
    assert docx.exists() and xlsx.exists()


def test_illegal_character_error_vira_erro_amigavel(tmp_path, capsys, monkeypatch):
    from openpyxl.utils.exceptions import IllegalCharacterError

    def quebrar(*args, **kwargs):
        raise IllegalCharacterError("\x0b")

    monkeypatch.setattr(g, "gerar_xlsx", quebrar)
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys)
    assert codigo == 1
    assert cap.err.startswith("ERRO:") and "Traceback" not in cap.err
    assert not docx.exists() and not xlsx.exists()


def test_falha_nao_apaga_arquivos_finais_existentes(tmp_path, capsys):
    (tmp_path / "out").mkdir()
    docx = tmp_path / "out" / "plano-de-acao-estrategico.docx"
    docx.write_bytes(b"antigo")
    modelo = tmp_path / "modelo.xlsx"
    wb = openpyxl.Workbook()
    wb.active.title = "Outra"
    wb.save(modelo)
    codigo, _, _, _ = _rodar(tmp_path, capsys, extra=("--modelo-xlsx", str(modelo)))
    assert codigo == 1
    assert docx.read_bytes() == b"antigo"
    assert [f.name for f in (tmp_path / "out").iterdir()] == [docx.name]


def test_nao_menciona_garantia(tmp_path, capsys):
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys)
    assert codigo == 0
    assert "garantia" not in "\n".join(_paragrafos_docx(docx)).lower()
    ws = openpyxl.load_workbook(xlsx)
    celulas = " ".join(str(cel.value) for aba in ws for linha in aba.iter_rows() for cel in linha
                       if cel.value is not None)
    assert "garantia" not in celulas.lower()


def test_avisos_vao_para_stdout_antes_do_ok(tmp_path, capsys):
    plano = ex.plano_valido()
    # todo AVISO do validador sai em stdout, antes da linha OK, sem nada a mais
    erros, avisos = g.validar(copy.deepcopy(plano), ex.registro_valido(), rascunho=False)
    assert erros == []
    codigo, cap, _, _ = _rodar(tmp_path, capsys, plano=plano)
    assert codigo == 0
    linhas = cap.out.strip().splitlines()
    assert linhas[-1].startswith("OK:")
    assert all(l.startswith("AVISO:") for l in linhas[:-1])
    assert len(linhas) - 1 == len(avisos)


def test_json_invalido_e_arquivo_ausente_sem_traceback(tmp_path, capsys):
    p, r = _entradas(tmp_path)
    p.write_text("{nao é json", encoding="utf-8")
    saidas = ["--saida-docx", str(tmp_path / "a.docx"), "--saida-xlsx", str(tmp_path / "a.xlsx")]
    assert g.main(["--plano", str(p), "--registro", str(r), *saidas]) == 1
    err = capsys.readouterr().err
    assert err.startswith("ERRO:") and "Traceback" not in err
    assert g.main(["--plano", str(tmp_path / "nao-existe.json"), "--registro", str(r), *saidas]) == 1
    assert "ERRO:" in capsys.readouterr().err
    assert not (tmp_path / "a.docx").exists() and not (tmp_path / "a.xlsx").exists()


def test_modelo_docx_ausente_vira_erro(tmp_path, capsys):
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys, extra=("--modelo-docx", str(tmp_path / "x.docx")))
    assert codigo == 1
    assert "ERRO:" in cap.err and "Traceback" not in cap.err
    assert not docx.exists() and not xlsx.exists()


def test_recusa_saida_igual_ao_modelo_docx(tmp_path, capsys):
    modelo = tmp_path / "modelo.docx"
    modelo.write_bytes(MODELO_DOCX_PADRAO.read_bytes())
    original = modelo.read_bytes()
    codigo, cap, _, xlsx = _rodar(tmp_path, capsys, saida_docx=modelo,
                                  extra=("--modelo-docx", str(modelo)))
    assert codigo == 1
    assert "ERRO:" in cap.err and "modelo" in cap.err
    assert modelo.read_bytes() == original
    assert not xlsx.exists()


def test_recusa_saida_igual_ao_modelo_xlsx_mesmo_por_caminho_relativo(tmp_path, capsys):
    modelo = tmp_path / "modelo.xlsx"
    wb = openpyxl.Workbook()
    wb.active.title = "Plano de Ação"
    wb.create_sheet("Metas do plano")
    wb.save(modelo)
    original = modelo.read_bytes()
    alias = tmp_path / "out" / ".." / "modelo.xlsx"
    (tmp_path / "out").mkdir()
    codigo, cap, docx, _ = _rodar(tmp_path, capsys, saida_xlsx=alias, extra=("--modelo-xlsx", str(modelo)))
    assert codigo == 1
    assert "ERRO:" in cap.err
    assert modelo.read_bytes() == original
    assert not docx.exists()


def test_recusa_saida_docx_igual_saida_xlsx(tmp_path, capsys):
    mesmo = tmp_path / "out" / "plano.bin"
    codigo, cap, _, _ = _rodar(tmp_path, capsys, saida_docx=mesmo, saida_xlsx=mesmo)
    assert codigo == 1
    assert "ERRO:" in cap.err
    assert not mesmo.exists()


def test_gerar_devolve_resumo_e_avisos(tmp_path):
    docx, xlsx = tmp_path / "a.docx", tmp_path / "a.xlsx"
    r = g.gerar(ex.plano_valido(), ex.registro_valido(), docx, xlsx)
    assert r["total_acoes"] == 6
    assert r["docx"] == str(docx) and r["xlsx"] == str(xlsx)
    assert isinstance(r["avisos"], list)
    assert docx.exists() and xlsx.exists()
    assert [f.name for f in tmp_path.iterdir()] == ["a.docx", "a.xlsx"]


def test_gerar_com_erro_levanta_erro_validacao(tmp_path):
    plano = ex.plano_valido()
    plano["horizontes"][0]["acoes"][0]["como"] = ""
    with pytest.raises(g.ErroValidacao) as e:
        g.gerar(plano, ex.registro_valido(), tmp_path / "a.docx", tmp_path / "a.xlsx")
    assert e.value.erros
    assert list(tmp_path.iterdir()) == []


def test_arquivos_finais_seguem_o_umask(tmp_path):
    import os
    docx, xlsx = tmp_path / "a.docx", tmp_path / "a.xlsx"
    g.gerar(ex.plano_valido(), ex.registro_valido(), docx, xlsx)
    umask = os.umask(0)
    os.umask(umask)
    esperado = 0o666 & ~umask
    assert docx.stat().st_mode & 0o777 == esperado
    assert xlsx.stat().st_mode & 0o777 == esperado


def test_recusa_saida_igual_ao_modelo_do_outro_tipo(tmp_path, capsys):
    # saída .xlsx apontando para o modelo .docx
    modelo = tmp_path / "modelo.docx"
    modelo.write_bytes(MODELO_DOCX_PADRAO.read_bytes())
    original = modelo.read_bytes()
    codigo, cap, docx, _ = _rodar(tmp_path, capsys, saida_xlsx=modelo, extra=("--modelo-docx", str(modelo)))
    assert codigo == 1
    assert "ERRO:" in cap.err
    assert modelo.read_bytes() == original
    assert not docx.exists()


def test_recusa_saida_igual_ao_plano_ou_registro(tmp_path, capsys):
    p, r = _entradas(tmp_path)
    original = p.read_bytes()
    codigo = g.main(["--plano", str(p), "--registro", str(r),
                     "--saida-docx", str(p), "--saida-xlsx", str(tmp_path / "a.xlsx")])
    err = capsys.readouterr().err
    assert codigo == 1 and "ERRO:" in err and "entrada" in err
    assert p.read_bytes() == original
    assert not (tmp_path / "a.xlsx").exists()


def test_mensagem_sem_modelo_xlsx_nao_diz_none(tmp_path, monkeypatch):
    def quebra(plano, saida, modelo=None):
        raise OSError("disco cheio")
    monkeypatch.setattr(g, "gerar_xlsx", quebra)
    with pytest.raises(c.ErroPlano) as e:
        g.gerar(ex.plano_valido(), ex.registro_valido(), tmp_path / "a.docx", tmp_path / "a.xlsx")
    assert "None" not in str(e.value) and "disco cheio" in str(e.value)
    assert list(tmp_path.iterdir()) == []


def test_saida_json_igual_a_entrada(tmp_path, capsys):
    saida = tmp_path / "out" / "plano-de-acao-estrategico.json"
    codigo, _, docx, xlsx = _rodar(tmp_path, capsys, extra=("--saida-json", str(saida)))
    assert codigo == 0
    assert docx.exists() and xlsx.exists()
    texto = saida.read_text(encoding="utf-8")
    assert json.loads(texto) == ex.plano_valido()
    assert texto == json.dumps(ex.plano_valido(), ensure_ascii=False, indent=2) + "\n"


def test_saida_json_segue_o_umask(tmp_path):
    import os
    docx, xlsx, js = tmp_path / "a.docx", tmp_path / "a.xlsx", tmp_path / "a.json"
    g.gerar(ex.plano_valido(), ex.registro_valido(), docx, xlsx, saida_json=js)
    umask = os.umask(0)
    os.umask(umask)
    assert js.stat().st_mode & 0o777 == 0o666 & ~umask


def test_sem_saida_json_nao_cria_json(tmp_path, capsys):
    codigo, _, _, _ = _rodar(tmp_path, capsys)
    assert codigo == 0
    assert list((tmp_path / "out").glob("*.json")) == []


def test_saida_json_atomica(tmp_path, capsys):
    modelo = tmp_path / "modelo.xlsx"
    wb = openpyxl.Workbook()
    wb.active.title = "Outra"
    wb.save(modelo)
    saida = tmp_path / "out" / "plano.json"
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys,
                                     extra=("--modelo-xlsx", str(modelo), "--saida-json", str(saida)))
    assert codigo == 1 and "ERRO:" in cap.err
    assert not docx.exists() and not xlsx.exists() and not saida.exists()
    if (tmp_path / "out").exists():
        assert list((tmp_path / "out").iterdir()) == []


def test_saida_json_colide_com_saida_docx(tmp_path, capsys):
    mesmo = tmp_path / "out" / "plano.bin"
    codigo, cap, _, xlsx = _rodar(tmp_path, capsys, saida_docx=mesmo, extra=("--saida-json", str(mesmo)))
    assert codigo == 1 and "ERRO:" in cap.err
    assert not mesmo.exists() and not xlsx.exists()


def test_saida_json_colide_com_saida_xlsx(tmp_path, capsys):
    mesmo = tmp_path / "out" / "plano.bin"
    codigo, cap, docx, _ = _rodar(tmp_path, capsys, saida_xlsx=mesmo, extra=("--saida-json", str(mesmo)))
    assert codigo == 1 and "ERRO:" in cap.err
    assert not mesmo.exists() and not docx.exists()


def test_saida_json_colide_com_modelo_e_com_entradas(tmp_path, capsys):
    modelo = tmp_path / "modelo.docx"
    modelo.write_bytes(MODELO_DOCX_PADRAO.read_bytes())
    original = modelo.read_bytes()
    codigo, cap, docx, xlsx = _rodar(tmp_path, capsys, extra=("--modelo-docx", str(modelo),
                                                              "--saida-json", str(modelo)))
    assert codigo == 1 and "ERRO:" in cap.err and "modelo" in cap.err
    assert modelo.read_bytes() == original
    assert not docx.exists() and not xlsx.exists()

    p, r = _entradas(tmp_path)
    original = p.read_bytes()
    codigo = g.main(["--plano", str(p), "--registro", str(r), "--saida-docx", str(tmp_path / "a.docx"),
                     "--saida-xlsx", str(tmp_path / "a.xlsx"), "--saida-json", str(p)])
    err = capsys.readouterr().err
    assert codigo == 1 and "ERRO:" in err and "entrada" in err
    assert p.read_bytes() == original
    assert not (tmp_path / "a.docx").exists() and not (tmp_path / "a.xlsx").exists()
