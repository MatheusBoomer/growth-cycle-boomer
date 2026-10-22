# Cliente de teste: conteúdo da Verdeluz (subprojeto B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir o fixture `clientes/_fixtures/verdeluz/` com o planejamento completo (etapas 01 a Apresentação final) de um e-commerce fictício de cosméticos veganos, os arquivos de kit e os roteiros de resposta, de modo que o mecanismo do subprojeto A reposicione o cliente em qualquer etapa.

**Architecture:** Geradores determinísticos (Python, semente fixa) criam os dados e os documentos brutos. O planejamento é produzido por inteiro, na ordem real das skills, em um cliente descartável `clientes/verdeluz-producao/` conduzido no terminal. Um script `montar-fixture.ts` colhe essa pasta e grava `base/`, `manifesto.json`, `estado-completo.json` e `roteiros/`. Testes automatizados garantem a coerência.

**Tech Stack:** Python 3 (openpyxl, matplotlib, python-docx, python-pptx; pytest), scripts e skills existentes do projeto, TypeScript com `tsx` para a montagem.

**Spec:** `docs/superpowers/specs/2026-10-22-cliente-de-teste-design.md`. Depende do subprojeto A (`docs/superpowers/plans/2026-10-22-cliente-de-teste-mecanismo.md`) para `carregarFixture`, `reposicionarNoFixture` e o script `tsx`.

## Global Constraints

- Tudo é fictício e marcado: o nome da marca é **Verdeluz Cosméticos Veganos** (provisório), o site é `https://www.verdeluz.example`, e cada documento do fixture traz a palavra "FICTÍCIO" em cabeçalho ou rodapé quando o formato permite.
- Período do histórico: **OUT/25 a SET/26** (12 meses fechados). Sede: Curitiba/PR. Criada em 2021 por duas sócias. Meta e Google ativos.
- **Âncoras numéricas** (o gerador acerta cada uma com tolerância de 3%; as etapas posteriores citam os números reais calculados, não estes):
  - sessões ≈ 440 mil no ano (34 a 52 mil por mês); conversão média 1,4% (Black Friday 2,1%); pedidos do site ≈ 6.150; ticket R$ 198; receita captada ≈ R$ 1,22 milhão;
  - investimento ≈ R$ 262 mil (Meta 62%, Google 38%); ROAS da captada de 6,0x em OUT/25 caindo a 3,6x em SET/26, média 4,65x;
  - quebra média 6,5% (captada para aprovada), receita aprovada ≈ R$ 1,14 milhão; meios: cartão 57%, PIX 38%, boleto 5%;
  - clientes novos ≈ 3.790 (62% dos pedidos), CAC médio ≈ R$ 69, de R$ 48 (OUT/25) a R$ 108 (SET/26);
  - base histórica desde 2021: ≈ 10.400 clientes e 16.900 pedidos (1,62 pedido por cliente); 31% com 2 ou mais pedidos; LTV histórico ≈ R$ 311; LTV/CAC do último mês ≈ 2,9x (ruim) e médio ≈ 4,5x;
  - Curva ABC com 58 SKUs: classe A com 9 SKUs e cerca de 78% da receita; três produtos (sérum de vitamina C, hidratante facial, protetor solar FPS 50) com cerca de 51%; kits com cerca de 24%;
  - sazonalidade: NOV (Black Friday) 1,9x a média, DEZ 1,3x, MAI (Dia das Mães) 1,35x, JAN e FEV 0,75x;
  - ruptura do sérum de vitamina C de 10 a 24/MAR e de 1 a 12/ABR, com queda de cerca de 22% na receita desses dois meses.
- Concorrentes reais para a etapa 07: Sallve, Simple Organic e Care Natural Beauty, mais um quarto a definir na Task 6 depois de conferir anúncios ativos na Biblioteca do Meta.
- Nenhum dado pessoal real: clientes só com ID sequencial e nome inventado a partir de listas de nomes e sobrenomes comuns; nenhum CPF, e-mail, telefone, endereço ou cartão em arquivo algum.
- Regra de escrita da agência: nada de travessão (`—`) no meio de frase nos textos gerados.
- Geradores vivem em `scripts/fixture_verdeluz/`, testes em `scripts/tests/` (pytest, `cd <raiz> && python3 -m pytest scripts/tests/test_fixture_verdeluz.py`).

