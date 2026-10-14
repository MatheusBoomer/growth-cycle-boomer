# Soluções no diagnóstico (etapa 05 · Soluções) — Design

**Data:** 2026-10-13
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Origem:** treinamento da liderança "Do diagnóstico à solução", que reúne as boas práticas
de 17 Planejamentos Estratégicos entregues pela Boomer
(`Boas Práticas - Seção Diagnóstico Atual.pdf`).
**Escopo:** uma spec. A seção 9 lista o que depende de validação da liderança e
pode cair sem afetar o resto.

## 1. Objetivo

O treinamento conclui que **14 de 17 entregas deixam a solução para o fim ou nem
chegam a propor uma**. A regra de ouro é "nenhum problema sai do diagnóstico sem
solução". Todo slide de análise deveria seguir o caminho
**Dado → Benchmark → Hipótese → Soluções (1 a 3) → Impacto (R$ ou %) → Plano
(dono, prazo, frente)**.

Hoje o pipeline produz o problema que o treinamento critica. As Skills 02, 03 e 04
proíbem soluções. As soluções só aparecem na mídia paga e no plano de ação,
descoladas do dado, sem hipótese de causa e sem impacto quantificado. A Sottile,
que este pipeline produziu, aparece no treinamento como exemplo de "faltou
solução" (quebra por PIX, conversão baixa).

Objetivo: tornar o padrão do treinamento o comportamento **padrão e garantido**
de todo planejamento, com uma etapa própria de Soluções, um registro estruturado
validado em código (mesmo princípio da regra do não-flat) e o deck montado a
partir desse registro.

**Critério de sucesso:** rodando a etapa 05 sobre os dados de `sottile-teste`,
todo desvio do diagnóstico sai com hipóteses, 1 a 3 soluções, impacto e frente.
O validador recusa um registro que viole a regra. A etapa 09 (plano) não fecha
enquanto houver uma solução sem ação. O deck traz um card de desafio por
problema na seção 02. Desafios.

## 2. Auditoria: treinamento × pipeline atual

| Prática do treinamento | Situação antes deste design |
|---|---|
| 1 a 3 soluções por problema | Proibido nas Skills 02, 03 e 04; aparece só em 07/08 |
| Hipótese de causa antes da ação | Só "possíveis causas" da quebra, sem lista estruturada |
| Impacto em R$ ou % | Nenhuma skill quantifica o problema |
| Funil por etapa (carrinho, checkout) | Não medido; o deck de referência cita "funil de eventos", mas nenhuma skill o gera |
| Quebra por meio de pagamento | Não coletada |
| ROAS captação × recompra, ROAS pela margem | Só ROAS global e por plataforma; margem não é insumo |
| Curva ABC: comportamento, kits | 03 só ranqueia; destinos da curva C só na 07 |
| Recorrência pelo ciclo de compra | Insumo da 04 sem datas; ciclo não calculável |
| Benchmark termina em "o que testar" | Lição + Evidência existe, sem testes |
| Dependência de mídia com ação concreta | 07 proíbe descer a CRM/SEO, o que gera "fortalecer CRM, SEO" |
| Cada solução vira item do plano | 08 cobre frentes, não liga solução → ação |
| Benchmarks de KPI com fonte | Valores soltos no texto da 03, sem fonte nem data; 05 aponta para benchmarks em `padrao-visual.md`, que não existem |

## 3. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Onde as soluções nascem | Etapa nova de Soluções. 03 e 04 continuam diagnósticas |
| 2 | Posição | Logo após a 04 e antes de Metas, para que o impacto das soluções vire alavanca dos cenários |
| 3 | Numeração | Renumerar: `05-solucoes`; as etapas 05–09 viram 06–10 |
| 4 | Escopo das soluções | Todo desvio do diagnóstico. Os casos do treinamento são repertório e régua de profundidade, não lista fechada |
| 5 | Garantia | Registro estruturado (`solucoes.json`) + validador em código |
| 6 | Deck | Cards concentrados na seção 02. Desafios; o diagnóstico (01) continua com os gráficos |
| 7 | Insumos novos | Quebra por meio de pagamento (núcleo); funil GA4 e datas por cliente (pendentes de validação, opcionais) |
| 8 | Margem por produto | Não pedida; ROAS por margem fica como hipótese qualitativa |
| 9 | Benchmarks de KPI | Arquivo central `_shared/benchmarks-kpi.md`; Claude estrutura, a liderança fornece e valida os valores |
| 10 | Dores do kickoff (slide 19 do treinamento) | Fora deste ciclo |
| 11 | Prospects existentes | Não migrar; adda, adda-demo, sottile-teste e teste-interface ficam como legado |

