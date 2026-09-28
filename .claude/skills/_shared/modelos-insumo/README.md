# Modelos oficiais de insumo

Coloque aqui os modelos em branco que o analista baixa na interface, com
exatamente estes nomes:

- `historico-mensal.xlsx` — Skill 03. Linha 1 com os marcadores
  "Fórmula" / "Preench. Manual"; linha 2 com o cabeçalho; coluna `DATA` com o mês.
- `produtos-curva-abc.xlsx` — Skill 03 (Curva ABC). Cabeçalho na linha 1.
- `clientes-historico.xlsx` — Skill 04. Cabeçalho na linha 1. Sem nenhuma coluna de dado pessoal.

Quando o modelo existe, o validador (`scripts/validar_insumo.py`) exige as
mesmas colunas do modelo — no histórico mensal, as marcadas "Preench. Manual".
Sem o modelo, ele cai para `colunas_obrigatorias` de `schemas.json` e avisa
o analista. Se mudar um modelo, confira `schemas.json` (linha do cabeçalho,
nome da coluna de mês).
