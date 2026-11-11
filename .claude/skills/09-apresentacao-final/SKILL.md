---
name: 09-apresentacao-final
description: Monta a apresentação final do planejamento para o prospect, no padrão visual da agência, como um .pptx editável. Escreve o roteiro slide a slide a partir do que foi aprovado (gráficos e seções), passa pela aprovação do analista e gera o arquivo com scripts/gerar_apresentacao.py. Use depois da Skill 08 (plano-de-acao) concluída, quando o analista pedir a apresentação final.
---

# Skill 09 — Apresentação final

Penúltima etapa: depois dela vem a revisão do plano de ação com o que o
cliente disser na reunião de apresentação (Skill 10). Transforma o que foi
aprovado em `entrega/ativos-aprovados/` na apresentação que vai para o
prospect, no molde da agência (`.claude/skills/_shared/modelos-apresentacao/`).
Não cria análise nova nem gráfico novo: organiza, condensa e monta.

## Antes de começar

Confira que existe material das 5 seções do deck em `entrega/ativos-aprovados/`:

| Seção do deck | Onde está | Etapa de origem |
|---|---|---|
| 01. Cenário atual | `graficos/*`, `secoes/03-*.md`, `secoes/04-*.md` | 03 e 04 |
| 02. Desafios | `contexto/solucoes.json`, `secoes/05-solucoes.md` | 05 |
| 03. Metas | `graficos/cenarios-*`, `graficos/tabela-cenarios-*`, `secoes/06-*.md` | 06 |
| 04. Cenários e impactos | `secoes/06-*.md`, `secoes/07-midia-paga.md`, `graficos/tabela-*` | 06 e 07 |
| 05. Plano de ação | `plano-de-acao/plano-de-acao-estrategico.docx` (documento) e `plano-de-acao/plano-de-acao-estrategico.xlsx` (planilha), `secoes/08-*.md` | 08 |

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
| `desafio` | `titulo`, `problema`, `hipoteses` (1 a 5), `solucoes` (1 a 3), `impacto`; `problema_id` obrigatório quando houver registro |
| `benchmark` | `titulo`, `subtitulo`, `concorrente`, `imagens` (1 a 3), `conclusoes` (1 a 3), `link` (tipo reservado, sem uso no roteiro padrão) |
| `obrigado` | nenhum |

Opcionais em qualquer slide: `fonte` e `pendencia`. Imagens: caminhos relativos
à pasta do prospect (png ou jpg).

Estrutura de referência (deck de 61 slides entregue à Sottile Jalecos, que
incluía uma seção de benchmark que não se aplica mais; siga esta espinha e
adapte ao material de cada prospect):

| Seção | Slides, na ordem |
|---|---|
| Abertura | capa · jornada (5 seções) |
| 01. Cenário atual | divisória · um `grafico` por gráfico do diagnóstico (investimento, receita captada x aprovada, taxa de quebra, ROAS global, ROAS por plataforma, sessões, dependência de mídia, conversão global, funil de eventos, conversão por plataforma, Curva ABC, top 10 produtos, CAC, novos x recorrentes) com 1 a 3 conclusões · `analises_2_colunas` depois de cada bloco (investimento e receita; conversão) · `tabela_lateral` por curva (A, B, C) · análise de criativos do próprio prospect quando houver imagem aprovada |
| 02. Desafios | divisória · `bullets` com a lista de desafios (título e impacto de cada problema) · um `desafio` por problema do registro, na ordem de prioridade, com `problema_id` · `cartoes` com os 3 pilares · um `bullets` por iniciativa de cada pilar (pilares e iniciativas vêm do analista; ver regras) |
| 03. Metas | divisória · `imagem_larga` com a tabela de metas e os 3 cenários · `grafico` com as curvas dos cenários |
| 04. Cenários e impactos | divisória · `bullets` com a metodologia (KPIs influenciadores e de resultado) · `imagem_larga` com as tabelas de projeção e de KPIs · `bullets` com as considerações · alocação de verba (`grafico` e `imagem_larga`) · estratégia por Curva ABC · calendário de mídia · ROAS esperado · dependência de mídia paga |
| 05. Plano de ação | divisória · estrutura de campanhas (imagem aprovada, se houver) · `bullets` sobre as campanhas · um `bullets` por horizonte (Imediato, Curto prazo, Médio prazo), com as ações, datas e donos lidos do documento e da planilha do plano |
| Fechamento | obrigado |

Regras:
- Ordem: capa → jornada (5 seções) → divisória 01 + slides → … → divisória 05 + slides → obrigado.
  Divisórias: "01." "CENÁRIO **ATUAL**", "02." "DESAFIOS", "03." "**METAS**",
  "04." "**CENÁRIOS** E IMPACTOS **ESPERADOS**", "05." "PLANO **DE AÇÃO**".
