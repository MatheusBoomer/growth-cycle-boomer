# Modo dev de comentários — Design

**Data:** 2026-10-13
**Status:** aprovado em brainstorming, aguardando revisão do documento
**Escopo:** uma spec. Ferramenta só de desenvolvimento em `src/apps/web` para o
desenvolvedor apontar ajustes de interface direto na tela; o Claude Code lê os
comentários depois, executa os ajustes e apaga os resolvidos.

## 1. Objetivo

Hoje, para pedir um ajuste visual ao agente, o desenvolvedor precisa descrever
em texto onde fica cada coisa. Com o modo dev ligado, ele aponta um bloco da
página, escreve o ajuste e salva. O comentário guarda contexto suficiente
(página, componente, cadeia de componentes, seletor, texto visível, recorte da
tela) para o agente chegar ao código sem perguntar.

**Usuário:** só o desenvolvedor. Ninguém do produto final vê isso.

**Critérios de sucesso:**

- Com `next dev`, o desenvolvedor liga o modo dev, destaca um bloco, comenta e
  vê um pino numerado no lugar.
- O comentário salvo traz página, componente e cadeia acima dele, texto
  visível e recorte PNG.
- Em `next build`, nada do modo dev aparece: o código não entra no bundle e a
  rota de API responde 404.
- `npm run dev:comentarios` lista os comentários em texto e apaga todos ou só
  os números indicados.

**Fora do escopo:** uso no site publicado, banco de dados, vários usuários,
histórico de comentários resolvidos.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Dev × produção | `process.env.NODE_ENV === "development"` (o próprio Next define: `next dev` → development, `next build` → production). O projeto não tinha separação antes |
| 2 | Pasta de dados | `.dev-comentarios/` na **raiz do repositório** (onde o Claude Code roda), no `.gitignore` |
| 3 | Nome no código | `modo-dev` / `/api/dev/comentarios`. O app já tem "comentários" como conceito de negócio (`ServicoComentarios`, comentários em entregáveis); os nomes não se misturam |
| 4 | Nome do componente | Fiber do React 19 (`__reactFiber$…`), subindo por `return` |
| 5 | Componentes ignorados | Internos do Next/React, primitivos Radix/Base UI e os genéricos de `packages/ui` |
| 6 | Recorte | `modern-screenshot` (`domToPng`), import dinâmico só dentro do modo dev |
| 7 | Script | Node puro (v26 executa TypeScript); módulos do `modo-dev` importam uns aos outros com extensão `.ts` explícita |
| 8 | Testes de DOM | `jsdom` como dependência de desenvolvimento, só nos testes do seletor |

## 3. Experiência

### Ligar e desligar

- Botão "Dev" fixo no canto inferior esquerdo, ou atalho Ctrl/⌘ + Shift + D.
- Estado lembrado no `localStorage` (chave `modo-dev:ativo`), com leitura e
  escrita em `try/catch`.
- O botão mostra quantos comentários abertos existem na página atual.

### Modo ativo

- O elemento sob o cursor ganha contorno e uma etiqueta com a cadeia de
  componentes (até 3 nomes, do mais interno para fora) e as dimensões
  (`largura × altura`).
- Níveis: ↑ sobe o destaque para o elemento pai (até o filho direto do
  `body`) e ↓ volta ao filho de onde subiu. O nível vale enquanto o cursor
  fica sobre o mesmo elemento; o clique fixa o elemento destacado, não o que
  está sob o cursor. As setas não rolam a página com o modo ativo e a caixa
  fechada.
- Cliques, `pointerdown`/`mousedown` e envios de formulário do site ficam
  bloqueados: listeners em fase de captura no `document` com
  `preventDefault` + `stopPropagation`, ignorando eventos que nascem dentro
  da própria camada do modo dev.
- Esc sai do modo (quando não há caixa aberta; com caixa aberta, Esc fecha a
  caixa primeiro).

### Comentar

- O clique fixa o elemento destacado, no nível escolhido (o contorno fica parado) e abre uma caixa ao lado,
  posicionada para caber na janela.
