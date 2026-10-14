# Soluções no diagnóstico: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** aplicar o treinamento "Do diagnóstico à solução" como padrão do pipeline: etapa nova `05-solucoes`, registro `contexto/solucoes.json` validado em código, cards de desafio no deck e renumeração das etapas seguintes.

**Arquitetura:** a garantia fica em `scripts/validar_solucoes.py` (mesmo contrato `ERRO:`/`AVISO:` do `projecao.py`), que valida o registro, gera a seção `secoes/05-solucoes.md` e confere o plano de ação contra o registro. O deck ganha o tipo `desafio`, derivado do slide `analises_2_colunas` do molde. As skills (texto) passam a ler e alimentar o registro. O app só muda na ordem das etapas e na leitura de estado legado.

**Stack:** Python 3.9+ (`python-pptx`, `pytest`), TypeScript (vitest) em `src/packages/core`, skills em Markdown.

**Spec:** `docs/superpowers/specs/2026-10-13-solucoes-no-diagnostico-design.md`

## Restrições globais

- Travessão (—) só em intervalo numérico (ex.: 10—20) em todo texto novo de skill, `etapas.json`, `modelos-insumo` e código do app. O teste `src/packages/core/test/sem-travessao.test.ts` cobre parte disso; nos `SKILL.md`, use dois-pontos ou vírgula.
- Python compatível com 3.9: `from __future__ import annotations` no topo; nada de `match`, nem `X | None` fora de anotações.
- Scripts recusam com `ERRO: <motivo>` no stderr e código 1; avisos saem como `AVISO:` e não bloqueiam.
- PII (CLAUDE.md raiz): nenhum CPF, e-mail, telefone, endereço ou cartão em registro, seção ou deck.
- Nome de arquivo estável, sem versionamento: revisão sobrescreve.
- Benchmark de KPI nunca vem de memória do modelo: vem de `_shared/benchmarks-kpi.md`, do analista ou do `pesquisador-benchmark` com fonte.
- Frentes válidas no registro (texto exato): `Mídia Paga / Canal Principal`, `Eficiência Operacional`, `Produto / Mix / Portfólio`, `Redução de Dependências`, `Monitoramento e Governança`.
- Soluções por problema: de 1 a 3. Hipóteses por problema: pelo menos 1 (até 5 no slide).
- Rodar testes Python com `python3 -m pytest` a partir da raiz; testes TS com `npm test` dentro de `src/packages/core`.
- Tarefas 13 e 14 estão **pendentes de validação da liderança**: só executar com aprovação explícita do analista; podem ser removidas sem afetar as demais.

## Foco de revisão

1. Prospect legado (`estado.json` sem a etapa nova) aberto no app: deve abrir normalmente, com a etapa ausente bloqueada. Teste na Tarefa 6.
2. Solução que aponta para hipótese de **outro** problema: deve ser recusada, não aceita por coincidência de id `H1`. Teste na Tarefa 1.
3. Registro ausente ou JSON malformado na linha de comando: `ERRO:` legível e código 1, sem traceback. Teste na Tarefa 2.
4. Ação do plano com nome diferente do da tabela-resumo (ex.: espaço a mais): `ERRO:` apontando a ação, nunca aprovação silenciosa. Teste na Tarefa 3.
5. Deck de prospect sem `contexto/solucoes.json` (legado ou etapa pulada): gera sem aviso de desafio e sem quebrar. Teste na Tarefa 5.

---

### Tarefa 1: validador do registro

**Arquivos:**
- Criar: `scripts/validar_solucoes.py`
- Teste: `scripts/tests/test_validar_solucoes.py`

**Interfaces:**
- Produz: `FRENTES: tuple[str, ...]`, `validar_registro(registro: dict) -> tuple[list[str], list[str]]` (erros, avisos).

- [ ] **Passo 1: escrever os testes que falham**

```python
from __future__ import annotations

import copy
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


def test_hipotese_de_outro_problema_nao_vale():
    # P2 tem H1; P1 só tem H1 e H2. Uma solução do P2 apontando para H2 precisa falhar.
    r = registro_valido()
    r["problemas"][1]["solucoes"][0]["hipotese"] = "H2"
    erros, _ = vs.validar_registro(r)
    assert any("P2" in e and "H2" in e for e in erros), erros
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `python3 -m pytest scripts/tests/test_validar_solucoes.py -v`
Esperado: FAIL com `ModuleNotFoundError: No module named 'validar_solucoes'`

- [ ] **Passo 3: implementar**

```python
#!/usr/bin/env python3
"""
scripts/validar_solucoes.py: garante em código a regra de ouro do treinamento
"Do diagnóstico à solução": nenhum problema sai do diagnóstico sem solução.

    python3 scripts/validar_solucoes.py --modo registro --registro contexto/solucoes.json [--markdown <secao.md>]
    python3 scripts/validar_solucoes.py --modo plano --registro contexto/solucoes.json --plano <plano.json>

registro: confere hipóteses, 1 a 3 soluções, impacto e frente de cada problema
e, com --markdown, gera a seção aprovável a partir do registro.
plano: confere que toda solução do registro virou ação do plano de ação.
ERRO: (código 1) bloqueia; AVISO: não bloqueia.
"""

from __future__ import annotations

import re
from typing import List, Tuple

FRENTES = (
    "Mídia Paga / Canal Principal",
    "Eficiência Operacional",
    "Produto / Mix / Portfólio",
    "Redução de Dependências",
    "Monitoramento e Governança",
)
TIPOS_IMPACTO = ("R$", "%", "nao_quantificavel")
MIN_SOLUCOES, MAX_SOLUCOES = 1, 3
RE_PROBLEMA = re.compile(r"^P\d+$")
RE_HIPOTESE = re.compile(r"^H\d+$")
RE_SOLUCAO = re.compile(r"^P\d+\.S\d+$")


def _texto(valor) -> bool:
    return isinstance(valor, str) and bool(valor.strip())


def _validar_impacto(impacto, onde: str, erros: List[str], avisos: List[str]) -> None:
    if not isinstance(impacto, dict):
        erros.append(f"{onde}: impacto obrigatório (R$, % ou nao_quantificavel com justificativa).")
        return
    tipo = impacto.get("tipo")
    if tipo not in TIPOS_IMPACTO:
        erros.append(f"{onde}: tipo de impacto \"{tipo}\" inválido. Use R$, % ou nao_quantificavel.")
        return
    if tipo == "nao_quantificavel":
        if _texto(impacto.get("justificativa")):
            avisos.append(f"{onde}: impacto não quantificado ({impacto['justificativa'].strip()}).")
        else:
            erros.append(f"{onde}: impacto nao_quantificavel precisa de justificativa.")
        return
    for campo in ("valor", "calculo"):
        if not _texto(impacto.get(campo)):
            erros.append(f"{onde}: impacto em {tipo} precisa de {campo}.")


def validar_registro(registro) -> Tuple[List[str], List[str]]:
    erros: List[str] = []
    avisos: List[str] = []
    problemas = registro.get("problemas") if isinstance(registro, dict) else None
    if not isinstance(problemas, list) or not problemas:
        return ["o registro não tem a lista \"problemas\" (ou ela está vazia)."], avisos
    ids_problema = set()
    ids_solucao = set()
    for i, p in enumerate(problemas, start=1):
        if not isinstance(p, dict):
            erros.append(f"Problema #{i}: formato inválido.")
            continue
        pid = p.get("id")
        onde = f"Problema {pid}" if _texto(pid) else f"Problema #{i}"
        if not _texto(pid) or not RE_PROBLEMA.match(pid):
            erros.append(f"{onde}: id precisa ter o formato P<n> (ex.: P1).")
        elif pid in ids_problema:
            erros.append(f"{onde}: id repetido.")
        else:
            ids_problema.add(pid)
        for campo in ("titulo", "origem", "dado", "benchmark"):
            if not _texto(p.get(campo)):
                erros.append(f"{onde}: campo {campo} obrigatório.")

        ids_hipotese = set()
        hipoteses = p.get("hipoteses")
        if not isinstance(hipoteses, list) or not hipoteses:
            erros.append(f"{onde}: precisa de pelo menos 1 hipótese de causa antes das soluções.")
        else:
            for h in hipoteses:
                hid = h.get("id") if isinstance(h, dict) else None
                if not _texto(hid) or not RE_HIPOTESE.match(hid) or not _texto(h.get("texto")):
                    erros.append(f"{onde}: toda hipótese precisa de id H<n> e texto.")
                    continue
                if hid in ids_hipotese:
                    erros.append(f"{onde}: hipótese {hid} repetida.")
                ids_hipotese.add(hid)

        solucoes = p.get("solucoes")
        quantidade = len(solucoes) if isinstance(solucoes, list) else 0
        if not MIN_SOLUCOES <= quantidade <= MAX_SOLUCOES:
            erros.append(f"{onde}: precisa de 1 a 3 soluções (tem {quantidade}).")
        for s in solucoes if isinstance(solucoes, list) else []:
            sid = s.get("id") if isinstance(s, dict) else None
            if not _texto(sid) or not RE_SOLUCAO.match(sid):
                erros.append(f"{onde}: toda solução precisa de id no formato P<n>.S<m>.")
                continue
            if _texto(pid) and not sid.startswith(f"{pid}."):
                erros.append(f"{onde}: a solução {sid} precisa começar com {pid}.")
            if sid in ids_solucao:
                erros.append(f"{onde}: solução {sid} repetida.")
            ids_solucao.add(sid)
            if not _texto(s.get("acao")):
                erros.append(f"{onde}, solução {sid}: campo acao obrigatório.")
            if s.get("hipotese") not in ids_hipotese:
                erros.append(f"{onde}, solução {sid}: aponta para a hipótese \"{s.get('hipotese')}\", que não existe neste problema.")

        _validar_impacto(p.get("impacto"), onde, erros, avisos)
        if p.get("frente") not in FRENTES:
            erros.append(f"{onde}: frente \"{p.get('frente')}\" inválida. Use uma de: {', '.join(FRENTES)}.")
    return erros, avisos
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `python3 -m pytest scripts/tests/test_validar_solucoes.py -v`
Esperado: todos PASS

