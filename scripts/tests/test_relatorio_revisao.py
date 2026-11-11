from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
sys.path.insert(0, str(RAIZ / "scripts" / "tests"))
import relatorio_revisao as r  # noqa: E402
from plano_v2_exemplo import plano_valido  # noqa: E402
from revisao_exemplo import plano_final_valido, revisao_valida  # noqa: E402

SCRIPT = RAIZ / "scripts" / "relatorio_revisao.py"


def relatorio(plano_final=None, revisao=None, plano_08=None):
    return r.montar_relatorio(
        plano_valido() if plano_08 is None else plano_08,
        plano_final_valido() if plano_final is None else plano_final,
        revisao_valida() if revisao is None else revisao,
    )


def secao(md: str, titulo: str) -> str:
    """Texto de uma seção `## titulo`, até a próxima `## `."""
    corpo = md.split(f"## {titulo}\n", 1)[1]
    return corpo.split("\n## ", 1)[0]


def linhas_com(md: str, trecho: str) -> list[str]:
    return [linha for linha in md.splitlines() if trecho in linha]


def test_secoes_na_ordem_e_sem_tabelas():
    md = relatorio()
    titulos = [linha for linha in md.splitlines() if linha.startswith("## ")]
    assert titulos == ["## O que mudou", "## Metas e cenário", "## Cobertura da meta", "## Pendências"]
    assert "|" not in md


def test_acao_incluida_com_o_ponto_em_aberto_que_a_originou():
    incluidas = secao(relatorio(), "O que mudou").split("### Incluídas\n", 1)[1].split("\n### ", 1)[0]
    assert "- Ação 7 · Levantar com o time comercial a viabilidade de kits de amostra: Ponto em aberto 1" in incluidas


def test_acao_alterada_com_conflito_opcao_e_campos():
    md = relatorio()
    alteradas = secao(md, "O que mudou").split("### Alteradas\n", 1)[1].split("\n### ", 1)[0]
    linha3 = linhas_com(alteradas, "Ação 3 ·")[0]
    assert "Conflito 1: Opção C" in linha3 and "(campos: como)" in linha3
    linha2 = linhas_com(alteradas, "Ação 2 ·")[0]
    assert "Complemento 1" in linha2 and "(campos: dono)" in linha2


def test_acao_removida_usa_o_nome_do_plano_da_08():
    removidas = secao(relatorio(), "O que mudou").split("### Removidas\n", 1)[1]
    assert "- Ação 6 · " in removidas and "Conflito 2: Opção B" in removidas
    nome = next(a["acao"] for h in plano_valido()["horizontes"] for a in h["acoes"] if a["numero"] == 6)
    assert nome in removidas


def test_motivo_de_cada_acao_mudada_aparece_no_relatorio():
    md = relatorio()
    esperado = {2: "Complemento 1", 3: "Conflito 1: Opção C", 6: "Conflito 2: Opção B", 7: "Ponto em aberto 1"}
    for numero, motivo in esperado.items():
        assert any(motivo in linha for linha in linhas_com(md, f"- Ação {numero} · ")), numero


def test_primeiro_item_que_cita_a_acao_ganha_na_ordem_dos_grupos():
    revisao = revisao_valida()
    revisao["compromissos"][0]["acoes"] = [2]  # também cita a ação 2, mas depois do complemento
    assert "Complemento 1" in linhas_com(relatorio(revisao=revisao), "- Ação 2 · ")[0]
    revisao["complementos"][0]["acoes"] = []
    assert "Compromisso 1" in linhas_com(relatorio(revisao=revisao), "- Ação 2 · ")[0]


def test_acao_sem_item_que_cite_nao_levanta_excecao():
    revisao = revisao_valida()
    revisao["complementos"][0]["acoes"] = []
    assert "- Ação 2 · " in relatorio(revisao=revisao)
    assert "sem motivo registrado" in linhas_com(relatorio(revisao=revisao), "- Ação 2 · ")[0]


def test_secao_sem_mudanca_diz_nenhuma():
    md = r.montar_relatorio(plano_valido(), plano_valido(), revisao_valida())
    mudou = secao(md, "O que mudou")
    assert mudou.count("- nenhuma") == 3


def test_sem_mudanca_de_meta_usa_a_frase_padrao():
    assert secao(relatorio(), "Metas e cenário").strip() == "Nenhuma mudança de meta, verba ou cenário."


def test_meta_alterada_mostra_antes_e_depois():
    final = plano_final_valido()
    final["abertura"]["metas"][0]["para"] = "28%"
    revisao = revisao_valida()
    revisao["divergencias_cenario"] = [
        {"item": "Taxa de quebra", "antes": "25%", "depois": "28%", "slides": ["Metas do projeto", "Cenários"]},
    ]
    metas = secao(relatorio(final, revisao), "Metas e cenário")
    assert "Nenhuma mudança" not in metas
    linha = linhas_com(metas, "Taxa de quebra")[0]
    assert "36,1% → 25%" in linha and "36,1% → 28%" in linha
    assert "Divergências" in metas
    diverg = linhas_com(metas, "25% → 28%")[0]
    assert "Metas do projeto" in diverg and "Cenários" in diverg


def test_divergencia_sem_meta_alterada_tambem_aparece():
    revisao = revisao_valida()
    revisao["divergencias_cenario"] = [{"item": "Verba de mídia", "slides": ["Plano de mídia"]}]
    metas = secao(relatorio(revisao=revisao), "Metas e cenário")
    assert "Verba de mídia" in metas and "Plano de mídia" in metas
    assert "Nenhuma mudança" not in metas


