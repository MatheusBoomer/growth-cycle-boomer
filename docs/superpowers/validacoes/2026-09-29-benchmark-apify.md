# Validação do benchmark via Apify e do visualizador — 2026-09-29

Python 3.9.6, ffmpeg (Homebrew), Next.js 16.3.3, react-resizable-panels 4.14.1.
Branch `feat/interface-planejamento`. Plano: `docs/superpowers/plans/2026-09-29-benchmark-apify-e-visualizador.md`.

## Suíte automática

| Comando | Resultado |
|---|---|
| `python3 -m pytest scripts/tests -q` | 65/65 |
| `cd src && npx turbo test typecheck lint` | core 132/132, web 6/6, mcp-planejamento 11/11; typecheck ok; lint sem erros |

## Coleta real na Apify (Insider Store)

| Passo | Resultado |
|---|---|
| `descobrir --marca "Insider Store" --site insiderstore.com.br` | 29 s. `confirmada`, page_id 1812940462298746 (95.265 curtidas, Clothing (Brand), anuncia para insiderstore.com.br, 29 de 30 na amostra). Segunda candidata ("Wellness Insider", 1 anúncio) descartada |
| `coletar --page-id 1812940462298746` | 66 s. Total ativo 1.082 (o `onlyTotal` devolve `totalCount`, já reconhecido). Amostra de 40, 10 selecionados, 56 arquivos de mídia, nenhum `.mp4` sobrando |
| Quadros de vídeo | Legíveis ao abrir com Read (vídeo UGC, pessoa mostrando o bojo removível do "Perfect Top", coerente com a copy) |
| Token | Não aparece em nenhum arquivo gerado (`bruto.json`, `anuncios.json`, `resumo.md`, `descoberta.json`) |

### Formato real da resposta x fixture

- Chaves em camelCase, como o fixture; `body` vem como `{text}` ou `null`. A Apify usa `collationId` (o código já aceitava).
- **Divergência encontrada:** 20 dos 40 anúncios vieram com `displayFormat: "DCO"` (criativo dinâmico), com as variações em `cards`. O script os classificava como "Carrossel". Corrigido em `63f2bd5` (DCO → Vídeo se houver vídeo, senão Imagem estática), com teste. Depois da correção: 6 vídeos e 4 imagens estáticas entre os 10 selecionados.
- 2 dos 10 selecionados não têm copy (texto só na imagem); a regra de análise manda transcrever o texto legível da imagem.
- Nenhum anúncio de catálogo (DPA) nessa página; a nota de coleta registra isso.

## Interface (executor de demonstração)

- `demo:propor html` abre o visualizador sozinho; Abrir no card e no painel; relatório renderiza via `srcDoc`.
- Link de anúncio dentro do relatório tenta abrir nova aba (o painel do navegador embutido só bloqueia porque o clique veio da automação).
- Tela cheia, Esc (sai da tela cheia), Esc (fecha); Esc com foco num campo de texto não fecha.
- Rascunho digitado no chat sobrevive à abertura automática e ao fechamento do visualizador.
- Larguras lembradas separadamente com e sem visualizador; recolher e expandir trilha e painel; `pointer-events: none` nos iframes durante o arraste.
- Nova versão do HTML troca o conteúdo aberto; fechado, não reabre sozinho.
- "Abrir em nova aba" recebe `Content-Security-Policy: sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`.
- Não testado ao vivo: troca de etapa com o visualizador aberto (as demais etapas estavam bloqueadas no prospect de teste).

## Skill 06 completa pela interface (sottile-teste, agente real)

Etapa 06 reaberta (07 e 08 ficaram desatualizadas), briefing aprovado reaproveitado.

- Descoberta: as 5 páginas (Dra. Cherie, Dra. Charm, Baunni, Use Bip, Sottile Jalecos) vieram `confirmada`, sem pergunta ao analista.
- Coleta: totais ativos 64 / 55 / 22 / 20 / 9; 49 criativos analisados (Baunni com 9, todos). Indicador "Coletando anúncios na Biblioteca do Meta" apareceu no chat.
- Análise lendo imagens e quadros de vídeo; `analise-benchmark.md` com ~10 mil palavras, gravado por anunciante.
- Relatório proposto como entregável `html` (`nome_final` `benchmark`): 7 perguntas com comparação nominal, ranking com barras corretas (100/86/34/31/14), prospect por último, todos os links com `target="_blank"`, 3 catálogos (1 por anunciante no máximo), 5 notas de coleta, sem placeholder nem script. Abre no visualizador e em tela cheia.
- Achado do agente: a hipótese do briefing ("nenhum concorrente comunica atributo técnico de tecido") não se confirma mais; ele registrou como achado.
- **Problema encontrado:** o briefing tinha 5 concorrentes nacionais + wearfigs, e o agente seguiu com 4 sem perguntar antes (só avisou no fim). Corrigido na skill em `9b8baa6`: com mais de 4, parar e perguntar antes da coleta; referência internacional fica de fora com aviso.
- Tempo total do turno: ~40 min.

## Revisão de custo (2026-09-30): link do analista e 5 criativos

Pedido do analista: sem descoberta de página pela API (o analista informa o link da página na
Biblioteca) e 5 criativos por marca. Commit `cfad192`.

- `coletar --link "<link com view_all_page_id>"` na Insider Store: 70 s, 15 anúncios cobrados
  (antes: 30 da descoberta + 40 da coleta), total ativo 1.101, 5 criativos distintos
  (2 vídeos, 3 imagens estáticas), 1 duplicado descartado.
- Link de anúncio avulso, de perfil do Facebook, de busca por palavra ou texto solto: recusado
  com explicação de como copiar o link da página (testes).
- Suíte Python: 67/67.
- Estimativa por benchmark (4 concorrentes + prospect): ~80 anúncios na Apify (antes ~355).
