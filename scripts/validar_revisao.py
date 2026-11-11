"""Validador do registro da revisão pós-apresentação (etapa 10): regras que valem em qualquer modo.

`validar(revisao, texto_transcricao, plano_08, plano_final=None, rascunho=False)` devolve
`(erros, avisos)` e nunca levanta exceção por causa do conteúdo: entrada malformada vira mensagem
de erro. Mensagens de item começam por `Complemento <n>: `, `Conflito <n>: `,
`Ponto em aberto <n>: ` ou `Compromisso <n>: `.
"""
from __future__ import annotations

from datetime import date

from plano_acao_comum import ErroPlano, ler_data
from texto_transcricao import contem_trecho, normalizar

_MAX_TRECHO = 300
_MAX_LINHAS_RESUMO = 5

# (chave no JSON, rótulo da mensagem)
_GRUPOS = (
    ("complementos", "Complemento"),
    ("conflitos", "Conflito"),
    ("abertos", "Ponto em aberto"),
    ("compromissos", "Compromisso"),
)


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
        self.existentes = set(self.acoes_08) | set(_acoes_do_plano(plano_final))
        self.nomes: set[str] = set()

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
    # As regras que só valem no modo final (rascunho=False) entram aqui, num bloco separado.
    return v.erros, v.avisos