def test_meta_nova_ou_removida_nao_quebra():
    final = plano_final_valido()
    final["abertura"]["metas"].append({"kpi": "ROAS", "de": "3", "para": "4", "ate": "25/01/2027", "fonte": "x"})
    metas = secao(relatorio(final), "Metas e cenário")
    assert "ROAS" in metas and "não existia" in linhas_com(metas, "ROAS")[0]
    final["abertura"]["metas"] = []
    assert "Taxa de quebra" in secao(relatorio(final), "Metas e cenário")


def test_cobertura_lista_acoes_antes_e_depois():
    cobertura = secao(relatorio(), "Cobertura da meta")
    linha = linhas_com(cobertura, "Taxa de quebra")[0]
    assert "antes" in linha and "Ação 2" in linha and "depois" in linha
    assert "⚠️" not in cobertura and "enfraqueceu" not in cobertura


def test_kpi_que_perde_todas_as_acoes_mostra_alerta_e_enfraqueceu():
    final = plano_final_valido()
    for h in final["horizontes"]:
        for a in h["acoes"]:
            if a["numero"] in (2, 4):  # as duas ações que sustentam a taxa de quebra
                a["alavanca_da_meta"] = False
    linha = linhas_com(secao(relatorio(final), "Cobertura da meta"), "Taxa de quebra")[0]
    assert "⚠️ sem ação" in linha and "enfraqueceu" in linha


def test_cobertura_ignora_maiusculas_e_acoes_que_nao_sao_da_meta():
    final = plano_final_valido()
    final["abertura"]["metas"][0]["kpi"] = "TAXA DE QUEBRA"
    plano_08 = plano_valido()
    plano_08["abertura"]["metas"][0]["kpi"] = "TAXA DE QUEBRA"
    for plano in (final, plano_08):
        for h in plano["horizontes"]:
            for a in h["acoes"]:
                if a["numero"] == 5:  # não é da meta, mas cita a alavanca
                    a["alavanca"] = "Taxa de quebra"
    linha = linhas_com(secao(r.montar_relatorio(plano_08, final, revisao_valida()), "Cobertura da meta"), "TAXA DE QUEBRA")[0]
    assert "depois Ação 2, Ação 4" in linha and "Ação 5" not in linha and "⚠️" not in linha


def test_cobertura_enfraqueceu_quando_cai_o_numero_de_acoes_mesmo_com_alguma():
    plano_08 = plano_valido()
    plano_08["horizontes"][0]["acoes"][0]["alavanca_da_meta"] = True
    plano_08["horizontes"][0]["acoes"][0]["alavanca"] = "Taxa de quebra"
    linha = linhas_com(secao(relatorio(plano_08=plano_08), "Cobertura da meta"), "Taxa de quebra")[0]
    assert "enfraqueceu" in linha and "⚠️" not in linha


def test_pendencias_lista_destino_confirmar_com_a_data():
    pend = secao(relatorio(), "Pendências")
    assert "Ponto em aberto 2" in pend and "Orçamento extra para mídia" in pend and "20/11/2026" in pend
    assert "Ponto em aberto 1" not in pend


def test_sem_pendencias():
    revisao = revisao_valida()
    revisao["abertos"][1]["destino"] = {"tipo": "descartado", "motivo": "fora de prazo"}
    assert "Nenhuma pendência." in secao(relatorio(revisao=revisao), "Pendências")


def test_revisao_malformada_nao_levanta_excecao():
    revisao = revisao_valida()
    revisao["conflitos"][0]["decisao"] = None
    revisao["abertos"][0]["destino"] = None
    md = relatorio(revisao=revisao)
    assert "sem decisão" in linhas_com(md, "- Ação 3 · ")[0]
    assert "sem motivo registrado" in linhas_com(md, "- Ação 7 · ")[0]


# --- CLI ---------------------------------------------------------------------------------------

@pytest.fixture
def arquivos(tmp_path):
    caminhos = {}
    for nome, dados in (("plano-08", plano_valido()), ("plano-final", plano_final_valido()), ("revisao", revisao_valida())):
        caminhos[nome] = tmp_path / f"{nome}.json"
        caminhos[nome].write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    return caminhos


def _argv(arquivos):
    return [sys.executable, str(SCRIPT), *(arg for nome, c in arquivos.items() for arg in (f"--{nome}", str(c)))]


def test_cli_imprime_o_markdown_e_sai_0(arquivos):
    p = subprocess.run(_argv(arquivos), capture_output=True, text=True)
    assert p.returncode == 0 and p.stderr == ""
    assert p.stdout == relatorio()
    assert "## O que mudou" in p.stdout


def test_cli_json_invalido_e_arquivo_ausente_dao_erro_sem_traceback(arquivos):
    arquivos["revisao"].write_text("{ não é json", encoding="utf-8")
    p = subprocess.run(_argv(arquivos), capture_output=True, text=True)
    assert p.returncode == 1 and p.stderr.startswith("ERRO: ") and "Traceback" not in p.stderr
    arquivos["revisao"].unlink()
    p = subprocess.run(_argv(arquivos), capture_output=True, text=True)
    assert p.returncode == 1 and p.stderr.startswith("ERRO: ") and "Traceback" not in p.stderr


def test_cli_json_de_tipo_errado_da_erro_sem_traceback(arquivos):
    arquivos["plano-final"].write_text("[1, 2]", encoding="utf-8")
    p = subprocess.run(_argv(arquivos), capture_output=True, text=True)
    assert p.returncode == 1 and p.stderr.startswith("ERRO: ") and "Traceback" not in p.stderr
