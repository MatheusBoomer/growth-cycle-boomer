# Fundo de ondas ASCII animadas

Data: 2026-11-09

## Objetivo

Dar à home do Growth Cycle, ao login e à tela do projeto um fundo animado de ondas em ASCII, inspirado em um vídeo de referência (listras verticais que ondulam, com miolo luminoso). O efeito respeita o fundo claro do app, usa o azul da Boomer com detalhes em laranja e some aos poucos de cima para baixo, de 100% a 0%, para ficar sutil e tecnológico.

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Produção do efeito | Canvas 2D gerado ao vivo. Não usa o .mp4 de referência, só imita o movimento. |
| Telas | `/`, `/login` e `/prospects/*`. Admin e demais telas mantêm o fundo atual. |
| Tema escuro | Versão própria: caracteres luminosos (azul vivo com toque de ciano, laranja mais quente) sobre o fundo escuro. |
| Degradê | 100% no topo da janela, 0% na base, sempre relativo à viewport. |
| Azul da Boomer | `#3987e5` (`rgb(57 135 229)`, já usado no `FundoBoomer`). Confirmar com o time se a marca usa outro. |

## Estrutura

Três unidades, cada uma com um propósito.

### `src/apps/web/lib/ondas-ascii.ts` (função pura)

- Entrada: coluna, linha, tempo em segundos e dimensões da grade.
- Saída: `{ intensidade: number (0–1), caractere: string, laranja: boolean }`.
- Rampa de caracteres: ` . : - = + * # @` (da menor para a maior intensidade).
- O campo é a soma de duas ou três senoides lentas. A fase de cada coluna é deslocada pela posição, o que dá as listras verticais que ondulam. Um fator radial concentra a intensidade no miolo.
- O laranja é decidido por um segundo ruído lento e fica em cerca de 10–15% das células.
- Exporta também as paletas por tema (`claro`, `escuro`) e a função que agrupa as células visíveis em faixas de opacidade.
- Não conhece React nem canvas.

### `src/apps/web/components/marca/fundo-ondas-ascii.tsx` (cliente)

- Renderiza um `<canvas>` fixo (`fixed inset-0 -z-10`), `aria-hidden` e `pointer-events-none`.
- Aplica `mask-image: linear-gradient(to bottom, #000, transparent)` para o degradê. O fade custa zero de CPU.
- Lê o tema pelo `ThemeProvider` já existente e troca a paleta sem recarregar.
- Cuida do loop de animação, do redimensionamento (`ResizeObserver`) e do `devicePixelRatio`.
- Fonte: Geist Mono, que o app já carrega (`--font-mono`).

### `FundoBoomer` (seletor por rota)

- `usePathname` decide qual fundo mostrar. Em `/`, `/login` e `/prospects/*`, as ondas substituem os brilhos difusos e a grade de pontos. Nas demais rotas o fundo atual continua igual.
- A regra de rotas fica numa função pura (`rotaUsaOndas(caminho)`), testável sem DOM.

## Visual

- **Movimento:** colunas verticais de caracteres ondulando devagar, com miolo mais denso, na linha da referência.
- **Tema claro:** azul dominante, laranja `#eb610a` como detalhe. Opacidade máxima baixa (alvo em torno de 0,35), para o texto das telas continuar legível.
- **Tema escuro:** azul vivo com toque de ciano e laranja mais quente, com opacidade maior.
- **Tela do projeto:** os painéis de vidro (`vidro`, `backdrop-blur`) ficam por cima das ondas, sem brigar com texto ou gráfico.

## Desempenho e robustez

- Células de cerca de 10×18 px no desktop e maiores no celular, para limitar o número de células.
- Teto de ~30 fps.
- Desenho em lotes por faixa de opacidade (poucos `fillStyle` por quadro). Linhas que o degradê já deixa invisíveis não são desenhadas.
- O loop pausa quando a aba fica oculta (`visibilitychange`).
- Com `prefers-reduced-motion: reduce` desenha um único quadro estático e não anima.
- Sem `getContext("2d")` o componente não renderiza nada, e o fundo base continua valendo.

## Testes e verificação

- **Vitest, função pura:**
  - o resultado é determinístico para a mesma entrada;
  - a intensidade fica sempre em [0, 1];
  - a rampa de caracteres é monotônica;
  - a paleta muda entre claro e escuro;
  - a fração de células laranja fica dentro do previsto.
- **Vitest, rotas:** `rotaUsaOndas` é verdadeira para `/`, `/login` e `/prospects/x`, e falsa para `/admin` e `/admin/skills`.
- **Componente:** não lança exceção quando o canvas não existe (jsdom).
- **Visual:** subir o app e capturar home, login e projeto nos dois temas antes de dar como pronto.
- Rodar `npm test` em `src/apps/web`.

## Fora do escopo

- Converter ou tocar o vídeo de referência.
- WebGL e shaders.
- Interação com o mouse ou com o scroll.
- Mudar o fundo das telas de admin.
- Alterar tokens de tema em `packages/ui` (a paleta das ondas fica no módulo próprio).