- Ctrl/⌘ + Enter salva; Esc cancela.
- Ao salvar: gera o recorte, envia ao servidor e mostra o pino. Em caso de
  falha, toast de erro (`sonner`, já presente no layout) e o texto permanece
  na caixa.

### Pinos

- Círculo numerado no canto superior direito do elemento, reencontrado pelo
  seletor (`document.querySelector`). Posições recalculadas em `scroll`,
  `resize` e por `MutationObserver` (com `requestAnimationFrame` para não
  recalcular mais de uma vez por quadro).
- Clicar no pino abre a caixa em modo edição.
- Se o seletor não encontra o elemento, o comentário aparece só na lista,
  marcado "elemento não encontrado". Isso acontece, por exemplo, em abas
  internas da página do prospect que não estão abertas.

### Lista

- Painel com os comentários da página atual: número, componente, texto do
  comentário, editar e apagar.
- Filtro "todas as páginas", que mostra também a página de cada comentário.

### Camada visual

- Toda a camada vive num container próprio (`<div data-modo-dev>`),
  `position: fixed`, `inset: 0`, `z-index: 2147483647`,
  `pointer-events: none`; só botão, caixa, pinos e lista têm
  `pointer-events: auto`. Nada altera o layout do site.
- O recorte exclui a própria camada (filtro do `domToPng`).

## 4. Dados

### Pasta

```
<raiz-do-repositório>/.dev-comentarios/
  comentarios.json
  capturas/<id>.png
```

A rota acha a raiz pelo mesmo critério de `lib/servidor.ts`:
`process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")`,
mas sem importar `servidor()` (que sobe todos os serviços do planejamento). O
script acha a raiz a partir da própria localização
(`import.meta.dirname` + `../../../..`).

### `comentarios.json`

```ts
interface ArquivoComentarios {
  versao: 1
  proximoNumero: number // começa em 1; só volta a 1 quando a lista é limpa por inteiro
  comentarios: ComentarioDev[]
}

interface ComentarioDev {
  id: string // crypto.randomUUID()
  numero: number
  criadoEm: string // ISO 8601
  editadoEm: string | null
  pagina: string // location.pathname
  componente: string | null // cadeia[0] ou null
  cadeia: string[] // até 8 nomes, do mais interno para o externo
  seletor: string
  tag: string // tagName em minúsculas
  texto: string // texto visível, espaços colapsados, até 300 caracteres
  caixa: { x: number; y: number; largura: number; altura: number; larguraTela: number; alturaTela: number }
  captura: string | null // caminho relativo à pasta: "capturas/<id>.png"
  comentario: string // 1 a 2000 caracteres, após trim
}
```

### Seletor estável (`seletorDoElemento`)

Sobe do elemento até o `body`, no máximo 8 níveis. Em cada nível:

1. se tem `id` válido e único no documento → `#id` e para de subir;
2. senão, se tem `data-slot` → `tag[data-slot="…"]`;
3. senão, se tem `aria-label` → `tag[aria-label="…"]`;
4. senão → `tag:nth-of-type(n)`.

Os níveis são unidos por `>`. Valores entre aspas passam por `CSS.escape`.
Quando o atributo do passo 2 ou 3 não é único entre os irmãos, acrescenta
`:nth-of-type(n)`.

### Cadeia de componentes (`cadeiaDeComponentes`)

- Entrada: o nó DOM. Procura a propriedade que começa com `__reactFiber$`.
- Sobe por `fiber.return`; para cada fiber cujo `type` é função ou objeto
  (`memo`/`forwardRef`), usa `type.displayName || type.name` (ou
  `type.render`/`type.type` nos embrulhos).
- Ignora:
  - internos do Next/React: nomes que começam com `_` ou terminam em
    `Boundary`/`Provider`/`Router`/`Context`, mais `Suspense`, `Fragment`,
    `InnerLayoutRouter`, `OuterLayoutRouter`, `RenderFromTemplateContext`,
    `ScrollAndFocusHandler`, `LoadingBoundary`, `HotReload`, `AppRouter`,
    `ServerRoot`, `Root`;
  - primitivos: nomes que começam com `Primitive` ou `Radix`, mais `Slot`,
    `Slottable`, `Presence`, `Portal`, `FocusScope`, `DismissableLayer`;
  - genéricos de `packages/ui`: `Button`, `Card*`, `Badge`, `Dialog*`,
    `AlertDialog*`, `DropdownMenu*`, `Input`, `Textarea`, `Label`, `Field*`,
    `Separator`, `Skeleton`, `Spinner`, `Progress`, `Empty*`, `Alert*`,
    `Resizable*`, `Toaster`.