- [ ] **Passo 5: commit**

```bash
git add scripts/validar_solucoes.py scripts/tests/test_validar_solucoes.py
git commit -m "feat(scripts): valida o registro de soluções do diagnóstico"
```

---

### Tarefa 2: seção em Markdown e linha de comando

**Arquivos:**
- Modificar: `scripts/validar_solucoes.py`
- Teste: `scripts/tests/test_validar_solucoes.py`

**Interfaces:**
- Consome: `validar_registro` (Tarefa 1).
- Produz: `gerar_markdown(registro: dict) -> str`; `main(argv: list[str] | None) -> int` com `--modo registro|plano`, `--registro`, `--plano`, `--markdown`. A Tarefa 3 preenche o modo plano.

- [ ] **Passo 1: escrever os testes que falham** (acrescentar ao arquivo de teste)

```python
import json


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
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `python3 -m pytest scripts/tests/test_validar_solucoes.py -v`
Esperado: FAIL com `AttributeError: module 'validar_solucoes' has no attribute 'gerar_markdown'`

- [ ] **Passo 3: implementar** (acrescentar ao fim de `scripts/validar_solucoes.py`; trocar os imports do topo por estes)

```python
import argparse
import json
import re
import sys
from pathlib import Path
from typing import List, Optional, Tuple
```

```python
class ErroEntrada(Exception):
    """Arquivo ausente, JSON inválido ou argumento faltando."""


def _impacto_md(impacto: dict) -> str:
    if impacto["tipo"] == "nao_quantificavel":
        return f"**Impacto:** não quantificável ({impacto['justificativa'].strip()})"
    return f"**Impacto:** {impacto['valor'].strip()} ({impacto['calculo'].strip()})"


def gerar_markdown(registro: dict) -> str:
    """Seção aprovável gerada do registro já validado; nunca editar à mão."""
    linhas = [f"# Soluções do diagnóstico: {registro.get('prospect', '').strip()}", ""]
    for p in registro["problemas"]:
        linhas += [
            f"## {p['id']} · {p['titulo'].strip()}",
            "",
            f"**Origem:** {p['origem'].strip()}  ",
            f"**Dado:** {p['dado'].strip()}  ",
            f"**Benchmark:** {p['benchmark'].strip()}  ",
            f"**Frente:** {p['frente']}",
            "",
            "**Hipóteses de causa**",
            "",
            *[f"- {h['id']} {h['texto'].strip()}" for h in p["hipoteses"]],
            "",
            "**Soluções**",
            "",
            *[f"- {s['id']} {s['acao'].strip()} (hipótese {s['hipotese']})" for s in p["solucoes"]],
            "",
            _impacto_md(p["impacto"]),
            "",
        ]
    fortes = registro.get("pontos_fortes") or []
    if fortes:
        linhas += ["## Pontos fortes", ""]
        linhas += [f"- **{f['titulo'].strip()}:** {f['dado'].strip()}. {f['uso'].strip()}" for f in fortes]
    return "\n".join(linhas).rstrip() + "\n"


def _ler_json(caminho: Path, nome: str):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ErroEntrada(f"{nome} não encontrado: {caminho}")
    except json.JSONDecodeError as e:
        raise ErroEntrada(f"o {nome} não é um JSON válido (linha {e.lineno}): {e.msg}")


