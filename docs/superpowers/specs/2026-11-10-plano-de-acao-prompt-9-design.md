# Skill 08 (Plano de ação) no padrão do Prompt 9

Data: 2026-11-10
Status: aprovado no brainstorming, aguardando revisão da spec

## Contexto

O processo manual da Boomer (pasta `prompts/`) tem um Prompt 9, o Plano de Ação
Estratégico, bem mais exigente que a Skill 08 atual. A Skill 08 gera ações com 4
campos (O quê, Quando, Por quem, Como) e só um `.docx`. O Prompt 9 exige 10
campos por ação, uma abertura com metas e premissas, `.docx` e `.xlsx` iguais,
os 6 critérios, os 7 erros a evitar, marcações [VALIDAR]/[PREENCHER], um
relatório de verificação e a pergunta-guia.

Este é o **primeiro de dois projetos**. O segundo é a etapa nova de revisão do
plano pós-apresentação (Prompt 10), que entra depois da Apresentação final e
revisa um plano já neste formato. A etapa 10 fica fora desta spec.

Mapa de numeração: Prompt 1 = Skill 02, …, Prompt 8 = Skill 07 (mídia paga),
Prompt 9 = Skill 08, Prompt 10 = etapa nova. O Prompt 7 (benchmark) é a etapa
desativada.

## Decisões tomadas

1. A Skill 08 é atualizada antes de criar a etapa de revisão.
2. Margem de contribuição e realidade operacional do cliente são perguntadas na
   abertura da Skill 08, pré-preenchidas com o que já está no kickoff e nas
   decisões (nenhum prompt anterior coleta esses dados; o Prompt 9 os pede na
   entrada).
3. O `.xlsx` é gerado por código, no padrão visual da agência, preparado para
   passar a preencher um modelo da Boomer quando ele existir. `.docx` e `.xlsx`
   saem sempre juntos, do mesmo JSON, no mesmo comando.
4. Arquitetura: um JSON (esquema v2), um validador e um gerador.
5. A skill pergunta ao analista se a empresa aparece como "Agência" ou
   "Boomer" no campo Dono.
6. Alcance: o plano cobre o ciclo de 12 meses do cenário; os 3 primeiros meses
   são a janela de prova. Toda ação cuja alavanca é um KPI da meta começa e
   entrega dentro dela.
7. Prospects com plano no formato antigo não são migrados. O formato novo vale
   para quem rodar a Skill 08 depois do deploy. O fixture Verdeluz (base dos
   clientes de teste) passa para o formato novo.

## Piso de ROAS

- Margem de contribuição sempre **antes da mídia**: receita menos custo do
  produto, impostos, frete, taxa de gateway e comissões. Nem margem bruta nem
  líquida. A pergunta da abertura diz isso explicitamente.
- `piso_roas_aprovada = 1 ÷ margem` (margem 20% → piso 5).
- Se as decisões trouxerem taxa de quebra, também
  `piso_roas_captada = piso_roas_aprovada ÷ (1 − quebra)` (quebra 20% → 6,25).
- Os dois são calculados pelo gerador, nunca digitados, e aparecem na abertura
  com uma frase dizendo com qual ROAS cada um se compara.
- O piso é o empate da primeira compra. Ele entra no plano como referência de
  gatilho, não como meta de ROAS (a meta é a do cenário; LTV da etapa 04 pode
  justificar aquisição abaixo do piso).
- Sem margem informada, o piso fica [PREENCHER] e a etapa não fecha.

## Parte 1 · Fluxo da Skill 08

**Abertura.** O agente lê o kickoff limpo, `contexto/decisoes/` e
`contexto/solucoes.json` e mostra numa mensagem o que já sabe. Depois confirma
ou pergunta o que falta, uma pergunta por vez:

1. Data de hoje.
2. Cenário de referência e números da meta (da 06 e da 07).
3. Frentes prioritárias (2 ou 3).
4. Quem executa do lado do cliente.
5. Quem opera a mídia (Boomer, agência parceira, cliente).
6. Ferramentas do cliente (plataforma, CRM, gateway, WhatsApp).
7. Restrições de calendário.
8. Margem de contribuição antes da mídia.
9. Empresa no campo Dono: "Agência" ou "Boomer".

**Fase 1 · Abertura do plano.** Cenário, metas (um número por KPI, com o mês e
o valor de origem no cenário), o que cabe e o que não cabe nos 3 meses,
premissas e pisos de ROAS. Checkpoint "Analista aprova?".

**Fase 2 · Ações.** Lista completa com os 10 campos, por horizonte e frente. O
agente roda `validar_plano_acao.py --rascunho` antes de mostrar e corrige os
`ERRO:`. O que exige julgamento sai marcado [VALIDAR]; dado ausente,
[PREENCHER]. Ação corretiva de problema diagnosticado sem solução no
planejamento é a única ação nova permitida, sempre [VALIDAR]. Checkpoint: o
analista resolve as marcações e aprova.

