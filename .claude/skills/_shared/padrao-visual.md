# Padrão visual obrigatório dos gráficos

Referenciado por todas as skills que geram gráfico: `03-diagnostico-performance`,
`04-unidade-economica`, `06-metas-e-cenarios`, `07-midia-paga`. Não copie este
conteúdo para dentro de uma skill — referencie este arquivo.

## Regras de construção

1. Gráfico de **linha**, salvo indicação em contrário (barras para Curva ABC e
   alocação de verba por plataforma; linhas finas e contínuas nos demais).
2. **Marcadores circulares** em cada ponto de dado.
3. **Cores simples e contrastantes** — ex.: azul para a série principal, laranja
   para a série comparativa. Terceira série (quando houver), verde.
4. Eixo horizontal representa **meses do ano**, em **letras maiúsculas,
   inclinadas a ~45°**.
5. Eixo vertical identifica claramente o KPI plotado, com unidade (R$, %, x).
6. **Legenda no canto superior esquerdo.**
7. **Grid horizontal leve** para facilitar leitura.
8. Os dados plotados devem corresponder exatamente aos dados da planilha de
   origem — nunca arredondar de forma a mascarar uma diferença real.

## Rótulos de valor nos pontos (padrão)

Todo gráfico traz o **valor escrito em cada ponto** (ou no topo de cada barra),
para o analista e o cliente lerem o número sem consultar o eixo.

- **Formato:** percentuais com o mesmo número de casas do eixo (`3,2%`), razões
  com `x` (`4,1x`), contagens com separador de milhar (`12.450`).
- **Valores monetários sempre abreviados:** `R$ 850`, `R$ 12,4 mil`,
  `R$ 1,2 mi`, `R$ 3,5 bi`. Uma casa decimal, vírgula decimal, sem zeros
  inúteis (`R$ 2 mi`, não `R$ 2,0 mi`). O eixo vertical segue a mesma
  abreviação.
- **Sem sobreposição:** o rótulo nunca cobre outro rótulo, a linha da série, uma
  linha de referência ou a legenda. Em série única, coloque o rótulo acima do
  ponto (abaixo nos vales). Com duas ou mais séries próximas, rótulos de séries
  diferentes ficam em lados opostos (a série de cima acima do ponto, a de baixo
  abaixo). Quando dois rótulos da mesma série ainda colidirem, alterne acima e
  abaixo ou afaste o rótulo com `annotate` (`xytext` em pontos). Se mesmo assim
  não couber, a figura é que cresce, com a fonte na mesma proporção.
- **Cor e tamanho:** o rótulo usa a cor da própria série e o mesmo corpo de
  fonte do restante do gráfico, sem caixa de fundo.
- **Conferência:** depois de salvar o PNG, abra-o com Read e confira se há
  rótulo cortado, sobreposto ou fora da figura antes de propor. Corrija na hora.
- A regra 8 vale também para os rótulos: o texto é o valor real, arredondado só
  no que a abreviação exige.

## Tamanho da figura e da fonte (gráficos e tabelas em PNG)

A fonte só fica legível se o tamanho da figura for fixado junto: uma figura
grande, encolhida para caber no slide, reduz o texto na mesma proporção.

- **Referência:** figura de **7 polegadas de largura**, salva a **300 dpi**,
  com **todo o texto em 8 pt** (título, rótulos dos eixos, valores dos eixos,
  legenda, células de tabela).
- **Proporção fixa:** se a figura precisar ser maior, a fonte cresce na mesma
  razão — `fonte = 8 × (largura em polegadas ÷ 7)`. Ex.: 10,5 pol → 12 pt;
  14 pol → 16 pt. Nunca aumentar a figura sem aumentar a fonte.
- **Altura:** livre, conforme o conteúdo (gráfico de linha padrão: 3,8 pol;
  tabela: 0,24 pol por linha + 0,45 pol de título, na largura de referência).
- **Fonte:** Arial (`"font.family": "Arial"`). A Helvetica do macOS não
  aplica negrito no matplotlib, e o cabeçalho e o total das tabelas precisam
  dele.
- No matplotlib, definir no início do script:
  `plt.rcParams.update({"font.size": F, "axes.titlesize": F, "axes.labelsize": F, "xtick.labelsize": F, "ytick.labelsize": F, "legend.fontsize": F})`
  e, em tabelas, `tabela.auto_set_font_size(False)` + `tabela.set_fontsize(F)`.

## Linhas horizontais de referência

Sempre que existir um valor de referência para o KPI, incluir como linha
horizontal:

| Tipo | Formato | Exemplo de legenda |
|---|---|---|
| Média do período | tracejada, mesma cor da série principal, fina | `Média 2025 (3,03%)` |
| Meta | tracejada, cor diferente da série principal | `Meta de Conversão (3%)` |
| Benchmark de mercado (mín./máx.) | pontilhada, cor mais clara | `Benchmark mínimo (1%)` / `Benchmark máximo (2%)` |

**Regra de clareza visual:** nunca mais que 1 linha principal de KPI + até 3
linhas horizontais de referência no mesmo gráfico. Se isso não couber, divida
em mais de um gráfico.

## Validação obrigatória

Depois de gerar qualquer gráfico, a skill deve parar e pedir explicitamente:

> "Confirme se os valores representados no gráfico correspondem exatamente
> aos dados enviados."

Não presuma que o gráfico está correto. Se o analista apontar divergência,
corrigir antes de seguir — ver também `regras-de-validacao.md`.
