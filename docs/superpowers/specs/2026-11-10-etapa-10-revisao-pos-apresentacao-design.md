# Etapa 10 — Revisão do plano de ação pós-apresentação

Data: 2026-11-10
Status: aprovado no brainstorming, aguardando revisão da spec

## Contexto

O processo manual da Boomer termina com o Prompt 10 (`prompts/Prompt 10 -
Revisão Plano Estratégico vs Transcrição Call.pdf`): depois da reunião em que
o Growth Cycle é apresentado ao cliente, a IA cruza a transcrição da reunião
com o Plano de Ação, separa complementos, conflitos e pontos em aberto, espera
as decisões do analista e gera a versão final do plano, que é a usada na
entrega formal.

Este é o segundo de dois projetos. O primeiro (spec
`2026-11-10-plano-de-acao-prompt-9-design.md`, já na `main`) deixou a Skill 08
no padrão do Prompt 9: JSON v2 com 10 campos, `validar_plano_acao.py` e
`gerar_plano_acao.py` (`.docx` + `.xlsx`). A etapa 10 revisa um plano nesse
formato.

O Prompt 10 cita "o briefing do Prompt 7": é a etapa de benchmark desativada e
fica de fora.

## Decisões tomadas

1. A etapa 10 é obrigatória e a última de verdade: entra depois da
   Apresentação final, e o prospect só fica "Planejamento concluído" quando ela
   fecha.
2. O plano revisado é uma versão separada, `plano-de-acao-final.*`; o plano da
   08 (`plano-de-acao-estrategico.*`) fica como registro do que foi
   apresentado.
3. Se o analista decidir, num conflito, mudar meta, verba ou cenário, a mudança
   vale só no plano final, com rastro: o relatório lista cada número que passou
   a divergir da 06/07 (antes e depois) e os slides do deck afetados. O deck
   não é mexido. Para refazer na origem, o analista reabre a 06 ou a 07 pelo
   fluxo existente.
4. O JSON v2 do plano chega à etapa 10 por uma cópia automática:
   `gerar_plano_acao.py` grava o JSON validado junto com os dois arquivos, e o
   app o copia para os ativos aprovados quando o documento é aprovado.
5. Sem subagente novo. A proteção vem de código: um registro da revisão
   (`revisao-plano.json`) validado contra a transcrição e contra os planos.
6. Na interface, a análise da reunião é proposta como seção (card de
   entregável); o analista confere os trechos, responde as decisões no chat e
   aprova; depois o plano final é proposto em documento e planilha.
7. Prospects que já concluíram a Apresentação final passam a mostrar a etapa
   10 liberada ("aguardando revisão pós-apresentação"); sem o JSON v2 da 08, a
   etapa avisa que é preciso refazer a 08.
8. A transcrição é aceita em `.docx`, `.txt` ou `.md` (o Prompt 10 pede `.txt`
   ou `.docx`; `.pdf` exigiria `pdftotext` no servidor).

## Parte 1 · Fluxo da skill `10-revisao-pos-apresentacao`

Rótulo "10 · Revisão pós-apresentação", fase "Pós-apresentação", comando
`/10-revisao-pos-apresentacao`. Corresponde ao Prompt 10 do processo manual.

**Antes de começar.**
- Insumo obrigatório: transcrição da reunião de apresentação.
- Conferir que existe `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json`
  (versão 2). Se não existir, parar e explicar que é preciso refazer a 08.
- No chat, uma pergunta por vez, pré-preenchidas pela transcrição: data de
  hoje, data da reunião, participantes da Boomer e do cliente com função. Se a
  transcrição parecer cortada, perguntar se cobre a reunião inteira.

**Fase 1 · Leitura e cruzamento** (Etapas 1 e 2 do Prompt 10).
- Extrair restrições do cliente, testes já realizados, decisões tomadas,
  mudanças de prioridade, informações novas, compromissos da Boomer e objeções
  sem resposta.
- Classificar cada ponto contra as ações do plano:
  - Complemento: acrescenta sem contrariar (ação nova alinhada ao diagnóstico,
    detalhe que torna a ação mais executável, ajuste de data ou dono que não
    muda o efeito na meta, plano B ou gatilho).
  - Conflito: o cliente não vai, não pode ou não quer executar; já testou e não
    funcionou; quer outro caminho; a mudança altera verba, metas, cenário, KPIs
    validados ou a lógica de mídia; retirar/adiar compromete uma alavanca; um
    compromisso da Boomer contradiz o plano ou extrapola o escopo.
  - Ponto em aberto: discutido sem virar decisão, ou dependente de confirmação.