def validar_plano(registro: dict, plano) -> Tuple[List[str], List[str]]:
    """Preenchido na Tarefa 3."""
    return [], []


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Valida o registro de soluções e o plano de ação.")
    p.add_argument("--modo", required=True, choices=["registro", "plano"])
    p.add_argument("--registro", required=True, type=Path)
    p.add_argument("--plano", type=Path)
    p.add_argument("--markdown", type=Path)
    a = p.parse_args(argv)
    try:
        registro = _ler_json(a.registro, "registro")
        erros, avisos = validar_registro(registro)
        if a.modo == "plano" and not erros:
            if a.plano is None:
                raise ErroEntrada("--modo plano precisa de --plano.")
            erros_plano, avisos_plano = validar_plano(registro, _ler_json(a.plano, "plano"))
            erros += erros_plano
            avisos += avisos_plano
    except ErroEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    for aviso in avisos:
        print(f"AVISO: {aviso}")
    if erros:
        alvo = "plano de ação" if a.modo == "plano" else "registro de soluções"
        print(f"ERRO: {alvo} inválido:\n" + "\n".join(f"- {e}" for e in erros), file=sys.stderr)
        return 1
    if a.markdown:
        a.markdown.parent.mkdir(parents=True, exist_ok=True)
        a.markdown.write_text(gerar_markdown(registro), encoding="utf-8")
        print(f"Seção gerada: {a.markdown}")
    total = sum(len(x["solucoes"]) for x in registro["problemas"])
    print(f"OK: {len(registro['problemas'])} problemas, {total} soluções.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `python3 -m pytest scripts/tests/test_validar_solucoes.py -v`
Esperado: todos PASS

- [ ] **Passo 5: commit**

```bash
git add scripts/validar_solucoes.py scripts/tests/test_validar_solucoes.py
git commit -m "feat(scripts): gera a seção de soluções e expõe o validador na linha de comando"
```

---

### Tarefa 3: modo plano (toda solução vira ação)

**Arquivos:**
- Modificar: `scripts/validar_solucoes.py` (substituir o `validar_plano` provisório)
- Modificar: `scripts/preencher_plano_acao_docx.py` (só o docstring do JSON de entrada)
- Teste: `scripts/tests/test_validar_solucoes.py`

**Interfaces:**
- Consome: formato do JSON de `preencher_plano_acao_docx.py` (`horizontes[].acoes[]` com `acao`, `o_que`, `quando`, `por_quem`, `como`; `tabela[]` com `acao`, `frente`, …), mais o campo novo opcional `acoes[].solucoes: list[str]`.
- Produz: `validar_plano(registro: dict, plano: dict) -> tuple[list[str], list[str]]`.

- [ ] **Passo 1: escrever os testes que falham**

```python
def plano_valido() -> dict:
    def acao(nome, solucoes):
        return {"acao": nome, "o_que": "x", "quando": "Semana 1", "por_quem": "Agência", "como": "y", "solucoes": solucoes}

    return {
        "prospect": "Marca Teste",
        "horizontes": [
            {"titulo": "H1", "intro": None, "acoes": [acao("Recuperar PIX", ["P1.S1"]), acao("Corrigir GA4", ["P2.S1"])]},
            {"titulo": "H2", "intro": "i", "acoes": [acao("Monitorar estoque", ["P1.S2"])]},
            {"titulo": "H3", "intro": "i", "acoes": [acao("Dashboard de KPIs", [])]},
        ],
        "tabela": [
            {"num": 1, "acao": "Recuperar PIX", "frente": "Eficiência Operacional", "horizonte": "Imediato", "quando": "S1", "por_quem": "Agência"},
            {"num": 2, "acao": "Corrigir GA4", "frente": "Governança", "horizonte": "Imediato", "quando": "S1", "por_quem": "Agência"},
            {"num": 3, "acao": "Monitorar estoque", "frente": "Eficiência Operacional", "horizonte": "Curto Prazo", "quando": "M1", "por_quem": "Cliente"},
            {"num": 4, "acao": "Dashboard de KPIs", "frente": "Governança", "horizonte": "Médio Prazo", "quando": "M3", "por_quem": "Agência"},
        ],
    }


def test_plano_valido_passa():
    assert vs.validar_plano(registro_valido(), plano_valido()) == ([], [])


def test_solucao_sem_acao_bloqueia():
    plano = plano_valido()
    plano["horizontes"][1]["acoes"][0]["solucoes"] = []
    erros, _ = vs.validar_plano(registro_valido(), plano)
    assert any("P1.S2" in e and "não virou nenhuma ação" in e for e in erros), erros


def test_acao_citando_solucao_inexistente():
    plano = plano_valido()
    plano["horizontes"][0]["acoes"][0]["solucoes"].append("P9.S1")
    erros, _ = vs.validar_plano(registro_valido(), plano)
    assert any("P9.S1" in e and "não existe no registro" in e for e in erros), erros


def test_acao_com_nome_diferente_na_tabela():
    plano = plano_valido()
    plano["tabela"][0]["acao"] = "Recuperar PIX "
    erros, _ = vs.validar_plano(registro_valido(), plano)
    assert any("\"Recuperar PIX\"" in e and "tabela-resumo" in e for e in erros), erros


def test_frente_vazia_e_quando_vazio():
    plano = plano_valido()
    plano["tabela"][2]["frente"] = ""
    plano["horizontes"][0]["acoes"][1]["quando"] = ""
    erros, _ = vs.validar_plano(registro_valido(), plano)
    assert any("Monitorar estoque" in e and "frente vazia" in e for e in erros), erros
    assert any("Corrigir GA4" in e and "quando" in e for e in erros), erros


def test_cli_modo_plano(tmp_path, capsys):
    reg = tmp_path / "solucoes.json"
    reg.write_text(json.dumps(registro_valido(), ensure_ascii=False), encoding="utf-8")
    pl = tmp_path / "plano.json"
    plano = plano_valido()
    plano["horizontes"][1]["acoes"][0]["solucoes"] = []
    pl.write_text(json.dumps(plano, ensure_ascii=False), encoding="utf-8")
    assert vs.main(["--modo", "plano", "--registro", str(reg), "--plano", str(pl)]) == 1
    assert "plano de ação inválido" in capsys.readouterr().err
    assert vs.main(["--modo", "plano", "--registro", str(reg)]) == 1
    assert "--modo plano precisa de --plano" in capsys.readouterr().err
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `python3 -m pytest scripts/tests/test_validar_solucoes.py -k plano -v`
Esperado: FAIL em `test_solucao_sem_acao_bloqueia` (a versão provisória retorna lista vazia)

- [ ] **Passo 3: implementar** (substituir o `validar_plano` provisório)

```python
def validar_plano(registro: dict, plano) -> Tuple[List[str], List[str]]:
    erros: List[str] = []
    if not isinstance(plano, dict) or not isinstance(plano.get("horizontes"), list):
        return ["o plano não tem a lista \"horizontes\"."], []
    ids = [s["id"] for p in registro["problemas"] for s in p["solucoes"]]
    conhecidos = set(ids)
    cobertos = set()
    tabela = {linha.get("acao"): linha for linha in plano.get("tabela") or [] if isinstance(linha, dict)}
    for horizonte in plano["horizontes"]:
        for acao in horizonte.get("acoes") or []:
            nome = acao.get("acao") or "(sem nome)"
            for campo in ("quando", "por_quem"):
                if not _texto(acao.get(campo)):
                    erros.append(f"Ação \"{nome}\": campo {campo} obrigatório.")
            linha = tabela.get(acao.get("acao"))
            if linha is None:
                erros.append(f"Ação \"{nome}\": não aparece na tabela-resumo (mesmo nome em \"acao\").")
            elif not _texto(linha.get("frente")):
                erros.append(f"Ação \"{nome}\": frente vazia na tabela-resumo.")
            solucoes = acao.get("solucoes", [])
            if not isinstance(solucoes, list):
                erros.append(f"Ação \"{nome}\": \"solucoes\" precisa ser uma lista de ids (ex.: [\"P1.S1\"]).")
                continue
            for sid in solucoes:
                if sid in conhecidos:
                    cobertos.add(sid)
                else:
                    erros.append(f"Ação \"{nome}\": cita a solução {sid}, que não existe no registro.")
    for sid in ids:
        if sid not in cobertos:
            erros.append(f"Solução {sid} do registro não virou nenhuma ação do plano.")
    return erros, []
```

- [ ] **Passo 4: documentar o campo novo no docstring de `scripts/preencher_plano_acao_docx.py`**

Trocar a linha do exemplo de ação por:

```
            {"acao": "...", "o_que": "...", "quando": "...", "por_quem": "...", "como": "...",
             "solucoes": ["P1.S1"]},              // opcional: ids do contexto/solucoes.json que a ação executa
```

O script ignora o campo ao montar o `.docx`; nenhuma outra mudança nele.

- [ ] **Passo 5: rodar e ver passar**

Rodar: `python3 -m pytest scripts/tests/test_validar_solucoes.py -v`
Esperado: todos PASS

- [ ] **Passo 6: commit**

```bash
git add scripts/validar_solucoes.py scripts/preencher_plano_acao_docx.py scripts/tests/test_validar_solucoes.py
git commit -m "feat(scripts): confere que toda solução do diagnóstico virou ação do plano"
```

---

### Tarefa 4: slide-modelo `desafio` no molde

**Arquivos:**
- Criar: `scripts/adicionar_modelo_desafio.py`
- Modificar: `scripts/preparar_molde_apresentacao.py` (chamar o novo script no fim de `preparar`)
- Modificar: `.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx` (regerado pelo script)
- Teste: `scripts/tests/test_molde_apresentacao.py`

**Interfaces:**
- Consome: `apresentacao_pptx` (`campos`, `tipo_do_slide`, `marcar_tipo`, `duplicar_slide`, `remover_slide`, `preencher_texto`, `preencher_bloco`, `definir_texto_alternativo`).
- Produz: `adicionar(molde: Path, saida: Path) -> None`; no molde, um slide `tipo:desafio` com os campos `titulo`, `esquerda`, `direita`.

- [ ] **Passo 1: atualizar o teste do molde (falha)**

Em `scripts/tests/test_molde_apresentacao.py`, acrescentar ao `ESPERADO`:

```python
    "desafio": {"titulo", "esquerda", "direita"},
```

e acrescentar o teste:

```python
def test_desafio_nao_repete_id_de_forma():
    prs = Presentation(MOLDE)
    desafio = next(s for s in prs.slides if ap.tipo_do_slide(s) == "desafio")
    ids = [sh.shape_id for sh in desafio.shapes]
    assert len(ids) == len(set(ids)), ids
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `python3 -m pytest scripts/tests/test_molde_apresentacao.py -v`
Esperado: FAIL em `test_molde_tem_um_slide_por_tipo_com_os_campos` (falta `desafio`)

- [ ] **Passo 3: implementar `scripts/adicionar_modelo_desafio.py`**

```python
#!/usr/bin/env python3
"""
scripts/adicionar_modelo_desafio.py: acrescenta ao molde da apresentação o
slide-modelo "desafio" (problema e hipóteses à esquerda; soluções e impacto à
direita), derivado do "analises_2_colunas" com o título do "bullets". Idempotente:
um desafio já existente é substituído. Também chamado no fim de
preparar_molde_apresentacao.py, para o molde regenerado já sair com ele.

    python3 scripts/adicionar_modelo_desafio.py --molde .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx
"""

from __future__ import annotations

import argparse
import copy
import sys
from pathlib import Path
from typing import Optional

from pptx import Presentation
from pptx.oxml.ns import qn

import apresentacao_pptx as ap


def adicionar(molde: Path, saida: Optional[Path] = None) -> None:
    prs = Presentation(molde)
    for slide in list(prs.slides):
        if ap.tipo_do_slide(slide) == "desafio":
            ap.remover_slide(prs, slide)
    modelos = {ap.tipo_do_slide(s): s for s in prs.slides}
    base = modelos["analises_2_colunas"]
    titulo_bullets = ap.campos(modelos["bullets"])["titulo"]

    novo = ap.duplicar_slide(prs, base)
    ap.marcar_tipo(novo, "desafio")
    copia = copy.deepcopy(titulo_bullets._element)
    proximo_id = max(sh.shape_id for sh in novo.shapes) + 1
    copia.find(".//" + qn("p:cNvPr")).set("id", str(proximo_id))
    novo.shapes._spTree.append(copia)

    c = ap.campos(novo)
    ap.preencher_texto(c["titulo"], "Desafio: **tema**")
    ap.preencher_bloco(c["esquerda"], "**Problema:** dado do problema", ["Hipótese 1", "Hipótese 2"])
    ap.preencher_bloco(c["direita"], "**Impacto:** R$ ou %", ["1. Solução 1", "2. Solução 2"])
    destino = saida or molde
    destino.parent.mkdir(parents=True, exist_ok=True)
    prs.save(destino)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Acrescenta o slide-modelo desafio ao molde.")
    p.add_argument("--molde", required=True, type=Path)
    p.add_argument("--saida", type=Path)
    a = p.parse_args(argv)
    adicionar(a.molde, a.saida)
    print(f"Slide-modelo desafio salvo em {a.saida or a.molde}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Em `scripts/preparar_molde_apresentacao.py`, acrescentar `import adicionar_modelo_desafio` junto dos imports e, na última linha de `preparar` (depois de `prs.save(saida)`):

```python
    adicionar_modelo_desafio.adicionar(saida)
```

- [ ] **Passo 4: regerar o molde e rodar os testes**

Rodar:
```bash
cd scripts && python3 adicionar_modelo_desafio.py --molde ../.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx && cd ..
python3 -m pytest scripts/tests/test_molde_apresentacao.py -v
```
Esperado: todos PASS

- [ ] **Passo 5: conferência visual**

Rodar: `python3 scripts/previa_apresentacao.py gerar --pptx .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx --saida /tmp/previa-molde`
Abrir com Read o PNG do último slide (`/tmp/previa-molde/slide-12.png`). Conferir: o título não sobrepõe as colunas, e os dois blocos estão legíveis. Se o título sobrepuser, ajustar `copia` para a mesma posição vertical do título do `bullets` deslocando os blocos (`c["esquerda"].top` e `c["direita"].top` += altura do título) e repetir os Passos 4 e 5. Se o LibreOffice não estiver instalado, pedir ao analista para abrir o molde no PowerPoint ou no Google Slides e confirmar.

- [ ] **Passo 6: commit**

```bash
git add scripts/adicionar_modelo_desafio.py scripts/preparar_molde_apresentacao.py scripts/tests/test_molde_apresentacao.py .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx
git commit -m "feat(apresentacao): slide-modelo desafio no molde da agência"
```

---

### Tarefa 5: tipo `desafio` no gerador do deck

**Arquivos:**
- Modificar: `scripts/gerar_apresentacao.py`
- Teste: `scripts/tests/test_gerar_apresentacao.py`

**Interfaces:**
- Consome: slide-modelo `desafio` (Tarefa 4); `contexto/solucoes.json` (formato da Tarefa 1).
- Produz: no `ESQUEMA`, `"desafio": {"titulo": texto, "problema": texto, "hipoteses": lista 1–5, "solucoes": lista 1–3, "impacto": texto}`; campo opcional `problema_id` no slide; aviso "N problemas do registro de soluções não entraram no deck: P2, P3."

- [ ] **Passo 1: escrever os testes que falham**

```python
def slide_desafio(**extra):
    s = {
        "tipo": "desafio",
        "problema_id": "P1",
        "titulo": "Quebra: **hipótese antes da ação**",
        "problema": "36,1% da receita captada não vira caixa",
        "hipoteses": ["Boleto como meio de pagamento", "Ruptura de estoque"],
        "solucoes": ["Recuperar PIX e boleto", "Checar ruptura de estoque"],
        "impacto": "+R$ 16,4M/ano",
    }
    s.update(extra)
    return s


def test_desafio_preenche_problema_hipoteses_solucoes_e_impacto(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio())
    saida = tmp_path / "deck.pptx"
    ga.gerar(roteiro, prospect, saida)
    prs = Presentation(saida)
    texto = " ".join(sh.text_frame.text for s in prs.slides for sh in s.shapes if sh.has_text_frame)
    for trecho in ("36,1% da receita", "Hipótese: Ruptura de estoque", "1. Recuperar PIX e boleto", "+R$ 16,4M/ano"):
        assert trecho in texto, trecho


@pytest.mark.parametrize(
    "extra, trecho",
    [
        ({"solucoes": ["a", "b", "c", "d"]}, "campo solucoes: precisa ter de 1 a 3"),
        ({"hipoteses": []}, "campo hipoteses: precisa ter de 1 a 5"),
        ({"impacto": ""}, "campo impacto: precisa ser um texto"),
    ],
)
def test_desafio_invalido(prospect, extra, trecho):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(**extra))
    modelos = {ap.tipo_do_slide(s) for s in Presentation(ga.CAMINHO_MOLDE).slides}
    erros, _ = ga.validar_roteiro(roteiro, prospect, modelos)
    assert any(trecho in e for e in erros), erros


