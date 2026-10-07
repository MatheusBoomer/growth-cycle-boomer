---
name: 09-apresentacao-final
description: Monta a apresentação final do planejamento para o prospect, no padrão visual da agência, como um .pptx editável. Escreve o roteiro slide a slide a partir do que foi aprovado (gráficos e seções), passa pela aprovação do analista e gera o arquivo com scripts/gerar_apresentacao.py. Use depois da Skill 08 (plano-de-acao) concluída, quando o analista pedir a apresentação final.
---

# Skill 09 — Apresentação final

Última etapa. Transforma o que foi aprovado em `entrega/ativos-aprovados/` na
apresentação que vai para o prospect, no molde da agência
(`.claude/skills/_shared/modelos-apresentacao/`). Não cria análise nova nem
gráfico novo: organiza, condensa e monta.

## Antes de começar

Confira que existe material das 6 seções do deck em `entrega/ativos-aprovados/`:

| Seção do deck | Onde está | Etapa de origem |
|---|---|---|
| 01. Cenário atual | `graficos/*`, `secoes/03-*.md`, `secoes/04-*.md` | 03 e 04 |
| 02. Desafios | gargalos e hipóteses em `contexto/decisoes/`, `secoes/05-*.md` | 02 a 05 |
| 03. Benchmarking | `secoes/06-benchmark.md`, `dados/benchmark-meta/<marca>/` | 06 |
| 04. Metas | `graficos/cenarios-*`, `graficos/tabela-cenarios-*`, `secoes/05-*.md` | 05 |
| 05. Cenários e impactos | `secoes/05-*.md`, `secoes/07-midia-paga.md`, `graficos/tabela-*` | 05 e 07 |
| 06. Plano de ação | `plano-de-acao/*.docx`, `secoes/07-*.md` | 08 |

Faltando material de uma seção, diga ao analista o que falta e de qual etapa
vem; não monte um deck incompleto em silêncio.

## Fase 1 — Roteiro

Escreva `roteiro-apresentacao.json` (na interface, em
`clientes/<slug>/.app/rascunhos/`; no terminal, em `clientes/<slug>/entrega/`):
`{ "versao": 1, "prospect": "<nome>", "slides": [ … ] }`. A fonte da verdade
dos campos é o `ESQUEMA` em `scripts/gerar_apresentacao.py`:

| Tipo | Campos |
|---|---|
| `capa` | `prospect` |
| `jornada` | nenhum |
| `divisoria` | `numero` ("01."), `titulo` |
| `grafico` | `titulo`, `subtitulo`, `imagem`, `conclusoes` (1 a 3) |
| `tabela_lateral` | `titulo`, `subtitulo`, `imagem`, `conclusoes` (1 a 3) |
| `imagem_larga` | `titulo`, `imagem`, `texto` |
| `analises_2_colunas` | `esquerda` e `direita`: `{ "titulo": "…", "itens": [1 a 4] }` |
| `bullets` | `titulo`, `subtitulo`, `itens` (1 a 6) |
| `cartoes` | `titulo`, `subtitulo`, `cartoes` (exatamente 3) |
| `benchmark` | `titulo`, `subtitulo`, `concorrente`, `imagens` (1 a 3), `conclusoes` (1 a 3), `link` |
| `obrigado` | nenhum |

Opcionais em qualquer slide: `fonte` e `pendencia`. Imagens: caminhos relativos
à pasta do prospect (png ou jpg).

Regras:
- Ordem: capa → jornada → divisória 01 + slides → … → divisória 06 + slides → obrigado.
  Divisórias: "CENÁRIO **ATUAL**", "DESAFIOS", "ANÁLISE DE **BENCHMARKING**",
  "**METAS**", "**CENÁRIOS** E IMPACTOS **ESPERADOS**", "PLANO **DE AÇÃO**".
- Um slide `grafico` por gráfico aprovado relevante; tabelas aprovadas usam
  `tabela_lateral` (tabela alta) ou `imagem_larga` (tabela larga).
- Títulos curtos no padrão do deck ("Cenário Atual", "Metas do projeto"…);
  subtítulos com o destaque em `**negrito**`.
- Conclusões: no máximo 3 por slide, frases curtas (até ~90 caracteres),
  condensando as seções aprovadas, com número e comparação quando houver.
  Registre a seção de origem em `fonte`. Nunca invente número ou análise.
- Benchmark: um slide `benchmark` por concorrente, com até 3 criativos de
  `dados/benchmark-meta/<marca>/midia/` (prefira o quadro mais representativo
  de cada vídeo), conclusões da camada Lição + Evidência e o link da página na
  Biblioteca (`resumo.md`, "Página na Biblioteca").
- Slide sem material: `{"tipo": "...", "pendencia": "o que falta e de qual etapa"}`.
- PII: as regras do `CLAUDE.md` raiz valem para o deck.

Interface: `propor_entregavel` tipo `roteiro`, `nome_final` `roteiro-apresentacao`.
Terminal: mostre o roteiro resumido slide a slide e peça a checagem.

## Fase 2 — Deck

Com o roteiro aprovado:

```bash
python3 scripts/gerar_apresentacao.py --roteiro <roteiro.json> --prospect clientes/<slug> --output <saida.pptx>
```

- Interface: `--output clientes/<slug>/.app/rascunhos/apresentacao-final.pptx` e
  `propor_entregavel` tipo `apresentacao`, `nome_final` `apresentacao-final`.
- Terminal: `--output clientes/<slug>/entrega/apresentacao-final.pptx`.
- `ERRO:` → corrija o roteiro nos pontos citados e rode de novo.
- Avisos de texto que não cabe → encurte aquela frase no roteiro e regere antes
  de propor. Avisos de slide pulado → conte ao analista.

## Ajustes

Pedido de ajuste (inclusive comentários por slide) → altere **só** o roteiro
nos slides citados, regere o deck e proponha de novo (roteiro, se mudou o
conteúdo; apresentação, sempre). Nunca edite o `.pptx` à mão.

## Encerramento e handoff

Ao concluir, marque "Apresentação final" como ✅ em
`contexto/status-planejamento.md` e diga ao analista, em linguagem natural,
que a apresentação está em `entrega/apresentacao-final.pptx` e que abre no
Google Slides (Arquivo → Importar slides) ou no PowerPoint. Este é o fim do
processo.
