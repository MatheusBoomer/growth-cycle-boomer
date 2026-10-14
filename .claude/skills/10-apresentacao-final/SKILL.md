---
name: 10-apresentacao-final
description: Monta a apresentação final do planejamento para o prospect, no padrão visual da agência, como um .pptx editável. Escreve o roteiro slide a slide a partir do que foi aprovado (gráficos e seções), passa pela aprovação do analista e gera o arquivo com scripts/gerar_apresentacao.py. Use depois da Skill 09 (plano-de-acao) concluída, quando o analista pedir a apresentação final.
---

# Skill 10 — Apresentação final

Última etapa. Transforma o que foi aprovado em `entrega/ativos-aprovados/` na
apresentação que vai para o prospect, no molde da agência
(`.claude/skills/_shared/modelos-apresentacao/`). Não cria análise nova nem
gráfico novo: organiza, condensa e monta.

## Antes de começar

Confira que existe material das 6 seções do deck em `entrega/ativos-aprovados/`:

| Seção do deck | Onde está | Etapa de origem |
|---|---|---|
| 01. Cenário atual | `graficos/*`, `secoes/03-*.md`, `secoes/04-*.md` | 03 e 04 |
| 02. Desafios | gargalos e hipóteses em `contexto/decisoes/`, `secoes/06-*.md` | 02 a 06 |
| 03. Benchmarking | `secoes/07-benchmark.md`, `dados/benchmark-meta/<marca>/` | 07 |
| 04. Metas | `graficos/cenarios-*`, `graficos/tabela-cenarios-*`, `secoes/06-*.md` | 06 |
| 05. Cenários e impactos | `secoes/06-*.md`, `secoes/08-midia-paga.md`, `graficos/tabela-*` | 06 e 08 |
| 06. Plano de ação | `plano-de-acao/*.docx`, `secoes/08-*.md` | 09 |

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

Estrutura de referência (deck de 61 slides entregue à Sottile Jalecos; siga
esta espinha e adapte ao material de cada prospect):

| Seção | Slides, na ordem |
|---|---|
| Abertura | capa · jornada (6 seções) |
| 01. Cenário atual | divisória · um `grafico` por gráfico do diagnóstico (investimento, receita captada x aprovada, taxa de quebra, ROAS global, ROAS por plataforma, sessões, dependência de mídia, conversão global, funil de eventos, conversão por plataforma, Curva ABC, top 10 produtos, CAC, novos x recorrentes) com 1 a 3 conclusões · `analises_2_colunas` depois de cada bloco (investimento e receita; conversão) · `tabela_lateral` por curva (A, B, C) · análise de criativos do próprio prospect quando houver imagem aprovada |
| 02. Desafios | divisória · `bullets` com a lista de desafios · `cartoes` com os 3 pilares · um `bullets` por iniciativa de cada pilar (ex.: retenção de base, auditoria de rastreio, ofertas, sessões x conversão, ROAS) |
| 03. Benchmarking | divisória · um `benchmark` por concorrente (3 criativos, conclusões, link da página) · `bullets` com as análises de benchmarking |
| 04. Metas | divisória · `imagem_larga` com a tabela de metas e os 3 cenários · `grafico` com as curvas dos cenários |
| 05. Cenários e impactos | divisória · `bullets` com a metodologia (KPIs influenciadores e de resultado) · `imagem_larga` com as tabelas de projeção e de KPIs · `bullets` com as considerações · alocação de verba (`grafico` e `imagem_larga`) · estratégia por Curva ABC · calendário de mídia · ROAS esperado · dependência de mídia paga |
| 06. Plano de ação | divisória · estrutura de campanhas (imagem aprovada, se houver) · `bullets` sobre as campanhas · `imagem_larga` com os planos de ação (B2C, B2B) |
| Fechamento | obrigado |

Regras:
- Ordem: capa → jornada → divisória 01 + slides → … → divisória 06 + slides → obrigado.
  Divisórias: "CENÁRIO **ATUAL**", "DESAFIOS", "ANÁLISE DE **BENCHMARKING**",
  "**METAS**", "**CENÁRIOS** E IMPACTOS **ESPERADOS**", "PLANO **DE AÇÃO**".
- **Cobertura obrigatória:** todo gráfico e toda tabela de
  `entrega/ativos-aprovados/graficos/` entra no deck, um slide cada (`grafico`;
  tabelas em `tabela_lateral` quando altas ou `imagem_larga` quando largas). Só
  sai se o analista pedir no ajuste do roteiro. O gerador avisa quando algum
  aprovado ficou de fora: trate o aviso antes de propor o deck.
- **Escala esperada:** 40 a 60 slides, como o deck de referência. Um deck
  muito menor indica que faltou material ou cobertura; diga ao analista o que
  falta em vez de enxugar.
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

Os ajustes chegam de dois jeitos: o texto livre do "Pedir ajuste" ou a lista
estruturada que o app monta a partir dos comentários do analista, no formato:

    Ajustes em "Apresentação final" (2):
    1. Slide 12 · "Cenário Atual · ROAS Global" · região: conclusoes (recorte: clientes/<slug>/.app/comentarios/<id>/c1.png)
       "a 2ª conclusão está errada, a média é 0,40%"
    2. Slide 18 · "Benchmarking · Baunni" · slide inteiro
       "esse slide pode sair"

- Abra cada recorte com Read antes de corrigir: ele mostra a área marcada
  (contorno laranja).
- "Slide N" é a posição no deck gerado (slides com pendência foram pulados);
  ache o slide no roteiro pelo título citado. No roteiro, "Slide N do roteiro"
  é a posição no próprio roteiro.
- Altere **só** os slides citados, regere o deck e proponha de novo (roteiro,
  se mudou o conteúdo; apresentação, sempre). Nunca edite o `.pptx` à mão.

## Encerramento e handoff

Ao concluir, marque "Apresentação final" como ✅ em
`contexto/status-planejamento.md` e diga ao analista, em linguagem natural,
que a apresentação está em `entrega/apresentacao-final.pptx` e que abre no
Google Slides (Arquivo → Importar slides) ou no PowerPoint. Este é o fim do
processo.