- Regras de leitura: "vou pensar", "pode ser" e "vamos ver" não são decisão;
  sugestão da Boomer não confirmada pelo cliente não é decisão do cliente;
  trecho incoerente (nome, número, quem falou) é sinalizado, não assumido;
  todo ponto cita trecho curto, quem falou e posição aproximada; na dúvida
  entre complemento e conflito, é conflito.
- Quando o cliente diz que já testou algo, verificar como foi o teste (verba,
  tempo, público, execução) e dizer se invalida a recomendação ou se foi
  diferente do que o plano propõe.
- Registrar tudo em `revisao-plano.json` e rodar
  `validar_revisao.py --rascunho`.

**Fase 2 · Análise para o analista** (Etapa 3 do Prompt 10). Seção proposta no
card, sem tabelas, nesta ordem:
1. Resumo da reunião (até 5 linhas).
2. Complementos aplicados: ação (nova ou alterada), o que foi feito, trecho.
3. Conflitos, numerados, no formato:
   ```
   CONFLITO [nº]
   AÇÃO DO PLANO: [nº e nome]
   O QUE O PLANO RECOMENDA: [resumo]
   O QUE FOI DITO NA REUNIÃO: [trecho, quem falou, minuto aproximado]
   IMPACTO: [alavanca ou meta afetada e quanto, se der para estimar]
   OPÇÃO A · Manter o plano: [significado e risco]
   OPÇÃO B · Seguir o que foi dito: [como a ação ficaria e risco]
   OPÇÃO C · Caminho intermediário: [se existir]
   RECOMENDAÇÃO DA BOOMER: [opção e porquê]
   ```
   Se uma ação sair do plano, dizer qual alavanca fica descoberta e qual ação
   poderia substituí-la.
4. Pontos em aberto, com destino sugerido.
5. Compromissos da Boomer, com trecho, sinalizando o que não está no plano ou
   parece fora do escopo.
6. Pedido de decisão (ex.: "Conflito 1: Opção B") e de destino dos pontos em
   aberto.

Checkpoint "Analista aprova?": o analista confere os trechos na transcrição e
responde as decisões no chat.

**Fase 3 · Plano final** (Etapa 4 do Prompt 10).
- Registrar as decisões no `revisao-plano.json` e rodar `validar_revisao.py`
  em modo final.
- Partir de uma cópia do JSON da 08, aplicar complementos e decisões, revisar
  em cadeia dependências, datas, gatilhos e ações que dependiam do que saiu ou
  mudou, e conferir que toda alavanca da meta continua coberta.
- Gerar `plano-de-acao-final.docx`, `.xlsx` e `.json` com
  `gerar_plano_acao.py` (todas as regras da 08 valem: 10 campos, 6 critérios,
  7 erros, um número por KPI, sem menção à garantia).
- Checkpoint "Analista aprova?" nos dois arquivos.

**Fase 4 · Relatório final** (Etapa 5 do Prompt 10), no chat, sem tabelas,
com base na saída de `relatorio_revisao.py`:
- O que mudou: ações incluídas, alteradas e removidas, cada uma com o motivo.
- Cobertura da meta: cada KPI e as ações que o movem; alavancas que ficaram
  mais fracas.
- Coerência: documento e planilha iguais; números que divergem da 06/07
  (antes e depois) e slides do deck a atualizar.
- Pendências com data.
- Pergunta-guia: "Se o cliente fizer exatamente isto, e só isto, por 3 meses,
  eu apostaria o dinheiro do projeto que o resultado vem?". A etapa só fecha
  com "sim" do analista; "não" volta à Fase 3 com o que falta.

**Encerramento.** Handoff em linguagem natural: o plano final (documento e
planilha) é o que vai para a entrega formal ao cliente; se houver
divergências com a 06/07, lembrar quais slides do deck precisam de
atualização. Terminal: marcar a 10 ✅ em `contexto/status-planejamento.md`,
reescrever "Próximo passo" e gravar `contexto/decisoes/10-revisao-pos-apresentacao.md`.
Interface: `sinalizar_etapa_pronta` com resumo e handoff (Regra 7).