## Review Focus

- Totais que não fecham entre arquivos (pedidos do `clientes-historico` contra vendas do `historico-mensal`; soma da `quebra-pagamento` contra a receita captada e aprovada do mês) (Task 1).
- Dado pessoal escapando para qualquer arquivo gerado, inclusive no corpo do `.docx` e nos nomes de cliente (Task 1 e Task 2).
- Resumo de decisões que cita um número diferente do que está na planilha ou no gráfico da mesma etapa (Task 8).
- Reposicionar em uma etapa cujo kit depende de arquivo gerado em etapa posterior (ex.: pedir o roteiro da 06 sem a projeção) (Task 8).
- Fixture pesado demais para o git (mais de 25 MB) (Task 8).

---

### Task 1: Dados-fonte (4 planilhas)

**Files:**
- Create: `scripts/fixture_verdeluz/ancoras.py` (constantes da seção Global Constraints)
- Create: `scripts/fixture_verdeluz/gerar_dados.py`
- Test: `scripts/tests/test_fixture_verdeluz.py`

**Interfaces:**
- Produces: `gerar_dados.py --saida <pasta>` grava `historico-mensal.xlsx`, `produtos-curva-abc.xlsx`, `quebra-pagamento.xlsx` e `clientes-historico.xlsx` seguindo as colunas dos modelos em `.claude/skills/_shared/modelos-insumo/` (abrir os modelos para copiar nomes de coluna e a linha de cabeçalho; no histórico mensal, preencher só as colunas "Preench. Manual" e calcular as de fórmula com a mesma lógica do modelo). Função pública `gerar(saida: Path, semente: int = 2026) -> dict` devolve os totais calculados (`sessoes`, `pedidos`, `captada`, `aprovada`, `investimento`, `cac_por_mes`, `clientes`, `pedidos_base`, `ltv`) para os testes e para a Task 8.

- [ ] **Step 1: Write the failing tests** em `test_fixture_verdeluz.py` (usam `gerar(tmp_path)`)

```python
def test_ancoras_dentro_da_tolerancia(totais):
    assert abs(totais["sessoes"] / 440_000 - 1) < 0.03
    assert abs(totais["captada"] / 1_220_000 - 1) < 0.03
    assert abs(totais["investimento"] / 262_000 - 1) < 0.03
def test_historico_valida(tmp_path): ...   # roda scripts/validar_insumo.py --insumo historico-mensal e espera ok
def test_demais_planilhas_validam(tmp_path): ...  # idem para produtos-curva-abc, quebra-pagamento, clientes-historico
def test_quebra_fecha_com_historico(tmp_path): ...  # soma captada e aprovada por mês == colunas do histórico (tolerância R$ 1)
def test_clientes_fecham_com_pedidos(totais): ...   # novos+recorrentes do ano == pedidos do site; pedidos_base/clientes == 1.62 (±0.03)
def test_ruptura_do_serum_reduz_marco_e_abril(totais): ...  # receita de MAR e ABR ≈ 22% abaixo da tendência
def test_sem_dado_pessoal(tmp_path): ...  # nenhuma célula casa os padrões de CPF, e-mail, telefone ou cartão
def test_determinismo(tmp_path): ...  # duas execuções com a mesma semente produzem os mesmos totais
def test_cac_sobe_ao_longo_do_ano(totais): ...  # cac_por_mes[0] ≈ 48 e cac_por_mes[-1] ≈ 108 (±5%)
```

- [ ] **Step 2: Run to verify failure**

Run: `python3 -m pytest scripts/tests/test_fixture_verdeluz.py -v`
Expected: FAIL (`gerar_dados` não existe).

