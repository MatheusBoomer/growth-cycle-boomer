# Etapa 10 — Revisão pós-apresentação — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a etapa 10 do Growth Cycle, que cruza a transcrição da reunião de apresentação com o plano de ação v2 da 08 e gera o plano final (`plano-de-acao-final.docx/.xlsx/.json`) depois das decisões do analista.

**Architecture:** Scripts Python novos e independentes (`texto_transcricao.py`, `validar_revisao.py`, `relatorio_revisao.py`, mais `diferencas` em `plano_acao_comum.py` e `--saida-json` em `gerar_plano_acao.py`) garantem em código que todo trecho citado existe na transcrição, que todo conflito foi decidido e que toda mudança no plano tem motivo. O app ganha a etapa `"10"` depois de `"final"`, o insumo da transcrição e a cópia automática dos JSONs que acompanham o documento aprovado. A skill, o fluxograma e o fixture Verdeluz fecham o ciclo.

**Tech Stack:** Python 3 + pytest + python-docx + openpyxl em `scripts/`; TypeScript + vitest em `src/packages/core` e `src/apps/web`; Mermaid nos `fluxo.mmd`.

**Spec:** `docs/superpowers/specs/2026-11-10-etapa-10-revisao-pos-apresentacao-design.md`

**Branch:** `feat/etapa-10-revisao`, no worktree `.claude/worktrees/etapa-10` (já tem o commit da spec). Outra sessão troca de branch no diretório principal: trabalhe só no worktree, rode `git branch --show-current` antes de cada commit e faça `git add` só de arquivos nomeados. Nunca use `git stash` sem tag.

## Global Constraints

- Id da etapa: `"10"`; skill `10-revisao-pos-apresentacao`; rótulo `10 · Revisão pós-apresentação`; fase `Pós-apresentação`; comando `/10-revisao-pos-apresentacao`.
- Insumo: id `apresentacao-transcricao`, obrigatório, formatos `.docx`, `.txt`, `.md`, destino `contexto/brutos/apresentacao-transcricao-bruta`.
- Nomes estáveis: `plano-de-acao-estrategico.json` (08), `plano-de-acao-final.{docx,xlsx,json}`, `revisao-plano.json`, seção `10-revisao-pos-apresentacao.md`; todos os do plano em `entrega/ativos-aprovados/plano-de-acao/`.
- `revisao-plano.json` tem `"versao": 1`; trecho = `{"texto","quem","posicao"}`; datas `dd/mm/aaaa`.
- Saída dos scripts: `ERRO: ...` em stderr e código 1; `AVISO: ...` em stdout; nunca traceback para entrada malformada.
- O plano final segue todas as regras da 08 (`validar_plano_acao.py` em modo final); nenhuma menção à garantia.
- `npm test` usa cache do turbo: verificar sempre com `npm test -- --force` em `src/`.
- Textos para o analista em pt-BR, sem caminho de arquivo nas mensagens de handoff (Regra 6).

## Review Focus