**Restrições.** Não gerar o plano final antes das decisões; não aplicar
conflito por conta própria; não tratar como decisão o que o cliente cogitou;
não remover ação sem apontar a alavanca descoberta; não alterar cenários,
metas ou verba sem decisão explícita; não inventar trechos; não mencionar a
garantia nos arquivos; não refazer o diagnóstico; não enviar nada ao cliente.

## Parte 2 · Dados e scripts

### Cópia do JSON na 08

`gerar_plano_acao.py` ganha `--saida-json <caminho>`: grava o JSON validado
(o mesmo dicionário que gerou os arquivos, `ensure_ascii=False`, indentado) na
mesma escrita atômica dos outros dois. A Skill 08 passa a usá-lo
(`plano-de-acao-estrategico.json`), assim como a etapa 10
(`plano-de-acao-final.json`).

### `scripts/texto_transcricao.py`

- `extrair_texto(caminho: Path) -> str` para `.docx` (python-docx: parágrafos
  e tabelas), `.txt` e `.md` (UTF-8, com fallback latin-1). Outra extensão →
  `ErroTranscricao`.
- `normalizar(texto: str) -> str`: minúsculas, aspas e travessões
  tipográficos unificados, espaços em branco colapsados, sem pontuação nas
  pontas.
- `contem_trecho(texto_normalizado: str, trecho: str) -> bool`.

### `revisao-plano.json`, versão 1

```
{
  "versao": 1,
  "prospect": "...",
  "data_hoje": "dd/mm/aaaa",
  "data_reuniao": "dd/mm/aaaa",
  "participantes": {
    "boomer": [{"nome": "...", "funcao": "..."}],
    "cliente": [{"nome": "...", "funcao": "..."}]
  },
  "resumo": "...",
  "complementos": [
    {"numero": 1, "acoes": [7], "o_que_mudou": "...", "trecho": TRECHO}
  ],
  "conflitos": [
    {"numero": 1, "acao": 12, "recomendacao_plano": "...", "trecho": TRECHO,
     "impacto": "...", "opcoes": {"A": "...", "B": "...", "C": "..."},
     "recomendacao_boomer": "C", "decisao": null,
     "remove_acao": false, "alavanca_descoberta": null, "substituta": null,
     "acoes_afetadas": [12]}
  ],
  "abertos": [
    {"numero": 1, "tema": "...", "trecho": TRECHO, "destino_sugerido": "...",
     "destino": null}
  ],
  "compromissos": [
    {"numero": 1, "texto": "...", "trecho": TRECHO, "no_plano": true,
     "fora_do_escopo": false, "acoes": [], "tratamento": null}
  ],
  "divergencias_cenario": [
    {"item": "Meta de conversão", "antes": "1,75%", "depois": "1,60%",
     "slides": ["Metas do projeto"]}
  ]
}
```

- `TRECHO` = `{"texto": "...", "quem": "Marina (cliente)", "posicao": "≈23 min"}`.
- `opcoes` tem A e B obrigatórias; C opcional.
- `destino` de ponto em aberto: `{"tipo": "acao", "acoes": [26]}`,
  `{"tipo": "descartado", "motivo": "..."}` ou
  `{"tipo": "confirmar", "ate": "dd/mm/aaaa"}`.
- `acoes_afetadas` (conflitos) e `acoes` (complementos, abertos com destino
  ação, compromissos) listam os números de ação que o item muda ou cria.

### `scripts/validar_revisao.py`

`python3 scripts/validar_revisao.py --revisao <json> --transcricao <arquivo> --plano-08 <json> [--plano-final <json>] [--rascunho]`

`validar(revisao, texto_transcricao, plano_08, plano_final=None, rascunho=False) -> (erros, avisos)`; nunca levanta exceção para entrada malformada.

ERRO sempre:
- `versao` ≠ 1; listas ausentes ou de tipo errado; números repetidos dentro de
  um grupo.
- Trecho (`texto`) vazio ou que não aparece na transcrição normalizada.
- `quem` cujo nome (antes do parêntese) não está entre os participantes.
- Ação citada (`acao`, `acoes`, `acoes_afetadas`) que não existe no plano da 08,
  exceto números novos que existam no plano final.
