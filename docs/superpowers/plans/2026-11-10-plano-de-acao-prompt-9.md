# Skill 08 no padrão do Prompt 9 — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Skill 08 passa a gerar o plano de ação do Prompt 9 (10 campos, abertura, `.docx` + `.xlsx` do mesmo JSON v2), com validação em código.

**Architecture:** Um JSON v2 é a única fonte. `scripts/plano_acao_comum.py` lê e deriva (datas, ordem, pisos de ROAS, tabela-resumo); `scripts/validar_plano_acao.py` recusa o que fere as regras; `scripts/gerar_plano_acao.py` valida e grava `.docx` (`plano_acao_docx.py`, sobre o modelo atual) e `.xlsx` (`plano_acao_xlsx.py`, openpyxl) na mesma execução. A skill, o app (destino da planilha), o fixture Verdeluz e os fluxogramas acompanham.

**Tech Stack:** Python 3 + pytest + openpyxl (3.1.5, já instalado) em `scripts/`; TypeScript + vitest em `src/packages/core`; Mermaid nos `fluxo.mmd`.

**Spec:** `docs/superpowers/specs/2026-11-10-plano-de-acao-prompt-9-design.md`

**Branch:** `feat/plano-acao-prompt-9` (já tem o commit da spec). Outra sessão do Claude troca de branch no mesmo diretório: trabalhe num worktree (`superpowers:using-git-worktrees`) e rode `git branch --show-current` antes de cada commit. Commits só com `git add` de arquivos nomeados.

## Global Constraints

- Datas sempre `dd/mm/aaaa` no JSON; na planilha, células de data reais (`datetime.date`), formato `DD/MM/YYYY`.
- Horizontes, exatamente nesta ordem: `Imediato`, `Curto prazo`, `Médio prazo`.
- Frentes, nomes exatos: `Mídia Paga / Canal Principal`, `Eficiência Operacional`, `Produto / Mix / Portfólio`, `Redução de Dependências`, `Monitoramento e Governança`.
- Dono: `"<disciplina> · <empresa>"` (separador ` · `, ponto médio U+00B7 com espaços).
- `empresa_agencia` ∈ {`Boomer`, `Agência`}.
- Piso de ROAS: `piso_aprovada = 1 / margem`; `piso_captada = piso_aprovada / (1 - quebra)`; margem 0,20 → 5,0; com quebra 0,20 → 6,25. Arredondar a 2 casas só na exibição.
- Marcações: `[VALIDAR]` e `[PREENCHER]` (com ou sem texto após dois-pontos, ex.: `[PREENCHER: margem]`).
- Saída de erro dos scripts no padrão do projeto: linhas `ERRO: ...` em stderr e código 1; `AVISO: ...` em stdout.
- Nenhuma menção à garantia nos arquivos gerados.
- Nome estável dos arquivos: `plano-de-acao-estrategico.docx` e `plano-de-acao-estrategico.xlsx`.

## Review Focus