def _registro(pasta, ids):
    (pasta / "contexto").mkdir(parents=True, exist_ok=True)
    (pasta / "contexto/solucoes.json").write_text(
        json.dumps({"problemas": [{"id": i} for i in ids]}), encoding="utf-8"
    )


def test_aviso_de_problema_do_registro_fora_do_deck(prospect, tmp_path):
    _registro(prospect, ["P1", "P2", "P3"])
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio())
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert any("2 problemas do registro de soluções não entraram no deck: P2, P3." in a for a in r["avisos"]), r["avisos"]


def test_sem_registro_nao_avisa_nem_quebra(prospect, tmp_path):
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    assert not any("registro de soluções" in a for a in r["avisos"])


def test_registro_malformado_vira_aviso(prospect, tmp_path):
    (prospect / "contexto").mkdir(parents=True, exist_ok=True)
    (prospect / "contexto/solucoes.json").write_text("{ruim", encoding="utf-8")
    r = ga.gerar(roteiro_basico(), prospect, tmp_path / "deck.pptx")
    assert any("contexto/solucoes.json não pôde ser lido" in a for a in r["avisos"]), r["avisos"]


def test_desafio_com_texto_longo_avisa_estouro(prospect, tmp_path):
    roteiro = roteiro_basico()
    roteiro["slides"].insert(-1, slide_desafio(problema="dado muito longo " * 40))
    r = ga.gerar(roteiro, prospect, tmp_path / "deck.pptx")
    assert any("não cabe na caixa" in a for a in r["avisos"]), r["avisos"]
```

Conferir que `roteiro_basico()` termina com o slide `obrigado` (o `insert(-1, …)` coloca o desafio antes dele). Se o arquivo de teste ainda não importa `json`, acrescentar `import json` (já importa hoje).

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `python3 -m pytest scripts/tests/test_gerar_apresentacao.py -v`
Esperado: FAIL com `tipo "desafio" não existe no molde` vindo do ESQUEMA

- [ ] **Passo 3: implementar em `scripts/gerar_apresentacao.py`**

No `ESQUEMA`, antes de `"obrigado"`:

```python
    "desafio": {
        "titulo": ("texto", 1, 1), "problema": ("texto", 1, 1), "hipoteses": ("lista", 1, 5),
        "solucoes": ("lista", 1, 3), "impacto": ("texto", 1, 1),
    },
```

No início de `_preencher`, logo depois de `c = ap.campos(slide)`:

```python
    if tipo == "desafio":
        ap.preencher_texto(c["titulo"], dados["titulo"])
        ap.preencher_bloco(c["esquerda"], f"**Problema:** {dados['problema']}", [f"Hipótese: {h}" for h in dados["hipoteses"]])
        ap.preencher_bloco(c["direita"], f"**Impacto:** {dados['impacto']}",
                           [f"{j}. {s}" for j, s in enumerate(dados["solucoes"], start=1)])
    else:
        _preencher_campos(slide, c, tipo, dados, pasta)
```

Mover o laço `for campo, (modo, _, _) in ESQUEMA[tipo].items(): …` que já existe (do `valor = dados[campo]` até o `ap.definir_link`) para uma função nova, sem alterar o corpo:

```python
def _preencher_campos(slide, c, tipo: str, dados: dict, pasta: Path) -> None:
    for campo, (modo, _, _) in ESQUEMA[tipo].items():
        ...  # corpo atual, idêntico
```

O trecho de aviso de estouro (`if tipo in TIPOS_SEM_AVISO_DE_ESTOURO: return` e o laço de `ocupacao`) continua no fim de `_preencher`, valendo também para o desafio.

Acrescentar depois de `_graficos_fora_do_roteiro`:

```python
def _problemas_fora_do_roteiro(roteiro: dict, pasta: Path, avisos: List[str]) -> None:
    """Todo problema do registro de soluções deve ter um slide desafio na seção 02. Desafios."""
    caminho = pasta / "contexto/solucoes.json"
    if not caminho.is_file():
        return
    try:
        registro = json.loads(caminho.read_text(encoding="utf-8"))
        ids = [p["id"] for p in registro["problemas"]]
    except (json.JSONDecodeError, KeyError, TypeError):
        avisos.append("contexto/solucoes.json não pôde ser lido; confira o registro de soluções.")
        return
    usados = {s.get("problema_id") for s in roteiro["slides"] if s.get("tipo") == "desafio"}
    fora = [i for i in ids if i not in usados]
    if fora:
        avisos.append(f"{len(fora)} problemas do registro de soluções não entraram no deck: {', '.join(fora)}.")
```

Em `gerar`, logo depois do bloco do aviso de gráficos fora (`if fora: avisos.append(...)`):

```python
    _problemas_fora_do_roteiro(roteiro, pasta_prospect, avisos)
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `python3 -m pytest scripts/tests/test_gerar_apresentacao.py scripts/tests/test_molde_apresentacao.py -v`
Esperado: todos PASS

- [ ] **Passo 5: commit**

```bash
git add scripts/gerar_apresentacao.py scripts/tests/test_gerar_apresentacao.py
git commit -m "feat(apresentacao): slide desafio e aviso de problema fora do deck"
```

---

### Tarefa 6: renumeração das etapas e app

**Arquivos:**
- Mover: `.claude/skills/05-metas-e-cenarios` → `06-metas-e-cenarios`; `06-briefing-e-benchmark` → `07-…`; `07-midia-paga` → `08-…`; `08-plano-de-acao` → `09-…`; `09-apresentacao-final` → `10-apresentacao-final`
- Mover: `.claude/commands/05-metas-e-cenarios.md` → `06-…`; `06-briefing-e-benchmark.md` → `07-…`; `07-midia-paga.md` → `08-…`; `08-plano-de-acao.md` → `09-…`
- Modificar: `.claude/skills/_shared/etapas.json`, `src/packages/core/src/tipos.ts:1`, `src/packages/core/src/armazenamento.ts` (`lerEstado`), `clientes/_template/contexto/status-planejamento.md`, `CLAUDE.md`, `.claude/commands/*.md`, `.claude/skills/*/SKILL.md` (referências cruzadas), `.claude/skills/_shared/*.md`, `.claude/agents/*.md`
- Teste: `src/packages/core/test/catalogo.test.ts`, `src/packages/core/test/prompts.test.ts`, `src/packages/core/test/armazenamento.test.ts`

**Interfaces:**
- Produz: `ORDEM_ETAPAS = ["01", …, "09", "final"]`; etapa `05` no catálogo com `skill: "05-solucoes"` (a pasta da skill nasce na Tarefa 8; o catálogo só guarda o nome); `final` com `skill: "10-apresentacao-final"`.

- [ ] **Passo 1: atualizar os testes (falham)**

`catalogo.test.ts`:

```ts
  it("carrega o etapas.json real com as 10 etapas na ordem", () => {
    const c = catalogoReal()
    expect(c.etapas.map((e) => e.id)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "final"])
    expect(etapaDoCatalogo(c, "03").skill).toBe("03-diagnostico-performance")
    expect(etapaDoCatalogo(c, "05").skill).toBe("05-solucoes")
    expect(etapaDoCatalogo(c, "09").skill).toBe("09-plano-de-acao")
    expect(insumoDoCatalogo(c, "clientes-historico").sensivel).toBe(true)
  })
```

e, no teste "navega entre etapas": `etapaAnterior("final")` → `"09"`, `proximaEtapa("08")` → `"09"`, acrescentar `expect(proximaEtapa("09")).toBe("final")`.

`prompts.test.ts`: no teste da etapa final, trocar `"09-apresentacao-final"` por `"10-apresentacao-final"`, e o título por "a etapa final usa a skill 10 (roteiro e pptx), não mais o subagente do Canva".

`armazenamento.test.ts`, novo teste ao lado do de "perguntas":

```ts
  it("estado gravado antes da etapa de soluções é lido com as etapas novas bloqueadas", async () => {
    await arm.criarPasta("iszi")
    const antigo = estadoInicial({ slug: "iszi", nome: "Iszi", site: null }, "2026-10-07T10:00:00.000Z") as unknown as {
      etapas: Record<string, unknown>
    }
    delete antigo.etapas["09"]
    await mkdir(path.join(raiz, "clientes/iszi/.app"), { recursive: true })
    await writeFile(path.join(raiz, "clientes/iszi/.app/estado.json"), JSON.stringify(antigo))
    const lido = await arm.lerEstado("iszi")
    expect(lido?.etapas["09"]?.status).toBe("bloqueada")
  })
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `cd src/packages/core && npm test -- catalogo prompts armazenamento`
Esperado: FAIL (catálogo com 9 etapas; `etapas["09"]` indefinido)

- [ ] **Passo 3: mover pastas e comandos (da maior para a menor, para não colidir)**

```bash
git mv .claude/skills/09-apresentacao-final .claude/skills/10-apresentacao-final
git mv .claude/skills/08-plano-de-acao .claude/skills/09-plano-de-acao
git mv .claude/skills/07-midia-paga .claude/skills/08-midia-paga
git mv .claude/skills/06-briefing-e-benchmark .claude/skills/07-briefing-e-benchmark
git mv .claude/skills/05-metas-e-cenarios .claude/skills/06-metas-e-cenarios
git mv .claude/commands/08-plano-de-acao.md .claude/commands/09-plano-de-acao.md
git mv .claude/commands/07-midia-paga.md .claude/commands/08-midia-paga.md
git mv .claude/commands/06-briefing-e-benchmark.md .claude/commands/07-briefing-e-benchmark.md
git mv .claude/commands/05-metas-e-cenarios.md .claude/commands/06-metas-e-cenarios.md
```

No frontmatter de `.claude/skills/10-apresentacao-final/SKILL.md`: `name: 10-apresentacao-final`. Em `.claude/commands/apresentacao-final.md`: `` Use a skill `10-apresentacao-final` `` e "(Skill 10)" na descrição.

- [ ] **Passo 4: catálogo, ordem e leitura de estado legado**

`src/packages/core/src/tipos.ts:1`:

```ts
export const ORDEM_ETAPAS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "final"] as const
```

`etapas.json`: inserir depois da etapa `04` a entrada abaixo, e somar 1 em `id`, `numero`, `rotuloStatus` e `skill` das antigas 05–08 (ex.: `"id": "06", "numero": "06", "rotuloStatus": "06 · Metas e cenários", "skill": "06-metas-e-cenarios"`); na `final`, `"skill": "10-apresentacao-final"`.

```json
    {
      "id": "05",
      "numero": "05",
      "titulo": "Soluções",
      "rotuloStatus": "05 · Soluções",
      "descricao": "Abre cada problema do diagnóstico em hipóteses de causa, 1 a 3 soluções e impacto em R$ ou %.",
      "skill": "05-solucoes",
      "insumos": []
    },