- [ ] **Step 3: Implement** `gerar_dados.py`. Ordem: calendário e sazonalidade; sessões por plataforma e mês; conversão e ticket por mês (conversão cai nos meses de ruptura); receita captada; investimento e ROAS (curva de queda descrita nas âncoras); quebra por mês e por meio de pagamento; produtos (58 SKUs com a distribuição da Curva ABC); base de clientes sintética com a distribuição de pedidos (1 pedido para 69%, 2 para 17%, 3 ou mais para 14%) que feche com os pedidos do ano.

- [ ] **Step 4: Run to verify pass**

Run: `python3 -m pytest scripts/tests/test_fixture_verdeluz.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fixture_verdeluz scripts/tests/test_fixture_verdeluz.py
git commit -m "feat(fixture): gerador determinístico dos dados da Verdeluz"
```

---

### Task 2: Documentos brutos e prints simulados

**Files:**
- Create: `scripts/fixture_verdeluz/gerar_brutos.py`
- Modify: `scripts/tests/test_fixture_verdeluz.py` (novos testes)

**Interfaces:**
- Consumes: totais de `gerar` (Task 1) para que a fala do kickoff cite os mesmos números que o cliente "conhece" (faturamento aproximado, investimento, ruptura do sérum), em forma arredondada e declarada, não exata.
- Produces: `gerar_brutos.py --saida <pasta>` grava `kickoff-transcricao-bruta.docx`, `formulario-cliente.docx`, `site-simulado.md` e `prints-campanhas/print-01.png` a `print-04.png` (imagens simuladas de painéis do Meta Ads e do Google Ads, com a faixa "FICTÍCIO").

Conteúdo mínimo:
- **Kickoff** (cerca de 40 minutos de fala, 4 participantes: as duas sócias Marina e Luiza, a analista da agência e um gestor de tráfego): marcas de tempo, quem fala, ruído real (interrupções, "pode repetir?", conversa sobre café e trânsito, problema de áudio, assunto fora do tema), e os fatos do negócio: história da marca, produtos e público, canais, dores (CAC subindo, Black Friday que consome margem, ruptura do sérum, carrinho abandonado), o que já foi tentado (cupom de primeira compra, e-mail de carrinho abandonado só com 1 disparo, influenciadoras), meta declarada (crescer cerca de 40% em 12 meses), concorrentes que citam (Sallve, Simple Organic, Care Natural Beauty). Um parágrafo da fala contém um número divergente do dado real, de propósito (as sócias dizem "uns R$ 1,5 milhão por ano"), para a skill 03 achar a diferença.
- **Formulário pré-kickoff:** perguntas e respostas curtas (ticket, canais, equipe de 7 pessoas, plataforma Nuvemshop, meios de pagamento).
- **Site simulado:** texto de home, duas páginas de produto (sérum de vitamina C e protetor solar), frete e trocas (frete grátis acima de R$ 249 no Sul e Sudeste, R$ 349 nas demais regiões; trocas em 7 dias).

- [ ] **Step 1: Write the failing tests**

```python
def test_docx_abrem_e_tem_ruido(tmp_path): ...   # python-docx abre; kickoff tem >= 4 falantes e >= 3 marcadores de ruído
def test_brutos_sem_dado_pessoal(tmp_path): ...  # nenhum padrão de PII em docx, md ou nos PNG (metadados)
def test_site_simulado_cita_frete_e_trocas(tmp_path): ...
def test_prints_existem_e_tem_ficticio(tmp_path): ...  # 4 PNG, tamanho > 10 KB
```

- [ ] **Step 2: Run to verify failure**

Run: `python3 -m pytest scripts/tests/test_fixture_verdeluz.py -k brutos -v`
Expected: FAIL.

- [ ] **Step 3: Implement** `gerar_brutos.py` com `python-docx` e `matplotlib`/Pillow para os prints. Texto do kickoff escrito como diálogo; sem travessão no meio de frase.

- [ ] **Step 4: Run to verify pass**

Run: `python3 -m pytest scripts/tests/test_fixture_verdeluz.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/fixture_verdeluz/gerar_brutos.py scripts/tests/test_fixture_verdeluz.py
git commit -m "feat(fixture): kickoff, formulário, site simulado e prints da Verdeluz"
```

