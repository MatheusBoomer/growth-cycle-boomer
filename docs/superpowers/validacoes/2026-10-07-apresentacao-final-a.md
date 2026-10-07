# Validação da apresentação final — Entrega A (2026-10-07)

Plano: `docs/superpowers/plans/2026-10-07-apresentacao-final-entrega-a.md`.

## Suítes

| Comando | Resultado |
|---|---|
| `python3 -m pytest scripts/tests -q` | 104/104 |
| `cd src && npx turbo test typecheck lint` | core 138/138, web 24/24, mcp 11/11; typecheck ok; lint sem erros |

## Molde

- 11 slides-modelo (um por tipo), 1,6 MB. Varredura do pacote inteiro (slides, anotações,
  mestre, metadados): nenhuma ocorrência de sottile, baunni, jalecos ou link do Drive.
- Achados corrigidos no preparo: imagens antigas continuavam anexadas aos slides depois
  da troca (2,8 MB com gráficos e criativos da Sottile); imagens do benchmark tinham
  link para vídeos no Drive e título interno com o nome do concorrente.

## Deck de teste (sottile-teste)

- Roteiro com todos os tipos (capa, jornada, 4 divisórias, gráfico, análises em 2 colunas,
  tabela lateral, cartões, bullets, benchmark com 3 quadros de vídeo da Baunni, imagem
  larga, obrigado) e 1 slide com pendência.
- Resultado: 14 slides; slide com pendência pulado com aviso; nenhum `{{` ou `**`
  sobrando; nenhuma imagem distorcida (proporção igual à do arquivo de origem).
- Achado corrigido: aviso de estouro falso nas divisórias (título de 50 pt em duas
  linhas, como no próprio deck de referência, p.42).

## Conferência visual

Pendente: o analista abre `clientes/sottile-teste/entrega/teste-apresentacao-gerada.pptx`
no Google Slides e compara com o PDF de referência.
