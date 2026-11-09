# Fundo de ondas ASCII animadas

Data: 2026-11-09 (revisado no mesmo dia: direção horizontal e app inteiro)

## Objetivo

Dar ao app inteiro do Growth Cycle um fundo animado de ondas em ASCII, inspirado em um vídeo de referência (listras verticais que ondulam, com miolo luminoso). O efeito respeita o fundo claro do app, usa o azul da Boomer com detalhes em laranja, nasce na esquerda e avança para a direita, e some aos poucos, de 100% na esquerda a 0% na direita, para ficar sutil e tecnológico.

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Produção do efeito | Canvas 2D gerado ao vivo. Não usa o .mp4 de referência, só imita o movimento. |
| Telas | App inteiro: todas as rotas, inclusive admin. É o único fundo da marca; os brilhos difusos e a grade de pontos deixam de existir. |
| Movimento | As listras viajam da esquerda para a direita. A massa de ondas fica concentrada à esquerda e cobre a altura toda da janela. |
| Tema escuro | Versão própria: caracteres luminosos (azul vivo com toque de ciano, laranja mais quente) sobre o fundo escuro. |
| Degradê | 100% na borda esquerda da janela, 0% na direita, sempre relativo à viewport. |
| Azul da Boomer | `#3987e5` (`rgb(57 135 229)`, já usado no antigo `FundoBoomer`). Confirmar com o time se a marca usa outro. |

## Estrutura

Duas unidades, cada uma com um propósito.

### `src/apps/web/lib/ondas-ascii.ts` (função pura)

- Entrada: coluna, linha, tempo em segundos e dimensões da grade.
- Saída: `{ intensidade: number (0–1), caractere: string, laranja: boolean }`.
- Rampa de caracteres: ` . : - = + * # @` (da menor para a maior intensidade).
- O campo é a soma de senoides lentas. A fase de cada listra anda com o tempo no sentido +x (`coluna * k - t * v`), o que faz as ondas viajarem para a direita. Todos os termos que dependem de `x` e `t` avançam para a direita; nenhum anda para a esquerda.
- Um envelope concentra a intensidade no lado esquerdo e cobre a altura toda da janela (sem miolo no centro).
- O laranja é decidido por um segundo ruído lento e fica em cerca de 10–15% das células.
- Exporta também as paletas por tema (`claro`, `escuro`), `fatorDeDegrade(posicao, total)` (1 no início, 0 no fim) e `dimensionarGrade`.
- Não conhece React nem canvas.

### `src/apps/web/components/marca/fundo-ondas-ascii.tsx` (cliente)

- Renderiza um `<canvas>` fixo (`fixed inset-0 -z-10`), `aria-hidden` e `pointer-events-none`.
- Aplica `mask-image: linear-gradient(to right, #000, transparent)` para o degradê. O fade custa zero de CPU.
- Lê o tema pelo `ThemeProvider` já existente e troca a paleta sem recarregar.
- Cuida do loop de animação, do redimensionamento (o canvas ocupa a janela toda: mede `window.innerWidth/innerHeight` e ouve `resize`) e do `devicePixelRatio`.
- Fonte: Geist Mono, que o app já carrega (`--font-mono`).
- O `layout.tsx` renderiza o componente direto, em todas as rotas. Não há seleção por rota.

## Visual

- **Movimento:** colunas verticais de caracteres ondulando e avançando para a direita, com a massa mais densa à esquerda.
- **Tema claro:** azul dominante, laranja `#eb610a` como detalhe. Opacidade máxima de 0,20 (era 0,35; reduzida duas vezes depois de ver o resultado), para o texto das telas continuar legível.
- **Tema escuro:** azul vivo com toque de ciano e laranja mais quente, com opacidade máxima de 0,4 e neon leve: um halo (`shadowBlur` de 6 px) na cor do próprio caractere, só nas faixas mais intensas (a partir da 6ª de 8). O tema claro não tem brilho.
- **Painéis de vidro** (`vidro`, `backdrop-blur`) ficam por cima das ondas, sem brigar com texto ou gráfico.

## Desempenho e robustez

- Células de cerca de 10×18 px no desktop e maiores no celular, para limitar o número de células.
- Teto de ~30 fps.
- Desenho em lotes por faixa de opacidade (poucos `fillStyle` por quadro). Colunas que o degradê já deixa invisíveis não são desenhadas.
- O halo neon só vale para as faixas mais fortes: o desfoque por caractere é o custo mais alto do quadro. Se pesar em máquinas fracas, aumentar `FAIXA_BRILHO` (menos caracteres com halo) ou zerar `brilho` na paleta escura resolve.
- O loop pausa quando a aba fica oculta (`visibilitychange`).
- Com `prefers-reduced-motion: reduce` desenha um único quadro estático e não anima.
- Sem `getContext("2d")` o componente não renderiza nada.

## Testes e verificação

- **Vitest, função pura:**
  - o resultado é determinístico para a mesma entrada;
  - a intensidade fica sempre em [0, 1];
  - a rampa de caracteres é monotônica;
  - a paleta muda entre claro e escuro;
  - a fração de células laranja fica dentro do previsto;
  - o padrão avança para a direita com o tempo (correlação entre quadros);
  - a esquerda é mais intensa que a direita, e a base não fica vazia em relação ao topo.
- **Componente:** não lança exceção sem canvas; a máscara é horizontal; nada é desenhado nas colunas que o degradê já escondeu.
- **Visual:** subir o app e capturar as telas nos dois temas antes de dar como pronto.
- Rodar `npm test` em `src/apps/web`.

## Fora do escopo

- Converter ou tocar o vídeo de referência.
- WebGL e shaders.
- Interação com o mouse ou com o scroll.
- Animação de entrada (varredura única ao carregar). "Nascer na esquerda" é a massa concentrada à esquerda com as ondas avançando.
- Alterar tokens de tema em `packages/ui`. Os tokens `--orb-*` e `--pontos*` do fundo antigo ficam sem uso e podem ser removidos num passo à parte.

## Histórico de revisões

- 2026-11-09, versão inicial: ondas em home, login e projeto, degradê de cima para baixo.
- 2026-11-09, revisão pedida após ver o resultado: movimento e degradê da esquerda para a direita, e fundo único em todo o app.