---

### Task 3: Cliente de produção e etapas 01 e 02

**Files:**
- Create (gitignorado): `clientes/verdeluz-producao/` e seus arquivos
- Create (versionado): `scripts/fixture_verdeluz/producao.md` (diário da produção, uma seção por etapa com as respostas dadas como analista; a Task 8 transforma isso em roteiros)

**Interfaces:**
- Consumes: saída das Tasks 1 e 2, gerada em uma pasta temporária e copiada para o cliente de produção; skills `criar-prospect`, `01-preparacao-de-contexto`, `02-contextualizacao-estrategica`.
- Produces: para cada etapa concluída, `contexto/decisoes/NN-<skill>.md`, os arquivos de contexto citados em `CLAUDE.md` do template e as seções aprovadas em `entrega/ativos-aprovados/secoes/`.

- [ ] **Step 1: Criar o cliente de produção** com a skill `criar-prospect` (`/novo-prospect verdeluz-producao`), colocar `kickoff-transcricao-bruta.docx` e `formulario-cliente.docx` em `contexto/brutos/`, e gravar em `contexto/site-referencia.md` o link `https://www.verdeluz.example`. Acrescentar ao `CLAUDE.md` do cliente, na seção de overrides, a nota "O site é simulado: ler `contexto/brutos/site-simulado.md` no lugar da raspagem" (copiar o texto exato para `scripts/fixture_verdeluz/overrides.md`, que a Task 8 coloca no manifesto).

- [ ] **Step 2: Etapa 01.** Rodar `/01-preparacao-de-contexto` e responder como analista. Registrar em `producao.md` cada decisão e resposta. Saída esperada: `kickoff-transcricao.md` limpo, `decisoes/01-...md`, seção `secoes/01-kickoff-transcricao.md`.

- [ ] **Step 3: Etapa 02.** Rodar `/02-contextualizacao-estrategica`. Para o site usar `site-simulado.md`. Responder às perguntas estratégicas dentro da história da seção Global Constraints (o que já foi tentado, canais, por que a Black Friday importa). Saída esperada: `contextualizacao-estrategica.md`, `decisoes/02-...md`, seção `secoes/02-contextualizacao-estrategica.md` com hipóteses ligadas aos gargalos (CAC, ruptura, carrinho, dependência da Black Friday).

- [ ] **Step 4: Verify.** Conferir que cada arquivo de saída existe, que os fatos citados batem com `site-simulado.md` e com as âncoras, e que `contexto/status-planejamento.md` mostra 01 e 02 concluídas.
Expected: sem divergência; anotar no diário qualquer desvio.

- [ ] **Step 5: Commit** apenas o diário.

```bash
git add scripts/fixture_verdeluz/producao.md scripts/fixture_verdeluz/overrides.md
git commit -m "docs(fixture): diário da produção das etapas 01 e 02 da Verdeluz"
```

---

### Task 4: Etapas 03 e 04 (diagnóstico e unidade econômica)

**Files:** continua em `clientes/verdeluz-producao/`; atualiza `scripts/fixture_verdeluz/producao.md`.

**Interfaces:**
- Consumes: as quatro planilhas da Task 1 (colocar em `dados/` com os nomes de destino do catálogo: `historico-mensal.xlsx`, `produtos-curva-abc.xlsx`, `quebra-pagamento.xlsx`, `clientes-historico.xlsx`); skills 03 e 04; subagente `analista-dados`.
- Produces: seções, gráficos e tabelas aprovados em `entrega/ativos-aprovados/{secoes,graficos}/` no padrão de nomes das etapas reais (ver `clientes/sottile-novo-modelo/entrega/ativos-aprovados/graficos/` como referência de nomes), mais `decisoes/03-...md` e `decisoes/04-...md`.

