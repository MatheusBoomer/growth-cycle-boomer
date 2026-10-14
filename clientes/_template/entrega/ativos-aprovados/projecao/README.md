A planilha de Projeção de Cenários (`projecao-de-cenarios.xlsx`) é salva aqui
pela Skill 06 (`metas-e-cenarios`), no final, depois que os 3 cenários são
aprovados pelo analista. É um entregável do cliente — vai para a apresentação e
pode ser enviado ao prospect.

É gerada a partir do modelo `.claude/skills/_shared/[MODELO] Projeção de
Cenários.xlsx` pelo script `scripts/preencher_projecao_xlsx.py` (rodado pelo
subagente `analista-dados`). O script preenche só os KPIs Influenciadores; as
colunas de resultado (Sessões, Vendas, Receita) são fórmulas e recalculam ao
abrir no Excel/Google Sheets.

Nome de arquivo estável — uma nova aprovação sobrescreve a anterior. Ver
`.claude/skills/_shared/regras-de-validacao.md`.

Não edite os arquivos desta pasta manualmente.
