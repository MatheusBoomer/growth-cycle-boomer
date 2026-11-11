"""Ponto de entrada único do plano de ação v2 (Skill 08): valida e gera .docx e .xlsx juntos.

Valida com `validar_plano_acao.validar(rascunho=False)`; se houver erro, não cria nenhum
arquivo. Os arquivos são gravados primeiro em temporários na pasta de destino e só
então renomeados para os nomes finais, para nunca sobrar um sem o outro. Com
`--saida-json`, o próprio plano também é gravado (o JSON que a revisão pós-apresentação compara).

    python3 scripts/gerar_plano_acao.py --plano <plano.json> --registro <solucoes.json> \\
        --saida-docx <.docx> --saida-xlsx <.xlsx> [--saida-json <.json>] \\
        [--modelo-docx <.docx>] [--modelo-xlsx <.xlsx>]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

from openpyxl.utils.exceptions import IllegalCharacterError, InvalidFileException

from plano_acao_comum import ErroPlano
from plano_acao_docx import MODELO_DOCX_PADRAO, gerar_docx
from plano_acao_xlsx import gerar_xlsx
from validar_plano_acao import ErroEntrada, _ler_json, validar

_FALHAS_DE_ARQUIVO = (OSError, zipfile.BadZipFile, InvalidFileException, IllegalCharacterError, KeyError)


class ErroValidacao(ErroPlano):
    """O plano não passou no validador; `erros` e `avisos` trazem as mensagens."""

    def __init__(self, erros: list[str], avisos: list[str]):
        super().__init__("\n".join(erros))
        self.erros = erros
        self.avisos = avisos


def _mesmo_arquivo(a: Path, b: Path) -> bool:
    if a.resolve() == b.resolve():
        return True
    try:
        return a.exists() and b.exists() and os.path.samefile(a, b)
    except OSError:
        return False


def _recusar_colisoes(
    saida_docx: Path,
    saida_xlsx: Path,
    modelo_docx: Path,
    modelo_xlsx: Path | None,
    caminhos_entrada: tuple[Path, ...] = (),
    saida_json: Path | None = None,
) -> None:
    if _mesmo_arquivo(saida_docx, saida_xlsx):
        raise ErroPlano(f"a saída .docx e a saída .xlsx são o mesmo arquivo ({saida_docx}).")
    saidas = [(".docx", saida_docx), (".xlsx", saida_xlsx)]
    if saida_json is not None:
        saidas.append((".json", saida_json))
        for nome, outra in saidas[:2]:
            if _mesmo_arquivo(saida_json, outra):
                raise ErroPlano(f"a saída .json e a saída {nome} são o mesmo arquivo ({saida_json}).")
    modelos = [m for m in (modelo_docx, modelo_xlsx) if m is not None]
    entradas = [Path(e) for e in caminhos_entrada]
    for nome, saida in saidas:
        for modelo in modelos:
            if _mesmo_arquivo(saida, modelo):
                raise ErroPlano(f"a saída {nome} não pode ser um dos modelos ({modelo}); escolha outro caminho.")
        for entrada in entradas:
            if _mesmo_arquivo(saida, entrada):
                raise ErroPlano(f"a saída {nome} não pode ser um arquivo de entrada ({entrada}); escolha outro caminho.")


def _temporario(destino: Path) -> Path:
    destino.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=destino.parent, prefix=".plano-", suffix=destino.suffix) as f:
        return Path(f.name)


def _permissao_padrao(caminho: Path) -> None:
    """NamedTemporaryFile cria o arquivo com 0600; o final precisa seguir o umask (o app web lê o arquivo)."""
    umask = os.umask(0)
    os.umask(umask)
    os.chmod(caminho, 0o666 & ~umask)


def gerar(
    plano: dict,
    registro: dict,
    saida_docx: Path,
    saida_xlsx: Path,
    modelo_docx: Path = MODELO_DOCX_PADRAO,
    modelo_xlsx: Path | None = None,
    caminhos_entrada: tuple[Path, ...] = (),
    saida_json: Path | None = None,
) -> dict:
    """Valida o plano e grava o .docx e o .xlsx (e o .json do plano, se `saida_json`).

    Devolve {"docx","xlsx","total_acoes","avisos"} (mais "json" quando gravado).

    Levanta ErroValidacao (plano inválido) ou ErroPlano (modelo ruim, caminhos em conflito,
    falha de arquivo); nesses casos nenhum arquivo final é criado nem alterado.
    `caminhos_entrada` são os arquivos lidos pela CLI (plano, registro): nenhuma saída pode ser um deles.
    O .json é o plano em `ensure_ascii=False, indent=2`, gravado na mesma escrita atômica.
    """
    saida_docx, saida_xlsx, modelo_docx = Path(saida_docx), Path(saida_xlsx), Path(modelo_docx)
    modelo_xlsx = Path(modelo_xlsx) if modelo_xlsx is not None else None
    saida_json = Path(saida_json) if saida_json is not None else None

    _recusar_colisoes(saida_docx, saida_xlsx, modelo_docx, modelo_xlsx, tuple(caminhos_entrada), saida_json)
    erros, avisos = validar(plano, registro, rascunho=False)
    if erros:
        raise ErroValidacao(erros, avisos)

    clausula_xlsx = f" com o modelo {modelo_xlsx}" if modelo_xlsx is not None else ""
    temporarios: list[Path] = []
    try:
        tmp_docx = _temporario(saida_docx)
        temporarios.append(tmp_docx)
        tmp_xlsx = _temporario(saida_xlsx)
        temporarios.append(tmp_xlsx)
        try:
            gerar_docx(plano, modelo_docx, tmp_docx)
        except _FALHAS_DE_ARQUIVO as e:
            raise ErroPlano(f"não foi possível gerar o .docx com o modelo {modelo_docx}: {e}") from e
        try:
            resumo = gerar_xlsx(plano, tmp_xlsx, modelo_xlsx)
        except _FALHAS_DE_ARQUIVO as e:
            raise ErroPlano(f"não foi possível gerar o .xlsx{clausula_xlsx}: {e}") from e
        pares = [(tmp_docx, saida_docx), (tmp_xlsx, saida_xlsx)]
        if saida_json is not None:
            tmp_json = _temporario(saida_json)
            temporarios.append(tmp_json)
            tmp_json.write_text(json.dumps(plano, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            pares.append((tmp_json, saida_json))
        for tmp, _ in pares:
            _permissao_padrao(tmp)
        for tmp, final in pares:
            os.replace(tmp, final)
            temporarios.remove(tmp)
    except OSError as e:
        raise ErroPlano(f"não foi possível gravar os arquivos de saída: {e}") from e
    finally:
        for t in temporarios:
            t.unlink(missing_ok=True)

    resultado = {"docx": str(saida_docx), "xlsx": str(saida_xlsx),
                 "total_acoes": resumo["total_acoes"], "avisos": avisos}
    if saida_json is not None:
        resultado["json"] = str(saida_json)
    return resultado


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Valida o plano de ação v2 e gera o .docx e o .xlsx (Skill 08).")
    p.add_argument("--plano", required=True, type=Path)
    p.add_argument("--registro", required=True, type=Path)
    p.add_argument("--saida-docx", required=True, type=Path)
    p.add_argument("--saida-xlsx", required=True, type=Path)
    p.add_argument("--saida-json", type=Path, default=None,
                   help="grava também o JSON do plano (opcional)")
    p.add_argument("--modelo-docx", type=Path, default=MODELO_DOCX_PADRAO)
    p.add_argument("--modelo-xlsx", type=Path, default=None)
    a = p.parse_args(argv)
    try:
        plano = _ler_json(a.plano, "plano")
        registro = _ler_json(a.registro, "registro")
        resumo = gerar(plano, registro, a.saida_docx, a.saida_xlsx, a.modelo_docx, a.modelo_xlsx,
                       caminhos_entrada=(a.plano, a.registro), saida_json=a.saida_json)
    except ErroValidacao as e:
        for aviso in e.avisos:
            print(f"AVISO: {aviso}")
        for erro in e.erros:
            print(f"ERRO: {erro}", file=sys.stderr)
        return 1
    except (ErroEntrada, ErroPlano) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    for aviso in resumo["avisos"]:
        print(f"AVISO: {aviso}")
    arquivos = ".docx, .xlsx e .json" if "json" in resumo else ".docx e .xlsx"
    print(f"OK: {arquivos} gerados com {resumo['total_acoes']} ações.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