- [ ] **Step 1: Etapa 03.** Rodar `/03-diagnostico-performance` com as três planilhas da etapa. Cobrir: investimento e receita mês a mês, quebra por meio de pagamento (esta existe, ao contrário do Sottile), ROAS por plataforma, sessões, conversão, dependência de mídia paga, Curva ABC (tabelas A, B e C) e a divergência entre o faturamento declarado no kickoff e o dado real. Gráficos conforme `.claude/skills/_shared/padrao-visual.md`.

- [ ] **Step 2: Etapa 04.** Rodar `/04-unidade-economica` com `clientes-historico.xlsx`. Cobrir: CAC mensal, novos contra recorrentes, LTV histórico, LTV/CAC (último mês e médio), top 5 clientes por gasto conferidos (nomes fictícios), e a ressalva de que LTV é receita e não margem.

- [ ] **Step 3: Verify.** Ler `decisoes/03` e `decisoes/04` e conferir três números de cada contra as planilhas (rodar um cálculo independente em Python); abrir 3 gráficos para checar legibilidade e a marca "FICTÍCIO" nas fontes.
Expected: números idênticos dentro de arredondamento.

- [ ] **Step 4: Commit** o diário.

```bash
git add scripts/fixture_verdeluz/producao.md
git commit -m "docs(fixture): diário da produção das etapas 03 e 04 da Verdeluz"
```

---

### Task 5: Etapas 05 e 06 (soluções, metas e cenários)

**Interfaces:**
- Consumes: skills 05 e 06; `scripts/validar_solucoes.py`, `scripts/projecao.py`, `scripts/preencher_projecao_xlsx.py`; subagente `analista-dados`.
- Produces: `contexto/solucoes.json` validado, seção `05-solucoes`, gráficos e tabela dos cenários, `entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx`, `decisoes/05` e `decisoes/06`.

- [ ] **Step 1: Etapa 05.** Rodar `/05-solucoes`. Problemas esperados (a skill pode agrupar diferente, registrar o que decidir): conversão e carrinho abandonado, CAC subindo e LTV/CAC, ruptura de estoque, dependência da Black Friday e do desconto, retenção (31% de recompra), quebra de pagamento, concentração em três produtos. Rodar `python3 scripts/validar_solucoes.py` sobre `contexto/solucoes.json`.
Expected: validação sem erro.

- [ ] **Step 2: Etapa 06.** Rodar `/06-metas-e-cenarios`. Respostas do analista: meta Realista de **R$ 1,55 milhão de receita aprovada em 12 meses (OUT/26 a SET/27)**, sazonalidade pelo histórico (NOV, DEZ e MAI), premissa de não trocar a plataforma (Nuvemshop), cenário Otimista como teto. Gerar a planilha de projeção com os três cenários.

- [ ] **Step 3: Verify.** Conferir que a soma mensal de cada cenário bate com o total da seção, que a planilha abre e que a meta Realista fecha em R$ 1,55 milhão (±1%).

- [ ] **Step 4: Commit** o diário.

```bash
git add scripts/fixture_verdeluz/producao.md
git commit -m "docs(fixture): diário da produção das etapas 05 e 06 da Verdeluz"
```

---

### Task 6: Etapas 07 e 08 (briefing, benchmark e mídia paga)

**Interfaces:**
- Consumes: skills 07 e 08; `scripts/coleta_meta_ads.py` (Apify), subagente `pesquisador-benchmark` (Firecrawl).
- Produces: briefing e benchmark (`entrega/ativos-aprovados/benchmark/benchmark.html`, seções `07-briefing` e `07-benchmark`), seção `08-midia-paga` com tabelas de alocação de verba, ROAS esperado e calendário, `decisoes/07` e `decisoes/08`, e `contexto/brutos/prints-campanhas/` (os 4 PNG da Task 2).

- [ ] **Step 1: Escolher o quarto concorrente.** Conferir na Biblioteca do Meta (pelo navegador ou pela coleta) quais marcas de skincare vegano brasileiras têm anúncios ativos; fechar a lista de quatro, registrar em `producao.md` e em `roteiros` (Task 8). Verificar antes se `APIFY_TOKEN` existe (`test -n "$APIFY_TOKEN"` ou presença da linha no `.env`, sem imprimir o valor).