**Fase 3 · Arquivos.** `gerar_plano_acao.py` gera `.docx` e `.xlsx`. Na
interface, os dois são propostos com `propor_entregavel` (tipos `documento` e
`planilha`, `nome_final` `plano-de-acao-estrategico`). Checkpoint nos arquivos.

**Fase 4 · Relatório de verificação**, no chat e sem tabelas: mapa de
cobertura (achado → ações), cobertura da meta (KPI influenciador → ações),
pendências, riscos (dono sem capacidade, meta acima do melhor mês do
histórico, premissa frágil) e a resposta sincera do agente à pergunta-guia:
"Se o cliente fizer exatamente isto, e só isto, por 3 meses, eu apostaria o
dinheiro do projeto que o resultado vem?". A etapa só fecha com "sim" do
analista; "não" volta à Fase 2 com o que falta.

**Handoff.** Continua levando à Apresentação final, citando documento e
planilha.

**Horizontes.**
- Imediato: primeira semana após a apresentação.
- Curto prazo: até o primeiro grande marco do calendário (primeiro mês de Pico
  ou Escala).
- Médio prazo: até o fim do ciclo de 12 meses.

**Frentes** (nomes exatos, para bater com o registro de soluções):
`Mídia Paga / Canal Principal`, `Eficiência Operacional`,
`Produto / Mix / Portfólio`, `Redução de Dependências`,
`Monitoramento e Governança`.

**Os 10 campos:** Ação (verbo + objeto), Achado de origem (seção + número),
Alavanca da meta (KPI), Como (passos com valores), Dono (disciplina · empresa),
Início e entrega (dd/mm/aaaa), Depende de (nº ou "Nenhuma"), Evidência, KPI e
meta (de quanto para quanto, até quando), Gatilho ("Se … então …"; para ação
de estrutura, gatilho de prazo).

A skill incorpora as regras de ouro, os 6 critérios e os 7 erros do Prompt 9 e
mantém as restrições atuais (sem ação fora do diagnóstico, sem nível
operacional de criativo/copy/configuração, sem período passado, sem alterar
cenário ou KPI validado, sem menção à garantia).

## Parte 2 · Esquema e validador

### `plano-de-acao.json`, versão 2

```
{
  "versao": 2,
  "prospect": "...",
  "data_referencia": "10/11/2026",
  "janela_prova": {"inicio": "dd/mm/aaaa", "fim": "dd/mm/aaaa"},
  "fim_ciclo": "dd/mm/aaaa",
  "empresa_agencia": "Boomer" | "Agência",
  "agencia_parceira": "Nome da parceira" | null,
  "abertura": {
    "cenario": "Realista",
    "metas": [{"kpi": "...", "de": "...", "para": "...", "ate": "dd/mm/aaaa", "fonte": "06 · mês 3"}],
    "cabe_nos_3_meses": ["..."],
    "nao_cabe": ["..."],
    "premissas": ["..."],
    "margem_contribuicao": 0.20 | null,
    "taxa_quebra": 0.20 | null
  },
  "horizontes": [
    {
      "nome": "Imediato" | "Curto prazo" | "Médio prazo",
      "titulo": "...",
      "intro": "..." | null,
      "acoes": [
        {
          "numero": 1,
          "frente": "...",
          "acao": "...",
          "achado_origem": "...",
          "alavanca": "...",
          "alavanca_da_meta": true,
          "como": "...",
          "dono": "Gestor de tráfego · Boomer",
          "inicio": "dd/mm/aaaa",
          "entrega": "dd/mm/aaaa",
          "depende_de": [2],
          "evidencia": "...",
          "kpi_meta": "...",
          "gatilho": "Se ... então ...",
          "solucoes": ["P1.S1"]
        }
      ]
    }
  ]
}
```

- Exatamente 3 horizontes, nesta ordem.
- `alavanca_da_meta: true` marca as ações cuja alavanca é um KPI da meta
  (sujeitas à janela de prova).
- `depende_de` vazio é exibido como "Nenhuma".
- Pisos de ROAS e tabela-resumo são derivados, não ficam no JSON.

### `scripts/validar_plano_acao.py`

`python3 scripts/validar_plano_acao.py --plano <json> --registro <solucoes.json> [--rascunho]`

**ERRO (bloqueia):**
- `versao` diferente de 2, horizontes fora do padrão.
- Qualquer um dos 10 campos vazio.
- `numero` repetido.
- Frente fora das 5.
- Data fora de dd/mm/aaaa, início antes de `data_referencia`, entrega antes do
  início, entrega depois de `fim_ciclo`.
