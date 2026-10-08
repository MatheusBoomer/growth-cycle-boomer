# Chat da etapa com componentes do AI Elements — Design

**Data:** 2026-10-07
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** uma spec. Quatro melhorias no chat da etapa (`apps/web/components/chat/`),
inspiradas no [AI Elements](https://elements.ai-sdk.dev): processo do agente como
ChainOfThought, anexos como etiquetas, ações nas respostas do agente e card de
perguntas estruturadas com resposta livre.

## 1. Objetivo

Deixar a conversa com o agente mais fácil de acompanhar e de responder, sem
mudar o fluxo das etapas. Hoje:

- o processo do agente é um `<details>` com uma lista de linhas, sem status;
- o anexo entra no texto da mensagem como `[Anexo: caminho]`;
- a resposta do agente não tem ação nenhuma (copiar, citar);
- quando o agente precisa de uma decisão entre alternativas, lista as opções no
  texto e o analista digita a resposta.

**Critério de sucesso:** numa etapa real, o analista acompanha o processo ao
vivo com o passo atual destacado, anexa por botão, arraste ou colagem e vê as
etiquetas, copia e cita respostas do agente, e responde um card com até 4
perguntas (inclusive com resposta própria) num único envio, que chega ao agente
como mensagem e abre o próximo turno.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Componentes adotados | ChainOfThought, Attachments, ações de Message, Question |
| 2 | Perguntas por card | Até 4, com um único "Enviar respostas" |
| 3 | Compositor com card pendente | Continua livre; o card fica pendente até ser respondido ou substituído |
| 4 | Ações da resposta do agente | Copiar e Responder a este trecho (sem Refazer, sem feedback) |
| 5 | Como o agente pergunta | Ferramenta nova no MCP `planejamento`: `fazer_perguntas` |
| 6 | Resposta livre | Toda pergunta tem "Outra resposta", sem o agente precisar pedir |
| 7 | Origem do código visual | Primitivos que já existem em `packages/ui` (`Attachment`, `MessageFooter`, `Bubble`); ChainOfThought e Question copiados do AI Elements e adaptados |
| 8 | Dependências | Nada via `npx shadcn add` do registro do AI Elements, sem pacote `ai`, sem Radix |

### Por que não instalar o AI Elements direto

- O app não usa o AI SDK: o chat é um stream próprio de `EventoConversa`. Os
  componentes do AI Elements só usam *tipos* do pacote `ai` (`ToolUIPart`,
  `ChatStatus`), que viram tipos locais.
- O shadcn do projeto é `base-nova` (Base UI). O AI Elements é escrito sobre
  Radix (`asChild`, `@radix-ui/react-use-controllable-state`); a instalação
  direta quebra ou duplica primitivos.
- `Conversation`, `Message`, `Shimmer` e `Attachments` já têm equivalente em
  `packages/ui` (`MessageScroller`, `Message` + `Bubble`, classe `.shimmer`,
  `Attachment`).

## 3. Card de perguntas

### 3.1 Ferramenta do MCP

Em `packages/mcp-planejamento/src/servidor.ts`, ao lado das outras três:

```ts
servidor.registerTool(
  "fazer_perguntas",
  {
    title: "Fazer perguntas ao analista",
    description:
      "Mostra ao analista um card com até 4 perguntas de alternativas. Use quando precisar de uma decisão entre opções definidas, em vez de listar opções no texto. Toda pergunta já tem um campo de resposta livre. Depois de chamar, encerre a resposta e aguarde: as respostas chegam como nova mensagem.",
    inputSchema: {
      perguntas: z
        .array(
          z.object({
            enunciado: z.string(),
            descricao: z.string().optional(),
            multipla: z.boolean().describe("true = o analista pode marcar várias opções"),
            opcoes: z
              .array(z.object({ rotulo: z.string(), descricao: z.string().optional() }))
              .min(2)
              .max(6),
          }),
        )
        .min(1)
        .max(4),
    },
  },
  async (args) => chamarApp("fazer_perguntas", args),
)
```

`mcp__planejamento` já está em `FERRAMENTAS_PERMITIDAS`; não muda.

### 3.2 Modelo de dados (`packages/core`)

Em `tipos.ts`:

```ts
export interface Pergunta {
  enunciado: string
  descricao: string | null
  multipla: boolean
  opcoes: { rotulo: string; descricao: string | null }[]
}

export interface RespostaPergunta {
  selecionadas: string[] // rótulos das opções
  outra: string | null
}

export interface ConjuntoPerguntas {
  id: string
  etapa: EtapaId
  perguntas: Pergunta[]
  status: "pendente" | "respondida" | "sem_resposta"
  respostas: RespostaPergunta[] | null // mesma ordem de `perguntas`
  criadoEm: string
  respondidoEm: string | null
}
```

- `Estado` ganha `perguntas: ConjuntoPerguntas[]`.
- `EventoConversa` ganha `{ tipo: "card_perguntas"; conjuntoId: string; em: string }`.
- **Sem subir `versao`:** o app não tem migração de estado. `Armazenamento.lerEstado`
  completa `perguntas: []` quando o campo não existe; o estado inicial em
  `maquina-estados.ts` já nasce com `perguntas: []`.
- As transições ficam num módulo puro novo, `perguntas.ts`, no padrão de
  `entregaveis.ts`: `criarConjunto(estado, etapa, perguntas, id, agora)` (marca os
  `pendente` da mesma etapa como `sem_resposta`) e
  `responderConjunto(estado, id, respostas, agora)`.

### 3.3 Fluxo

1. O agente chama `fazer_perguntas`. `ServicoPlanejamento.ferramenta` despacha
   para `ferramentaPerguntar`, que valida (limites da 3.1, textos não vazios,
   rótulos sem repetição na mesma pergunta), cria o conjunto com `mutar`,
   registra `card_perguntas` e responde ao agente: "Perguntas mostradas ao
   analista (id X). Encerre sua resposta agora e aguarde: as respostas chegam
   como nova mensagem."
2. O chat desenha `CardPerguntas` para o evento.
3. O analista responde e clica **Enviar respostas**. O app chama
   `POST /api/prospects/[slug]/perguntas/[id]` com `{ respostas }`.
4. A rota chama `ServicoPlanejamento.responderPerguntas(slug, id, respostas)`,
   que valida, marca `respondida` e chama o `enfileirar` existente com:

   ```
   RESPOSTAS (perguntas X):
   1. Qual cenário usar como meta? → Realista
   2. Quais canais priorizar? → Meta Ads; Google Ads; Outra: "testar TikTok só no Q4"
   ```

   Como a aprovação de entregável, a mensagem aparece no chat como separador
   automático (`mensagem_analista` com `automatica: true`).
5. O evento `estado` atualiza o card para somente leitura.

### 3.4 Instruções ao agente

- `packages/core/src/prompts.ts`: linha nova junto de `propor_entregavel` e
  `solicitar_insumo`: "Para pedir uma decisão entre alternativas, chame
  `fazer_perguntas` (até 4 perguntas) em vez de listar opções no texto. Depois,
  encerre a resposta e espere."
- `.claude/skills/_shared/regras-de-validacao.md`, Regra 7: o mesmo item, e a
  lista de ferramentas do MCP no início da regra passa a incluir
  `fazer_perguntas`.
- `packages/core/src/executor/fake.ts`: o executor falso ganha um caminho que
  chama `fazer_perguntas` pelo mesmo endpoint, para ver o card sem gastar turno
  real (como já faz com `propor_entregavel`).

## 4. Componentes visuais

### 4.1 ChainOfThought (processo do agente)

- Novo `packages/ui/src/components/chain-of-thought.tsx`, adaptado do AI Elements:
  `ChainOfThought`, `ChainOfThoughtHeader`, `ChainOfThoughtContent`,
  `ChainOfThoughtStep` (`status: "complete" | "active" | "pending"`, `icon`,
  `label`, `description`). Usa o `Collapsible` do Base UI; aberto/fechado
  controlado com `useState` + props `open`/`defaultOpen`/`onOpenChange`.
  Sem `ChainOfThoughtSearchResults` nem `ChainOfThoughtImage` (não há uso).
- `ListaDeProcesso` em `chat-etapa.tsx` passa a usar o ChainOfThought. O
  agrupamento de `lib/passos.ts` não muda.
- Cada `atividade` vira um passo com ícone escolhido pelo `nome` do evento:
  ler (Read, Glob, Grep), escrever (Write, Edit, MultiEdit), script (Bash),
  web (WebSearch, WebFetch, firecrawl), card (mcp planejamento), subagente
  (Agent, Task), e um ícone genérico para o resto. O mapeamento é uma função
  pura em `lib/passos.ts`.
- Falas intermediárias (`texto_agente` de processo) viram passos de texto, com
  o markdown no `description`.
- Status: no bloco ao vivo, o último passo é `active` e os anteriores
  `complete`; em blocos encerrados, todos `complete`.
- Cabeçalho: "Processo · N passos" (como hoje). O bloco ao vivo abre expandido;
  ao terminar o turno, o bloco volta à lista recolhido.

### 4.2 Anexos

Usa o `Attachment` que já está em `packages/ui` (estados `uploading`, `error`,
`done`).

- **Compositor:** estado próprio `anexos: { id, nome, caminho | null, estado, erro | null }[]`,
  fora do texto. Etiquetas numa `AttachmentGroup` acima do `Textarea`: spinner
  durante o upload, ✕ para remover, borda de erro com a mensagem no `title`.
  Entradas: botão de clipe (como hoje), arrastar sobre a área do compositor
  (realce enquanto arrasta) e colar arquivo no `Textarea`. O upload continua
  imediato, pela rota de anexos existente.
- **Envio:** os caminhos vão ao agente num rodapé `[Anexos]` com uma linha
  `- <caminho>` por anexo, montado no mesmo lugar que o rodapé de menções
  (`textoParaAgente`). Anexos com erro não vão. Enviar fica desabilitado
  enquanto houver upload em andamento. Mensagem só com anexo (texto vazio) é
  permitida.
- **Mensagem enviada:** `semRodape` tira também o rodapé `[Anexos]`; uma função
  nova extrai os caminhos e o balão do analista mostra as etiquetas embaixo do
  texto. Clicar abre o arquivo na lateral (`abrirArquivo`).
- Remover uma etiqueta não apaga o arquivo do disco.

### 4.3 Ações da resposta do agente

- Em `item-conversa.tsx`, todo `texto_agente` que é resposta (não processo)
  ganha um `MessageFooter` com dois botões de ícone com tooltip:
  - **Copiar:** copia o markdown original; o ícone vira ✓ por 2 s.
  - **Responder a este trecho:** se houver texto selecionado dentro dessa
    resposta, cita a seleção; senão, o primeiro parágrafo. Insere `> …` no
    compositor seguido de linha em branco, pelo `registrarCompositor` existente.
- As ações aparecem ao passar o mouse e ficam sempre visíveis na última
  resposta da conversa.

### 4.4 Question

- Novo `packages/ui/src/components/question.tsx`, adaptado do AI Elements:
  `Question`, `QuestionPrompt`, `QuestionDescription`, `QuestionOptions`,
  `QuestionOption`, `QuestionInput`, sem dependência do pacote `ai`. Um
  `Question` representa uma pergunta; o card agrupa vários.
- Novo `apps/web/components/cards/card-perguntas.tsx`: recebe o
  `ConjuntoPerguntas`, numera as perguntas, controla as respostas e tem um
  único botão **Enviar respostas**, desabilitado até toda pergunta ter ao menos
  uma opção marcada ou texto em "Outra".
  - Opções como botões alternáveis (comportamento de rádio quando
    `multipla: false`, de caixa de seleção quando `true`).
  - "Outra…" é um botão que revela um `Textarea` curto. Com `multipla: false`,
    preencher "Outra" desmarca a opção escolhida e vice-versa.
  - **Respondida:** opções escolhidas marcadas, as demais esmaecidas, "Outra"
    em itálico; sem botão de envio.
  - **Sem resposta:** card esmaecido com o selo "Substituída por uma pergunta
    mais recente".
  - **Etapa concluída ou desatualizada:** card pendente fica somente leitura,
    com o mesmo motivo que o compositor mostra.
- `item-conversa.tsx` ganha o `case "card_perguntas"`.

## 5. Erros e casos-limite

| Situação | Comportamento |
|---|---|
| `fazer_perguntas` inválida (0 ou mais de 4 perguntas, menos de 2 ou mais de 6 opções, texto vazio, rótulo repetido) | `ErroEntrada` volta ao agente com o que corrigir, como em `propor_entregavel` |
| Resposta para conjunto inexistente | 404 na rota; toast no card |
| Resposta para conjunto que não está `pendente` (outra aba, substituído) | 409 na rota; toast; o card se atualiza pelo evento `estado` |
| Resposta incompleta ou com rótulo que não existe | 400 na rota; toast |
| Agente ocupado (nesta ou em outra etapa) | `enfileirar` segura a mensagem até o turno acabar, como hoje |
| Upload falha | Etiqueta em erro, ignorada no envio; Enviar continua habilitado |
| Enviar durante upload | Botão desabilitado até terminar |
| Estado antigo sem `perguntas` | `lerEstado` completa com `[]` |

Mensagens geradas para o agente (`RESPOSTAS…`, rodapé `[Anexos]`) não usam
travessão (teste `sem-travessao`).

## 6. Testes

**`packages/core/test/`**
- `perguntas.test.ts` (novo): `criarConjunto` cria pendente e marca pendentes
  anteriores da mesma etapa como `sem_resposta` (e não os de outra etapa);
  `responderConjunto` grava respostas e recusa conjunto não pendente.
- `servico-planejamento.test.ts`: `fazer_perguntas` cria conjunto e evento e
  valida limites; `responderPerguntas` valida, formata a mensagem e enfileira.
- `armazenamento.test.ts`: estado sem `perguntas` é lido com `[]`.

**`apps/web/lib/`**
- `mencoes.test.ts`: rodapé `[Anexos]` montado, removido por `semRodape` e
  extraído; convivência com o rodapé de menções.
- `passos.test.ts`: ícone por nome de ferramenta e status dos passos (ao vivo e
  encerrado).

**Checagem manual no app** (executor falso e uma etapa real): processo ao vivo
com passo ativo; anexar por botão, arraste e colagem, inclusive com erro;
copiar e citar resposta (com e sem seleção); card de perguntas com escolha
única, múltipla e "Outra"; card substituído; card respondido após recarregar a
página.

## 7. Fora do escopo

- Componentes do AI Elements avaliados e não adotados agora: Tool,
  Confirmation, Checkpoint, Queue/Plan, PromptInput, Context, Reasoning,
  Suggestion, CodeBlock, Sources/InlineCitation, e os de voz, de fluxo
  (canvas) e de desenvolvimento.
- Editar respostas de um card já enviado.
- Apagar do disco o anexo removido antes do envio.
- Mudar como o agente é executado (`claude` CLI) ou o formato do stream.
