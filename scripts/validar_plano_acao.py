"""Validador do plano de ação v2 (Skill 08): regras que bloqueiam a entrega.

`validar(plano, registro, rascunho=False)` devolve `(erros, avisos)` e nunca levanta
exceção por causa do conteúdo do plano: JSON malformado vira mensagem de erro.
Também confere a cobertura das soluções do registro, devolve avisos que não bloqueiam e
tem linha de comando:

    python3 scripts/validar_plano_acao.py --plano <plano.json> --registro <solucoes.json> [--rascunho]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from plano_acao_comum import CAMPOS_ACAO, acoes, FRENTES, HORIZONTES, ErroPlano, ler_data, pisos_roas

_SEPARADOR_DONO = " · "
_MARCAS = ("[VALIDAR", "[PREENCHER")
_VERBOS_VAGOS = ("otimizar", "acompanhar", "priorizar", "direcionar", "melhorar")
_VERBOS_DIAGNOSTICO = ("auditar", "mapear", "investigar")
_MAX_DIAS_IMEDIATO = 7
_JANELA_DIAS = (85, 95)


class ErroEntrada(Exception):
    """Arquivo de entrada ausente, ilegível ou que não é JSON."""


def _ler_json(caminho: Path, nome: str):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ErroEntrada(f"{nome} não encontrado: {caminho}")
    except json.JSONDecodeError as e:
        raise ErroEntrada(f"o {nome} não é um JSON válido (linha {e.lineno}): {e.msg}")
    except (OSError, UnicodeDecodeError) as e:
        raise ErroEntrada(f"não foi possível ler o {nome} ({caminho}): {e}")


def _ids_do_registro(registro) -> list[str] | None:
    """Ids de solução do registro, na ordem; None se o registro não tem a lista de problemas."""
    if not isinstance(registro, dict) or not isinstance(registro.get("problemas"), list):
        return None
    ids: list[str] = []
    for p in registro["problemas"]:
        if not isinstance(p, dict) or not isinstance(p.get("solucoes"), list):
            continue
        for sol in p["solucoes"]:
            if isinstance(sol, dict) and isinstance(sol.get("id"), str):
                ids.append(sol["id"])
    return ids


def _vazio(valor) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def _fmt(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def _marcacoes(no, caminho: str = "plano"):
    """Gera (caminho, texto) de toda string do plano que contém [VALIDAR ou [PREENCHER."""
    if isinstance(no, str):
        if any(m in no for m in _MARCAS):
            yield caminho, no
    elif isinstance(no, dict):
        for k, v in no.items():
            yield from _marcacoes(v, f"{caminho}.{k}")
    elif isinstance(no, list):
        for i, v in enumerate(no):
            yield from _marcacoes(v, f"{caminho}[{i}]")


def _ciclos(grafo: dict[int, list[int]]) -> list[list[int]]:
    """Ciclos do grafo por DFS iterativa; cada um sai como [a, b, ..., a]."""
    cor: dict[int, int] = {}  # ausente = não visitado, 1 = no caminho, 2 = concluído
    achados: list[list[int]] = []
    vistos: set[frozenset[int]] = set()
    for raiz in sorted(grafo):
        if raiz in cor:
            continue
        caminho = [raiz]
        cor[raiz] = 1
        iteradores = [iter(grafo[raiz])]
        while caminho:
            try:
                prox = next(iteradores[-1])
            except StopIteration:
                cor[caminho.pop()] = 2
                iteradores.pop()
                continue
            if cor.get(prox) == 1:
                ciclo = caminho[caminho.index(prox):] + [prox]
                chave = frozenset(ciclo)
                if chave not in vistos:
                    vistos.add(chave)
                    achados.append(ciclo)
            elif prox not in cor:
                cor[prox] = 1
                caminho.append(prox)
                iteradores.append(iter(grafo.get(prox, [])))
    return achados


# --- ondas e blocos novos do plano (todas as chaves são opcionais) ---

_CAMPOS_TEXTO_ONDA = ("nome", "calendario_midia", "objetivo")
_CAMPOS_CHECKPOINT = ("duracao", "pauta", "para_liberar", "quem_decide")


def _inteiro(valor) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool)


def _data_ou_none(texto) -> date | None:
    """Lê dd/mm/aaaa sem registrar erro: quem lê a data de cada campo já a reporta uma vez."""
    try:
        return ler_data(texto, "data")
    except ErroPlano:
        return None


def _lista_de_acoes(plano: dict) -> list[dict]:
    """Todas as ações (objetos) dos horizontes, ignorando o que estiver malformado."""
    horizontes = plano.get("horizontes")
    if not isinstance(horizontes, list):
        return []
    return [
        a
        for h in horizontes
        if isinstance(h, dict) and isinstance(h.get("acoes"), list)
        for a in h["acoes"]
        if isinstance(a, dict)
    ]


def _prefixo_acao(a: dict) -> str:
    nome = a.get("acao") if isinstance(a.get("acao"), str) else ""
    return f'Ação {a["numero"] if _inteiro(a.get("numero")) else "?"} ("{nome}"): '


def _texto(valor, onde: str, erros: list[str], feminino: bool = False) -> None:
    """ERRO quando `valor` não é um texto preenchido; `onde` é o caminho do campo na mensagem."""
    if _vazio(valor):
        erros.append(f"{onde} {'vazia' if feminino else 'vazio'}: informe um texto.")
    elif not isinstance(valor, str):
        erros.append(f"{onde} precisa ser texto (veio {valor!r}).")


def _validar_ondas(plano: dict, erros: list[str], avisos: list[str]) -> None:
    """Confere ondas, checkpoints e a cobertura das ações; plano sem `ondas` só recebe um aviso."""
    brutas = plano.get("ondas")
    if brutas is None or brutas == []:
        avisos.append(
            "Plano sem ondas: o plano segue só os horizontes. Monte as ondas (janela, objetivo e "
            "checkpoint de cada uma) a partir do calendário estratégico de mídia."
        )
        return
    if not isinstance(brutas, list):
        erros.append("ondas precisa ser uma lista de objetos (uma por onda).")
        return

    referencia = _data_ou_none(plano.get("data_referencia"))
    fim_ciclo = _data_ou_none(plano.get("fim_ciclo"))
    existentes: dict[int, dict] = {}
    for a in _lista_de_acoes(plano):
        if _inteiro(a.get("numero")):
            existentes.setdefault(a["numero"], a)

    total = len(brutas)
    numeros = [o.get("numero") if isinstance(o, dict) else None for o in brutas]
    if numeros != list(range(1, total + 1)) or not all(_inteiro(n) for n in numeros):
        erros.append(f"As ondas precisam ser numeradas de 1 a {total}, na ordem (veio {numeros}).")

    # Cada onda lida: (posição, rótulo, objeto, início, fim, data do checkpoint).
    lidas: list[tuple] = []
    onde_esta: dict[int, list[str]] = {}
    for pos, o in enumerate(brutas, start=1):
        if not isinstance(o, dict):
            erros.append(
                f"Onda {pos}: precisa ser um objeto com numero, nome, inicio, fim, calendario_midia, "
                "objetivo, acoes e checkpoint."
            )
            continue
        rotulo = f"Onda {o['numero'] if _inteiro(o.get('numero')) else pos}"

        for campo in _CAMPOS_TEXTO_ONDA:
            _texto(o.get(campo), f"{rotulo}: campo {campo}", erros)

        datas = []
        for campo in ("inicio", "fim"):
            try:
                datas.append(ler_data(o.get(campo), campo))
            except ErroPlano as e:
                erros.append(f"{rotulo}: {e}")
                datas.append(None)
        ini, fim = datas
        if ini and fim and ini > fim:
            erros.append(f"{rotulo}: o início {_fmt(ini)} é depois do fim {_fmt(fim)}.")

        listadas = o.get("acoes")
        if not isinstance(listadas, list):
            erros.append(f"{rotulo}: acoes precisa ser uma lista de números de ação.")
        else:
            if not listadas:
                avisos.append(f"{rotulo}: não tem nenhuma ação; distribua as ações do plano pelas ondas.")
            vistas: set[int] = set()
            for n in listadas:
                if not _inteiro(n):
                    erros.append(f"{rotulo}: cita {n!r}, que não é um número de ação.")
                    continue
                if n in vistas:
                    erros.append(f"{rotulo}: cita a ação {n} mais de uma vez.")
                    continue
                vistas.add(n)
                if n not in existentes:
                    erros.append(f"{rotulo}: cita a ação {n}, que não existe no plano.")
                    continue
                onde_esta.setdefault(n, []).append(rotulo)
                inicio_acao = _data_ou_none(existentes[n].get("inicio"))
                if ini and fim and inicio_acao and not ini <= inicio_acao <= fim:
                    erros.append(
                        f"{_prefixo_acao(existentes[n])}início {_fmt(inicio_acao)} fora da janela da {rotulo} "
                        f"({_fmt(ini)} a {_fmt(fim)})."
                    )

        cp = o.get("checkpoint")
        data_cp = None
        if cp is None:
            if pos != total:
                avisos.append(
                    f"{rotulo}: sem checkpoint; toda onda, exceto a última, termina num checkpoint "
                    "com data, pauta e quem decide."
                )
        elif not isinstance(cp, dict):
            erros.append(
                f"{rotulo}: checkpoint precisa ser um objeto com data, duracao, pauta, para_liberar "
                "e quem_decide (ou null)."
            )
        else:
            try:
                data_cp = ler_data(cp.get("data"), "checkpoint.data")
            except ErroPlano as e:
                erros.append(f"{rotulo}: {e}")
            for campo in _CAMPOS_CHECKPOINT:
                _texto(cp.get(campo), f"{rotulo}: checkpoint.{campo}", erros)
        lidas.append((pos, rotulo, o, ini, fim, data_cp))

    for n, rotulos in onde_esta.items():
        if len(rotulos) > 1:
            erros.append(f"{_prefixo_acao(existentes[n])}está em mais de uma onda ({' e '.join(rotulos)}).")
    for n, a in existentes.items():
        if n not in onde_esta:
            erros.append(f"{_prefixo_acao(a)}não está em nenhuma onda.")

    # Ordem e limites entre as ondas.
    anterior = None
    for atual in lidas:
        _, rotulo, _, ini, fim, _ = atual
        if anterior is not None and ini:
            _, rotulo_ant, _, ini_ant, fim_ant, _ = anterior
            if ini_ant and ini < ini_ant:
                erros.append(
                    f"{rotulo}: fora de ordem, começa em {_fmt(ini)} antes da {rotulo_ant} ({_fmt(ini_ant)})."
                )
            elif fim_ant and ini <= fim_ant:
                erros.append(
                    f"{rotulo}: começa em {_fmt(ini)}, mas a {rotulo_ant} só termina em {_fmt(fim_ant)}; "
                    "as ondas não podem se sobrepor."
                )
        anterior = atual
    if lidas and lidas[0][0] == 1 and lidas[0][3] and referencia and lidas[0][3] < referencia:
        erros.append(
            f"{lidas[0][1]}: início {_fmt(lidas[0][3])} antes da data de referência {_fmt(referencia)}."
        )
    if lidas and lidas[-1][0] == total and lidas[-1][4] and fim_ciclo and lidas[-1][4] > fim_ciclo:
        erros.append(f"{lidas[-1][1]}: fim {_fmt(lidas[-1][4])} depois do fim do ciclo ({_fmt(fim_ciclo)}).")

    # O checkpoint cai entre o início da onda e o início da seguinte (a última: até o fim do ciclo).
    for i, (pos, rotulo, _, ini, _, data_cp) in enumerate(lidas):
        if not data_cp:
            continue
        if ini and data_cp < ini:
            erros.append(
                f"{rotulo}: checkpoint.data {_fmt(data_cp)} antes do início da onda ({_fmt(ini)})."
            )
        if pos == total:
            if fim_ciclo and data_cp > fim_ciclo:
                erros.append(
                    f"{rotulo}: checkpoint.data {_fmt(data_cp)} depois do fim do ciclo ({_fmt(fim_ciclo)})."
                )
        elif i + 1 < len(lidas) and lidas[i + 1][0] == pos + 1:
            _, rotulo_seg, _, ini_seg, _, _ = lidas[i + 1]
            if ini_seg and data_cp > ini_seg:
                erros.append(
                    f"{rotulo}: checkpoint.data {_fmt(data_cp)} depois do início da {rotulo_seg} ({_fmt(ini_seg)})."
                )


def _validar_tabela(bloco, nome: str, erros: list[str]) -> bool:
    """Confere `colunas` e `linhas` de uma tabela; False quando o bloco nem é um objeto."""
    if not isinstance(bloco, dict):
        erros.append(f"{nome} precisa ser um objeto com colunas e linhas.")
        return False
    colunas = bloco.get("colunas")
    colunas_ok = (
        isinstance(colunas, list) and bool(colunas)
        and all(isinstance(c, str) and c.strip() for c in colunas)
    )
    if not colunas_ok:
        erros.append(f"{nome}.colunas precisa ser uma lista de títulos em texto e não pode ficar vazia.")
    linhas = bloco.get("linhas")
    if not isinstance(linhas, list):
        erros.append(f"{nome}.linhas precisa ser uma lista de linhas (cada linha, uma lista de textos).")
        return True
    for i, linha in enumerate(linhas, start=1):
        if not isinstance(linha, list) or not all(isinstance(c, str) for c in linha):
            erros.append(f"{nome}.linhas[{i}] precisa ser uma lista de textos, um por coluna.")
        elif colunas_ok and len(linha) != len(colunas):
            erros.append(f"{nome}.linhas[{i}]: {len(linha)} células, mas colunas tem {len(colunas)}.")
    return True


def _validar_lista_de_pares(valor, nome: str, campos: tuple, erros: list[str]) -> None:
    """Lista de objetos com os `campos` em texto (`como_funciona`, `kpis_acompanhamento`)."""
    if not isinstance(valor, list):
        erros.append(f"{nome} precisa ser uma lista de objetos com {' e '.join(campos)}.")
        return
    for i, item in enumerate(valor, start=1):
        if not isinstance(item, dict):
            erros.append(f"{nome}[{i}] precisa ser um objeto com {' e '.join(campos)}.")
            continue
        for campo in campos:
            _texto(item.get(campo), f"{nome}[{i}].{campo}", erros)


def _validar_blocos_novos(plano: dict, erros: list[str], avisos: list[str]) -> None:
    """Decisões do cliente por ação e os blocos opcionais do plano com ondas."""
    referencia = _data_ou_none(plano.get("data_referencia"))
    fim_ciclo = _data_ou_none(plano.get("fim_ciclo"))

    for a in _lista_de_acoes(plano):
        decisao = a.get("decisao_cliente")
        if decisao is None:
            continue
        pre = _prefixo_acao(a)
        if not isinstance(decisao, dict):
            erros.append(f"{pre}decisao_cliente precisa ser um objeto com ate e recomendacao (ou null).")
            continue
        try:
            ate = ler_data(decisao.get("ate"), "decisao_cliente.ate")
        except ErroPlano as e:
            erros.append(f"{pre}{e}")
        else:
            if referencia and fim_ciclo and not referencia <= ate <= fim_ciclo:
                erros.append(
                    f"{pre}decisao_cliente.ate {_fmt(ate)} fora do ciclo "
                    f"({_fmt(referencia)} a {_fmt(fim_ciclo)})."
                )
        _texto(decisao.get("recomendacao"), f"{pre}decisao_cliente.recomendacao", erros, feminino=True)

    como_funciona = plano.get("como_funciona")
    if como_funciona is not None and como_funciona != []:
        _validar_lista_de_pares(como_funciona, "como_funciona", ("titulo", "texto"), erros)

    metas = plano.get("metas_mensais")
    if metas is not None and _validar_tabela(metas, "metas_mensais", erros):
        _texto(metas.get("cenario"), "metas_mensais.cenario", erros)
        if metas.get("observacao") is not None and not isinstance(metas["observacao"], str):
            erros.append(f"metas_mensais.observacao precisa ser texto ou null (veio {metas['observacao']!r}).")

    sessoes = plano.get("sessoes_nao_pagas")
    if sessoes is not None and _validar_tabela(sessoes, "sessoes_nao_pagas", erros):
        for campo in ("premissas", "risco"):
            valor = sessoes.get(campo)
            if isinstance(valor, list) and valor and all(isinstance(t, str) and t.strip() for t in valor):
                continue  # premissas pode ser uma lista de textos, como em abertura.premissas
            _texto(valor, f"sessoes_nao_pagas.{campo}", erros)

    protocolo = plano.get("protocolo_mudanca")
    if protocolo is not None:
        if not isinstance(protocolo, dict):
            erros.append("protocolo_mudanca precisa ser um objeto com intro e regras.")
        else:
            _texto(protocolo.get("intro"), "protocolo_mudanca.intro", erros)
            regras = protocolo.get("regras")
            if not isinstance(regras, list) or not regras:
                erros.append("protocolo_mudanca.regras precisa ser uma lista de textos e não pode ficar vazia.")
            else:
                for i, regra in enumerate(regras, start=1):
                    _texto(regra, f"protocolo_mudanca.regras[{i}]", erros)

    kpis = plano.get("kpis_acompanhamento")
    if kpis is not None and kpis != []:
        _validar_lista_de_pares(kpis, "kpis_acompanhamento", ("kpi", "meta_limite"), erros)
    elif plano.get("ondas"):
        avisos.append(
            "O plano não tem kpis_acompanhamento: liste os KPIs e o limite de cada um (com número do "
            "cenário aprovado) para o acompanhamento entre os checkpoints."
        )


def validar(plano, registro, rascunho: bool = False) -> tuple[list[str], list[str]]:
    """Valida o plano v2 contra o registro de soluções; devolve (erros, avisos)."""
    erros: list[str] = []
    avisos: list[str] = []
    if not isinstance(plano, dict):
        return ["O plano precisa ser um objeto JSON com os campos da versao 2."], []

    def data(texto, onde, prefixo="") -> date | None:
        try:
            return ler_data(texto, onde)
        except ErroPlano as e:
            erros.append(f"{prefixo}{e}")
            return None

    if plano.get("versao") != 2 or isinstance(plano.get("versao"), bool):
        erros.append(f'O plano precisa ser da versao 2 (campo versao está {plano.get("versao")!r}).')

    referencia = data(plano.get("data_referencia"), "data_referencia")
    fim_ciclo = data(plano.get("fim_ciclo"), "fim_ciclo")
    janela_ini = janela_fim = None
    janela = plano.get("janela_prova")
    if isinstance(janela, dict):
        janela_ini = data(janela.get("inicio"), "janela_prova.inicio")
        janela_fim = data(janela.get("fim"), "janela_prova.fim")
    else:
        erros.append("janela_prova ausente: informe inicio e fim em dd/mm/aaaa.")
    if janela_ini and janela_fim:
        if janela_ini > janela_fim:
            erros.append(
                f"janela de prova: o início {_fmt(janela_ini)} é depois do fim {_fmt(janela_fim)}."
            )
        else:
            dias = (janela_fim - janela_ini).days
            if not _JANELA_DIAS[0] <= dias <= _JANELA_DIAS[1]:
                avisos.append(
                    f"A janela de prova tem {dias} dias; o esperado é de {_JANELA_DIAS[0]} a "
                    f"{_JANELA_DIAS[1]} dias (cerca de três meses)."
                )
    if janela_fim and fim_ciclo and janela_fim > fim_ciclo:
        erros.append(
            f"janela de prova: o fim {_fmt(janela_fim)} é depois do fim do ciclo ({_fmt(fim_ciclo)})."
        )
    if janela_ini and referencia and janela_ini < referencia:
        erros.append(
            f"janela de prova: o início {_fmt(janela_ini)} fica antes da data de referência {_fmt(referencia)}."
        )

    abertura = plano.get("abertura")
    margem = None
    if abertura is None or isinstance(abertura, dict):
        abertura = abertura or {}
        margem = abertura.get("margem_contribuicao")
        if rascunho and isinstance(margem, str) and "[PREENCHER" in margem:
            margem = None  # no rascunho, o marcador vale como margem ausente
        quebra = abertura.get("taxa_quebra")
        if quebra is not None and (
            not isinstance(quebra, (int, float)) or isinstance(quebra, bool) or not 0 <= quebra < 1
        ):
            erros.append(
                f"abertura.taxa_quebra inválida: use fração entre 0 e 1 (ex.: 0.055); veio {quebra!r}."
            )
        if not rascunho and _vazio(abertura.get("cenario")):
            erros.append("abertura.cenario vazio: informe o cenário (Pessimista, Realista ou Otimista).")
        metas = abertura.get("metas")
        if isinstance(metas, list):
            if not metas and not rascunho:
                erros.append("abertura.metas vazia: informe ao menos uma meta (kpi, de, para, ate e fonte).")
            for i, meta in enumerate(metas, start=1):
                if isinstance(meta, dict):
                    data(meta.get("ate"), f"abertura.metas[{i}].ate")
                    if not rascunho:
                        for campo in ("kpi", "de", "para", "fonte"):
                            valor = meta.get(campo)
                            if _vazio(valor) or not isinstance(valor, str):
                                erros.append(f"abertura.metas[{i}].{campo} vazio: informe um texto.")
                else:
                    erros.append(f"abertura.metas[{i}]: a meta precisa ser um objeto com kpi, de, para, ate e fonte.")
        elif metas is not None:
            erros.append("abertura.metas precisa ser uma lista.")
        elif not rascunho:
            erros.append("abertura.metas ausente: informe ao menos uma meta (kpi, de, para, ate e fonte).")
    else:
        erros.append("abertura precisa ser um objeto.")

    horizontes = plano.get("horizontes")
    if not isinstance(horizontes, list):
        horizontes = []
    nomes = [h.get("nome") if isinstance(h, dict) else None for h in horizontes]
    if nomes != list(HORIZONTES):
        erros.append(f"Os horizontes precisam ser, nesta ordem: {', '.join(HORIZONTES)}.")

    # Reúne as ações com número e rótulo antes de checar uma a uma.
    lista: list[dict] = []
    horizonte_da_acao: dict[int, str] = {}  # id(objeto da ação) -> nome do horizonte
    for h in horizontes:
        if not isinstance(h, dict):
            continue
        brutas = h.get("acoes")
        if not isinstance(brutas, list):
            erros.append(f'Horizonte "{h.get("nome")}": acoes precisa ser uma lista.')
            continue
        for a in brutas:
            if isinstance(a, dict):
                lista.append(a)
                horizonte_da_acao[id(a)] = h.get("nome")
            else:
                erros.append(f'Horizonte "{h.get("nome")}": cada ação precisa ser um objeto.')

    def eh_numero(n) -> bool:
        return isinstance(n, int) and not isinstance(n, bool)

    por_numero: dict[int, dict] = {}
    for a in lista:
        n = a.get("numero")
        if eh_numero(n):
            por_numero.setdefault(n, a)

    prospect = plano.get("prospect")
    empresas = {"Cliente"}
    for chave in ("empresa_agencia", "agencia_parceira"):
        if isinstance(plano.get(chave), str) and plano[chave].strip():
            empresas.add(plano[chave].strip())
    if isinstance(prospect, str) and prospect.strip():
        empresas.add(prospect.strip())

    vistos: set[int] = set()
    datas: dict[int, tuple[date | None, date | None]] = {}
    for a in lista:
        n = a.get("numero")
        nome = a.get("acao") if isinstance(a.get("acao"), str) else ""
        pre = f'Ação {n if eh_numero(n) else "?"} ("{nome}"): '

        if not eh_numero(n):
            erros.append(f"{pre}número inválido: use um inteiro único por ação.")
        elif n in vistos:
            erros.append(f"{pre}número {n} repetido.")
        else:
            vistos.add(n)

        for campo in CAMPOS_ACAO:
            if _vazio(a.get(campo)):
                erros.append(f"{pre}campo {campo} vazio.")
            elif campo not in ("inicio", "entrega") and not isinstance(a[campo], str):
                erros.append(f"{pre}campo {campo} precisa ser texto (veio {a[campo]!r}).")

        if a.get("frente") not in FRENTES:
            erros.append(f'{pre}frente "{a.get("frente")}" fora das cinco frentes: {"; ".join(FRENTES)}.')

        ini = fim = None
        if not _vazio(a.get("inicio")):
            ini = data(a["inicio"], "inicio", pre)
        if not _vazio(a.get("entrega")):
            fim = data(a["entrega"], "entrega", pre)
        if eh_numero(n):
            datas.setdefault(n, (ini, fim))
        if ini and referencia and ini < referencia:
            erros.append(f"{pre}início {_fmt(ini)} antes da data de referência {_fmt(referencia)}.")
        if ini and fim and fim < ini:
            erros.append(f"{pre}entrega antes do início ({_fmt(fim)} < {_fmt(ini)}).")
        if fim and fim_ciclo and fim > fim_ciclo:
            erros.append(f"{pre}entrega {_fmt(fim)} depois do fim do ciclo ({_fmt(fim_ciclo)}).")

        dono = a.get("dono")
        if isinstance(dono, str) and dono.strip():
            disciplina, sep, empresa = dono.partition(_SEPARADOR_DONO)
            if not sep or not disciplina.strip() or not empresa.strip():
                erros.append(f'{pre}dono "{dono}" fora do formato disciplina · empresa.')
            elif empresa.strip() not in empresas:
                erros.append(
                    f'{pre}empresa "{empresa.strip()}" do dono não é uma das aceitas: '
                    f'{", ".join(sorted(empresas))}.'
                )

        gatilho = a.get("gatilho")
        if isinstance(gatilho, str) and gatilho.strip():
            g = gatilho.strip().lower()
            if not (g.startswith("se ") and " então " in g):
                erros.append(f'{pre}gatilho precisa seguir o formato "Se … então …".')

        if "alavanca_da_meta" not in a:
            erros.append(f"{pre}alavanca_da_meta ausente: informe true ou false.")
        elif not isinstance(a["alavanca_da_meta"], bool):
            erros.append(f'{pre}alavanca_da_meta precisa ser true ou false (veio {a["alavanca_da_meta"]!r}).')

        if a.get("alavanca_da_meta") is True and janela_ini and janela_fim:
            fora = [
                f"{rotulo} {_fmt(d)}"
                for rotulo, d in (("início", ini), ("entrega", fim))
                if d and not (janela_ini <= d <= janela_fim)
            ]
            if fora:
                erros.append(
                    f"{pre}é alavanca da meta, mas {' e '.join(fora)} ficam fora da janela de prova "
                    f"({_fmt(janela_ini)} a {_fmt(janela_fim)}); a janela termina em {_fmt(janela_fim)}."
                )

        if horizonte_da_acao.get(id(a)) == "Imediato" and ini and fim and (fim - ini).days > _MAX_DIAS_IMEDIATO:
            avisos.append(
                f"{pre}está no Imediato, mas leva {(fim - ini).days} dias "
                f"(mais de {_MAX_DIAS_IMEDIATO} dias); reveja o horizonte ou quebre a ação."
            )

    # Dependências: existência, ordem das datas e ciclos.
    grafo: dict[int, list[int]] = {}
    for a in lista:
        n = a.get("numero")
        nome = a.get("acao") if isinstance(a.get("acao"), str) else ""
        pre = f'Ação {n if eh_numero(n) else "?"} ("{nome}"): '
        deps = a.get("depende_de")
        if deps is None:
            deps = []
        if not isinstance(deps, list):
            erros.append(f"{pre}depende_de precisa ser uma lista de números de ação.")
            continue
        ini_desta = datas.get(n, (None, None))[0] if eh_numero(n) else None
        validas: list[int] = []
        for d in deps:
            if not eh_numero(d):
                erros.append(f"{pre}depende da ação {d!r}, que não é um número de ação.")
            elif d == n:
                erros.append(f"{pre}depende da ação {d}, que é ela mesma.")
            elif d not in por_numero:
                erros.append(f"{pre}depende da ação {d}, que não existe no plano.")
            else:
                validas.append(d)
                entrega_dep = datas.get(d, (None, None))[1]
                if ini_desta and entrega_dep and entrega_dep > ini_desta:
                    erros.append(
                        f"{pre}depende da ação {d}, que só termina em {_fmt(entrega_dep)}, "
                        f"depois do início desta ação ({_fmt(ini_desta)})."
                    )
        if eh_numero(n) and n not in grafo:
            grafo[n] = validas
    for ciclo in _ciclos(grafo):
        erros.append("Há ciclo de dependência entre as ações: " + " → ".join(str(x) for x in ciclo) + ".")

    # Cobertura: toda solução do registro vira ação, e toda solução citada existe.
    ids = _ids_do_registro(registro)
    if ids is None:
        erros.append('O registro de soluções não tem a lista "problemas"; não dá para conferir a cobertura.')
    else:
        conhecidos, cobertos = set(ids), set()
        for a in lista:
            n = a.get("numero")
            pre = f'Ação {n if eh_numero(n) else "?"} ("{a.get("acao") if isinstance(a.get("acao"), str) else ""}"): '
            sols = a.get("solucoes")
            if sols is None:
                sols = []
            if not isinstance(sols, list):
                erros.append(f'{pre}solucoes precisa ser uma lista de ids de solução (ex.: ["P1.S1"]).')
                continue
            for sid in sols:
                if not isinstance(sid, str):
                    erros.append(f'{pre}cada item de solucoes precisa ser um id de solução em texto (ex.: "P1.S1").')
                elif sid in conhecidos:
                    cobertos.add(sid)
                else:
                    erros.append(f"{pre}cita a solução {sid}, que não existe no registro.")
        for sid in ids:
            if sid not in cobertos:
                erros.append(f"Solução {sid} do registro não virou nenhuma ação do plano.")

    # Avisos: não bloqueiam, mas o analista precisa ver.
    dependidas = {
        d
        for a in lista
        for d in (a.get("depende_de") if isinstance(a.get("depende_de"), list) else [])
        if eh_numero(d)
    }
    for a in lista:
        n = a.get("numero")
        nome = a.get("acao") if isinstance(a.get("acao"), str) else ""
        pre = f'Ação {n if eh_numero(n) else "?"} ("{nome}"): '
        palavras = nome.split()
        primeira = palavras[0].lower() if palavras else ""
        if primeira in _VERBOS_VAGOS:
            avisos.append(f'{pre}começa com o verbo vago "{primeira}"; diga o que será feito, com objeto e resultado.')
        if primeira in _VERBOS_DIAGNOSTICO and not (eh_numero(n) and n in dependidas):
            avisos.append(
                f'{pre}é uma ação de diagnóstico ("{primeira}") e nenhuma outra ação depende dela; '
                "ligue o que ela descobre a uma ação seguinte via depende_de."
            )
    for frente in FRENTES:
        if not any(a.get("frente") == frente for a in lista):
            avisos.append(f'A frente "{frente}" não tem nenhuma ação no plano.')

    if not rascunho:
        for caminho, texto in _marcacoes(plano):
            marca = next(m for m in _MARCAS if m in texto)
            erros.append(
                f'Há marcação {marca}] pendente em {caminho}: resolva com o analista antes de gerar a versão final.'
            )

    if margem is None:
        if rascunho:
            avisos.append(
                "A margem de contribuição está ausente: o piso de ROAS vai sair como [PREENCHER] até "
                "informar abertura.margem_contribuicao."
            )
        else:
            erros.append(
                "A margem de contribuição está ausente: sem ela o piso de ROAS fica [PREENCHER]. "
                "Informe abertura.margem_contribuicao."
            )
    elif pisos_roas(margem, None)["aprovada"] is None:
        erros.append(f"A margem de contribuição {margem!r} é inválida: use um número maior que 0 e até 1.")

    _validar_ondas(plano, erros, avisos)
    _validar_blocos_novos(plano, erros, avisos)

    return erros, avisos


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Valida o plano de ação v2 (Skill 08).")
    p.add_argument("--plano", required=True, type=Path)
    p.add_argument("--registro", required=True, type=Path)
    p.add_argument("--rascunho", action="store_true", help="aceita marcações [VALIDAR]/[PREENCHER] e margem ausente")
    a = p.parse_args(argv)
    try:
        plano = _ler_json(a.plano, "plano")
        registro = _ler_json(a.registro, "registro")
    except ErroEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    erros, avisos = validar(plano, registro, rascunho=a.rascunho)
    for aviso in avisos:
        print(f"AVISO: {aviso}")
    if erros:
        for erro in erros:
            print(f"ERRO: {erro}", file=sys.stderr)
        return 1
    total = len(_ids_do_registro(registro) or [])
    print(f"OK: {len(acoes(plano))} ações, {total} soluções cobertas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