- [ ] **Step 2: Etapa 07.** Com token: rodar a coleta real para os quatro concorrentes e a análise. Sem token: perguntar ao analista como seguir; a alternativa registrada no spec é um benchmark só com informação pública e verificável (páginas das marcas), marcado como ilustrativo, sem número inventado sobre marca real.

- [ ] **Step 3: Etapa 08.** Rodar `/08-midia-paga` com os prints simulados. Alocação de verba entre Meta e Google coerente com o investimento do histórico e com a projeção da Task 5.

- [ ] **Step 4: Verify.** Abrir `benchmark.html`; conferir que cada afirmação sobre marca real tem fonte coletada ou está marcada como ilustrativa.

- [ ] **Step 5: Commit** o diário.

```bash
git add scripts/fixture_verdeluz/producao.md
git commit -m "docs(fixture): diário da produção das etapas 07 e 08 da Verdeluz"
```

---

### Task 7: Etapas 09 e Apresentação final

**Interfaces:**
- Consumes: skills 09 e 10; `scripts/preencher_plano_acao_docx.py`, `scripts/gerar_apresentacao.py`, `scripts/previa_apresentacao.py`.
- Produces: `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx`, `entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json`, `entrega/apresentacao-final.pptx`, `decisoes/09` e `decisoes/10`.

- [ ] **Step 1: Etapa 09.** Rodar `/09-plano-de-acao`. Responsáveis e capacidade: equipe de 7 pessoas (duas sócias, e-commerce, atendimento, marketing, operação e logística), com a agência assumindo mídia e CRM.

- [ ] **Step 2: Apresentação final.** Rodar `/apresentacao-final`: roteiro e `.pptx` no molde da agência. Preferência do analista: apresentação enxuta (cerca de 40 slides), Realista em destaque.

- [ ] **Step 3: Verify.** Gerar a prévia (`scripts/previa_apresentacao.py`) e abrir 5 slides; conferir números contra a Task 5.

- [ ] **Step 4: Commit** o diário.

```bash
git add scripts/fixture_verdeluz/producao.md
git commit -m "docs(fixture): diário da produção das etapas 09 e final da Verdeluz"
```

---

### Task 8: Montar e validar o fixture

**Files:**
- Create: `src/packages/core/scripts/montar-fixture.ts`
- Create: `src/packages/core/test/fixture-verdeluz.test.ts`
- Create (versionados): `clientes/_fixtures/verdeluz/` (`manifesto.json`, `estado-completo.json`, `base/`, `roteiros/01.md` a `final.md`)
- Modify: `src/package.json` (script `montar-fixture`)

**Interfaces:**
- Consumes: pasta `clientes/verdeluz-producao/` pronta; `producao.md`; `overrides.md`; `destinoAprovado`, `EXTENSAO_POR_TIPO` (`entregaveis.ts`) e `renderStatusMd`; `carregarFixture` (subprojeto A).
- Produces: `npm run montar-fixture` (opções `--producao clientes/verdeluz-producao`, `--saida clientes/_fixtures/verdeluz`) que:
  1. copia para `base/` todo arquivo do cliente de produção exceto `.app/`, `CLAUDE.md`, `status-planejamento.md`, `*.tmp` e `.DS_Store`;
  2. atribui a etapa de cada arquivo: `00` para `contexto/site-referencia.md` e `contexto/brutos/site-simulado.md`; pela pasta `decisoes/NN-*` e pelo prefixo de seção `NN-` nas seções; pelas tabelas abaixo para os demais;
  3. gera um `Entregavel` aprovado para cada arquivo de `entrega/ativos-aprovados/` (o inverso de `destinoAprovado`: pasta → tipo, `NN-` das seções → etapa, `nomeFinal` do nome do arquivo; a etapa dos gráficos, tabelas, planilha, `.docx`, benchmark e roteiro vem da tabela de etapas em `producao.md`), copiando o arquivo para `base/app/propostas/<id><ext>`;
  4. monta `estado-completo.json` com as 10 etapas `concluida` (`resumoDecisoes` lido de `decisoes/NN-*.md`, `handoff` lido da seção "Próximo passo" que a skill gravou em `status-planejamento.md` quando existir, senão do diário), os entregáveis e os insumos válidos;
  5. grava `roteiros/NN.md` a partir de `producao.md` (uma seção por etapa: "O que enviar" e "O que responder ao agente");
  6. grava `manifesto.json` com `prospect` (`{ nome: "Verdeluz Teste", site: "https://www.verdeluz.example" }`), `overrides` (texto de `overrides.md`), `arquivos` e `kit` (kit 01: kickoff bruto e formulário; kit 03: as três planilhas; kit 04: `clientes-historico.xlsx`; kit 08: os 4 prints).
  - Tabelas: arquivos de insumo → etapa que os recebe (`kickoff-transcricao-bruta.docx` e `formulario-cliente.docx` → 01; `historico-mensal`, `produtos-curva-abc`, `quebra-pagamento` → 03; `clientes-historico` → 04; `prints-campanhas/*` → 08).

