# Dados do prospect

Três arquivos, com propósitos e sensibilidade diferentes:

| Arquivo | Usado por | Sensibilidade |
|---|---|---|
| `historico-mensal.xlsx` | Skill 03 (`diagnostico-performance`) | Nenhuma — dado agregado mensal |
| `produtos-curva-abc.xlsx` | Skill 03, etapa de Curva ABC | Nenhuma — dado de produto |
| `clientes-historico.xlsx` | Skill 04 (`unidade-economica`) | **Sensível** — nunca deve conter CPF, e-mail, telefone, endereço ou dado de cartão. Ver `regras-de-validacao.md` |

`historico-mensal.xlsx` segue o formato de referência usado no projeto
(12 meses, KPIs de investimento/receita/ROAS/sessões/conversão já quebrados
por Google e Meta).

## benchmark-meta/ (gerada pela Skill 07)

Não é insumo do analista. A Skill 07 cria `benchmark-meta/<marca>/` com os
anúncios coletados pela Apify (`resumo.md`, `anuncios.json`, `bruto.json`,
`midia/`) e o arquivo `analise-benchmark.md`. São anúncios públicos das
marcas, sem dado de cliente final.