- Trecho citado com aspas tipográficas, travessão ou quebra de linha diferentes da transcrição: deve ser encontrado (normalização), e um trecho inventado deve ser recusado (Task 2 e Task 4).
- Plano final em que uma ação muda só no `como` sem item da revisão citando o número: o validador deve recusar com o número da ação (Task 5).
- Estado de prospect antigo com a final concluída e sem a chave `"10"`: deve abrir com a 10 liberada, sem quebrar o prospect com etapa desatualizada (Task 7).
- Aprovação do documento da 08/10 quando o JSON acompanhante não existe no rascunho (plano gerado antes de `--saida-json`): a aprovação acontece e o aviso aparece na atividade (Task 8).
- Transcrição `.docx` com o texto em tabela (alguns exportadores fazem isso): os trechos ainda são encontrados (Task 2).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/gerar_plano_acao.py` | ganha `--saida-json` / parâmetro `saida_json` |
| `scripts/plano_acao_comum.py` | ganha `diferencas(plano_a, plano_b)` |
| `scripts/texto_transcricao.py` (novo) | extrair e normalizar texto de `.docx/.txt/.md`; buscar trecho |
| `scripts/validar_revisao.py` (novo) | regras e CLI do `revisao-plano.json` |
| `scripts/relatorio_revisao.py` (novo) | relatório do que mudou, metas e cobertura |
| `scripts/tests/revisao_exemplo.py` (novo) | `transcricao_exemplo()`, `revisao_valida()`, `plano_final_valido()` para os testes |
| `src/packages/core/src/tipos.ts`, `maquina-estados.ts`, `armazenamento.ts`, `servico-planejamento.ts` | etapa 10 no estado |
| `src/packages/core/src/entregaveis.ts` + `servico-planejamento.ts` | planilha da 10 e acompanhantes |
| `src/apps/web/components/trabalho/area-de-trabalho.tsx`, `src/apps/web/components/admin/painel/graficos-dados.ts` | etapa inicial e rótulos |
| `.claude/skills/_shared/etapas.json`, `sugestoes-modelos.json` | catálogo |
| `.claude/skills/10-revisao-pos-apresentacao/{SKILL.md,fluxo.mmd}`, `.claude/commands/10-revisao-pos-apresentacao.md` (novos) | skill |
| `.claude/skills/08-plano-de-acao/SKILL.md`, `.claude/skills/09-apresentacao-final/{SKILL.md,fluxo.mmd}`, `_shared/{fluxo-geral.mmd,regras-de-validacao.md}`, `_desativadas/briefing-e-benchmark/README.md`, `CLAUDE.md` | textos |
| `scripts/fixture_verdeluz/{textos.py,gerar_brutos.py,producao.md}`, `clientes/_fixtures/verdeluz/**`, `src/packages/core/scripts/montar-fixture.ts` | fixture |

---

### Task 1: `--saida-json` no gerador e `diferencas` entre planos

**Files:**
- Modify: `scripts/gerar_plano_acao.py`, `scripts/plano_acao_comum.py`
- Test: `scripts/tests/test_gerar_plano_acao.py`, `scripts/tests/test_plano_acao_comum.py`

**Interfaces:**
- Produces:
  - `gerar(..., saida_json: Path | None = None, ...)` e CLI `--saida-json <caminho>`: grava `json.dumps(plano, ensure_ascii=False, indent=2) + "\n"` na mesma escrita atômica (temporário + `os.replace`, mesma permissão dos outros); entra nas checagens de colisão (não pode ser igual às outras saídas, aos modelos nem às entradas).
  - `diferencas(plano_a: dict, plano_b: dict) -> dict` em `plano_acao_comum.py`, retornando `{"incluidas": [int], "removidas": [int], "alteradas": {int: [campo, ...]}, "metas_alteradas": [kpi, ...]}`. Compara ações por `numero`; campos comparados: os de `CAMPOS_ACAO` mais `frente`, horizonte (nome do horizonte onde a ação está), `depende_de`, `alavanca_da_meta`, `solucoes`. Metas por `kpi` (meta incluída, removida ou com `de`/`para`/`ate` diferente conta como alterada).

- [ ] **Step 1:** Testes que falham:
  - `test_saida_json_igual_a_entrada`: gera com `saida_json`; `json.loads` do arquivo == `plano_valido()`.
  - `test_saida_json_atomica`: com `--modelo-xlsx` inválido, nenhum dos três arquivos existe.
  - `test_saida_json_colide`: `saida_json == saida_docx` → `ERRO`.
  - `test_diferencas`: copia `plano_valido()`, remove a ação 6, muda `como` da 2, inclui uma ação 7 nova, muda `para` de uma meta → `{"incluidas": [7], "removidas": [6], "alteradas": {2: ["como"]}, "metas_alteradas": [<kpi>]}`; `diferencas(p, p)` vazio.
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_gerar_plano_acao.py tests/test_plano_acao_comum.py -q` → FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** Mesmo comando → PASS; `python3 -m pytest -q` sem regressão (base: 494).
- [ ] **Step 5:** Commit `feat(plano): gerar_plano_acao grava o JSON do plano e diferencas entre planos`.

---

### Task 2: Leitura da transcrição

**Files:**
- Create: `scripts/texto_transcricao.py`
- Test: `scripts/tests/test_texto_transcricao.py`

**Interfaces:**
- Produces:
  - `class ErroTranscricao(Exception)`.
  - `extrair_texto(caminho: Path) -> str`: `.docx` com python-docx (parágrafos e, depois, células de tabelas, cada um em uma linha); `.txt` e `.md` em UTF-8, com fallback latin-1. Outra extensão ou arquivo ausente → `ErroTranscricao` com a extensão/caminho na mensagem.
  - `normalizar(texto: str) -> str`: minúsculas; `“”„«»` → `"`, `‘’` → `'`, `–—` → `-`, reticências `…` → `...`; qualquer sequência de espaço em branco (inclui `\n`) → um espaço; `strip` de espaço e de `.,;:!?"'` nas pontas.
  - `contem_trecho(texto_normalizado: str, trecho: str) -> bool`: `normalizar(trecho)` não vazio e contido em `texto_normalizado`.

- [ ] **Step 1:** Testes que falham: extração de `.docx` (parágrafo + tabela, criado no teste com python-docx), `.txt` UTF-8, `.txt` latin-1, `.md`; `.pdf` → `ErroTranscricao`; `contem_trecho` acha `“CRM só depois de janeiro”` quando a transcrição tem `"CRM só depois\nde Janeiro."`; não acha trecho inventado; trecho vazio → False.
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_texto_transcricao.py -q` → FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(revisao): leitura e normalização da transcrição da apresentação`.

---

### Task 3: Exemplo compartilhado da revisão

**Files:**
- Create: `scripts/tests/revisao_exemplo.py`
- Test: `scripts/tests/test_revisao_exemplo.py`

**Interfaces:**
- Consumes: `plano_v2_exemplo.plano_valido()`, `registro_valido()`; `diferencas` (Task 1).
- Produces:
  - `transcricao_exemplo() -> str`: texto de reunião curto (marcações `[00:12:30] Nome:` por fala) com falas da Boomer e do cliente que contenham literalmente os trechos usados abaixo, uma fala "vou pensar" e uma "já testamos".
  - `revisao_valida() -> dict` (rascunho completo, **com** decisões e destinos, válido em modo final contra `plano_final_valido()`): participantes 2 Boomer + 2 cliente; 1 complemento (muda o dono da ação 2); 1 conflito com opções A/B/C, `decisao: "C"`, `acoes_afetadas: [3]`; 1 conflito com `remove_acao: true` sobre a ação 6 (não alavanca) e decisão "B"; 1 ponto em aberto com destino `{"tipo":"acao","acoes":[7]}`; 1 ponto em aberto com destino `confirmar` em data futura; 1 compromisso `no_plano: true`; 1 compromisso `fora_do_escopo: true` com `tratamento`; `divergencias_cenario: []`.
  - `plano_final_valido() -> dict`: `plano_valido()` com essas mudanças aplicadas (dono da 2, `como` da 3, ação 6 removida, ação 7 incluída); passa em `validar_plano_acao.validar(..., rascunho=False)` sem avisos.

- [ ] **Step 1:** Teste que falha: `test_exemplo_coerente` — `validar_plano_acao.validar(plano_final_valido(), registro_valido()) == ([], [])`; `diferencas(plano_valido(), plano_final_valido())` tem exatamente incluídas `[7]`, removidas `[6]` e alteradas `{2, 3}`; todo `trecho.texto` de `revisao_valida()` é encontrado por `contem_trecho` em `transcricao_exemplo()`.
- [ ] **Step 2:** FAIL. **Step 3:** Implemente o exemplo. **Step 4:** PASS. (Se a remoção da ação 6 deixar uma solução do registro sem ação, a ação 7 cobre essa solução.)
- [ ] **Step 5:** Commit `test(revisao): exemplo compartilhado de transcrição, revisão e plano final`.

---

### Task 4: Validador da revisão — regras de sempre

**Files:**
- Create: `scripts/validar_revisao.py`
- Test: `scripts/tests/test_validar_revisao.py`

**Interfaces:**
- Consumes: Tasks 1–3; `plano_acao_comum.ler_data`, `ErroPlano`.
- Produces: `validar(revisao: dict, texto_transcricao: str, plano_08: dict, plano_final: dict | None = None, rascunho: bool = False) -> tuple[list[str], list[str]]`. Nunca levanta exceção. Mensagens de item começam por `Complemento <n>: `, `Conflito <n>: `, `Ponto em aberto <n>: ` ou `Compromisso <n>: `.

ERRO (em qualquer modo), com o trecho obrigatório na mensagem:

| Regra | Trecho |
|---|---|
| `versao` ≠ 1 | `versao 1` |
| `participantes`, `complementos`, `conflitos`, `abertos`, `compromissos` ausentes ou de tipo errado | nome da chave |
| `numero` repetido no grupo | `número <n> repetido` |
| `trecho.texto` vazio ou não encontrado (`contem_trecho` sobre `normalizar(texto_transcricao)`) | `trecho não encontrado na transcrição` |
| `quem` cujo nome (texto antes de ` (`) não é `nome` de nenhum participante | `quem` |
| ação citada em `acao`, `acoes`, `acoes_afetadas` que não existe no plano da 08 nem no plano final | `ação <n> não existe` |
| `opcoes` sem A e B, ou `recomendacao_boomer`/`decisao` fora das chaves de `opcoes` | `opção` |
| `remove_acao` true, ação com `alavanca_da_meta` true no plano da 08, e `alavanca_descoberta` ou `substituta` vazio | `alavanca descoberta` |
| `data_hoje`, `data_reuniao`, `destino.ate` fora de dd/mm/aaaa | `dd/mm/aaaa` |
| `data_reuniao` depois de `data_hoje` | `data da reunião` |

AVISO: `trecho.texto` com mais de 300 caracteres; `posicao` vazia; `resumo` com mais de 5 linhas não vazias.

- [ ] **Step 1:** Testes: `validar(revisao_valida(), transcricao_exemplo(), plano_valido(), plano_final_valido()) == ([], [])`; um teste parametrizado por linha da tabela (mutação + trecho esperado); um trecho com aspas tipográficas é aceito; um trecho inventado é recusado; entrada malformada (lista no lugar de dict, `conflitos` como string, `trecho` ausente) não levanta e gera erro; cada AVISO.
- [ ] **Step 2:** `cd scripts && python3 -m pytest tests/test_validar_revisao.py -q` → FAIL. **Step 3:** Implemente. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(revisao): validador do registro da revisão (trechos, participantes, ações, opções)`.

---

### Task 5: Validador da revisão — modo final, rastreabilidade e CLI

**Files:**
- Modify: `scripts/validar_revisao.py`
- Test: `scripts/tests/test_validar_revisao.py`

**Interfaces:**
- Consumes: Task 4; `diferencas` (Task 1); `texto_transcricao.extrair_texto`; `validar_plano_acao._ler_json`/`ErroEntrada`.
- Produces: CLI `python3 scripts/validar_revisao.py --revisao <json> --transcricao <arquivo> --plano-08 <json> [--plano-final <json>] [--rascunho]`; sucesso imprime AVISOs e `OK: <a> complementos, <b> conflitos, <c> pontos em aberto, <d> compromissos.`

ERRO só sem `rascunho`:

| Regra | Trecho |
|---|---|
| conflito com `decisao` null | `sem decisão` |
| ponto em aberto com `destino` null | `sem destino` |
| destino `confirmar` com `ate` anterior a `data_hoje` | `data já passou` |
| destino `acao` com ação inexistente no plano final (ou sem `plano_final`) | `ação <n> não existe no plano final` |
| destino `descartado` sem `motivo` | `motivo` |
| compromisso com `fora_do_escopo` true ou `no_plano` false, sem `acoes` e sem `tratamento` | `tratamento` |
| com `plano_final`: número em `diferencas(...)["incluidas"|"removidas"|"alteradas"]` que não aparece em nenhum `acoes`/`acoes_afetadas`/`acao` de complemento, conflito, ponto em aberto (destino ação) ou compromisso | `Ação <n> mudou no plano final sem motivo na revisão` |
| com `plano_final`: kpi em `metas_alteradas` ausente de `divergencias_cenario[].item` | `Meta "<kpi>" mudou sem registro em divergencias_cenario` |

- [ ] **Step 1:** Testes por regra; `revisao_valida()` passa em modo final; a mesma revisão com `decisao: null` passa em `rascunho=True`; ação 2 alterada só no `como` sem item citando a ação → erro com `Ação 2`; CLI: OK (exit 0), inválido (exit 1, `ERRO:` em stderr), JSON quebrado e transcrição `.pdf` → `ERRO:` sem traceback.
- [ ] **Step 2:** FAIL. **Step 3:** Implemente. **Step 4:** PASS; `python3 -m pytest -q` sem regressão.
- [ ] **Step 5:** Commit `feat(revisao): modo final, toda mudança com motivo e CLI do validador`.

---

### Task 6: Relatório da revisão

**Files:**
- Create: `scripts/relatorio_revisao.py`
- Test: `scripts/tests/test_relatorio_revisao.py`

**Interfaces:**
- Consumes: `diferencas` (Task 1), `validar_plano_acao._ler_json`.
- Produces: `montar_relatorio(plano_08: dict, plano_final: dict, revisao: dict) -> str` (Markdown sem tabelas) e CLI `python3 scripts/relatorio_revisao.py --plano-08 <json> --plano-final <json> --revisao <json>` (imprime o Markdown; `ERRO:` em stderr para JSON inválido).

Seções do Markdown, nesta ordem e com estes títulos `##`: `O que mudou` (subtítulos `Incluídas`, `Alteradas`, `Removidas`, cada linha `- Ação <n> · <nome>: <motivo>` e, nas alteradas, `(campos: como, dono)`; motivo = `Complemento <n>`, `Conflito <n>: Opção <X>`, `Ponto em aberto <n>` ou `Compromisso <n>`, o primeiro item que cita a ação, nessa ordem de grupos), `Metas e cenário` (metas alteradas com `de → para` antes e depois; `divergencias_cenario` com slides; ou `Nenhuma mudança de meta, verba ou cenário.`), `Cobertura da meta` (para cada `kpi` das metas do plano final: ações com `alavanca_da_meta` cuja `alavanca` contém o kpi, sem diferenciar maiúsculas, antes e depois; `⚠️ sem ação` se ficou vazio; `enfraqueceu` se o número de ações caiu), `Pendências` (pontos em aberto com destino `confirmar`, com a data).

- [ ] **Step 1:** Testes com o exemplo da Task 3: contém `Ação 7` em Incluídas com `Ponto em aberto 1`; `Ação 3` em Alteradas com `Conflito 1: Opção C`; `Ação 6` em Removidas com `Conflito 2: Opção B`; meta alterada aparece com antes e depois; KPI que perde todas as ações mostra `⚠️ sem ação`; sem mudança de meta → frase padrão; CLI imprime e sai 0.
- [ ] **Step 2:** FAIL. **Step 3:** Implemente. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(revisao): relatório do que mudou, metas e cobertura da meta`.

---

### Task 7: Etapa 10 no estado, no catálogo e nos rótulos

**Files:**
- Modify: `src/packages/core/src/tipos.ts:1` (`ORDEM_ETAPAS`), `src/packages/core/src/maquina-estados.ts` (`recalcularLiberacoes`), `src/packages/core/src/armazenamento.ts:52-58` (`normalizarEstado`), `src/packages/core/src/servico-planejamento.ts` (`resumir`), `src/apps/web/components/trabalho/area-de-trabalho.tsx` (`escolherEtapaInicial`), `src/apps/web/components/admin/painel/graficos-dados.ts` (`rotuloEtapa`, se precisar), `.claude/skills/_shared/etapas.json`, `.claude/skills/_shared/sugestoes-modelos.json`
- Test: `src/packages/core/test/maquina-estados.test.ts`, `src/packages/core/test/armazenamento*.test.ts` (o que já testa `normalizarEstado`; crie se não houver), `src/packages/core/test/servico-painel.test.ts`, `src/packages/core/test/catalogo.test.ts`

**Interfaces:**
- Produces: `ORDEM_ETAPAS = ["01", ..., "08", "final", "10"]`; `ETAPAS_DE_FECHAMENTO = ["final", "10"] as const` em `maquina-estados.ts` (a regra de "nenhuma desatualizada" vale para elas); `normalizarEstado` completa chaves ausentes **e**, se completou alguma, aplica `recalcularLiberacoes`; resumo com `totalEtapas` 9 e `concluidas` sem a final.

Textos de `etapas.json` (etapa `"10"`, inserida depois de `"final"`):
- `descricao`: `"Cruza a transcrição da reunião de apresentação com o plano de ação e gera o plano final, depois das suas decisões."`
- `oQueEsperar`: `"Envie a transcrição completa da reunião em que o Growth Cycle foi apresentado. O agente separa o que foi dito em complementos (aplicados direto), conflitos (você decide cada um) e pontos em aberto, e mostra a análise num card para você conferir os trechos. Depois das suas decisões no chat, ele gera o plano final em documento e planilha, que é o que vai para a entrega formal. A etapa só fecha quando você responder sim à pergunta-guia."`
- Insumo `apresentacao-transcricao` no array `insumos`: `nome` "Transcrição da reunião de apresentação", `descricao` "Transcrição completa da reunião em que o Growth Cycle foi apresentado ao cliente.", `instrucao` "Exporte a transcrição completa do Google Drive e confira se cobre a reunião do início ao fim.", `tipo` "arquivo", `formatos` [".docx", ".txt", ".md"], `modelo` null, `destino` "contexto/brutos/apresentacao-transcricao-bruta", `validador` null, `sensivel` false.
- `sugestoes-modelos.json`: `{ "etapa": "10", "alvo": "principal", "modelo": "sonnet", "esforco": null, "motivo": "leitura atenta de transcrição longa e julgamento sobre conflitos" }`.

- [ ] **Step 1:** Testes que falham:
  - máquina: com 01–08 e final concluídas, a 10 fica `liberada`; com a final concluída e uma etapa `desatualizada`, a 10 fica `bloqueada`; final não concluída → 10 `bloqueada`.
  - normalização: estado sem a chave `"10"` com a final `concluida` → `"10"` `liberada`; com a final `liberada` → `"10"` `bloqueada`; estado completo não é alterado.
  - resumo: prospect com tudo concluído menos a 10 → `etapaAtual` `"10"`, `concluidas` 8, `totalEtapas` 9; com a 10 concluída → `rotuloEtapaAtual` "Planejamento concluído".
  - catálogo: `etapaDoCatalogo(c, "10").skill === "10-revisao-pos-apresentacao"`; `validarCatalogo` aceita.
- [ ] **Step 2:** `cd src/packages/core && npx vitest run test/maquina-estados.test.ts test/catalogo.test.ts test/servico-painel.test.ts` → FAIL.
- [ ] **Step 3:** Implemente; procure com `grep -rn '"final"' src/packages/core/src src/apps/web --include=*.ts --include=*.tsx` todo tratamento especial da final e decida, um a um, se a 10 entra junto (liberação, etapa padrão) ou não (contagem); registre a lista no relatório da tarefa.
- [ ] **Step 4:** `cd src && npm test -- --force` → PASS (a fixture de teste ainda não tem a 10: se `fixture-verdeluz.test.ts` falhar por falta de material da etapa 10, marque esses casos com `it.skip` e um comentário `// Task 10 reativa`, e registre no relatório).
- [ ] **Step 5:** Commit `feat(core): etapa 10 · Revisão pós-apresentação no estado e no catálogo`.

---

### Task 8: Planilha da 10 e JSONs acompanhantes na aprovação

**Files:**
- Modify: `src/packages/core/src/entregaveis.ts`, `src/packages/core/src/servico-planejamento.ts` (`aprovarEntregavel`, ~linha 868)
- Test: `src/packages/core/test/entregaveis.test.ts`, teste do serviço que já cobre `aprovarEntregavel` (procure com `grep -rn aprovarEntregavel src/packages/core/test`)

**Interfaces:**
- Produces:
  - `PASTA_POR_TIPO_E_ETAPA["planilha:10"] = "plano-de-acao"`.
  - `acompanhantes(e: Pick<Entregavel, "tipo" | "etapa" | "nomeFinal" | "arquivoRascunho">): { origem: string; destino: string }[]` em `entregaveis.ts`: só para `tipo === "documento"`; mapa fixo `{"08:plano-de-acao-estrategico": ["plano-de-acao-estrategico.json"], "10:plano-de-acao-final": ["plano-de-acao-final.json", "revisao-plano.json"]}`; `origem` = pasta de `arquivoRascunho` + nome; `destino` = pasta de `destinoAprovado(e)` + nome; vazio para o resto.
  - Em `aprovarEntregavel`, depois de copiar o documento: para cada acompanhante, se `await this.arm.existeArquivo(slug, origem)` (use o método de existência de arquivo do armazenamento; se não houver um, crie `existeArquivo(slug, rel)` em `FsArmazenamento` e na nuvem, seguindo o padrão de `lerTexto`), copia; se não existir, registra na atividade/fila a mensagem `"Aviso: <nome> não foi encontrado junto do documento aprovado; a etapa 10 vai precisar dele."` (pelo mesmo mecanismo de `enfileirar`/atividade já usado na aprovação).

- [ ] **Step 1:** Testes: destino da planilha da 10; `acompanhantes` para 08, para 10, para documento de outra etapa (vazio) e para planilha (vazio); aprovação do documento da 08 com o JSON no rascunho copia o JSON; sem o JSON, aprova e gera o aviso.
- [ ] **Step 2:** `cd src/packages/core && npx vitest run test/entregaveis.test.ts <teste do serviço>` → FAIL. **Step 3:** Implemente. **Step 4:** `cd src && npm test -- --force` → PASS.
- [ ] **Step 5:** Commit `feat(core): planilha da 10 e JSONs do plano copiados junto na aprovação`.

---

### Task 9: Skill 10, fluxogramas e textos

**Files:**
- Create: `.claude/skills/10-revisao-pos-apresentacao/SKILL.md`, `.claude/skills/10-revisao-pos-apresentacao/fluxo.mmd`, `.claude/commands/10-revisao-pos-apresentacao.md`
- Modify: `.claude/skills/08-plano-de-acao/SKILL.md` (Fase 3 com `--saida-json`; interface `.app/rascunhos/plano-de-acao-estrategico.json`, terminal `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json`), `.claude/skills/09-apresentacao-final/SKILL.md` e `fluxo.mmd` (encerramento leva à etapa 10), `.claude/skills/_shared/fluxo-geral.mmd`, `.claude/skills/_shared/regras-de-validacao.md` (Regra 7: scripts da 10; Regra 6 inalterada), `.claude/skills/_desativadas/briefing-e-benchmark/README.md` (a numeração atual vai até a 10), `CLAUDE.md` (ordem de execução com a 10, lista de comandos)
- Test: `src/apps/web/lib/fluxos.test.ts`, `src/packages/core/test/catalogo-skills.test.ts` (existentes; ajustar a contagem de fluxos se o teste fixar 12)

O `SKILL.md` segue a estrutura das skills 08/09 (frontmatter `name: 10-revisao-pos-apresentacao`, `description` dizendo quando usar: depois da Apresentação final, com a transcrição da reunião de apresentação) e contém, na ordem, tudo de "Parte 1" da spec: antes de começar (insumo, checagem do JSON v2 da 08, 3 perguntas pré-preenchidas, transcrição cortada), Fase 1 (o que extrair, critérios de complemento/conflito/ponto em aberto, regras de leitura, "já testei", registro em `revisao-plano.json` com link para o esquema na spec, `validar_revisao.py --rascunho`), Fase 2 (seção com as 6 partes e o bloco CONFLITO literal do Prompt 10; interface: `propor_entregavel` tipo `secao`, `nome_final` `revisao-pos-apresentacao`; checkpoint), Fase 3 (decisões do chat no JSON, `validar_revisao.py` final, cópia do JSON da 08 → aplicar → revisar em cadeia → `validar_plano_acao.py` → `gerar_plano_acao.py --saida-docx/--saida-xlsx/--saida-json` com nomes `plano-de-acao-final.*`; interface: `propor_entregavel` tipos `documento` e `planilha`, `nome_final` `plano-de-acao-final`; `revisao-plano.json` fica em `.app/rascunhos/` para ser copiado junto), Fase 4 (relatório a partir de `relatorio_revisao.py`, 5 itens, pergunta-guia), encerramento por modo (terminal: status ✅, "Próximo passo", `contexto/decisoes/10-revisao-pos-apresentacao.md`; interface: `sinalizar_etapa_pronta`), handoff ("o plano final, em documento e planilha, é o que vai para a entrega formal ao cliente"; se houver divergência com 06/07, citar os slides) e restrições.

`fluxo.mmd` (convenções do `CLAUDE.md`): insumos (transcrição + plano v2 da 08) → decisão "Existe o plano v2 da 08?" (não → "Pedir para refazer a 08") → "Perguntas: datas e participantes" → "Fase 1 · Leitura e cruzamento" → "validar_revisao.py --rascunho" → decisão "Saiu ERRO?" (sim → corrigir) → "Fase 2 · Análise no card" → checkpoint "Analista aprova?" → "Analista decide conflitos e pontos em aberto no chat" → "validar_revisao.py final" → "Fase 3 · gerar_plano_acao.py (plano final)" → checkpoint "Analista aprova?" → "Fase 4 · Relatório (relatorio_revisao.py)" → checkpoint "Pergunta-guia: sim?" (não, ajustar → Fase 3) → entrega "Plano final (.docx + .xlsx)" → handoff. Rótulos sem colchetes.

- [ ] **Step 1:** Escreva os arquivos.
- [ ] **Step 2:** `cd src && npm test -- --force` → PASS (fluxos e catálogo).
- [ ] **Step 3:** Releia o `SKILL.md` contra a Parte 1 da spec, item por item; `grep -n "fim do processo" .claude/skills/09-apresentacao-final/SKILL.md` não acha nada.
- [ ] **Step 4:** Commit `feat(skill-10): revisão pós-apresentação, fluxograma e textos`.

---

### Task 10: Fixture Verdeluz com a etapa 10

**Files:**
- Modify: `scripts/fixture_verdeluz/textos.py` (`APRESENTACAO`), `scripts/fixture_verdeluz/gerar_brutos.py` (gera `apresentacao-transcricao-bruta.docx`), `scripts/fixture_verdeluz/producao.md` (seção "Etapa 10"), `src/packages/core/scripts/montar-fixture.ts` (`etapaDoArquivo`, `unicos`, `GRAFICOS` se preciso), `clientes/_fixtures/verdeluz/manifesto.json`, `clientes/_fixtures/verdeluz/estado-completo.json`
- Create: `clientes/_fixtures/verdeluz/base/contexto/brutos/apresentacao-transcricao-bruta.docx`, `clientes/_fixtures/verdeluz/base/entrega/ativos-aprovados/plano-de-acao/{plano-de-acao-estrategico.json,plano-de-acao-final.docx,plano-de-acao-final.xlsx,plano-de-acao-final.json,revisao-plano.json}`, `clientes/_fixtures/verdeluz/base/entrega/ativos-aprovados/secoes/10-revisao-pos-apresentacao.md`, `clientes/_fixtures/verdeluz/base/contexto/decisoes/10-revisao-pos-apresentacao.md`, `clientes/_fixtures/verdeluz/roteiros/10.md`, as cópias em `base/app/propostas/<id>.*` (id = `idDeterministico(rel)` de `montar-fixture.ts`)
- Test: `src/packages/core/test/fixture-verdeluz.test.ts`

Conteúdo: reunião fictícia de 30 a 40 minutos em 22/11/2026 (Boomer: o estrategista e o gestor de tráfego do kickoff; cliente: Marina e Luiza), falas marcadas `[hh:mm:ss] Nome:` como o kickoff, contendo de propósito 2 a 3 complementos, 2 conflitos (um "já testamos cupom de primeira compra e não funcionou", que o agente deve investigar), 2 pontos em aberto (um "vou pensar"), 2 compromissos da Boomer (um fora do escopo) e nenhuma PII. O `revisao-plano.json` registra tudo com decisões; o plano final aplica as decisões ao `plano-de-acao.json` v2 da 08 (que passa a ser copiado para `plano-de-acao-estrategico.json` aprovado) e é gerado com `gerar_plano_acao.py`; `relatorio_revisao.py` sobre o par alimenta `decisoes/10-…md` e o `resumoDecisoes` da 10. Todos os nomes de prospect com "(FICTÍCIO)".

- [ ] **Step 1:** Testes que falham em `fixture-verdeluz.test.ts`: reativar casos marcados na Task 7; o manifesto lista a transcrição da apresentação (etapa `10`) e os arquivos do plano final e da revisão; o estado tem entregáveis aprovados da 10 (`secao`, `documento`, `planilha`); "reposicionar na etapa 10" gera estado válido com kit completo (a transcrição no kit da 10); a marca FICTÍCIO está no `.docx` e no `.xlsx` finais.
- [ ] **Step 2:** `cd src/packages/core && npx vitest run test/fixture-verdeluz.test.ts` → FAIL.
- [ ] **Step 3:** Escreva a transcrição em `textos.py` e gere o `.docx`; escreva o `revisao-plano.json` e o plano final; rode, nesta ordem, até sair OK: `validar_revisao.py` (modo final, com `--plano-final`), `validar_plano_acao.py` no plano final, `gerar_plano_acao.py` com as três saídas, `relatorio_revisao.py`. Copie para as propostas (byte a byte, conferir com `cmp`), atualize manifesto, estado, `montar-fixture.ts`, `roteiros/10.md` e `producao.md` (o que enviar: a transcrição; o que responder: datas, participantes e as decisões de cada conflito e ponto em aberto).
- [ ] **Step 4:** `cd src && npm test -- --force` e `cd scripts && python3 -m pytest -q` → PASS.
- [ ] **Step 5:** Commit `feat(fixture): Verdeluz com a reunião de apresentação e a etapa 10`.

---

### Task 11: Verificação final

- [ ] **Step 1:** `cd src && npm test -- --force` (mostrar `Cached: 0 cached`) e `cd scripts && python3 -m pytest -q` → tudo PASS.
- [ ] **Step 2:** `grep -rn "fim do processo\|Este é o fim" .claude --include=*.md` → só textos que não se referem à 09.
- [ ] **Step 3:** App local sem nuvem (`PLANEJAMENTO_AUTH=off PLANEJAMENTO_DADOS=fs`, porta livre, ex.: 3107): `POST /api/cliente-teste {"etapa":"10"}` cria o cliente; a etapa 10 aparece liberada com o card do insumo da transcrição; se a API de cliente de teste aceitar posicionar com tudo concluído, crie um assim e confira os entregáveis aprovados da 10, a prévia da planilha final e "Planejamento concluído" no painel; se não aceitar, confira os mesmos pontos aprovando, pela API, os entregáveis da 10 do cliente criado na etapa 10 (ou registre no relatório o que não deu para verificar). Encerrar só o servidor iniciado e apagar só o cliente criado.
- [ ] **Step 4:** Commit de ajustes, se houver; sem push.