- "Imediato" ou "A definir" em data; dono sem o formato "disciplina · empresa";
  empresa diferente de `empresa_agencia`, de "Cliente"/nome do prospect ou de
  `agencia_parceira` (preenchida quando a resposta 5 da abertura for "agência
  parceira").
- `depende_de` com ação inexistente, a própria ação, ação cuja entrega é
  depois do início desta, ou ciclo.
- Gatilho sem "Se" e "então".
- Ação com `alavanca_da_meta: true` com início ou entrega fora da janela de
  prova.
- Solução do registro que não virou ação (lógica atual de
  `validar_solucoes.py --modo plano`, reaproveitada).
- [VALIDAR] ou [PREENCHER] em qualquer campo, exceto com `--rascunho`.

**AVISO (mostrado ao analista):**
- Ação começando por verbo vago sozinho ("otimizar", "acompanhar",
  "priorizar", "direcionar").
- Ação de "auditar", "mapear" ou "investigar" sem nenhuma ação que dependa
  dela.
- Frente sem ação.
- Ação do Imediato com mais de 7 dias entre início e entrega.
- Margem ausente (piso de ROAS fica [PREENCHER]).

`validar_solucoes.py --modo plano` passa a delegar para a mesma função, para
não haver duas lógicas.

## Parte 3 · Geradores, app e fixture

### `scripts/gerar_plano_acao.py`

```
python3 scripts/gerar_plano_acao.py --plano <json> \
  --registro clientes/<slug>/contexto/solucoes.json \
  --saida-docx <...>.docx --saida-xlsx <...>.xlsx [--modelo-xlsx <modelo>]
```

- Roda o validador (modo final). Com `ERRO:`, não gera nada e sai com código
  diferente de zero.
- `scripts/plano_acao_docx.py`: o código atual de
  `preencher_plano_acao_docx.py`, sobre o mesmo
  `[MODELO] Plano de Ação Estratégico.docx`. Gera a abertura, as ações com os
  10 rótulos (linha "AÇÃO nº" com destaque amarelo) e a tabela-resumo derivada
  (Nº, Ação, Frente, Horizonte, Início–Entrega, Dono). O
  `preencher_plano_acao_docx.py` é removido.
- `scripts/plano_acao_xlsx.py` (openpyxl):
  - Aba "Plano de Ação": Nº, Frente, Horizonte, Ação, Achado de origem,
    Alavanca da meta, Como, Dono, Início, Entrega, Depende de, Evidência, KPI e
    meta, Gatilho, Status. Ordem cronológica de início. Status vazio com lista
    (A fazer, Em andamento, Feito, Atrasado). Datas como data, não texto.
  - Aba "Metas do plano": cenário, metas por KPI, o que cabe e o que não cabe,
    premissas, pisos de ROAS.
  - Visual de `padrao-visual.md` (cabeçalho `#1c2f5f`, zebra
    branco/`#eef2f8`), cabeçalho congelado, filtro, quebra de texto.
  - Com `--modelo-xlsx`, preenche o modelo em vez de criar a planilha.
- Saídas na interface: `.app/rascunhos/plano-de-acao-estrategico.docx` e
  `.xlsx`. No terminal:
  `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.{docx,xlsx}`.

### App (`src/packages/core`)

- `destinoAprovado`: planilha da etapa `08` vai para
  `entrega/ativos-aprovados/plano-de-acao/`; as outras planilhas continuam em
  `projecao/`.
- `etapas.json`: descrição e "O que esperar" da 08 citam documento e planilha
  e as perguntas de abertura.
- Sem migração de estado.

### Fixture Verdeluz

- `scripts/fixture_verdeluz/plano-de-acao.json` reescrito em v2: mesmas
  soluções, datas a partir de 26/10/2026, empresa "Boomer".
- `montar-fixture.ts` registra a planilha como entregável da 08.
- `roteiro_09.py`: os bullets da seção 05 trocam "(Agência)" pelo nome
  escolhido.

### Outros arquivos

- `09-apresentacao-final/SKILL.md`: a seção 05 lê documento e planilha. O deck
  continua com bullets por horizonte.
- `_shared/regras-de-validacao.md`, Regra 8 item 4: cita
  `validar_plano_acao.py`.
- `08-plano-de-acao/fluxo.mmd`: abertura, Fases 1 a 3 com checkpoint
  "Analista aprova?", relatório e decisão "Pergunta-guia: sim?" (classe
  `checkpoint`, saídas `sim` e `não, ajustar`).
- `_shared/fluxo-geral.mmd`: seta 08 → 09 com "plano de ação .docx + .xlsx".

## Testes

- `scripts/tests/test_validar_plano_acao.py`: um caso por regra de ERRO e
  AVISO; o plano do fixture passa sem erro.
- `scripts/tests/test_gerar_plano_acao.py`: gera os dois arquivos do mesmo
  JSON e confere, lendo de volta, que ações, datas e números são iguais;
  confere os pisos de ROAS (margem 0,20 → 5; quebra 0,20 → 6,25); com
  `ERRO:` não gera arquivo.
- `src/packages/core`: `entregaveis.test.ts` (destino da planilha da 08) e
  os testes de fixture.
- `npm test` em `src/apps/web` (fluxogramas) e `src/packages/core`; `pytest`
  em `scripts/`.

## Fora do escopo

- Etapa 10, revisão do plano pós-apresentação (próximo projeto).
- Modelo `.xlsx` da Boomer (o gerador já aceita `--modelo-xlsx`).
- Conferência automática da meta do mês 3 contra a planilha de projeção (fica
  com o agente, que cita mês e valor de origem, e com o analista).
- Migração dos planos antigos.
