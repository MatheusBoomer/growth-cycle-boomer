"""Validador do registro da revisão pós-apresentação (etapa 10): regras que valem em qualquer modo.

`validar(revisao, texto_transcricao, plano_08, plano_final=None, rascunho=False)` devolve
`(erros, avisos)` e nunca levanta exceção por causa do conteúdo: entrada malformada vira mensagem
de erro. Mensagens de item começam por `Complemento <n>: `, `Conflito <n>: `,
`Ponto em aberto <n>: ` ou `Compromisso <n>: `. Sem `rascunho`, valem também as regras do modo
final (decisões e destinos preenchidos, compromissos tratados, toda mudança do plano final com
motivo na revisão). Tem linha de comando:

    python3 scripts/validar_revisao.py --revisao <json> --transcricao <arquivo> --plano-08 <json> [--plano-final <json>] [--rascunho]
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from plano_acao_comum import GRUPOS_REVISAO as _GRUPOS
from plano_acao_comum import ErroPlano, diferencas, ler_data, numeros_citados
from texto_transcricao import ErroTranscricao, contem_trecho, extrair_texto, normalizar
from validar_plano_acao import ErroEntrada, _ler_json

_MAX_TRECHO = 300
_MAX_LINHAS_RESUMO = 5


def _inteiro(valor) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool)


def _vazio(valor) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def _acoes_do_plano(plano) -> dict[int, dict]:
    """Número -> ação de um plano, sem levantar exceção para plano malformado."""
    achadas: dict[int, dict] = {}
    if not isinstance(plano, dict) or not isinstance(plano.get("horizontes"), list):
        return achadas
    for h in plano["horizontes"]:
        if not isinstance(h, dict) or not isinstance(h.get("acoes"), list):
            continue
        for a in h["acoes"]:
            if isinstance(a, dict) and _inteiro(a.get("numero")):
                achadas[a["numero"]] = a
    return achadas


class _Validacao:
    """Estado de uma validação: erros, avisos e o que as regras consultam."""

    def __init__(self, texto_transcricao, plano_08, plano_final):
        self.erros: list[str] = []
        self.avisos: list[str] = []
        self.transcricao = normalizar(texto_transcricao) if isinstance(texto_transcricao, str) else ""
        self.acoes_08 = _acoes_do_plano(plano_08)
        self.acoes_final = _acoes_do_plano(plano_final)
        self.existentes = set(self.acoes_08) | set(self.acoes_final)
        self.nomes: set[str] = set()
        self.hoje: date | None = None

    def erro(self, prefixo: str, mensagem: str) -> None:
        self.erros.append(f"{prefixo}{mensagem}")

    def aviso(self, prefixo: str, mensagem: str) -> None:
        self.avisos.append(f"{prefixo}{mensagem}")

    def data(self, valor, onde: str, prefixo: str = "") -> date | None:
        try:
            return ler_data(valor, onde)
        except ErroPlano as e:
            self.erro(prefixo, str(e))
            return None

    def numeros(self, item: dict, campo: str, prefixo: str) -> list[int]:
        """Números de ação de `item[campo]` (int ou lista); confere tipo e existência."""
        valor = item.get(campo)
        if valor is None:
            return []
        if campo == "acao":
            if not _inteiro(valor):
                self.erro(prefixo, "campo acao precisa ser um número de ação (inteiro).")
                return []
            candidatos = [valor]
        else:
            if not isinstance(valor, list):
                self.erro(prefixo, f"campo {campo} precisa ser uma lista de números de ação.")
                return []
            candidatos = [n for n in valor if _inteiro(n)]
        return self._existentes(candidatos, campo, prefixo)

    def _existentes(self, candidatos: list[int], campo: str, prefixo: str) -> list[int]:
        for n in candidatos:
            if n not in self.existentes:
                self.erro(prefixo, f"ação {n} não existe no plano (campo {campo}).")
        return candidatos


def _participantes(v: _Validacao, revisao: dict) -> None:
    participantes = revisao.get("participantes")
    if not isinstance(participantes, dict):
        v.erro("", "participantes ausente ou não é um objeto com as listas boomer e cliente.")
        return
    for lado in ("boomer", "cliente"):
        lista = participantes.get(lado)
        if not isinstance(lista, list):
            v.erro("", f"participantes.{lado} ausente ou não é uma lista.")
            continue
        for p in lista:
            if isinstance(p, dict) and isinstance(p.get("nome"), str) and p["nome"].strip():
                v.nomes.add(p["nome"].strip())
            else:
                v.erro("", f"participantes.{lado}: cada participante precisa ter nome.")


def _trecho(v: _Validacao, item: dict, prefixo: str) -> None:
    trecho = item.get("trecho")
    if not isinstance(trecho, dict):
        v.erro(prefixo, "trecho ausente (precisa ter texto, quem e posicao).")
        return
    texto = trecho.get("texto")
    if not isinstance(texto, str) or not contem_trecho(v.transcricao, texto):
        v.erro(prefixo, "trecho não encontrado na transcrição.")
    elif len(texto) > _MAX_TRECHO:
        v.aviso(prefixo, f"trecho com {len(texto)} caracteres; deveria ser curto (até {_MAX_TRECHO}).")
    quem = trecho.get("quem")
    if _vazio(quem) or not isinstance(quem, str):
        v.erro(prefixo, "quem não informado no trecho.")
    else:
        nome = quem.split(" (")[0].strip()
        if nome not in v.nomes:
            v.erro(prefixo, f'quem "{nome}" não está entre os participantes.')
    if _vazio(trecho.get("posicao")):
        v.aviso(prefixo, "posicao do trecho vazia.")


def _opcoes(v: _Validacao, conflito: dict, prefixo: str) -> None:
    opcoes = conflito.get("opcoes")
    if not isinstance(opcoes, dict) or any(_vazio(opcoes.get(k)) for k in ("A", "B")):
        v.erro(prefixo, "opcoes precisa ter as opção A e B preenchidas.")
        chaves: set = set(opcoes) if isinstance(opcoes, dict) else set()
    else:
        chaves = set(opcoes)
    recomendacao = conflito.get("recomendacao_boomer")
    if not isinstance(recomendacao, str) or recomendacao not in chaves:
        v.erro(prefixo, f"recomendacao_boomer {recomendacao!r} não é uma opção existente.")
    decisao = conflito.get("decisao")
    if decisao is not None and (not isinstance(decisao, str) or decisao not in chaves):
        v.erro(prefixo, f"decisao {decisao!r} não é uma opção existente.")


def _remocao(v: _Validacao, conflito: dict, prefixo: str) -> None:
    if conflito.get("remove_acao") is not True:
        return
    alvo = [n for campo in ("acoes_afetadas", "acoes")
            for n in (conflito.get(campo) if isinstance(conflito.get(campo), list) else [])
            if _inteiro(n)]
    if not alvo and _inteiro(conflito.get("acao")):
        alvo = [conflito["acao"]]
    for n in sorted(set(alvo)):
        acao = v.acoes_08.get(n)
        if acao is None or acao.get("alavanca_da_meta") is not True:
            continue
        if _vazio(conflito.get("alavanca_descoberta")) or _vazio(conflito.get("substituta")):
            v.erro(prefixo, f"a ação {n} é alavanca da meta; removê-la exige alavanca descoberta e substituta preenchidas.")


def _destino(v: _Validacao, aberto: dict, prefixo: str) -> None:
    destino = aberto.get("destino")
    if destino is None:
        return
    if not isinstance(destino, dict):
        v.erro(prefixo, "destino precisa ser um objeto com tipo.")
        return
    if destino.get("tipo") == "acao":
        v.numeros(destino, "acoes", prefixo)
    elif destino.get("tipo") == "confirmar" or "ate" in destino:
        v.data(destino.get("ate"), "destino.ate", prefixo)


def _itens(v: _Validacao, revisao: dict) -> None:
    for chave, rotulo in _GRUPOS:
        itens = revisao.get(chave)
        if not isinstance(itens, list):
            v.erro("", f"{chave} ausente ou não é uma lista.")
            continue
        vistos: set[int] = set()
        for i, item in enumerate(itens, start=1):
            numero = item.get("numero") if isinstance(item, dict) else None
            prefixo = f"{rotulo} {numero if _inteiro(numero) else i}: "
            if not isinstance(item, dict):
                v.erro(prefixo, "precisa ser um objeto.")
                continue
            if _inteiro(numero):
                if numero in vistos:
                    v.erro(prefixo, f"número {numero} repetido no grupo {chave}.")
                vistos.add(numero)
            else:
                v.erro(prefixo, "numero ausente ou não é um inteiro.")
            _trecho(v, item, prefixo)
            for campo in ("acao", "acoes", "acoes_afetadas"):
                v.numeros(item, campo, prefixo)
            if chave == "conflitos":
                _opcoes(v, item, prefixo)
                _remocao(v, item, prefixo)
            elif chave == "abertos":
                _destino(v, item, prefixo)


def _cabecalho(v: _Validacao, revisao: dict) -> None:
    if revisao.get("versao") != 1 or isinstance(revisao.get("versao"), bool):
        v.erro("", "a revisão precisa ser da versao 1.")
    hoje = v.data(revisao.get("data_hoje"), "data_hoje")
    v.hoje = hoje
    reuniao = v.data(revisao.get("data_reuniao"), "data_reuniao")
    if hoje and reuniao and reuniao > hoje:
        v.erro("", "a data da reunião não pode ser depois de data_hoje.")
    resumo = revisao.get("resumo")
    if isinstance(resumo, str):
        linhas = [x for x in resumo.splitlines() if x.strip()]
        if len(linhas) > _MAX_LINHAS_RESUMO:
            v.aviso("", f"resumo com {len(linhas)} linhas; o ideal é até {_MAX_LINHAS_RESUMO}.")


def validar(revisao, texto_transcricao, plano_08, plano_final=None, rascunho: bool = False) -> tuple[list[str], list[str]]:
    """Valida o registro da revisão contra a transcrição e os planos; devolve (erros, avisos)."""
    if not isinstance(revisao, dict):
        return ["A revisão precisa ser um objeto JSON com os campos da versao 1."], []
    v = _Validacao(texto_transcricao, plano_08, plano_final)
    if not isinstance(plano_08, dict):
        v.erro("", "o plano da 08 precisa ser um objeto JSON.")
    if not isinstance(texto_transcricao, str):
        v.erro("", "a transcrição precisa ser um texto.")
    _cabecalho(v, revisao)
    _participantes(v, revisao)
    _itens(v, revisao)
    if not rascunho:
        _modo_final(v, revisao, plano_08, plano_final)
    return v.erros, v.avisos


# --- Modo final (sem rascunho) ---------------------------------------------------------------

_TIPOS_DESTINO = ("acao", "confirmar", "descartado")


def _itens_do_grupo(revisao: dict, chave: str):
    """(prefixo, item) dos itens dict de um grupo, com a mesma numeração das mensagens de sempre."""
    rotulo = dict(_GRUPOS)[chave]
    itens = revisao.get(chave)
    if not isinstance(itens, list):
        return
    for i, item in enumerate(itens, start=1):
        if isinstance(item, dict):
            numero = item.get("numero")
            yield f"{rotulo} {numero if _inteiro(numero) else i}: ", item


def _final_conflitos(v: _Validacao, revisao: dict) -> None:
    for prefixo, c in _itens_do_grupo(revisao, "conflitos"):
        if c.get("decisao") is None:
            v.erro(prefixo, "sem decisão registrada (escolha uma das opções).")


def _data_sem_erro(valor) -> date | None:
    try:
        return ler_data(valor, "destino.ate")
    except ErroPlano:
        return None  # data malformada já foi acusada nas regras de sempre


def _final_abertos(v: _Validacao, revisao: dict) -> None:
    for prefixo, a in _itens_do_grupo(revisao, "abertos"):
        destino = a.get("destino")
        if destino is None:
            v.erro(prefixo, "sem destino definido.")
            continue
        if not isinstance(destino, dict):
            continue  # o formato do destino já foi acusado nas regras de sempre
        tipo = destino.get("tipo")
        if not isinstance(tipo, str) or tipo not in _TIPOS_DESTINO:
            v.erro(prefixo, f"destino com tipo {tipo!r} desconhecido (use acao, confirmar ou descartado).")
        elif tipo == "confirmar":
            ate = _data_sem_erro(destino.get("ate"))
            if ate and v.hoje and ate < v.hoje:
                v.erro(prefixo, f"destino confirmar com data já passou ({destino['ate']}, antes de data_hoje).")
        elif tipo == "acao":
            lista = destino.get("acoes")
            numeros = [n for n in lista if _inteiro(n)] if isinstance(lista, list) else []
            if not numeros:
                v.erro(prefixo, "destino acao precisa listar ao menos uma ação em acoes.")
            for n in numeros:
                if n not in v.acoes_final:
                    v.erro(prefixo, f"ação {n} não existe no plano final.")
        elif _vazio(destino.get("motivo")):
            v.erro(prefixo, "destino descartado sem motivo preenchido.")


def _final_compromissos(v: _Validacao, revisao: dict) -> None:
    for prefixo, c in _itens_do_grupo(revisao, "compromissos"):
        if not (c.get("fora_do_escopo") is True or c.get("no_plano") is False):
            continue
        acoes = c.get("acoes")
        if (isinstance(acoes, list) and any(_inteiro(n) for n in acoes)) or not _vazio(c.get("tratamento")):
            continue
        v.erro(prefixo, "compromisso fora do plano ou do escopo precisa de acoes ou de tratamento (o que será feito).")


def _plano_comparavel(plano) -> bool:
    """True se `diferencas` aceita o plano: dict, ações com `numero` int e metas com `kpi` texto."""
    if not isinstance(plano, dict):
        return False
    horizontes = plano.get("horizontes", [])
    if not isinstance(horizontes, list):
        return False
    for h in horizontes:
        if not isinstance(h, dict) or not isinstance(h.get("acoes", []), list):
            return False
        if not all(isinstance(a, dict) and _inteiro(a.get("numero")) for a in h.get("acoes", [])):
            return False
    abertura = plano.get("abertura", {})
    if not isinstance(abertura, dict) or not isinstance(abertura.get("metas", []), list):
        return False
    return all(isinstance(m, dict) and isinstance(m.get("kpi"), str) for m in abertura.get("metas", []))


def _acoes_citadas(revisao: dict) -> set[int]:
    citadas: set[int] = set()
    for chave, _ in _GRUPOS:
        for _, item in _itens_do_grupo(revisao, chave):
            citadas |= numeros_citados(chave, item)
    return citadas


def _divergencias(v: _Validacao, revisao: dict) -> set[str]:
    divergencias = revisao.get("divergencias_cenario")
    if not isinstance(divergencias, list):
        v.erro("", "divergencias_cenario ausente ou não é uma lista.")
        return set()
    return {d["item"].strip() for d in divergencias if isinstance(d, dict) and isinstance(d.get("item"), str)}


def _final_rastreabilidade(v: _Validacao, revisao: dict, plano_08, plano_final) -> None:
    divergentes = _divergencias(v, revisao)
    if not (_plano_comparavel(plano_08) and _plano_comparavel(plano_final)):
        return  # plano malformado: as outras regras e o validador do plano já acusam
    mudancas = diferencas(plano_08, plano_final)
    citadas = _acoes_citadas(revisao)
    mudadas = {*mudancas["incluidas"], *mudancas["removidas"], *mudancas["alteradas"]}
    for n in sorted(mudadas - citadas):
        v.erro("", f"Ação {n} mudou no plano final sem motivo na revisão (nenhum item cita a ação {n}).")
    for kpi in mudancas["metas_alteradas"]:
        if kpi.strip() not in divergentes:
            v.erro("", f'Meta "{kpi}" mudou sem registro em divergencias_cenario.')


def _modo_final(v: _Validacao, revisao: dict, plano_08, plano_final) -> None:
    _final_conflitos(v, revisao)
    _final_abertos(v, revisao)
    _final_compromissos(v, revisao)
    if isinstance(plano_final, dict):
        _final_rastreabilidade(v, revisao, plano_08, plano_final)
    else:
        v.erro("", "plano final ausente ou inválido: a rastreabilidade não foi conferida.")


# --- Linha de comando ------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Valida o registro da revisão pós-apresentação (etapa 10).")
    p.add_argument("--revisao", required=True, type=Path)
    p.add_argument("--transcricao", required=True, type=Path)
    p.add_argument("--plano-08", required=True, type=Path)
    p.add_argument("--plano-final", type=Path)
    p.add_argument("--rascunho", action="store_true", help="aceita decisões e destinos ainda em aberto")
    a = p.parse_args(argv)
    try:
        revisao = _ler_json(a.revisao, "registro da revisão")
        plano_08 = _ler_json(a.plano_08, "plano da 08")
        plano_final = _ler_json(a.plano_final, "plano final") if a.plano_final else None
        texto = extrair_texto(a.transcricao)
    except (ErroEntrada, ErroTranscricao) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    erros, avisos = validar(revisao, texto, plano_08, plano_final, rascunho=a.rascunho)
    for aviso in avisos:
        print(f"AVISO: {aviso}")
    if erros:
        for erro in erros:
            print(f"ERRO: {erro}", file=sys.stderr)
        return 1
    contagem = {chave: len(revisao[chave]) for chave, _ in _GRUPOS}  # sem erros, os grupos são listas
    print(f"OK: {contagem['complementos']} complementos, {contagem['conflitos']} conflitos, "
          f"{contagem['abertos']} pontos em aberto, {contagem['compromissos']} compromissos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