- Remove repetições consecutivas, para em 8 nomes.
- Sem fiber ou sem nomes → `[]`.
- A função recebe o nó e não depende do navegador: os testes usam objetos
  falsos com a propriedade `__reactFiber$teste`.

### Recorte

- `import("modern-screenshot")` só ao salvar com o modo ligado.
- `domToPng(elemento, { scale })` com `scale = min(1, 1600 / maior lado)`.
- Falha ou elemento vazio → `captura: null` e o comentário é salvo mesmo
  assim.

## 5. Arquitetura

Módulos pequenos, com uma responsabilidade cada:

1. **`lib/modo-dev/nucleo.ts`** — puro. Tipos, `validarNovo`/`validarEdicao`
   (lançam `ErroValidacaoDev`, erro próprio do módulo, com a mensagem),
   `cadeiaDeComponentes`,
   `seletorDoElemento`, `textoVisivel`, `resumoEmTexto`.
2. **`lib/modo-dev/armazenamento.ts`** — Node (`fs/promises`). Classe ou
   funções com a pasta injetada: `listar(pagina?)`, `criar(entrada, png?)`,
   `editar(id, comentario)`, `apagar(id)` (remove o PNG junto),
   `limpar(numeros?)`. Escrita atômica (`comentarios.json.tmp` + `rename`).
   JSON ausente ou corrompido → lista vazia com `proximoNumero: 1`. `limpar()`
   sem números zera a lista, apaga `capturas/` e volta `proximoNumero` a 1;
   com números, apaga só esses e mantém o contador.
3. **Rotas** — `app/api/dev/comentarios/route.ts` (GET `?pagina=` ou todos;
   POST) e `app/api/dev/comentarios/[id]/route.ts` (PATCH, DELETE).
   Primeira linha de cada handler: `NODE_ENV !== "development"` → 404.
   `ErroValidacaoDev` vira 400 `{ erro, codigo: "entrada_invalida" }`; os
   demais erros seguem `respostaDeErro` de `lib/http.ts`. Recusa com 400 e mensagem:
   comentário vazio ou acima de 2000 caracteres, PNG acima de 5 MB
   (decodificado), PNG que não começa com a assinatura PNG, campos fora do
   formato. Herdam a checagem de origem local de `proxy.ts`.
4. **`components/modo-dev/modo-dev.tsx`** — o único componente client do modo:
   botão, atalho, overlay, caixa, pinos e lista.
   **`components/modo-dev/carregador.tsx`** — `"use client"`, faz
   `dynamic(() => import("./modo-dev"), { ssr: false })`. O `layout.tsx`
   renderiza `{process.env.NODE_ENV === "development" && <CarregadorModoDev />}`.
   Em produção a condição vira `false` no build e o import some.
5. **`scripts/dev-comentarios.ts`** (em `src/apps/web/`) — exposto como
   `dev:comentarios` em `src/package.json`
   (`node apps/web/scripts/dev-comentarios.ts`):
   - sem argumento: imprime `resumoEmTexto`, com o caminho absoluto de cada
     recorte;
   - `--limpar`: apaga tudo;
   - `--limpar 3,5`: apaga os números indicados e seus recortes, e avisa os
     números que não existiam.
6. **`.claude/skills/dev-comentarios/SKILL.md`** (raiz) — roteiro do agente
   (seção 7).

Ajustes de apoio:

- `src/apps/web/tsconfig.json`: `allowImportingTsExtensions: true` (permitido
  porque o projeto já usa `noEmit`). Os arquivos do `modo-dev` importam uns
  aos outros com `.ts` explícito. O núcleo não importa `@/` nem
  `@workspace/*`, para o script rodar no Node puro.
- `.gitignore` (raiz): `/.dev-comentarios/`.
- `CLAUDE.md` (raiz): uma linha dizendo que `dev-comentarios` é ferramenta de
  desenvolvimento da interface, fora da sequência 01→09.