```

`armazenamento.ts`, em `lerEstado` (trocar o import de tipos por `import { ORDEM_ETAPAS, type Estado, type EtapaId, type EventoConversa } from "./tipos"` e acrescentar `import { etapaVazia } from "./maquina-estados"`; não há ciclo, `maquina-estados` não importa `armazenamento`):

```ts
    const estado = JSON.parse(texto) as Estado
    // estado.json gravado antes de uma etapa nova (ex.: 05 · Soluções) não tem a chave dela
    const etapas = { ...estado.etapas }
    for (const id of ORDEM_ETAPAS) etapas[id] ??= etapaVazia("bloqueada")
    // estado.json gravado antes do card de perguntas não tem o campo
    return { ...estado, etapas, perguntas: estado.perguntas ?? [] }
```

`clientes/_template/contexto/status-planejamento.md`: inserir `| 05 · Soluções | ⬜ | | |` depois da linha 04 e renumerar as quatro seguintes (06 Metas e cenários, 07 Briefing e benchmark, 08 Mídia paga, 09 Plano de ação). Os rótulos precisam ser idênticos ao `rotuloStatus` do catálogo (o `status-md.ts` casa por texto).

- [ ] **Passo 5: rodar os testes do core**

Rodar: `cd src/packages/core && npm test && npm run typecheck`
Esperado: todos PASS, sem erro de tipo

- [ ] **Passo 6: referências cruzadas em texto**

Atualizar, em todos os `SKILL.md`, comandos, `_shared/*.md`, agentes e no `CLAUDE.md` raiz:
- sequência do `CLAUDE.md` (bloco "Ordem de execução"): inserir `05-solucoes` depois de `04-unidade-economica` e renumerar até `10-apresentacao-final`; na lista de subagentes, `analista-dados` "Usado pelas Skills 03, 05 e 06"; `pesquisador-benchmark` "Usado pela Skill 08 (e pontualmente pelas 02 e 05)"; "Pré-requisitos da Skill 06" vira "da Skill 07";
- "Skill N de 8" vira "Skill N de 10" com o número novo; "Skill 05" (metas) → "Skill 06", "Skill 06" (briefing) → "07", "Skill 07" (mídia) → "08", "Skill 08" (plano) → "09", "Skill 09" (apresentação) → "10";
- comandos nos handoffs: `/05-metas-e-cenarios` → `/06-metas-e-cenarios`, etc. O handoff da 04 passa a chamar `/05-solucoes` (texto definido na Tarefa 8);
- descrições dos comandos (`Skill 05/8` → `Skill 06/10`, etc.);
- tabela "Antes de começar" da Skill 10: `secoes/05-*` → `secoes/06-*`, `secoes/06-benchmark.md` → `secoes/07-benchmark.md`, `secoes/07-*` → `secoes/08-*`, etapas de origem renumeradas.

Conferência: rodar

```bash
grep -rnE "Skill 0?[5-9]\b|/0[5-8]-|de 8\b|[0-9]{2}/8" CLAUDE.md .claude/skills/0* .claude/skills/10-* .claude/skills/_shared/*.md .claude/commands .claude/agents
```

e revisar cada ocorrência: toda referência às etapas antigas precisa estar no número novo. Referências históricas ("Prompt 9 do processo original") ficam como estão.

- [ ] **Passo 7: suíte completa**

Rodar: `cd src/packages/core && npm test` e `python3 -m pytest scripts/tests -q`
Esperado: todos PASS

- [ ] **Passo 8: commit**

```bash
git add -A .claude CLAUDE.md clientes/_template src/packages/core
git commit -m "refactor: renumera as etapas para abrir a 05 · Soluções"
```

---

### Tarefa 7: regras compartilhadas (benchmarks, repertório, checklist)

**Arquivos:**
- Criar: `.claude/skills/_shared/benchmarks-kpi.md`
- Criar: `.claude/skills/_shared/repertorio-solucoes.md`
- Modificar: `.claude/skills/_shared/regras-de-validacao.md` (Regra 8; trocar a citação ao `designer-apresentacao` na Regra 2 por "Skill 10")

- [ ] **Passo 1: criar `benchmarks-kpi.md`**

```markdown
# Benchmarks de KPI

Referenciado pelas Skills 03, 04, 05 e 06. Não copie estes valores para dentro
de uma skill: referencie este arquivo.

Fonte única de "onde estamos versus o mercado" (passo 2 do padrão Dado →
Benchmark → Hipótese → Soluções → Impacto → Plano). Valores com fonte "a
confirmar" aguardam validação da liderança: podem ser usados, mas o slide ou a
seção que os citar diz "referência de mercado" sem nomear fonte.

KPI que não está aqui: o analista informa o valor, ou o subagente
`pesquisador-benchmark` pesquisa com fonte citada. Nunca usar valor de memória
do modelo. Um valor novo validado entra nesta tabela.

| KPI | Faixa saudável | Recorte | Fonte | Revisado em |
|---|---|---|---|---|
| Taxa de quebra (captada → aprovada) | até 5% | geral | a confirmar | 2026-10-13 |
| Taxa de conversão global | 1% a 2% | geral | a confirmar | 2026-10-13 |
| Taxa de conversão Google | 2% a 4% | geral | a confirmar | 2026-10-13 |
| Taxa de conversão Meta | 1% a 2% | geral | a confirmar | 2026-10-13 |
| Adição ao carrinho (sessão → carrinho) | 6% a 10% | geral | treinamento "Do diagnóstico à solução" (caso iQuê); a confirmar | 2026-10-13 |
| Carrinho → checkout | 35% a 40% | geral | treinamento (caso iQuê); a confirmar | 2026-10-13 |
| Checkout → compra | 45% a 47% | geral | treinamento (caso iQuê); a confirmar | 2026-10-13 |
| Dependência de mídia paga (% sessões pagas) | 70% a 85% | e-commerce iniciante (0 a 6 meses) | a confirmar | 2026-10-13 |
| Dependência de mídia paga | 45% a 60% | DTC consolidada (12 a 24 meses) | a confirmar | 2026-10-13 |
| Dependência de mídia paga | 30% a 45% | marca madura / CRM ativo | a confirmar | 2026-10-13 |
| LTV/CAC | < 3 ruim; 3 a 5 normal; > 5 escala | geral | a confirmar | 2026-10-13 |

## Pendentes (sem valor ainda)

Pedir ao analista ou pesquisar com fonte quando o diagnóstico precisar:
quebra por PIX e por boleto; % de clientes de compra única; ciclo médio de
recompra por categoria; ROAS por segmento; CAC por segmento; custo por sessão
(CPS) por plataforma.
```

- [ ] **Passo 2: criar `repertorio-solucoes.md`**

```markdown
# Repertório de soluções

Referenciado pela Skill 05 (Soluções). Não copie este conteúdo para dentro de
uma skill: referencie este arquivo.

Casos das 17 entregas analisadas no treinamento "Do diagnóstico à solução",
organizados por tema. Servem de **régua de profundidade**, não de lista
fechada: todo desvio encontrado no diagnóstico vira problema com solução,
esteja ou não aqui. Não copie a solução de um caso sem conferir que a
hipótese de causa vale para o prospect.

## Padrão (todo problema)

Dado → Benchmark → Hipóteses de causa → 1 a 3 soluções → Impacto em R$ ou % →
Plano (dono, prazo e frente, na Skill 09). 1 solução: ok; 2: bom; 3: ótimo;
zero: erro.

## Quebra de receita

- **Hipóteses antes da ação (World Tennis):** quebra de 36,1% (R$ 19,1M/ano):
  cupom sistemático inflando a captação; boleto como meio de pagamento;
  insatisfação logística gerando cancelamento; ruptura de estoque; tamanho
  errado percebido após a entrega.
- **Ações (Wurth):** revisar gateway e recuperar o checkout; analisar regras de
  antifraude; ativar fluxos automáticos de recuperação; checar ruptura de
  estoque continuamente.
- **Causa ligada à ferramenta (iQuê):** experimentação → provador virtual;
  antifraude → novo gateway.
- **Motivo declarado (Fresca):** 43% "mudou de ideia" → contato ativo com o
  pedido perdido.
- **Quebra por PIX (faltou em Loê e Sottile):** hipóteses + 1 a 3 ações de
  recuperação de PIX (lembrete antes de expirar, novo QR por WhatsApp/e-mail).

## Conversão e funil

- **Uma solução por gargalo (iQuê):** adição ao carrinho 4,96% × 6–10% →
  reforçar página de produto (imagens, ficha técnica, prova social) e incluir
  seleção de cor; checkout → compra 28,25% × 45–47% → investigar meios de
  pagamento, custos ocultos e carregamento, testar formulário dinâmico;
  carrinho → checkout 80,56% × 35–40% → ponto forte, citar como prova de que o
  problema está nas pontas.
- **Fricção que o cliente consegue ver:** Adda (CEP não preenche endereço, menu
  com bugs, PageSpeed mobile 50 → corrigir CEP, tirar CSS/JS que travam,
  estabilizar banner); Wurth (conversão 0,47% com criação de conta e aceite de
  termos obrigatórios → simplificar checkout, avaliar troca de plataforma,
  recuperar checkout abandonado); Compress (funil incompleto no GA4 →
  desativar limiar de dados, explorar Google Shopping).

## ROAS e mix de plataformas

- **iQuê:** meta única de ROAS 10 empurra verba para recompra → ROAS-alvo
  separado para captação e recompra; mais verba no canal mais eficiente;
  cortar campanha de tráfego com connect rate baixíssimo.
- **OMA:** ROAS do painel esconde se a venda dá lucro → ROAS ideal pela margem
  de cada peça; matriz margem × ROAS; kits de maior margem no tráfego frio.
- **Compress:** Google com muitas sessões e conversão 0,07%, Meta converte com
  CPC alto → Google para fundo de funil; Meta para menor custo por sessão;
  remarketing por URL, carrinho e checkout.
- **Canal ineficiente (faltou em Jogê):** Google com ROAS 0,33x e 60% da verba
  pede causa provável e ação no próprio problema.

## Curva ABC

- **Ler o comportamento, não só o ranking (Le Vivre):** refil no fundo da
  curva; cliente compra o kit (curva A) e não repõe → campanhas de recompra do
  refil; fluxo de WhatsApp e grupo VIP; avulsos da curva C como order bump.
- **Kits que nasceram da curva:** Compress (sutiã + gel cicatrizante); Sottile
  (scrub + touca, blusa + calça); iQuê (linha líder em novas cores); OMA (anel
  + brinco, mesmo lucro).
- **Curva C sem verba de mídia:** bundle com a curva A; upsell na página de
  produto; amostra ou brinde nos pedidos da curva A; revisão de portfólio
  (descontinuar SKU abaixo de R$ 5 mil/ano sem função de cross-sell).

## Recorrência (CAC, LTV)

- **Sottile:** 75,8% compraram uma vez; uniforme tem vida útil previsível →
  contato 6 a 12 meses após a compra; reativação da base adormecida; 2ª venda
  com CAC zero via parceiros.
- **Svarts:** 82,4% com um pedido; recompra em ~180 dias → novas cores e
  coleções como gatilho; campanhas para clientes de 1 compra; ofertas por
  categoria e histórico.
- **Iszi:** recorrente vale 3,3x mais; 14% de Champions geram 37% da receita →
  régua de CRM para reativar; quiz de escuta ativa para lançamentos; kits
  curva A + B para elevar o ticket.

## Dependência de mídia

Proibido o genérico "fortalecer CRM, SEO" (falha em quase todas as entregas).
A solução nomeia o mecanismo e quem faz, como a Iszi: régua de CRM com
gatilho definido, quiz de escuta ativa, kits.

## Impacto em reais

- World Tennis: +R$ 16,4M de receita aprovada se a quebra cair de 36% para 5%.
- Jogê: 2x receita se a conversão subir de 0,61% para 1,2%, sem sessão a mais.
  **Alerta:** o impacto foi quantificado, mas faltou dizer como chegar a 1,2%.
  Número sem solução vira só alerta.
- Iszi: R$ 1,1M de quebra anual = 5,4 meses de investimento em mídia.

## Benchmark de concorrentes (Skill 07)

Termina em "o que testar": Sofá na Caixa (criativo próprio para topo e fundo;
vídeo selfie de baixa produção; estático com citação real de cliente); Iszi
vs. Kérastase (conteúdo educativo na manutenção; preço cheio nos meses de
escala; escuta ativa para lançamentos); World Tennis ("conforto e qualidade"
genérico → copy por persona; pisada e nível de treino no carro-chefe; unboxing
com pessoa e narração).
```

- [ ] **Passo 3: Regra 8 em `regras-de-validacao.md`** (acrescentar ao fim)

```markdown
## 8. Checklist de qualidade do diagnóstico

Regra de ouro: nenhum problema sai do diagnóstico sem solução. Antes do
checkpoint final, a Skill 05 (Soluções) e a Skill 10 (Apresentação final)
apresentam ao analista os 5 itens abaixo, cada um marcado como atendido ou
com o que falta:

1. **Problema identificado = 1 a 3 soluções**, no próprio problema, não só no
   plano de ação. Garantido por `scripts/validar_solucoes.py --modo registro`.
2. **Hipótese de causa antes da ação**: "por que acontece" vem antes de "o que
   fazer". Conferência do analista: a hipótese explica o dado?
3. **Impacto estimado em R$ ou %**: o número que abre a conversa com o
   cliente. Garantido pelo validador (`nao_quantificavel` só com
   justificativa, e vira aviso).
4. **Cada solução vira item do plano**, com dono, prazo e frente. Garantido
   por `scripts/validar_solucoes.py --modo plano` na Skill 09.
5. **Benchmarking termina em teste**: o que vamos aplicar, não só o que o
   concorrente faz. Conferência do analista no bloco "O que testar" da
   Skill 07.
```

Na Regra 2, trocar "feita pelo subagente `designer-apresentacao`, ao final de tudo" por "feita pela Skill 10, ao final de tudo" e "o `designer-apresentacao` lê apenas essa pasta" por "a Skill 10 lê apenas essa pasta".

- [ ] **Passo 4: conferir travessão**

Rodar: `grep -nP "(?<!\d)\s*—|—\s*(?!\d)" .claude/skills/_shared/benchmarks-kpi.md .claude/skills/_shared/repertorio-solucoes.md`
Esperado: nenhuma linha

- [ ] **Passo 5: commit**

```bash
git add .claude/skills/_shared
git commit -m "docs(skills): benchmarks de KPI, repertório de soluções e checklist de qualidade"
```

---

### Tarefa 8: skill `05-solucoes`

**Arquivos:**
- Criar: `.claude/skills/05-solucoes/SKILL.md`
- Criar: `.claude/commands/05-solucoes.md`
- Modificar: `.claude/skills/04-unidade-economica/SKILL.md` (handoff)

**Interfaces:**
- Consome: `validar_solucoes.py` (Tarefas 1 a 3), `benchmarks-kpi.md` e `repertorio-solucoes.md` (Tarefa 7), catálogo com a etapa `05` (Tarefa 6).
- Produz: `contexto/solucoes.json`, `secoes/05-solucoes.md`, `contexto/decisoes/05-solucoes.md`.

- [ ] **Passo 1: criar `.claude/skills/05-solucoes/SKILL.md`**

```markdown
---
name: solucoes
description: Abre cada problema encontrado no diagnóstico (Skills 03 e 04) em hipóteses de causa, 1 a 3 soluções concretas e impacto em R$ ou %, e grava o registro de soluções validado em código. Use após unidade-economica e antes de metas-e-cenarios.
---

# Skill 05 · Soluções

Skill 5 de 10. Aplica a regra de ouro do treinamento "Do diagnóstico à
solução": **nenhum problema sai do diagnóstico sem solução.** O cliente compra
o plano, não o gráfico.

As Skills 03 e 04 apontam os problemas; esta etapa os resolve. Ela não cria
gráfico novo nem pede arquivo novo: trabalha sobre o que já foi aprovado.

## Antes de começar (checklist do analista)

- [ ] Skills 01 a 04 concluídas e aprovadas.
- [ ] Ter em mente o que o prospect já tentou para resolver cada dor (ajuda a
      descartar soluções que já falharam).

## Leitura obrigatória

- `contexto/contextualizacao-estrategica.md` (hipóteses e gargalos da 02);
- `contexto/decisoes/03-diagnostico-performance.md` e
  `contexto/decisoes/04-unidade-economica.md`;
- `entrega/ativos-aprovados/secoes/03-*.md` e `04-*.md`;
- `.claude/skills/_shared/benchmarks-kpi.md`;
- `.claude/skills/_shared/repertorio-solucoes.md`.

## Passo 1 · Levantar os achados

Percorra cada KPI analisado nas Skills 03 e 04 e classifique:

- **Problema:** fora da faixa de `benchmarks-kpi.md`, com tendência negativa,
  ou que confirma um gargalo da 02.
- **Ponto forte:** acima da faixa. Vira argumento (ex.: "carrinho → checkout
  acima do mercado prova que o problema está nas pontas do funil").

KPI sem faixa em `benchmarks-kpi.md`: peça o valor ao analista ou acione o
`pesquisador-benchmark` com fonte citada. Nunca use valor de memória.

O repertório **não é lista fechada**: todo desvio vira problema, esteja ou não
lá. Problemas correlatos podem ser agrupados num só, se o analista concordar.

Mostre a lista (problemas e pontos fortes, com o dado de cada um) e peça ao
analista para confirmar e ordenar por prioridade. Na interface, use
`fazer_perguntas` para a ordem quando houver mais de 5 problemas.

## Passo 2 · Abrir cada problema

Para cada problema confirmado, nesta ordem:

1. **Dado:** o número, com o valor em R$ quando houver.
2. **Benchmark:** a faixa e o recorte usados.
3. **Hipóteses de causa:** pelo menos 1, idealmente 2 a 5. "Por que acontece"
   vem antes de "o que fazer".
4. **Soluções:** de 1 a 3, cada uma ligada a uma hipótese. Concretas: verbo +
   objeto + mecanismo ("régua de reativação para clientes de 1 compra aos 150
   dias"), nunca genéricas ("fortalecer CRM", "melhorar SEO"). Sem nível de
   criativo, copy ou configuração de campanha.
5. **Impacto:** em R$ ou %, com a fórmula e a premissa. A conta é feita pelo
   subagente `analista-dados`. Se realmente não der para estimar, use
   `nao_quantificavel` com a justificativa (ex.: funil sem eventos no GA4).
6. **Frente:** uma das 5 do plano de ação (texto exato):
   `Mídia Paga / Canal Principal`, `Eficiência Operacional`,
   `Produto / Mix / Portfólio`, `Redução de Dependências`,
   `Monitoramento e Governança`.

Dono e prazo ficam para a Skill 09.

## Passo 3 · Gravar e validar o registro

Grave `contexto/solucoes.json`:

    {
      "versao": 1,
      "prospect": "<nome>",
      "problemas": [
        {
          "id": "P1", "tema": "quebra", "titulo": "...", "origem": "03 · Taxa de quebra",
          "dado": "...", "benchmark": "...",
          "hipoteses": [{ "id": "H1", "texto": "..." }],
          "solucoes": [{ "id": "P1.S1", "acao": "...", "hipotese": "H1" }],
          "impacto": { "tipo": "R$", "valor": "...", "calculo": "..." },
          "frente": "Eficiência Operacional"
        }
      ],
      "pontos_fortes": [{ "titulo": "...", "dado": "...", "uso": "..." }]
    }

Rode (na interface, `--markdown clientes/<slug>/.app/rascunhos/solucoes.md`;
no terminal, `--markdown clientes/<slug>/entrega/ativos-aprovados/secoes/05-solucoes.md`):

    python3 scripts/validar_solucoes.py --modo registro \
      --registro clientes/<slug>/contexto/solucoes.json \
      --markdown <destino>

`ERRO:`: corrija o registro e rode de novo. `AVISO:`: mostre ao analista.
Nunca edite a seção gerada à mão: mude o registro e gere de novo.

## Passo 4 · Checkpoint

Apresente o checklist da Regra 8 de `regras-de-validacao.md` (itens 1 a 3
desta etapa) e peça a checagem da seção. Interface: `propor_entregavel` tipo
`secao`, `nome_final` `solucoes`. Terminal: checagem no chat; a seção já está
no destino.

## Restrições

- Não propor metas, cenários, alocação de verba nem calendário: isso é das
  Skills 06 e 08.
- Não inventar número: dado vem das Skills 03 e 04; impacto vem do
  `analista-dados`; benchmark vem de `benchmarks-kpi.md`, do analista ou de
  pesquisa com fonte.
- PII: o registro nunca cita cliente final do prospect.

## Critério de conclusão

- Todo problema confirmado no Passo 1 está no registro.
- `validar_solucoes.py --modo registro` sem `ERRO:`.
- Seção aprovada pelo analista.
- Resumo em `contexto/decisoes/05-solucoes.md` (no terminal; na interface,
  pelo `resumo_decisoes`): problemas, soluções e impactos aprovados.

## Encerramento e handoff

Ao concluir, marque "05 · Soluções" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída! Cada problema do diagnóstico agora tem hipóteses, soluções e
impacto. Não preciso de arquivo novo: só pensa numa meta clara (qual número,
em quanto tempo) e tenha em mente a receita do ano passado e alguma
sazonalidade importante do negócio, porque vou te perguntar isso logo no
início da próxima etapa. As soluções com impacto vão virar alavancas dos
cenários.

Quando estiver pronto, rode `/06-metas-e-cenarios`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
```

- [ ] **Passo 2: criar `.claude/commands/05-solucoes.md`**

```markdown
---
description: "Skill 05/10: hipóteses, 1 a 3 soluções e impacto para cada problema do diagnóstico"
---
Use a skill `solucoes` (Skill 05 do planejamento estratégico) para o prospect em andamento nesta conversa.
```

- [ ] **Passo 3: handoff da 04**

Em `.claude/skills/04-unidade-economica/SKILL.md`, substituir o texto entre aspas do "Encerramento e handoff" por:

```
"Etapa concluída! Não preciso de arquivo novo agora. Na próxima etapa vou
abrir cada problema que encontramos no diagnóstico em hipóteses, soluções e
impacto em reais; vale lembrar o que o prospect já tentou para resolver cada
um.

Quando estiver pronto, rode `/05-solucoes`."
```

- [ ] **Passo 4: conferir travessão e catálogo**

Rodar: `grep -nP "(?<!\d)\s*—|—\s*(?!\d)" .claude/skills/05-solucoes/SKILL.md .claude/commands/05-solucoes.md` (esperado: nenhuma linha) e `cd src/packages/core && npm test -- catalogo prompts` (esperado: PASS).

- [ ] **Passo 5: commit**

```bash
git add .claude/skills/05-solucoes .claude/commands/05-solucoes.md .claude/skills/04-unidade-economica/SKILL.md
git commit -m "feat(skills): etapa 05 · Soluções"
```

---

### Tarefa 9: Skills 03 e 04 e o insumo de quebra por meio de pagamento

**Arquivos:**
- Modificar: `.claude/skills/03-diagnostico-performance/SKILL.md`, `.claude/skills/04-unidade-economica/SKILL.md`, `.claude/skills/02-contextualizacao-estrategica/SKILL.md` (handoff)
- Modificar: `.claude/skills/_shared/etapas.json`, `.claude/skills/_shared/modelos-insumo/schemas.json`, `.claude/skills/_shared/modelos-insumo/README.md`
- Teste: `scripts/tests/test_validar_insumo.py`

**Interfaces:**
- Produz: insumo `quebra-pagamento` (opcional na etapa 03), destino `dados/quebra-pagamento`, colunas `DATA`, `MEIO DE PAGAMENTO`, `RECEITA CAPTADA`, `RECEITA APROVADA`.

- [ ] **Passo 1: teste do schema (falha)**

```python
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
```

Rodar: `python3 -m pytest scripts/tests/test_validar_insumo.py -k quebra -v`
Esperado: FAIL (insumo desconhecido)

- [ ] **Passo 2: schema, catálogo e README**

`schemas.json`, nova chave:

```json
  "quebra-pagamento": {
    "modelo": "quebra-pagamento.xlsx",
    "linha_cabecalho": 1,
    "colunas_obrigatorias": ["DATA", "MEIO DE PAGAMENTO", "RECEITA CAPTADA", "RECEITA APROVADA"],
    "min_linhas": 1,
    "sensivel": false
  }
```

`etapas.json`, na etapa `03`: `{ "id": "quebra-pagamento", "obrigatorio": false }` em `insumos`; e em `insumos` do catálogo:

```json
    {
      "id": "quebra-pagamento",
      "nome": "Quebra por meio de pagamento",
      "descricao": "Receita captada e aprovada de cada mês, separada por meio de pagamento (PIX, cartão, boleto).",
      "instrucao": "Opcional. Uma linha por mês e meio de pagamento, exportada da plataforma do e-commerce.",
      "tipo": "arquivo",
      "formatos": [".xlsx"],
      "modelo": "quebra-pagamento.xlsx",
      "destino": "dados/quebra-pagamento",
      "validador": "quebra-pagamento",
      "sensivel": false
    },
```

`modelos-insumo/README.md`, novo item: "- `quebra-pagamento.xlsx`: Skill 03 (opcional). Cabeçalho na linha 1: DATA, MEIO DE PAGAMENTO, RECEITA CAPTADA, RECEITA APROVADA."

Rodar: `python3 -m pytest scripts/tests/test_validar_insumo.py -v` e `cd src/packages/core && npm test` (esperado: PASS, inclusive `sem-travessao`).

- [ ] **Passo 3: Skill 03**

- Checklist do analista: acrescentar "`dados/quebra-pagamento.xlsx` (opcional): receita captada e aprovada por mês e meio de pagamento".
- Fase 1, item 3 (taxa de quebra): trocar "se ultrapassa o limite saudável (~5%), possíveis causas estruturais" por "comparada à faixa de `benchmarks-kpi.md`, e a suspeita de causa quando o dado indicar". Acrescentar o item **3b. Quebra por meio de pagamento** (se o arquivo veio): taxa de quebra mês a mês por meio de pagamento, um gráfico de linha com uma série por meio (até 3, ver `padrao-visual.md`), linha de referência do benchmark.
- Fase 2, item 3: trocar os valores fixos de conversão por "faixas de `benchmarks-kpi.md`". Remover a seção "Benchmark de dependência de mídia paga por estágio" (a tabela agora está em `benchmarks-kpi.md`) e, no item 2, apontar para lá.
- Restrições: substituir "Não propor metas, plano de mídia ou ações corretivas." por "Não propor metas, plano de mídia nem soluções: registre cada achado com clareza (dado, benchmark e suspeita de causa quando houver). As soluções são da Skill 05."
- Critério de conclusão: substituir "Nenhuma solução foi antecipada." por "Cada achado registrado com dado e benchmark, pronto para a Skill 05."

- [ ] **Passo 4: Skill 04**

- No processo, item 5 (LTV/CAC): substituir a tabela de classificação por "classificar pela faixa de LTV/CAC em `benchmarks-kpi.md`".
- Restrições: substituir por "Não propor metas, plano de mídia nem soluções: registre cada achado com clareza. As soluções são da Skill 05."

- [ ] **Passo 5: handoff da 02 e "Antes de começar" da 03 alinhados**

No texto do handoff da 02, depois do pedido das duas planilhas, acrescentar: "Se conseguir, mande também uma terceira, opcional: a receita captada e aprovada de cada mês separada por meio de pagamento (PIX, cartão, boleto)." (Regra 6: os dois textos descrevem a mesma exigência.)

- [ ] **Passo 6: conferir travessão e commit**

Rodar: `grep -nP "(?<!\d)\s*—|—\s*(?!\d)" .claude/skills/03-diagnostico-performance/SKILL.md .claude/skills/04-unidade-economica/SKILL.md` e corrigir só as linhas alteradas nesta tarefa.

```bash
git add .claude/skills scripts/tests/test_validar_insumo.py
git commit -m "feat(skills): quebra por meio de pagamento e benchmarks centralizados no diagnóstico"
```

---

### Tarefa 10: Skills 06, 07 e 08 consomem o registro

**Arquivos:**
- Modificar: `.claude/skills/06-metas-e-cenarios/SKILL.md`, `.claude/skills/07-briefing-e-benchmark/SKILL.md`, `.claude/skills/08-midia-paga/SKILL.md`

- [ ] **Passo 1: Skill 06 (metas)**

- Na Parte 2 (cenários), acrescentar depois da escolha das alavancas: "As soluções do `contexto/solucoes.json` com impacto quantificado são **alavancas nomeadas**: para cada cenário, registre quais ids de solução ele assume e em que intensidade (ex.: 'Otimista assume P1.S1: quebra cai para 10%'). Pessimista não assume nenhuma; Realista assume as de execução mais simples; Otimista, as demais. A tabela de cenários ganha a linha 'Soluções consideradas'."
- Corrigir a referência quebrada (hoje "ver `padrao-visual.md` para os benchmarks de …"): apontar para `benchmarks-kpi.md`.

- [ ] **Passo 2: Skill 07 (briefing e benchmark)**

- Template do briefing: inserir depois da seção 4 a seção **"## 5. Problemas e soluções (Skill 05)"**: "Para cada problema do registro: título, impacto e soluções (ids)." Renumerar as seguintes (6 Metas, 7 Cenários, 8 Concorrentes, 9 Observações) e as citações a "seção 7" no corpo da skill passam a "seção 8".
- Em 2d, item 2, a camada passa a ser **Lição + Evidência + O que testar**. Acrescentar o terceiro marcador: "**O que testar:** 1 a 3 testes concretos para o prospect, derivados da lição, ligados a um problema do registro quando houver (ex.: 'Copy por persona: corredor, caminhante → P3'). Nunca a copy do concorrente." Atualizar o critério de conclusão: "Camada Lição + Evidência + O que testar escrita para cada concorrente."
- Acrescentar ao checkpoint da camada estratégica: conferência do item 5 da Regra 8.

- [ ] **Passo 3: Skill 08 (mídia paga)**

- Etapa 5: substituir "Não descer a nível operacional de CRM/SEO, só o papel estratégico de cada canal." por "Para cada canal complementar, uma ação concreta: o quê, qual mecanismo e quem executa (ex.: 'régua de reativação no e-mail aos 150 dias para clientes de 1 compra, Agência + Cliente'). Proibido o genérico 'fortalecer CRM, SEO'. Reaproveite as soluções do registro com frente `Redução de Dependências`."
- Restrições: substituir "Não propor estratégia de conteúdo orgânico detalhada, plano de CRM operacional, ou estratégia de influenciadores específicos." por "Não descer a calendário editorial, roteiro de conteúdo ou escolha de influenciadores específicos."

- [ ] **Passo 4: conferir travessão nas linhas alteradas e commit**

```bash
git add .claude/skills/06-metas-e-cenarios .claude/skills/07-briefing-e-benchmark .claude/skills/08-midia-paga
git commit -m "feat(skills): metas, briefing e mídia paga usam o registro de soluções"
```

---

### Tarefa 11: Skills 09 e 10 fecham o ciclo

**Arquivos:**
- Modificar: `.claude/skills/09-plano-de-acao/SKILL.md`, `.claude/skills/10-apresentacao-final/SKILL.md`

- [ ] **Passo 1: Skill 09 (plano de ação)**

- Base de dados obrigatória: acrescentar "o registro `contexto/solucoes.json` (Skill 05): toda solução precisa virar ação".
- Formato por ação: acrescentar a linha `SOLUÇÕES: [ids do registro que esta ação executa, ex.: P1.S1, P1.S2; vazio para governança]`.
- Output .docx: no JSON, cada ação leva `"solucoes": ["P1.S1"]`. Antes de rodar `preencher_plano_acao_docx.py`, rodar:

  ```
  python3 scripts/validar_solucoes.py --modo plano \
    --registro clientes/<slug>/contexto/solucoes.json \
    --plano <json_montado>
  ```

  `ERRO:` → crie ou ajuste ações até cobrir toda solução; nunca apague solução do registro para passar.
- Critério de conclusão: acrescentar "`validar_solucoes.py --modo plano` sem `ERRO:`".

- [ ] **Passo 2: Skill 10 (apresentação)**

- Tabela "Antes de começar": linha "02. Desafios" passa a "`contexto/solucoes.json`, `secoes/05-solucoes.md` | 05".
- Tabela de tipos: acrescentar `| desafio | titulo, problema, hipoteses (1 a 5), solucoes (1 a 3), impacto; opcional problema_id |`.
- Estrutura de referência, linha "02. Desafios": "divisória · `bullets` com a lista de desafios (título e impacto de cada problema) · um `desafio` por problema do registro, na ordem de prioridade, com `problema_id` · `cartoes` com os 3 pilares · um `bullets` por iniciativa de cada pilar".
- Regras: acrescentar "**Cobertura de desafios:** todo problema de `contexto/solucoes.json` entra como slide `desafio`. O gerador avisa quando algum ficou de fora: trate o aviso antes de propor o deck. Os textos vêm do registro, condensados; nunca invente hipótese, solução ou impacto."
- Antes de propor o deck: apresentar o checklist da Regra 8 (os 5 itens).

- [ ] **Passo 3: commit**

```bash
git add .claude/skills/09-plano-de-acao .claude/skills/10-apresentacao-final
git commit -m "feat(skills): plano rastreia soluções e deck traz os desafios do registro"
```

---

### Tarefa 12: ponta a ponta com `sottile-teste`

**Arquivos:** nenhum código; só artefatos de teste do prospect (não commitar dados do prospect).

- [ ] **Passo 1:** com as Skills 03 e 04 do `sottile-teste` já concluídas, rodar `/05-solucoes` no terminal sobre esse prospect.
- [ ] **Passo 2:** conferir que `contexto/solucoes.json` cobre pelo menos a quebra (15,9% contra 5%), a conversão e a dependência de Meta citadas em `entrega/ativos-aprovados/secoes/03-macro-financeiro.md`, e que `validar_solucoes.py --modo registro` passa.
- [ ] **Passo 3:** montar um roteiro mínimo com divisória 02 e um `desafio` por problema e gerar o deck com `gerar_apresentacao.py`; abrir a prévia (`previa_apresentacao.py gerar`) e conferir os cards com Read.
- [ ] **Passo 4:** montar um plano mínimo cobrindo todas as soluções e conferir `--modo plano`; remover uma solução de uma ação e ver o `ERRO:`.
- [ ] **Passo 5:** relatar ao analista o resultado, com prints da prévia e qualquer ajuste necessário em skill ou script. Não commitar arquivos de `clientes/sottile-teste/`.

---

### Tarefa 13 (pendente de validação da liderança): funil de eventos do GA4

Executar só com aprovação explícita. Se a liderança vetar, apagar esta tarefa; nada nas Tarefas 1 a 12 depende dela.

**Arquivos:** `.claude/skills/_shared/etapas.json`, `modelos-insumo/schemas.json` e `README.md`, `.claude/skills/03-diagnostico-performance/SKILL.md`, handoff da `02`, `scripts/tests/test_validar_insumo.py`.

- [ ] **Passo 1: teste (falha)**

```python
def test_funil_ga4_exige_as_etapas(ambiente):
    tmp_path, schemas, modelos = ambiente
    ok = salvar(tmp_path / "ok.xlsx", [
        ["DATA", "SESSOES", "ADICOES AO CARRINHO", "INICIOS DE CHECKOUT", "COMPRAS"],
        ["JANEIRO", 10000, 600, 240, 110],
    ])
    assert validar("funil-ga4", ok, schemas, modelos)["ok"] is True
    ruim = salvar(tmp_path / "ruim.xlsx", [["DATA", "SESSOES"], ["JANEIRO", 10000]])
    assert validar("funil-ga4", ruim, schemas, modelos)["ok"] is False
```

- [ ] **Passo 2:** schema `funil-ga4` (`linha_cabecalho: 1`, colunas acima, `min_linhas: 1`, `sensivel: false`); insumo no catálogo (opcional na etapa 03, destino `dados/funil-ga4`, formato `.xlsx`, instrução "Exporte do GA4 o relatório de funil de compra mês a mês"); README.
- [ ] **Passo 3:** Skill 03, Fase 2: item **3b. Funil de eventos** (se o arquivo veio): taxas sessão → carrinho, carrinho → checkout, checkout → compra, mês a mês, cada uma contra a faixa de `benchmarks-kpi.md`; um gráfico por taxa (regra de clareza do `padrao-visual.md`). Handoff da 02: pedido opcional do funil.
- [ ] **Passo 4:** `python3 -m pytest scripts/tests/test_validar_insumo.py -v` e `cd src/packages/core && npm test` → PASS.
- [ ] **Passo 5:** `git commit -m "feat(skills): funil de eventos do GA4 no diagnóstico"`

---

### Tarefa 14 (pendente de validação da liderança): datas por cliente e recorrência

Executar só com aprovação explícita. Se a liderança vetar, apagar esta tarefa.

**Arquivos:** `modelos-insumo/schemas.json` e `README.md`, `etapas.json` (descrição do insumo `clientes-historico`), `.claude/skills/04-unidade-economica/SKILL.md`, handoff da `03`, `scripts/tests/test_validar_insumo.py`.

- [ ] **Passo 1: teste (falha)**: as colunas novas são opcionais (o relatório antigo continua válido), mas, quando presentes, aceitam data.

```python
def test_clientes_historico_aceita_datas_opcionais(ambiente):
    tmp_path, schemas, modelos = ambiente
    salvar(modelos / "clientes-historico.xlsx", [[
        "ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)", "Data 1ª compra", "Data última compra",
    ]])
    antigo = salvar(tmp_path / "antigo.xlsx", [
        ["ID", "Nome", "Nº de pedidos", "Valor total produtos comprados (R$)"], [1, "Cliente A", 2, 300.0],
    ])
    r = validar("clientes-historico", antigo, schemas, modelos)
    assert r["ok"] is True, r
```

Se `validar_insumo.py` exigir todas as colunas do modelo, acrescentar ao schema `"colunas_opcionais": ["Data 1ª compra", "Data última compra"]` e, em `colunas_esperadas`, descontar as opcionais da lista exigida; cobrir com este teste.

- [ ] **Passo 2:** Skill 04: checklist pede as duas datas (opcionais). Novo item no processo, se as datas vieram: % de clientes de compra única; ciclo médio de recompra (média dos dias entre 1ª e última compra dos clientes com 2+ pedidos, dividida por pedidos − 1); base adormecida (clientes sem compra há mais de 1,5× o ciclo, contados a partir da data de hoje confirmada com o analista). Sem gráfico: números consolidados, com fórmula explícita. Handoff da 03: pedir as duas datas, sem PII.
- [ ] **Passo 3:** `python3 -m pytest scripts/tests/test_validar_insumo.py -v` → PASS.
- [ ] **Passo 4:** `git commit -m "feat(skills): recorrência pelo ciclo de compra na unidade econômica"`

---

## Pendência externa (sem tarefa de código)

Os valores marcados "a confirmar" em `benchmarks-kpi.md` dependem da liderança. Quando vierem, atualizar a tabela (fonte e data) num commit `docs(skills): benchmarks de KPI validados pela liderança`.
