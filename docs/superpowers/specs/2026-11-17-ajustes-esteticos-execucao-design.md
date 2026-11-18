# Ajustes estéticos da execução das etapas e da apresentação

Data: 2026-11-17 · Branch: `fix/ajustes-esteticos` (a partir de `origin/main`)

Oito correções apontadas pelo analista ao executar as etapas do Growth Cycle. Seis são da interface web
(`src/apps/web`, `src/packages/ui`); duas são do gerador do `.pptx` (`scripts/`). Ajustes de skills ficam
fora deste spec: são outro ciclo.

Os dois blocos são independentes e podem virar dois planos de implementação. Cada apontamento tem a causa
encontrada no código e a correção.

## Bloco A — Interface web

### A1. Botão "Concluir etapa e ir para …" com letras para fora

- **Causa:** em `components/trabalho/painel-etapa.tsx` o botão é `w-full` numa coluna de ~280 px e o rótulo
  ("Concluir etapa e ir para 03 · Diagnóstico de performance →") é mais largo que ela. O botão base não
  quebra linha, então o texto vaza. A implementação confirma no `Button` de `src/packages/ui` qual classe
  impede a quebra.
- **Correção:** neste botão o rótulo pode quebrar em até duas linhas (altura automática, texto centralizado,
  `text-balance`). O botão do chat (`fim-da-etapa.tsx`) já cabe e não muda.
- **Pronto quando:** com rótulo longo e coluna na largura mínima, nenhuma letra sai do botão.

### A2. Sombra branca sobre a última linha do chat

- **Causa:** `components/chat/chat-etapa.tsx` tem um degradê de 48 px (`h-12`, de `--vidro-2` a transparente)
  sobre a base da área de rolagem. No fim da conversa, a última linha (por exemplo o botão de concluir) fica
  exatamente embaixo dele.
- **Correção:** `MessageScrollerContent` ganha respiro no fim (`pb-14`, maior que o degradê). Na rolagem
  máxima o último item para acima da sombra. O degradê continua, para suavizar o texto durante a rolagem.
- **Pronto quando:** no fim da conversa a última linha aparece inteira e sem véu branco.

### A3. Histórico de ações recolhido e com frases amigáveis

- **Causa:** `components/chat/thought-line.tsx` inicia com `useState(aoVivo)` e reabre/recolhe sozinho quando
  o agente começa ou termina de trabalhar. O texto vem de `atividade.detalhe`, gravado por
  `packages/core/src/atividade.ts` ("Lendo .claude/skills/…", "Rodando: cd …").
- **Comportamento novo:**
  - Fechado por padrão, inclusive durante o trabalho. A linha mostra ✦, a frase da ação atual, o cronômetro
    e a seta. Ao terminar, mostra "Pensou por X s", como hoje.
  - Abrir e fechar é só escolha do analista; o componente nunca muda isso sozinho.
  - A lista aberta usa as mesmas frases amigáveis. O texto técnico original fica no `title` (tooltip).
- **Frases:** módulo novo `src/apps/web/lib/frases-do-agente.ts`, função pura
  `fraseDoPasso(evento, posicao)`. Classifica pelo nome da ferramenta (`evento.nome`) e pelo caminho ou
  comando em `evento.detalhe`. Cada categoria tem 2 a 3 variações; a escolhida depende da posição do passo
  (determinística, sem piscar a cada render). `core/atividade.ts` não muda: o log gravado e os eventos
  antigos continuam válidos.

| Categoria | Critério | Exemplos de frase |
|---|---|---|
| Skill | `nome = Skill` | "Abrindo o manual da etapa" |
| Regras da casa | leitura em `.claude/` | "Relendo as regras da casa" |
| Contexto | leitura em `contexto/` | "Relembrando o que já sabemos do prospect" |
| Dados | leitura em `dados/` ou planilhas | "Folheando as planilhas do cliente" |
| Cálculo | `Bash` com script | "Fazendo as contas" |
| Escrita | `Write`, `Edit` | "Passando a limpo" |
| Busca | `Glob`, `Grep` | "Procurando nas gavetas" |
| Web | firecrawl, `WebSearch` | "Dando uma volta pela web" |
| Subagente | `Agent`, `Task` | "Chamando o analista de dados" |
| Outro | qualquer outro | "Passando um café…" |

- **Pronto quando:** nenhum caminho de arquivo nem comando aparece na linha visível; o histórico só abre por
  clique.

### A4. Entregáveis da etapa sem rolagem

