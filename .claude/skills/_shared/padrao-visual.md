# Padrão visual obrigatório dos gráficos

Referenciado por todas as skills que geram gráfico: `03-diagnostico-performance`,
`04-unidade-economica`, `06-metas-e-cenarios`, `08-midia-paga`. Não copie este
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