- Plano com uma ação de Médio prazo que é alavanca da meta e termina depois da janela de prova: o validador deve recusar com mensagem que diga a ação, a data e o fim da janela (teste na Task 2).
- `margem_contribuicao` ausente (`null`): o validador em modo final recusa (piso fica `[PREENCHER]`), em `--rascunho` só avisa; o gerador nunca grava "inf" ou divisão por zero (testes nas Tasks 1 e 3).
- Texto com caracteres especiais de XML (`&`, `<`, aspas) e acentos no `como`: o `.docx` abre e o texto volta igual (teste na Task 4).
- Datas inválidas de calendário (`31/02/2027`) ou com hora: erro claro, não exceção Python (teste na Task 1).
- `depende_de` em ciclo (1→2→1): erro listando o ciclo, sem recursão infinita (teste na Task 2).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/plano_acao_comum.py` (novo) | Constantes, `ErroPlano`, leitura de data, iteração de ações, pisos de ROAS, tabela-resumo. Sem regra de validação. |
| `scripts/validar_plano_acao.py` (novo) | Regras ERRO/AVISO e CLI. |
| `scripts/validar_solucoes.py` | `--modo plano` delega a `validar_plano_acao`. |
| `scripts/plano_acao_docx.py` (novo, a partir do `preencher_plano_acao_docx.py`) | Monta o `.docx` v2 sobre o modelo. |
| `scripts/plano_acao_xlsx.py` (novo) | Monta o `.xlsx` v2 (cria ou preenche modelo). |
| `scripts/gerar_plano_acao.py` (novo) | CLI: valida e gera os dois. |
| `scripts/preencher_plano_acao_docx.py` | Removido. |
| `scripts/tests/plano_v2_exemplo.py` (novo) | `plano_valido()` e `registro_valido()` compartilhados pelos testes. |
| `src/packages/core/src/entregaveis.ts` | Planilha da 08 vai para `plano-de-acao/`. |
| `.claude/skills/08-plano-de-acao/SKILL.md`, `fluxo.mmd` | Skill nova. |
| `.claude/skills/_shared/etapas.json`, `regras-de-validacao.md`, `fluxo-geral.mmd`, `.claude/skills/09-apresentacao-final/SKILL.md` | Textos. |
| `scripts/fixture_verdeluz/plano-de-acao.json`, `roteiro_09.py`, `producao.md`, `clientes/_fixtures/verdeluz/**`, `src/packages/core/scripts/montar-fixture.ts` | Fixture no formato novo. |

---

### Task 1: Base comum do plano v2

**Files:**
- Create: `scripts/plano_acao_comum.py`
- Create: `scripts/tests/plano_v2_exemplo.py`
- Test: `scripts/tests/test_plano_acao_comum.py`

**Interfaces:**
- Produces:
  - `HORIZONTES: tuple[str, ...]`, `FRENTES: tuple[str, ...]`, `CAMPOS_ACAO: tuple[str, ...]` = `("acao","achado_origem","alavanca","como","dono","inicio","entrega","evidencia","kpi_meta","gatilho")` (os 10 campos; `depende_de` é lista e conta como o 7º campo na exibição).
  - `class ErroPlano(Exception)`.
  - `ler_data(texto: str, onde: str) -> datetime.date` — aceita só `dd/mm/aaaa`; senão `ErroPlano(f"{onde}: data \"{texto}\" fora do formato dd/mm/aaaa.")` (inclui datas impossíveis).
  - `acoes(plano: dict) -> list[tuple[str, dict]]` — `(nome_do_horizonte, acao)` na ordem do JSON.
  - `acoes_cronologicas(plano: dict) -> list[dict]` — por `inicio`, desempate por `numero`.
  - `pisos_roas(margem: float | None, quebra: float | None) -> dict` — `{"aprovada": float|None, "captada": float|None}`; `None` quando margem é `None`, `<= 0` ou `> 1`; `captada` é `None` sem quebra.
  - `tabela_resumo(plano: dict) -> list[dict]` — linhas `{"numero","acao","frente","horizonte","periodo","dono"}` em ordem cronológica; `periodo` = `"26/10/2026 a 30/10/2026"`.
  - `texto_depende(acao: dict) -> str` — `"Nenhuma"` ou `"Ações 2, 5"` (uma: `"Ação 2"`).
- `scripts/tests/plano_v2_exemplo.py` produz `registro_valido() -> dict` (copie o de `test_validar_solucoes.py`) e `plano_valido() -> dict`: plano v2 com `data_referencia` `"22/10/2026"`, `janela_prova` `26/10/2026`–`25/01/2027`, `fim_ciclo` `30/09/2027`, `empresa_agencia` `"Boomer"`, `agencia_parceira` `None`, margem `0.20`, quebra `0.20`, 3 horizontes com ao menos uma ação cada, cobrindo todas as soluções de `registro_valido()`, uma frente por ação ao menos uma vez nas 5 frentes, uma ação com `depende_de: [1]`, uma com `alavanca_da_meta: true` dentro da janela, e uma de Médio prazo com `alavanca_da_meta: false` terminando em 2027 após a janela.

- [ ] **Step 1: Testes que falham** em `test_plano_acao_comum.py`:

```python
def test_ler_data_valida():
    assert c.ler_data("26/10/2026", "x") == date(2026, 10, 26)

@pytest.mark.parametrize("ruim", ["2026-10-26", "26/10/26", "31/02/2027", "26/10/2026 10:00", "Imediato", ""])
def test_ler_data_invalida(ruim):
    with pytest.raises(c.ErroPlano, match="dd/mm/aaaa"):
        c.ler_data(ruim, "Ação 1, início")

def test_pisos():
    assert c.pisos_roas(0.20, None) == {"aprovada": pytest.approx(5.0), "captada": None}
    assert c.pisos_roas(0.20, 0.20)["captada"] == pytest.approx(6.25)

@pytest.mark.parametrize("m", [None, 0, -0.1, 1.5])
def test_pisos_sem_margem_valida(m):
    assert c.pisos_roas(m, 0.2) == {"aprovada": None, "captada": None}

def test_tabela_resumo_cronologica():
    linhas = c.tabela_resumo(ex.plano_valido())
    inicios = [c.ler_data(l["periodo"].split(" a ")[0], "") for l in linhas]
    assert inicios == sorted(inicios)
    assert set(linhas[0]) == {"numero", "acao", "frente", "horizonte", "periodo", "dono"}

def test_texto_depende():
    assert c.texto_depende({"depende_de": []}) == "Nenhuma"
    assert c.texto_depende({"depende_de": [2]}) == "Ação 2"
    assert c.texto_depende({"depende_de": [2, 5]}) == "Ações 2, 5"
```

- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_plano_acao_comum.py -q` → FAIL (módulo não existe).
- [ ] **Step 3:** Implemente `plano_acao_comum.py` e `plano_v2_exemplo.py` com as assinaturas acima. `ler_data` usa regex `^\d{2}/\d{2}/\d{4}$` + `datetime.strptime`.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(plano): base comum do plano de ação v2 (datas, pisos de ROAS, tabela-resumo)`.

---

### Task 2: Validador — regras de ERRO

**Files:**
- Create: `scripts/validar_plano_acao.py`
- Test: `scripts/tests/test_validar_plano_acao.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: `validar(plano: dict, registro: dict, rascunho: bool = False) -> tuple[list[str], list[str]]` (erros, avisos). Nunca levanta exceção para entrada malformada: converte `ErroPlano` em erro.

Regras (mensagens começam por `Ação <nº> ("<nome>"): ` quando são de ação):

| Regra | Trecho obrigatório na mensagem |
|---|---|
| `versao != 2` | `versao 2` |
| horizontes ≠ os 3 nomes, na ordem | `Imediato, Curto prazo, Médio prazo` |
| campo de `CAMPOS_ACAO` vazio/ausente | `campo <campo> vazio` |
| `numero` repetido | `número <n> repetido` |
| frente fora de `FRENTES` | `frente` |
| data inválida (`data_referencia`, `janela_prova`, `fim_ciclo`, `inicio`, `entrega`, `metas[].ate`) | `dd/mm/aaaa` |
| `inicio < data_referencia` | `antes da data de referência` |
| `entrega < inicio` | `entrega antes do início` |
| `entrega > fim_ciclo` | `depois do fim do ciclo` |
| dono sem ` · ` ou com disciplina vazia | `disciplina · empresa` |
| empresa do dono ∉ {`empresa_agencia`, `Cliente`, `prospect`, `agencia_parceira`} | `empresa` |
| `depende_de` com nº inexistente / a própria ação / ação cuja `entrega > inicio` desta | `depende da ação <n>` |
| ciclo em `depende_de` | `ciclo de dependência` + os números |
| gatilho sem `se ` no início e sem ` então ` (case-insensitive) | `Se … então` |
| `alavanca_da_meta` true com `inicio` ou `entrega` fora de `janela_prova` | `janela de prova` + a data de fim da janela |
| `[VALIDAR]`/`[PREENCHER]` em qualquer string do plano, se `rascunho=False` | `marcação` |
| margem `null` e `rascunho=False` | `margem de contribuição` |

- [ ] **Step 1: Testes que falham.** `test_plano_valido_passa` (`validar(plano_valido(), registro_valido()) == ([], [])` — ajuste o exemplo da Task 1 para não gerar aviso) e um teste parametrizado por linha da tabela: copia `plano_valido()`, aplica a mutação, e afirma que algum erro contém o trecho. Inclua: `31/02/2027` como `entrega` (erro, não exceção), ciclo `1→2→1`, Médio prazo com `alavanca_da_meta: true` e `entrega` `15/03/2027` (mensagem contém `25/01/2027`), `[PREENCHER: margem]` no `como` aceito com `rascunho=True`, margem `None` aceita com `rascunho=True`.
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_validar_plano_acao.py -q` → FAIL.
- [ ] **Step 3:** Implemente `validar` com as regras de ERRO. Ciclo por DFS iterativa com conjunto de visitados.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(plano): validador do plano v2 (regras que bloqueiam)`.

---

### Task 3: Validador — cobertura, avisos, CLI e delegação

**Files:**
- Modify: `scripts/validar_plano_acao.py`
- Modify: `scripts/validar_solucoes.py:186-236` (`validar_plano`)
- Test: `scripts/tests/test_validar_plano_acao.py`, `scripts/tests/test_validar_solucoes.py`

**Interfaces:**
- Consumes: Task 2.
- Produces: CLI `python3 scripts/validar_plano_acao.py --plano <json> --registro <json> [--rascunho]` → 0 com `OK: <n> ações, <m> soluções cobertas.`; 1 com `ERRO:` em stderr. `validar_solucoes.validar_plano(registro, plano)` passa a retornar `validar_plano_acao.validar(plano, registro, rascunho=True)` filtrado para erros de solução (mensagens com `Solução` ou `solução`), mantendo o contrato de `--modo plano`.

Cobertura (ERRO): reaproveite a lógica de ids do `validar_solucoes.validar_plano` atual — solução citada que não existe no registro; solução do registro sem ação. `solucoes` deve ser lista de strings.

AVISOS: primeira palavra de `acao` ∈ {`otimizar`,`acompanhar`,`priorizar`,`direcionar`,`melhorar`}; `acao` começando por `auditar`/`mapear`/`investigar` sem nenhuma ação com `depende_de` contendo seu número; frente de `FRENTES` sem ação; ação do Imediato com `entrega - inicio > 7 dias`; margem `None` (só em rascunho, porque no final já é erro).

- [ ] **Step 1: Testes que falham:** cobertura (solução sem ação; id inexistente), cada aviso, CLI (exit 0 com plano válido em `tmp_path`; exit 1 e `ERRO:` em stderr com plano inválido; JSON quebrado vira `ERRO:` e não traceback). Em `test_validar_solucoes.py`, troque `plano_valido()` local pelo de `plano_v2_exemplo` e mantenha os testes de cobertura.
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_validar_plano_acao.py tests/test_validar_solucoes.py -q` → FAIL.
- [ ] **Step 3:** Implemente cobertura, avisos, `main()` e a delegação.
- [ ] **Step 4:** Mesmo comando → PASS; `python3 -m pytest -q` em `scripts/` sem regressão.
- [ ] **Step 5:** Commit `feat(plano): cobertura de soluções, avisos e CLI do validador v2`.

---

### Task 4: Gerador do `.docx` v2

**Files:**
- Create: `scripts/plano_acao_docx.py` (mova o conteúdo de `preencher_plano_acao_docx.py` com `git mv` e adapte)
- Test: `scripts/tests/test_plano_acao_docx.py`

**Interfaces:**
- Consumes: Task 1 (`tabela_resumo`, `texto_depende`, `pisos_roas`, `acoes`).
- Produces: `gerar_docx(plano: dict, modelo: Path, saida: Path) -> dict` (`{"output", "total_acoes"}`). Não valida (quem valida é o gerador da Task 6). `MODELO_DOCX_PADRAO = RAIZ / ".claude/skills/_shared/[MODELO] Plano de Ação Estratégico.docx"`.

Conteúdo, nesta ordem: título (prospect); **Abertura** — subtítulo "Metas do plano" com uma linha por meta (`<kpi>: de <de> para <para> até <ate>`), "Cenário de referência: <cenario>", "O que cabe nos 3 meses" (bullets), "O que não cabe" (só se houver), "Premissas", "Piso de ROAS" (`Piso de ROAS sobre a receita aprovada: 5,00 (1 ÷ margem de 20%).` e, se houver, `Sobre a receita captada: 6,25 (com quebra de 20%).`; sem margem: `Piso de ROAS: [PREENCHER: margem de contribuição]`); depois cada horizonte (título, intro) e, dentro dele, as ações agrupadas por frente na ordem de `FRENTES`, cada uma com: linha `AÇÃO <nº>: <acao>` (destaque amarelo), `FRENTE: <frente> · HORIZONTE: <horizonte>`, `ACHADO DE ORIGEM`, `ALAVANCA DA META`, `COMO`, `DONO`, `INÍCIO E ENTREGA: <inicio> a <entrega>`, `DEPENDE DE: <texto_depende>`, `EVIDÊNCIA`, `KPI E META`, `GATILHO`; por fim a tabela-resumo com cabeçalhos `["Nº", "Ação", "Frente", "Horizonte", "Início e entrega", "Dono"]` (reajuste `TABLE_COL_WIDTHS`, soma 9029). Números com vírgula decimal.

- [ ] **Step 1: Testes que falham** (leem `word/document.xml` do zip e extraem o texto dos `<w:t>`):
  - `test_docx_tem_os_10_rotulos_por_acao`: para cada ação de `plano_valido()`, o texto contém `AÇÃO <nº>:` e os rótulos `ACHADO DE ORIGEM`, `ALAVANCA DA META`, `COMO`, `DONO`, `INÍCIO E ENTREGA`, `DEPENDE DE`, `EVIDÊNCIA`, `KPI E META`, `GATILHO`.
  - `test_docx_piso_roas`: contém `5,00` e `6,25`.
  - `test_docx_sem_margem`: com margem `None`, contém `[PREENCHER: margem de contribuição]`.
  - `test_docx_escapa_xml`: `como` = `Verba R$ 20 & público <25 anos> "quentes"` → arquivo abre com `zipfile` + `xml.dom.minidom.parseString` e o texto volta idêntico.
  - `test_docx_preserva_modelo`: `word/header1.xml` e `word/styles.xml` byte a byte iguais ao modelo.
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_plano_acao_docx.py -q` → FAIL.
- [ ] **Step 3:** Implemente `gerar_docx` reaproveitando `_run`, `_p_open`, `_tc`, `titulo_paragrafo`, `horizonte_titulo`, `horizonte_intro`, `montar_tabela`; generalize `acao_bloco` para receber a lista de pares (rótulo, valor). Remova o `main()` antigo.
- [ ] **Step 4:** Mesmo comando → PASS. Abra o arquivo gerado num `tmp` no Word/LibreOffice uma vez e confira visualmente (banner, fonte, destaque amarelo).
- [ ] **Step 5:** Commit `feat(plano): .docx do plano v2 com abertura e 10 campos por ação`.

---

### Task 5: Gerador do `.xlsx`

**Files:**
- Create: `scripts/plano_acao_xlsx.py`
- Test: `scripts/tests/test_plano_acao_xlsx.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: `gerar_xlsx(plano: dict, saida: Path, modelo: Path | None = None) -> dict` (`{"output", "total_acoes"}`). `COLUNAS_PLANO = ["Nº","Frente","Horizonte","Ação","Achado de origem","Alavanca da meta","Como","Dono","Início","Entrega","Depende de","Evidência","KPI e meta","Gatilho","Status"]`. `STATUS = ["A fazer","Em andamento","Feito","Atrasado"]`.

Aba `Plano de Ação`: cabeçalho na linha 1 (`COLUNAS_PLANO`), uma linha por ação de `acoes_cronologicas`, `Início`/`Entrega` como `date` com `number_format = "DD/MM/YYYY"`, `Depende de` = `texto_depende`, `Status` vazio com `DataValidation(type="list")` sobre a coluna inteira até a última ação. Cabeçalho preenchido `1C2F5F`, fonte branca negrito; linhas zebradas `FFFFFF`/`EEF2F8`; `freeze_panes = "A2"`; `auto_filter.ref` cobrindo a tabela; `wrap_text` nas colunas de texto; larguras fixas legíveis (Como 60, Gatilho 45, demais 14–30).
Aba `Metas do plano`: blocos "Cenário de referência", "Metas" (tabela KPI | De | Para | Até | Fonte), "O que cabe nos 3 meses", "O que não cabe" (se houver), "Premissas", "Piso de ROAS" (mesmo texto da Task 4).
Com `modelo`: abre o modelo, escreve a partir da linha 2 da aba `Plano de Ação` e no bloco da aba `Metas do plano`, sem recriar estilos; se o modelo não tiver as duas abas, `ErroPlano("o modelo .xlsx precisa das abas \"Plano de Ação\" e \"Metas do plano\".")`.

- [ ] **Step 1: Testes que falham** (relendo com `openpyxl.load_workbook`): abas com os nomes exatos; cabeçalho = `COLUNAS_PLANO`; nº de linhas = nº de ações; ordem cronológica; células de data são `date`; validação de dados com os 4 status; `freeze_panes == "A2"`; aba de metas contém `5,00` e `6,25`; modelo sem as abas → `ErroPlano`; modelo mínimo criado no teste com as duas abas → preenchido.
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_plano_acao_xlsx.py -q` → FAIL.
- [ ] **Step 3:** Implemente `gerar_xlsx`.
- [ ] **Step 4:** Mesmo comando → PASS. Abra uma vez no Excel/Sheets e confira o visual.
- [ ] **Step 5:** Commit `feat(plano): planilha .xlsx do plano v2 (Plano de Ação e Metas do plano)`.

---

### Task 6: `gerar_plano_acao.py` (valida e gera os dois juntos)

**Files:**
- Create: `scripts/gerar_plano_acao.py`
- Delete: `scripts/preencher_plano_acao_docx.py` (se o `git mv` da Task 4 já não o removeu)
- Test: `scripts/tests/test_gerar_plano_acao.py`

**Interfaces:**
- Consumes: Tasks 3, 4, 5.
- Produces: CLI
  `python3 scripts/gerar_plano_acao.py --plano <json> --registro <solucoes.json> --saida-docx <.docx> --saida-xlsx <.xlsx> [--modelo-docx <.docx>] [--modelo-xlsx <.xlsx>]`
  e `gerar(plano: dict, registro: dict, saida_docx: Path, saida_xlsx: Path, modelo_docx: Path = MODELO_DOCX_PADRAO, modelo_xlsx: Path | None = None) -> dict`. Valida com `rascunho=False`; com erro, imprime `ERRO:` e sai 1 **sem criar nenhum dos dois arquivos**. Grava os dois em arquivos temporários na mesma pasta e só renomeia para os nomes finais quando ambos deram certo. Sucesso: imprime avisos e `OK: .docx e .xlsx gerados com <n> ações.`

- [ ] **Step 1: Testes que falham:**
  - `test_docx_e_xlsx_iguais`: gera os dois de `plano_valido()`; extrai de cada um o conjunto `(numero, acao, inicio, entrega, dono, kpi_meta)` (docx pelo texto, xlsx pelas células) e afirma igualdade.
  - `test_erro_nao_gera_nada`: plano com campo vazio → exit 1, nenhum dos dois caminhos existe.
  - `test_falha_no_xlsx_nao_deixa_docx`: `--modelo-xlsx` sem as abas → exit 1, nenhum arquivo final existe.
  - `test_nao_menciona_garantia`: nenhum dos dois contém `garantia` (case-insensitive).
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_gerar_plano_acao.py -q` → FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** Mesmo comando → PASS; `python3 -m pytest -q` em `scripts/` sem regressão; `grep -rn preencher_plano_acao_docx --exclude-dir=node_modules --exclude-dir=.git .` só deve achar specs/planos antigos em `docs/` e o `resumoDecisoes` histórico do fixture (tratado na Task 9).
- [ ] **Step 5:** Commit `feat(plano): gerar_plano_acao.py gera .docx e .xlsx juntos depois de validar`.

---

### Task 7: App — destino da planilha da 08 e catálogo

**Files:**
- Modify: `src/packages/core/src/entregaveis.ts:47-51` (`destinoAprovado`)
- Modify: `.claude/skills/_shared/etapas.json` (etapa `08`: `descricao`, `oQueEsperar`)
- Test: `src/packages/core/test/entregaveis.test.ts`

**Interfaces:**
- Produces: `destinoAprovado({tipo: "planilha", nomeFinal: "plano-de-acao-estrategico", etapa: "08"}) === "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.xlsx"`; planilha da `06` continua em `projecao/`.

Textos de `etapas.json`, etapa 08:
- `descricao`: `"Monta o plano de ação com 10 campos por ação, abertura com metas e premissas, em documento Word e planilha Excel iguais."`
- `oQueEsperar`: `"O agente começa confirmando o que já sabe e perguntando o que falta: quem executa do lado do cliente, quem opera a mídia, ferramentas, restrições de calendário, a margem de contribuição antes da mídia (para o piso de ROAS) e se a empresa aparece como Agência ou Boomer. Depois monta a abertura do plano e as ações, cada uma com dono, datas, evidência, meta e gatilho, e gera o documento Word e a planilha Excel. A etapa só fecha quando você responder sim à pergunta-guia: se o cliente fizer só isto por 3 meses, o resultado vem?"`

- [ ] **Step 1:** Acrescente em `entregaveis.test.ts` a expectativa acima (e mantenha a de `06`). 
- [ ] **Step 2:** `cd src/packages/core && npx vitest run test/entregaveis.test.ts` → FAIL.
- [ ] **Step 3:** Em `destinoAprovado`, para `tipo === "planilha" && etapa === "08"` use a pasta `plano-de-acao`. Atualize `etapas.json`.
- [ ] **Step 4:** `cd src && npm test` → PASS (inclui `catalogo.test.ts` e `catalogo-skills.test.ts`).
- [ ] **Step 5:** Commit `feat(core): planilha do plano de ação vai para plano-de-acao/ e catálogo da 08 atualizado`.

---

### Task 8: Skill 08, fluxograma e textos compartilhados

**Files:**
- Modify: `.claude/skills/08-plano-de-acao/SKILL.md` (reescrita)
- Modify: `.claude/skills/08-plano-de-acao/fluxo.mmd`
- Modify: `.claude/skills/_shared/regras-de-validacao.md` (Regra 7, lista de scripts; Regra 8, item 4)
- Modify: `.claude/skills/_shared/fluxo-geral.mmd` (rótulo da seta `E08 --> E09`)
- Modify: `.claude/skills/09-apresentacao-final/SKILL.md` (linha da seção 05 nas duas tabelas)
- Test: `src/apps/web/lib/fluxos.test.ts`, `src/packages/core/test/catalogo-skills.test.ts` (existentes)

O `SKILL.md` segue a estrutura e o tom das outras skills (frontmatter `name: plano-de-acao`, `description` citando documento e planilha) e contém, nesta ordem, o que a spec define em "Parte 1 · Fluxo da Skill 08": "Antes de começar" (as 9 perguntas de abertura, pré-preenchidas, uma por vez; margem "antes da mídia" com a lista do que entra; "Agência" ou "Boomer"); objetivo e pergunta-guia; base de dados; horizontes (Médio prazo até `fim_ciclo`); janela de prova; frentes; regras de ouro; 6 critérios; 7 erros (texto do Prompt 9, Erro 6 com o piso calculado pelo script); os 10 campos com os exemplos do Prompt 9; formato JSON v2 (link para a spec, não copiar o esquema inteiro) e os comandos `validar_plano_acao.py --rascunho` (Fase 2) e `gerar_plano_acao.py` (Fase 3; saídas em `.app/rascunhos/` na interface e em `entrega/ativos-aprovados/plano-de-acao/` no terminal; `propor_entregavel` tipos `documento` e `planilha`, `nome_final` `plano-de-acao-estrategico`); Fase 4 (relatório sem tabelas, 5 itens); restrições; critério de conclusão (inclui "sim" à pergunta-guia e os dois arquivos aprovados); encerramento e handoff (texto atual, trocando "o plano de ação ficou fechado" por "o plano de ação ficou fechado, em documento e planilha"). Remova a nota "Corresponde ao Prompt 10 do processo original" e diga "Corresponde ao Prompt 9 do processo manual (`prompts/`)".

`fluxo.mmd`: nós na ordem — insumos (decisões 01–07 + `solucoes.json`) → "Abertura: confirmar o que já se sabe e perguntar o que falta (9 itens)" → "Fase 1 · Abertura do plano" → checkpoint → "Fase 2 · Ações com os 10 campos" → "validar_plano_acao.py --rascunho" → decisão "Saiu ERRO?" (sim → corrigir e voltar) → checkpoint "Analista aprova?" (resolve [VALIDAR]/[PREENCHER]) → "Fase 3 · gerar_plano_acao.py (.docx + .xlsx)" → checkpoint → "Fase 4 · Relatório de verificação" → decisão "Pergunta-guia: sim?" com classe `checkpoint` e saídas `sim` / `não, ajustar` (volta à Fase 2) → entrega "Plano de ação (.docx + .xlsx)" → handoff. Convenções do `CLAUDE.md` (TD, rótulos entre aspas, três `classDef`).

- [ ] **Step 1:** Escreva os arquivos.
- [ ] **Step 2:** `cd src && npm test` → PASS (valida os 12 fluxos e o catálogo).
- [ ] **Step 3:** Releia o `SKILL.md` contra a spec, item a item da Parte 1; nenhum "Agência" genérico como dono nos exemplos.
- [ ] **Step 4:** Commit `feat(skill-08): plano de ação no padrão do Prompt 9 e fluxograma`.

---

### Task 9: Fixture Verdeluz no formato novo

**Files:**
- Modify: `scripts/fixture_verdeluz/plano-de-acao.json` (reescrita v2)
- Modify: `scripts/fixture_verdeluz/roteiro_09.py:139,182-188` (dono "(Agência)" → "(Boomer)")
- Modify: `scripts/fixture_verdeluz/producao.md` (seção "Etapa 08") e `clientes/_fixtures/verdeluz/roteiros/08.md`
- Modify: `clientes/_fixtures/verdeluz/base/entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx` (regerado) e Create `.xlsx` ao lado
- Modify: `clientes/_fixtures/verdeluz/base/contexto/decisoes/08-plano-de-acao.md`, `clientes/_fixtures/verdeluz/manifesto.json`, `clientes/_fixtures/verdeluz/estado-completo.json`
- Modify: `src/packages/core/scripts/montar-fixture.ts` (tabelas `etapaDoArquivo` e `unicos`)
- Test: `src/packages/core/test/fixture-verdeluz.test.ts`

**Interfaces:**
- Consumes: Tasks 6 e 7.

Dados do fixture: `data_referencia` `22/10/2026`; `janela_prova` `26/10/2026`–`25/01/2027`; `fim_ciclo` `30/09/2027` (ciclo OUT/26–SET/27 da 06); `empresa_agencia` `Boomer`; margem `0.35` (fictícia; registrar no roteiro 08 como resposta do analista); quebra `0.055` (Realista da 06). As 25 ações atuais viram ações v2 com as mesmas soluções; donos com disciplina (ex.: "Gestor de tráfego · Boomer", "Operação do e-commerce · Cliente"; as pessoas nomeadas — Marina, Luiza, Bruna, Caio, Rafael — ficam no `como`). Ações que são alavanca da meta e hoje passam de 25/01/2027 (ex.: reativação de JAN e FEV, P3.S2) têm a **entrega** redesenhada para a estrutura pronta dentro da janela (régua configurada e disparada) e o efeito no `kpi_meta`; o que for preparação de pico posterior fica `alavanca_da_meta: false`.

- [ ] **Step 1:** Escreva o test em `fixture-verdeluz.test.ts`: o manifesto lista `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.xlsx` com etapa `08`; o estado tem um entregável aprovado `tipo: "planilha"`, `etapa: "08"`, `nomeFinal: "plano-de-acao-estrategico"`; o teste "marca FICTÍCIO" passa a cobrir também o `.xlsx` (lendo `xl/sharedStrings.xml`).
- [ ] **Step 2:** `cd src/packages/core && npx vitest run test/fixture-verdeluz.test.ts` → FAIL.
- [ ] **Step 3:** Reescreva o JSON e rode `python3 scripts/validar_plano_acao.py --plano scripts/fixture_verdeluz/plano-de-acao.json --registro clientes/_fixtures/verdeluz/base/contexto/solucoes.json` até `OK` sem avisos de frente vazia.
- [ ] **Step 4:** Gere os dois arquivos na base do fixture com `gerar_plano_acao.py`; copie para as propostas: o `.docx` sobre `.app/propostas/7e587276-9c22-4711-cdcc-1ce930aac9f3.docx` (em `base/app/propostas/`) e o `.xlsx` como `base/app/propostas/<id>.xlsx`, com `id` = `idDeterministico("entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.xlsx")` (calcule com o mesmo SHA-1/formatação de `montar-fixture.ts`). Acrescente as duas entradas no `manifesto.json` (etapa `08`) e o entregável em `estado-completo.json` (`titulo` "Plano de ação estratégico (planilha)", `criadoEm`/`decididoEm` iguais aos do `.docx`). Atualize `montar-fixture.ts`: `etapaDoArquivo` com o `.xlsx` → `"08"` e `unicos` com `"plano-de-acao-estrategico.xlsx": { tipo: "planilha", etapa: "08", nomeFinal: "plano-de-acao-estrategico", titulo: "Plano de ação estratégico (planilha)" }`.
- [ ] **Step 5:** Reescreva `decisoes/08-plano-de-acao.md` e o `resumoDecisoes` da 08 em `estado-completo.json` (mesmo texto) citando `gerar_plano_acao.py`, os dois arquivos, a margem e os pisos (`2,86` sobre a aprovada; `3,02` sobre a captada), a janela de prova e as novas respostas da abertura. Atualize `roteiros/08.md` e a seção correspondente de `producao.md` com as 9 respostas da abertura (incluindo "Boomer" e margem de 35%) e "confira o .docx e o .xlsx". Troque "(Agência)" por "(Boomer)" em `roteiro_09.py` e regenere o roteiro/deck do fixture só se o teste de fixture exigir (o deck não mostra donos fora desses bullets).
- [ ] **Step 6:** `cd src && npm test` e `cd scripts && python3 -m pytest -q` → PASS.
- [ ] **Step 7:** Commit `feat(fixture): Verdeluz com plano de ação v2 (.docx + .xlsx)`.

---

### Task 10: Verificação final

- [ ] **Step 1:** `cd src && npm test` (web + core) e `cd scripts && python3 -m pytest -q` → tudo PASS.
- [ ] **Step 2:** `grep -rn "preencher_plano_acao_docx\|O QUÊ:\|POR QUEM" .claude scripts src --exclude-dir=node_modules` → nenhum uso ativo.
- [ ] **Step 3:** Rode o app local sem nuvem (memória `rodar-app-local-sem-nuvem`), crie um cliente de teste a partir do fixture posicionado na etapa 08 e confirme que a etapa mostra o documento e a planilha aprovados e que a planilha abre no visualizador.
- [ ] **Step 4:** Commit de qualquer ajuste; não fazer push sem pedido.