- **Causa:** `PainelEtapa` renderiza `<aside className="flex min-h-0 flex-col">` sem `h-full`, dentro de um
  container `h-full overflow-hidden` (em `area-de-trabalho.tsx`). O conteúdo cresce além da altura e o
  container corta; a divisão com o arquivo aberto embaixo agrava.
- **Correção:** `aside` com `h-full`. A área `flex-1 overflow-y-auto` (Entregáveis e Insumos) passa a rolar, e
  o rodapé com o botão de concluir fica fixo. Vale com ou sem arquivo aberto.
- **Pronto quando:** com arquivo aberto embaixo, todos os entregáveis (por exemplo 19) são alcançáveis pela
  rolagem.

### A7. Coluna 3 reabrindo sozinha

- **Causa:** ao abrir o visualizador do meio, `layoutParaVisualizador` (`lib/layout-colunas.ts`) aplica o
  layout salvo da combinação "com visualizador". Esse layout pode ter sido salvo com a coluna 3 aberta e a
  reabre. No sentido inverso, um layout salvo com a coluna 3 fechada a esconderia com ela aberta.
- **Correção:** depois de escolher o layout, o estado atual da coluna 3 prevalece:
  - recolhida agora → continua recolhida; a largura dela vai para o chat;
  - aberta agora e o salvo tinha 0 → abre com a última largura (`larguraPainel`).
  Implementado dentro de `layoutParaVisualizador`, com a informação do estado do painel passada pelo
  chamador, e coberto em `lib/layout-colunas.test.ts`.
- **Mantido:** clicar num item da lista de Entregáveis, ou numa menção, abre o arquivo na coluna 3 e a abre
  se estiver oculta (`abrirArquivo`), porque o arquivo só tem onde aparecer ali.
- **Pronto quando:** com a coluna 3 oculta, expandir um texto não a reabre; com ela aberta, continua aberta.

### A8. "Ampliar" do gráfico abre um modal

- **Hoje:** em `cards/previa-arquivo.tsx`, "Ampliar" (e clicar na imagem) chama `abrirArquivo`, que mostra a
  imagem pequena embaixo da coluna 3.
- **Novo:** componente `cards/modal-grafico.tsx`, um `Dialog` no estilo de `modal-roteiro.tsx` (`h-[92vh]`,
  `sm:max-w-[min(96vw,1500px)]`), com a imagem ajustada à área.
  - Barra superior: título, **Abrir em nova aba**, **Baixar**.
  - Rodapé, só com o entregável pendente: **Aprovar** e **Pedir ajuste…**, com as mesmas regras do card
    (`aguardandoNovaVersao` desabilita Aprovar; mesmo `title` explicativo).
  - **Aprovar** fecha o modal quando conclui. **Pedir ajuste…** fecha o modal e executa o fluxo atual
    (`refs.adicionar` + `refs.iniciarMarcacao`), então a marcação continua no card.
  - Entregável aprovado: só ver, abrir em nova aba e baixar.
- **Estado:** o modal pertence ao `CardEntregavel`, que já tem `aprovar` e `pedirAjuste`. `PreviaArquivo` ganha
  `aoAmpliar` separado de `aoAbrir`. Só gráfico e tabela usam `aoAmpliar`; os outros tipos não mudam.
- **Inalterado:** clicar num item da lista de Entregáveis do painel continua abrindo o visualizador embaixo
  (cobre o A4).
- **Pronto quando:** "Ampliar" e clique na imagem abrem o modal; Aprovar e Pedir ajuste funcionam de dentro
  dele; nova aba abre a imagem inteira.

## Bloco B — Gerador do `.pptx`

Geometria dos slides modelo (molde em `.claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx`,
slide 9 144 000 × 5 143 500 EMU, medida em % do slide):

| Slide | Elemento | x | y | largura | altura |
|---|---|---|---|---|---|
| `jornada` | caixa de texto (5 itens) | 7,1 | 23,1 | 84,3 | 51,8 |
| `jornada` | setas (5), altura 4,1 | 0 | 27,0 + 10,35·i | 7,6 | 4,1 |
| `grafico` | imagem / conclusões | 3,6 / 68,9 | 27,3 / 37,5 | 63,9 / 28,9 | 62,5 / 36,4 |
| `tabela_lateral` | imagem / conclusões | 46,3 / 5,0 | 7,2 / 30,8 | 47,2 / 34,7 | 83,6 / 56,5 |
| `imagem_larga` | imagem / texto | 4,4 / 4,4 | 21,6 / 65,3 | 88,4 / 88,4 | 39,1 / 14,3 |