- Dependências de desenvolvimento em `apps/web`: `modern-screenshot`, `jsdom`,
  `vitest` (já usado pelo `npm test` do web via hoisting; passa a ser
  declarado).

### Formato do resumo (`resumoEmTexto`)

```
3 comentários abertos em .dev-comentarios/

## /prospects/acme
#1 · PainelEtapa ← AreaDeTrabalho ← ProspectPage
   seletor: main > div[data-slot="card"]:nth-of-type(2)
   texto: "Diagnóstico de performance Aguardando insumos…"
   recorte: /…/.dev-comentarios/capturas/<id>.png
   pedido: Aumentar o espaço entre o título e a lista.
```

Agrupado por página, em ordem de número. Sem comentários → "Nenhum comentário
aberto."

## 6. Erros

| Situação | Comportamento |
|---|---|
| Falha ao salvar/editar/apagar na interface | Toast de erro; caixa continua aberta com o texto |
| Recorte falha | Salva com `captura: null` |
| `comentarios.json` ausente ou corrompido | Tratado como lista vazia; a próxima escrita recria o arquivo |
| Elemento não reencontrado | Sem pino; na lista, marcado "elemento não encontrado" |
| Rota fora de desenvolvimento | 404 |
| Entrada inválida | 400 com `{ erro, codigo: "entrada_invalida" }` |
| `id` inexistente em PATCH/DELETE | 404 com `{ erro }` |

## 7. Roteiro da skill `dev-comentarios`

1. **Ler:** rodar `npm run dev:comentarios` em `src/` e abrir cada PNG para
   ver o que o desenvolvedor viu.
2. **Localizar:** o primeiro nome da cadeia é o componente mais próximo; achar
   o arquivo com `grep` por `function <Nome>` em `src/apps/web` e
   `src/packages/ui`; confirmar com o resto da cadeia, o seletor e o texto
   visível.
3. **Planejar:** agrupar por página e resumir o que muda em cada comentário.
   Perguntar antes só se o pedido for ambíguo ou mudar regra de negócio;
   ajustes visuais e de texto seguem direto.
4. **Executar e verificar:** seguir os padrões do projeto; rodar
   `npm run typecheck`, `npm run lint` e `npm test` em `src/`; fazer um commit
   por grupo de ajustes.
5. **Limpar:** logo depois de verificar e commitar, apagar **sem perguntar**
   os resolvidos (`npm run dev:comentarios -- --limpar 3,5`). Manter só os
   pendentes e dizer quais ficaram e por quê, para o desenvolvedor recarregar
   a página e conferir.

A skill deixa claro que não faz parte das etapas 01→09 do planejamento.

## 8. Testes

- **Unidade (vitest):**
  - `cadeiaDeComponentes`: fibers falsos com nomes internos e genéricos
    ignorados, embrulhos `memo`/`forwardRef`, repetições consecutivas,
    limite de 8, nó sem fiber → `[]`;
  - `seletorDoElemento` (ambiente `jsdom` só nesse arquivo):
    prioridade id → `data-slot` → `aria-label` → `nth-of-type`, limite de 8
    níveis, e o seletor reencontra o mesmo elemento;
  - validação: vazio, 2001 caracteres, campos faltando, PNG grande ou sem
    assinatura;
  - `resumoEmTexto`: agrupamento por página, lista vazia.
- **Armazenamento** em pasta temporária (`fs.mkdtemp`): numeração sequencial,
  números não reaproveitados após apagar, editar com `editadoEm`, apagar
  remove o PNG, `limpar()` volta a 1, `limpar([3,5])` apaga só esses, JSON
  corrompido → lista vazia.
- **Rota:** com `NODE_ENV=production` (`vi.stubEnv`), GET/POST/PATCH/DELETE
  respondem 404.
- **Build de produção:** `npm run build` em `src/` e busca no
  `.next/static` por uma marca única do componente (ex.: a string
  `data-modo-dev`), que não pode aparecer.
- **Manual:** com `npm run dev`, comentar dois blocos, recarregar, ver os
  pinos, rodar `npm run dev:comentarios` e conferir o resumo.