- [ ] **Step 1: Write the failing test** `fixture-verdeluz.test.ts` (roda sobre o fixture real; usa `raizTemporaria` com o fixture copiado ou `RAIZ` direto em modo somente leitura)

```ts
it("o fixture real carrega (manifesto, estado e arquivos coerentes)", async () => {
  const f = await carregarFixture(RAIZ, "verdeluz")
  expect(f.manifesto.fixture).toBe("verdeluz")
})
it.each(ORDEM_ETAPAS)("reposicionar na etapa %s gera estado válido e dossiê sem arquivo faltando", async (etapa) => {
  // cria cliente em raiz temporária com o fixture copiado; reposicionarNoFixture; para cada caminho citado
  // por montarDossie(...) (contextoPersistido e aprovados) o arquivo existe; a etapa fica liberada;
  // condicoesConcluir da etapa lista só "Enviar: ..." dos insumos obrigatórios do catálogo e "O agente ainda não sinalizou..."
})
it("cada arquivo de kit de dados passa pelo validador de insumo", async () => {
  // roda scripts/validar_insumo.py nas quatro planilhas e espera ok
})
it("nenhum arquivo de texto do fixture contém CPF, e-mail ou telefone", async () => {})
it("todo kit tem roteiro, e o roteiro da 02 e da 05 a final existe mesmo sem arquivos", async () => {})
it("o fixture não passa de 25 MB", async () => {})
it("os textos do fixture não têm travessão fora de intervalo numérico", async () => {})
it("números do estado batem com a planilha: receita captada do resumo da 03 == soma do historico-mensal (±R$ 1)", async () => {})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd src/packages/core && npx vitest run test/fixture-verdeluz.test.ts`
Expected: FAIL (fixture inexistente).

- [ ] **Step 3: Implement** `montar-fixture.ts` conforme a seção Interfaces e rodar `cd src && npm run montar-fixture`.

- [ ] **Step 4: Run to verify pass**

Run: `cd src/packages/core && npx vitest run test/fixture-verdeluz.test.ts && cd .. && npm test`
Expected: PASS em toda a suíte. Se o limite de 25 MB falhar, reduzir o `.pptx` (menos slides ou imagens menores) e remontar.

- [ ] **Step 5: Verificação no app.** `npm run cliente-teste -- --etapa 03`, abrir o app e conferir: faixa de teste, etapas 01 e 02 concluídas com seções visíveis, 03 liberada com kit (3 planilhas e roteiro). Repetir em `01` e em `final` (reposicionando pela tela). Não rodar o agente.
Expected: igual ao esperado no plano do mecanismo, agora com o conteúdo real; prévia do `.pptx` abre na `final`.

- [ ] **Step 6: Commit**

```bash
git add src/packages/core/scripts/montar-fixture.ts src/packages/core/test/fixture-verdeluz.test.ts src/package.json clientes/_fixtures/verdeluz scripts/fixture_verdeluz
git commit -m "feat(fixture): fixture completo da Verdeluz montado a partir da produção"
```