### B5. Jornada desalinhada das setas azuis

- **Causa:** os 5 itens estão numa só caixa, com espaçamento de linha de 250%
  (`preparar_molde_apresentacao.ajustar_jornada`), e as setas em posições fixas. O alinhamento depende de como
  cada programa desenha o espaçamento, e o resultado sai deslocado quase meia linha.
- **Correção no gerador** (`scripts/gerar_apresentacao.py`, tipo `jornada`): em vez de uma caixa com 5
  parágrafos, uma caixa de texto por item, com o mesmo `x` e a mesma largura da caixa original e o mesmo
  **centro vertical** da seta correspondente (altura própria de 420 000 EMU, maior que a linha de texto, porque
  a seta tem só 210 900). Cada caixa tem ancoragem vertical ao centro, espaçamento de linha de 100% e a
  numeração automática continuando de 1 a 5 (`startAt`), já que cada item passa a ser uma lista própria. A
  caixa original é removida. As setas não mudam de lugar. O resultado não depende do motor de renderização.
- **Teste** (`scripts/tests/test_gerar_apresentacao.py`): o centro vertical de cada caixa de item coincide com
  o centro da sua seta, na ordem, e o slide tem exatamente 5 caixas de item.

### B6. Imagens pequenas e ilegíveis

- **Causa:** a imagem é encaixada, com a proporção original, na área do modelo. Em `imagem_larga` a área é uma
  faixa de 88,4% × 39,1%; uma tabela alta ou quadrada (como a de metas, com 12 linhas) vira um quadrado
  pequeno no centro. O texto fica embaixo.
- **Layout novo** para `grafico`, `tabela_lateral` e `imagem_larga`:
  - **coluna de texto à esquerda**, de x = 4,4% a ~31%: título, subtítulo (quando existir) e
    conclusões/texto, que quebram linha dentro da coluna;
  - **imagem à direita**, de x = ~34% a 97% (cerca de 63–65% da largura) e de y = 7% a 92% (cerca de 85% da
    altura), encaixada com a proporção original e centralizada nessa área.
- **Exceção:** imagem com proporção (largura/altura) acima de 2,8 mantém a faixa larga atual, porque na coluna
  ficaria pequena de novo.
- **Onde:** ajuste de geometria em tempo de geração, aplicado depois de duplicar o slide modelo e identificar os
  campos por texto alternativo. O molde `.pptx` não é alterado, e o deck original nunca esteve no git. O
  `mapa-slides.json` e a prévia passam a refletir a geometria nova, porque leem as formas do arquivo gerado.
- **Risco:** a coluna estreita pode estourar o texto. O gerador já calcula `ocupacao` e avisa acima de 1,1; o
  limite de avisos e o tamanho da fonte são ajustados com o ensaio gravado do Verdeluz
  (`clientes/_fixtures/verdeluz`) como referência.
- **Testes:** para cada um dos 3 tipos e proporção ≤ 2,8, a imagem fica dentro da área da direita
  (x 34–97%, y 7–92%) e encosta nela pelo lado limitante: ou a largura é ~63% do slide, ou a altura é ~85%
  (uma imagem larga demais para encher a altura é limitada pela largura, e uma alta pela altura). Com
  proporção maior que 2,8 a geometria do molde é mantida. Título, subtítulo e texto ficam dentro da coluna da
  esquerda e não se sobrepõem à imagem.

## Como será implementado

- Branch `fix/ajustes-esteticos`, a partir de `origin/main` (a checkout principal está na branch antiga
  `feat/validacao-cliente`, 172 commits atrás, com alterações não commitadas, e não é tocada).
- Um commit por apontamento.
- Testes: `npm test` em `src/apps/web` (layout, frases, modal) e `pytest scripts/tests`.
- Verificação visual no navegador, no modo ensaiado do Verdeluz, nas larguras mínima e ampla da coluna 3, e
  prévia do `.pptx` gerado para o Verdeluz.
- Se o gerador mudar o que o analista vê na etapa 09, a skill `09-apresentacao-final` e o seu `fluxo.mmd` são
  atualizados no mesmo commit, como o `CLAUDE.md` do projeto pede. O Bloco A não muda skills.

## Fora de escopo

- Marcar ajustes na imagem dentro do modal (continua no card).
- Mudar o molde `.pptx` ou o fluxo de aprovação da apresentação.
- Ajustes de skills.