- `recomendacao_boomer` ou `decisao` fora das opções existentes.
- Conflito com `remove_acao` true cuja ação tem `alavanca_da_meta` true no
  plano da 08 e `alavanca_descoberta` ou `substituta` vazio.
- Datas fora de dd/mm/aaaa.

ERRO só em modo final (sem `--rascunho`):
- Conflito sem `decisao`.
- Ponto em aberto sem `destino`; destino "confirmar" com data anterior a
  `data_hoje`; destino "acao" sem ação existente no plano final.
- Compromisso com `fora_do_escopo` true ou `no_plano` false que não tenha
  `acoes` (virou ação no plano final) nem `tratamento` (texto dizendo o que
  será feito, ex.: "fora do escopo: alinhar com o cliente na próxima
  reunião"). O campo `tratamento` (string ou null) entra no esquema de
  `compromissos`.
- Com `--plano-final`: toda ação incluída, alterada ou removida em relação à
  08 precisa aparecer em `acoes`/`acoes_afetadas` de algum complemento,
  conflito, ponto em aberto ou compromisso ("toda mudança tem motivo"); metas
  da abertura que mudaram precisam constar em `divergencias_cenario`.

AVISO: trecho com mais de 300 caracteres (deveria ser curto); `posicao` vazia;
resumo com mais de 5 linhas.

O plano final também passa por `validar_plano_acao.py` (modo final) e pelo
próprio `gerar_plano_acao.py`.

### `scripts/relatorio_revisao.py`

`python3 scripts/relatorio_revisao.py --plano-08 <json> --plano-final <json> --revisao <json>` imprime Markdown (sem tabelas):
- Ações incluídas, alteradas (campos que mudaram) e removidas, cada uma com o
  motivo ("Complemento 2", "Conflito 1: Opção C", "Ponto em aberto 3").
- Metas da abertura que mudaram e `divergencias_cenario` com slides.
- Cobertura da meta: para cada KPI das metas, as ações com
  `alavanca_da_meta` que o citam em `alavanca`, antes e depois; KPI sem ação
  no final é destacado.

Funções testáveis: `diferencas(plano_08, plano_final) -> dict` e
`montar_relatorio(...) -> str`.

### Arquivos da etapa 10

| Artefato | Interface (rascunho) | Aprovado em |
|---|---|---|
| Análise da reunião (seção) | `.app/rascunhos/revisao-pos-apresentacao.md` | `entrega/ativos-aprovados/secoes/10-revisao-pos-apresentacao.md` |
| Registro da revisão | `.app/rascunhos/revisao-plano.json` | `entrega/ativos-aprovados/plano-de-acao/revisao-plano.json` |
| Plano final | `.app/rascunhos/plano-de-acao-final.{docx,xlsx,json}` | `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-final.*` |

No terminal, os mesmos destinos são escritos direto.

## Parte 3 · App, catálogo, skills e fixture

### Estado e máquina de etapas (`src/packages/core`)

- `ORDEM_ETAPAS` = `[... "08", "final", "10"]`.
- `recalcularLiberacoes`: a regra "só libera se nenhuma etapa estiver
  desatualizada" vale para `final` e `10`.
- Resumo do prospect: `concluidas` continua excluindo `final` (a 10 conta);
  `totalEtapas` = 9; "Planejamento concluído" só sem etapa pendente.
- `escolherEtapaInicial` (web) cai na `10` quando não há nada em andamento.
- Normalização na leitura: estado sem a chave `"10"` ganha
  `etapaVazia("bloqueada")` e passa por `recalcularLiberacoes` (disco e
  Supabase); persiste na próxima escrita. Não toca `classificarNumeracao`
  nem a migração da renumeração.
- Rótulos e painéis que tratam `final` à parte (`graficos-dados.ts`, fixture
  do painel) passam a conhecer a `10` como etapa numerada comum.

### Catálogo (`.claude/skills/_shared/etapas.json`)

- Etapa `"10"`: `fase` "Pós-apresentação", `numero` "10", `titulo`
  "Revisão pós-apresentação", `rotuloStatus` "10 · Revisão pós-apresentação",
  `skill` "10-revisao-pos-apresentacao", `subagentes` [], insumos
  `[{"id": "apresentacao-transcricao", "obrigatorio": true}]`, `descricao` e
  `oQueEsperar` (transcrição; análise com complementos, conflitos e pontos em
  aberto; decisões no chat; plano final em documento e planilha; pergunta-guia).
- Insumo `apresentacao-transcricao`: nome "Transcrição da reunião de
  apresentação", tipo arquivo, formatos `.docx`, `.txt`, `.md`, destino
  `contexto/brutos/apresentacao-transcricao-bruta`, instrução "Exporte a
  transcrição completa do Google Drive e confira se cobre a reunião do início
  ao fim.", `modelo` null, `validador` null, `sensivel` false.
- `sugestoes-modelos.json`: `{"etapa": "10", "alvo": "principal", "modelo":
  "sonnet", "motivo": "leitura atenta de transcrição longa e julgamento sobre
  conflitos"}`.

### Entregáveis (`entregaveis.ts`)

- `PASTA_POR_TIPO_E_ETAPA` ganha `"planilha:10": "plano-de-acao"`.
- Mapa fixo de acompanhantes copiados na aprovação de um `documento`:
  - etapa `08`, `plano-de-acao-estrategico` → `plano-de-acao-estrategico.json`;
  - etapa `10`, `plano-de-acao-final` → `plano-de-acao-final.json` e
    `revisao-plano.json`.
  Origem: mesma pasta do rascunho; destino: pasta do documento aprovado.
  Acompanhante ausente não bloqueia a aprovação, mas é registrado como aviso
  na atividade. Mesma regra no armazenamento em disco e no Supabase.

### Skills, comandos, fluxogramas e textos

- Novos: `.claude/skills/10-revisao-pos-apresentacao/SKILL.md`, `fluxo.mmd`
  e `.claude/commands/10-revisao-pos-apresentacao.md`.
- Skill 08: `gerar_plano_acao.py` com `--saida-json`.
- Skill 09: o encerramento deixa de ser "fim do processo" e pede a
  transcrição da reunião de apresentação para a etapa 10; `fluxo.mmd` da 09
  troca o nó final.
- `_shared/fluxo-geral.mmd` (`E09 --> E10 --> FIM` com "plano final"),
  `CLAUDE.md` (ordem de execução), lista fixa do catálogo em
  `src/packages/core/src/catalogo-skills.ts` (se a etapa não vier só do
  `etapas.json`), `_desativadas/briefing-e-benchmark/README.md` (numeração).
- `regras-de-validacao.md`: Regra 7 cita os scripts da etapa 10.

### Fixture Verdeluz

- `contexto/brutos/apresentacao-transcricao-bruta.docx`: transcrição fictícia
  de 30 a 40 minutos (gerada por `scripts/fixture_verdeluz/gerar_brutos.py`),
  com de propósito 2 a 3 complementos, 2 conflitos (um "já testamos e não
  funcionou"), 2 pontos em aberto, 2 compromissos da Boomer (um fora do
  escopo) e uma fala ambígua ("vou pensar").
- Etapa 10 executada: `revisao-plano.json` com decisões, plano final
  (`.docx`, `.xlsx`, `.json`), seção da análise, `decisoes/10-…md`,
  `roteiros/10.md`, entregáveis no `estado-completo.json` e no
  `manifesto.json`, kit de insumos da 10 e `montar-fixture.ts`.
- O `plano-de-acao-estrategico.json` aprovado da 08 entra no fixture.

## Testes

- `scripts/tests/test_texto_transcricao.py`, `test_validar_revisao.py` (um
  caso por regra), `test_relatorio_revisao.py` (par de planos com ação
  incluída, alterada e removida; meta alterada; KPI que perde cobertura),
  `test_gerar_plano_acao.py` (`--saida-json` igual ao JSON de entrada e
  atômico).
- `src/packages/core`: máquina de estados (liberação da 10, regra de
  desatualizada, normalização de estado antigo, contagem), entregáveis
  (planilha da 10, acompanhantes), fixture (reposicionar na 10).
- `src/apps/web`: fluxogramas.
- Rodar `npm test -- --force` (o cache do turbo esconde falhas) e
  `python3 -m pytest -q` em `scripts/`.

## Fora do escopo

- Atualizar o deck depois da revisão (a etapa só lista os slides afetados).
- Status "dispensada" para prospects antigos.
- Leitura de `.pdf`.
- Push e deploy na VPS (feitos depois, junto com o projeto 1).