- **Cobertura obrigatória:** todo gráfico e toda tabela de
  `entrega/ativos-aprovados/graficos/` entra no deck, um slide cada (`grafico`;
  tabelas em `tabela_lateral` quando altas ou `imagem_larga` quando largas). Só
  sai se o analista pedir no ajuste do roteiro. O gerador avisa quando algum
  aprovado ficou de fora: trate o aviso antes de propor o deck.
- **Cobertura de desafios:** todo problema de `contexto/solucoes.json` entra
  como slide `desafio`. O gerador avisa quando algum ficou de fora: trate o
  aviso antes de propor o deck. Os textos vêm do registro, condensados; nunca
  invente hipótese, solução ou impacto. O gerador acrescenta sozinho os
  prefixos "Hipótese: " e "Solução: " e renderiza as soluções como bullets sem
  numeração: escreva só o texto, sem esses prefixos e sem numerar.
- **`problema_id` obrigatório:** sempre que `contexto/solucoes.json` existir,
  todo slide `desafio` leva `problema_id` (ex.: "P1"), porque a checagem de
  cobertura depende dele.
- **Limites do `desafio`** (caracteres por item do roteiro, sem os prefixos):
  título ≤ 60, problema ≤ 140, cada hipótese ≤ 90, cada solução ≤ 100,
  impacto ≤ 100. O gerador recusa o roteiro acima disso; condense o texto.
  Título no formato "<Tema>: **<frase curta do achado>**". Confira a prévia
  de cada desafio antes de propor o deck.
- **Pilares (`cartoes`) e iniciativas:** os 3 pilares e os bullets de cada
  pilar vêm do analista. Com o aval dele, podem ser as 3 frentes com mais
  problemas no registro. Sem isso, emita o slide com `pendencia` dizendo o que
  falta. Nunca invente pilar.
- **Lista de desafios (`bullets`):** no máximo 6 itens; com mais de 6
  problemas, divida em dois slides de lista. A ordem é a do array `problemas`
  de `contexto/solucoes.json` (a Skill 05 grava por prioridade).
- **Escala esperada:** 40 a 60 slides (o deck de referência tinha 61 com a
  seção de benchmark, que não se aplica mais). Um deck
  muito menor indica que faltou material ou cobertura; diga ao analista o que
  falta em vez de enxugar.
- Títulos curtos no padrão do deck ("Cenário Atual", "Metas do projeto"…);
  subtítulos com o destaque em `**negrito**`.
- Conclusões: no máximo 3 por slide, frases curtas (até ~90 caracteres),
  condensando as seções aprovadas, com número e comparação quando houver.
  Registre a seção de origem em `fonte`. Nunca invente número ou análise.
- Slide sem material: `{"tipo": "...", "pendencia": "o que falta e de qual etapa"}`.
- PII: as regras do `CLAUDE.md` raiz valem para o deck.

Antes de propor o deck, apresente ao analista o checklist da Regra 8 de
`_shared/regras-de-validacao.md` (os 4 itens), cada um marcado como atendido
ou com o que falta.

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
    2. Slide 44 · "Mídia paga · Calendário estratégico" · slide inteiro
       "esse slide pode sair"

- Abra cada recorte com Read antes de corrigir: ele mostra a área marcada
  (contorno laranja).
- "Slide N" é a posição no deck gerado (slides com pendência foram pulados);
  ache o slide no roteiro pelo título citado. No roteiro, "Slide N do roteiro"
  é a posição no próprio roteiro.
- Altere **só** os slides citados, regere o deck e proponha de novo (roteiro,
  se mudou o conteúdo; apresentação, sempre). Nunca edite o `.pptx` à mão.

## Encerramento e handoff

Ao concluir, converse com o analista em linguagem natural, sem citar caminho
de arquivo:

"Nesta sessão, a apresentação final ficou pronta, em .pptx editável no molde
da agência; ela abre no Google Slides (Arquivo → Importar slides) ou no
PowerPoint. Falta uma etapa: depois da reunião em que você apresentar o
Growth Cycle ao cliente, eu reviso o plano de ação com o que ele trouxer e
gero o plano final, que é o que vai para a entrega formal. Para isso,
preciso da transcrição completa dessa reunião: espere o Google Drive
disponibilizar, exporte em documento Word (.docx) ou texto (.txt) e confira
se ela cobre a reunião do início ao fim.

Quando estiver com a transcrição, rode `/10-revisao-pos-apresentacao`."

Depois, conforme o modo (Regras 6 e 7):

- **Terminal:** marque "Apresentação final" como ✅ em
  `contexto/status-planejamento.md`, reescreva o bloco "Próximo passo" desse
  arquivo com o mesmo pedido e grave
  `contexto/decisoes/09-apresentacao-final.md`.
- **Interface:** não edite `contexto/status-planejamento.md` nem
  `contexto/decisoes/`. Chame `sinalizar_etapa_pronta` com o
  `resumo_decisoes` e o mesmo texto de handoff; o app grava os dois.