## 4. Etapa nova: `05-solucoes`

### 4.1 Entrada

Lê `contexto/decisoes/03-*.md`, `contexto/decisoes/04-*.md`, as seções aprovadas
`secoes/03-*.md` e `secoes/04-*.md`, os gráficos aprovados e
`contexto/contextualizacao-estrategica.md` (hipóteses e gargalos da 02). Não pede
insumo novo ao analista.

### 4.2 Processo

1. **Levantar os achados.** A etapa percorre cada KPI analisado na 03 e na 04.
   - Vira **problema** todo KPI fora do benchmark de `benchmarks-kpi.md`, com
     tendência negativa ou que confirme um gargalo da 02.
   - Vira **ponto forte** todo KPI acima do benchmark. Ele serve de argumento no
     deck (ex.: iQuê, "carrinho → checkout 80% × 35–40%: o problema está nas
     pontas do funil").
   - **Checkpoint:** o analista confirma a lista e a ordem de prioridade antes
     de seguir.
2. **Abrir cada problema** pelo padrão do treinamento:
   - **Dado:** o número e o valor em R$ quando houver.
   - **Benchmark:** a faixa de `benchmarks-kpi.md`. Se o KPI não estiver lá,
     o analista informa o valor ou o `pesquisador-benchmark` pesquisa com fonte
     citada. Nunca usar valor de memória do modelo.
   - **Hipóteses de causa:** pelo menos 1, idealmente 2 a 5. Vêm antes das ações.
   - **Soluções:** de 1 a 3, concretas (verbo + objeto), cada uma ligada a uma
     hipótese. Proibidas as genéricas ("fortalecer CRM", "melhorar SEO"); a
     solução diz o mecanismo (ex.: "régua de reativação para clientes de 1
     compra aos 150 dias").
   - **Impacto:** em R$ ou %, com fórmula e premissa explícitas. A conta é feita
     pelo subagente `analista-dados`; a skill não calcula.
   - **Frente:** uma das 5 frentes do plano de ação.
   - Dono e prazo **não** entram aqui; são o passo "Plano" e ficam com a etapa
     09.
3. **Validar** com `scripts/validar_solucoes.py --modo registro` e corrigir até
   passar sem `ERRO:`.
4. **Gerar a seção** `secoes/05-solucoes.md` a partir do registro, pelo próprio
   script, e passar pela checagem do analista com o checklist de qualidade
   (Regra 8).

### 4.3 Repertório

`.claude/skills/_shared/repertorio-solucoes.md` reúne os casos do treinamento por
tema, como referência de profundidade:

- quebra (World Tennis: hipóteses; Wurth: ações; iQuê: causa → ferramenta;
  Fresca: contato ativo com o pedido perdido);
- quebra por PIX;
- funil por etapa (iQuê) e fricção visível (Adda, Wurth, Compress);
- ROAS e mix de plataformas (iQuê, OMA, Compress);
- Curva ABC: comportamento (Le Vivre) e kits; curva C sem verba de mídia;
- recorrência pelo ciclo de compra (Sottile, Svarts, Iszi);
- dependência de mídia com ação concreta (Iszi);
- impacto em reais (World Tennis, Jogê, Iszi), incluindo o alerta "número sem
  solução vira só alerta".

O arquivo diz de forma explícita que **não é uma lista fechada**: todo desvio
encontrado é tratado, esteja ou não no repertório.

### 4.4 Registro `solucoes.json`

Fonte da verdade das soluções. Fica em `contexto/solucoes.json`, como dado de
trabalho da etapa (mesmo papel do `contexto/contextualizacao-estrategica.md` da
02), gravado pela própria skill nos dois modos. O que o analista aprova é a
seção `secoes/05-solucoes.md`, gerada do registro pelo validador e proposta como
tipo `secao` já existente. Nome estável e sem versionamento: uma revisão
sobrescreve o arquivo.

```json
{
  "versao": 1,
  "prospect": "<nome>",
  "problemas": [
    {
      "id": "P1",
      "tema": "quebra",
      "titulo": "Quebra 7x acima do mercado",
      "origem": "03 · Taxa de quebra",
      "dado": "36,1% da receita captada não vira caixa (R$ 19,1M/ano)",
      "benchmark": "até 5%",
      "hipoteses": [
        { "id": "H1", "texto": "Boleto como meio de pagamento" },
        { "id": "H2", "texto": "Ruptura de estoque" }
      ],
      "solucoes": [
        { "id": "P1.S1", "acao": "Ativar recuperação automática de PIX e boleto", "hipotese": "H1" },
        { "id": "P1.S2", "acao": "Checar ruptura de estoque continuamente", "hipotese": "H2" }
      ],
      "impacto": {
        "tipo": "R$",
        "valor": "+R$ 16,4M/ano",
        "calculo": "receita captada × (36,1% − 5%)"
      },
      "frente": "Eficiência Operacional"
    }
  ],
  "pontos_fortes": [
    { "titulo": "Carrinho → checkout acima do mercado", "dado": "80,56% × 35–40%", "uso": "Prova de que o problema está nas pontas do funil" }
  ]
}
```

- `impacto.tipo`: `"R$"`, `"%"` ou `"nao_quantificavel"`. O último exige o campo
  `justificativa` (ex.: funil incompleto no GA4 impede medir).
- `frente`: uma das 5 frentes da etapa 09: Mídia Paga / Canal Principal,
  Eficiência Operacional, Produto / Mix / Portfólio, Redução de Dependências,
  Monitoramento e Governança.
- Ids: problemas `P<n>`; hipóteses `H<n>`, únicas dentro do problema; soluções
  `P<n>.S<m>`.

## 5. Mudanças nas etapas existentes

### 5.1 01 Preparação e 02 Contextualização

Sem mudança de conteúdo. O handoff da 02 passa a pedir, junto do histórico
mensal, a quebra por meio de pagamento (5.2).

### 5.2 03 Diagnóstico de performance

- **Insumo novo (núcleo):** receita captada × aprovada por meio de pagamento
  (PIX, cartão, boleto), mensal. Opcional no `etapas.json` (`obrigatorio: false`):
  sem ele, a 03 roda como hoje e a quebra por meio de pagamento fica como
  hipótese na 05. Atualizar `modelos-insumo/schemas.json` e
  `scripts/validar_insumo.py`.
- **Análise e gráfico novos:** taxa de quebra por meio de pagamento, contra o
  benchmark.
- Os benchmarks passam a vir de `benchmarks-kpi.md`; a tabela de dependência sai
  do corpo da skill.
- Restrição reescrita: em vez de "não propor ações corretivas", a skill registra
  o achado com clareza (dado, benchmark e suspeita de causa, quando houver) e
  deixa a solução para a etapa de Soluções.
- Funil de eventos: ver seção 9.

### 5.3 04 Unidade econômica

Restrição reescrita como na 03. Datas por cliente e métricas de recorrência: ver
seção 9.

### 5.4 06 Metas e cenários (ex-05)

- As soluções com impacto quantificado viram **alavancas nomeadas** dos cenários
  (ex.: "Otimista assume P1.S1: quebra cai para 10%"). O cenário registra quais
  ids de solução considera.
- Corrigir a referência quebrada: benchmarks passam a vir de `benchmarks-kpi.md`,
  não de `padrao-visual.md`.

### 5.5 07 Briefing e benchmark (ex-06)

- O briefing ganha a seção **"Problemas e soluções"**, lida do registro: título,
  impacto e soluções de cada problema.
- A camada estratégica por concorrente passa a ser **Lição + Evidência + O que
  testar**. "O que testar" traz de 1 a 3 testes concretos para o prospect, ligados
  a um problema do registro quando houver (ex.: "Copy por persona: corredor,
  caminhante → P3").

### 5.6 08 Mídia paga (ex-07)

- Remover a restrição "não descer a nível operacional de CRM/SEO" da Etapa 5.
- A redução de dependência passa a exigir, por canal complementar, uma ação
  concreta: o quê e qual mecanismo. Proibido o genérico "fortalecer CRM, SEO".
- Continuam os limites de criativo, copy, público e configuração de campanha.

### 5.7 09 Plano de ação (ex-08)

- Cada ação no JSON de entrada do `.docx` ganha o campo `solucoes`, com os ids
  que executa (ex.: `["P1.S1", "P1.S2"]`). Uma ação pode não citar id
  (governança, por exemplo). A frente continua na linha correspondente da
  tabela-resumo, que já tem esse campo.
- Antes de gerar o `.docx`, rodar `validar_solucoes.py --modo plano`.
- `preencher_plano_acao_docx.py` aceita o campo novo. Ele não precisa aparecer
  no `.docx`.

### 5.8 10 Apresentação final (ex-09)

- A seção **02. Desafios** é montada do registro: divisória → `bullets` com a
  lista de desafios → um slide `desafio` por problema → `cartoes` com os 3
  pilares.
- Tipo novo `desafio` no `ESQUEMA` de `gerar_apresentacao.py`, com os campos
  `titulo`, `problema`, `hipoteses` (1 a 5), `solucoes` (1 a 3) e `impacto`.
  Layout: problema e hipóteses à esquerda; soluções e impacto à direita, com o
  impacto em destaque (molde visual dos slides 6, 8 e 10 do treinamento).
- O gerador avisa quando algum problema do registro ficou fora do deck, do mesmo
  jeito que já faz com os gráficos aprovados.
- Atualizar a tabela "Antes de começar" da skill (`secoes/05-*` passa a ser
  `secoes/06-*`, etc.) e a estrutura de referência.

## 6. Garantia em código: `scripts/validar_solucoes.py`

Mesmo contrato do `projecao.py`: sai com `ERRO: <motivo>` e código ≠ 0 quando
recusa; `AVISO:` não bloqueia.

**`--modo registro --registro <solucoes.json>`**
- Todo problema tem pelo menos 1 hipótese e **de 1 a 3** soluções.
- Toda solução aponta para uma hipótese existente no mesmo problema.
- `impacto` presente; `calculo` obrigatório quando o tipo é `R$` ou `%`.
- `nao_quantificavel` sem `justificativa` → `ERRO`; com justificativa → `AVISO`.
- `frente` dentro da lista das 5.
- Ids únicos e no formato da seção 4.4.
- `--markdown <saida.md>` gera `secoes/05-solucoes.md` do registro.

**`--modo plano --registro <solucoes.json> --plano <plano.json>`**
- Todo id de solução do registro aparece em pelo menos uma ação.
- Nenhuma ação cita id inexistente.
- Toda ação tem `quando` e `por_quem` preenchidos e uma linha na tabela-resumo
  (mesmo nome em `acao`) com `frente` preenchida.

## 7. Regras compartilhadas

- **`_shared/benchmarks-kpi.md` (novo):** tabela única com KPI, faixa, recorte
  (segmento ou estágio), fonte e data da última revisão. Carga inicial: os valores
  que já existem na 03 e na 04 (quebra, conversão por plataforma, dependência por
  estágio, LTV/CAC) e os do funil do treinamento (carrinho 6–10%, carrinho →
  checkout 35–40%, checkout → compra 45–47%), todos com "fonte a confirmar" até a
  liderança validar. KPI ausente: o analista informa ou o `pesquisador-benchmark`
  pesquisa com fonte; nunca valor de memória do modelo.
- **`regras-de-validacao.md`, Regra 8 (nova): checklist de qualidade do
  diagnóstico.** São os 5 itens do treinamento:
  1. Problema identificado = 1 a 3 soluções.
  2. Hipótese de causa antes da ação.
  3. Impacto estimado em R$ ou %.
  4. Cada solução vira item do plano.
  5. Benchmarking termina em teste.

  Os itens 1, 3 e 4 são garantidos pelo validador; os itens 2 e 5 são conferência
  do analista. As etapas 05 e 10 apresentam o checklist antes do checkpoint
  final.
- **Regra 2:** sem mudança de destinos; a seção `05-solucoes.md` vai para
  `secoes/` como as demais.

## 8. Renumeração, app e migração

- **Pastas:** `05-metas-e-cenarios` → `06-…`, `06-briefing-e-benchmark` → `07-…`,
  `07-midia-paga` → `08-…`, `08-plano-de-acao` → `09-…`,
  `09-apresentacao-final` → `10-…`; nova `05-solucoes`.
- **Comandos:** os mesmos renomes em `.claude/commands/` e o comando novo
  `05-solucoes.md`. `/apresentacao-final` não muda.
- **Textos:** "Skill N de 8" vira "de 10"; referências cruzadas e handoffs de
  todas as skills; sequência no `CLAUDE.md` raiz; linha nova no
  `clientes/_template/contexto/status-planejamento.md`.
- **App:**
  - `ORDEM_ETAPAS` em `src/packages/core/src/tipos.ts` ganha a etapa nova (o id
    `final` continua);
  - `etapas.json` ganha a etapa `05` e renumera as seguintes;
  - nenhum tipo de entregável novo: o registro fica em `contexto/` e a seção
    gerada usa o tipo `secao`;
  - `lerEstado` completa etapas ausentes no `estado.json` (prospects gravados
    antes da etapa nova) com etapa vazia bloqueada, para o app não quebrar ao
    abrir um prospect legado;
  - `prompts.ts`, `catalogo.ts` e `status-md.ts` revisados para a etapa nova.
- **Prospects existentes:** sem migração. adda, adda-demo, sottile-teste e
  teste-interface ficam como legado (entregáveis antigos aparecem uma etapa
  deslocados se reabertos). sottile-jalecos só concluiu a etapa 00 e segue o
  fluxo novo.

## 9. Pendente de validação da liderança

Estes itens entram no plano como **tarefas independentes, no fim**, e podem ser
removidos ou alterados sem retrabalho no restante. Enquanto não forem
validados, ficam como insumo opcional: sem eles, a 03 e a 04 rodam como hoje e
a 05 trata o tema como hipótese qualitativa (impacto `nao_quantificavel` com
justificativa).

1. **Funil de eventos do GA4** na 03: sessões → adição ao carrinho → checkout →
   compra, mensal, como aba do histórico mensal. Gráfico do funil contra os
   benchmarks do treinamento.
2. **Datas de compra por cliente** na 04: data da 1ª e da última compra no
   relatório por cliente (sem PII).
3. **Métricas de recorrência** na 04, dependentes do item 2: % de clientes de
   compra única, ciclo médio de recompra e base adormecida (clientes sem compra
   há mais de 1,5× o ciclo).
4. **Valores de `benchmarks-kpi.md`** marcados como "fonte a confirmar".

## 10. Testes

- **`scripts/tests/test_validar_solucoes.py`:** um caso por regra da seção 6 nos
  dois modos, mais um registro e um plano bem formados (fixture inspirada no caso
  World Tennis), e a geração do `.md`.
- **`scripts/tests/test_gerar_apresentacao.py`:** slide `desafio` renderizado,
  limites dos campos e aviso de problema do registro fora do deck.
- **`scripts/tests/test_validar_insumo.py`:** schema da quebra por meio de
  pagamento.
- **Vitest (`src/packages/core/test/`):** `catalogo.test.ts` e
  `prompts.test.ts` atualizados para 10 etapas; teste de `lerEstado` com
  `estado.json` legado.
- **Ponta a ponta manual:** rodar a 05 sobre os dados de `sottile-teste` (03 e
  04 já existem) e conferir registro, validador, seção gerada e card no deck.

## 11. Fora de escopo

- Rastreabilidade das dores levantadas pelo cliente no kickoff.
- Margem por produto e ROAS ideal pela margem.
- Migração do estado `.app/` dos prospects existentes.
- Separação de ROAS de novos clientes × recorrentes (sugerido como próximo tema
  de treinamento).

## 12. Riscos

- **Layout do slide `desafio` no molde `.pptx`:** é o maior risco técnico. A
  primeira tarefa do bloco do deck verifica se dá para derivar de um layout
  existente (`cartoes` ou `analises_2_colunas`) antes de criar um novo.
- **Volume da etapa 05:** muitos problemas tornam a etapa longa. A priorização no
  checkpoint do passo 1 é o controle: o analista pode agrupar problemas
  correlatos num só.
