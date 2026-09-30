---
name: briefing-e-benchmark
description: Consolida tudo que foi construído nas skills anteriores num briefing estruturado e faz o benchmark de anúncios dos concorrentes na Biblioteca do Meta (coleta via Apify) — substitui o antigo processo manual de sair do chat e entrar no Cowork. Use após metas-e-cenarios, ao concluir o diagnóstico e a projeção.
---

# Skill 06 — Briefing e Benchmark de Concorrentes

Skill 6 de 8. Corresponde ao Prompt 7 (Produção de Briefing) do processo
original, mais a etapa de pesquisa de concorrentes que antes não tinha skill
própria e dependia de um salto manual para o Cowork (e, depois, da extensão
do Claude no Chrome). Aqui, a coleta dos anúncios da Biblioteca do Meta é
feita pela Apify (`scripts/coleta_meta_ads.py`) e a análise acontece na
própria conversa, sem sair do planejamento.

## Antes de começar (checklist do analista)

- [ ] Skills 01 a 05 concluídas e aprovadas.
- [ ] Lista de até 4 concorrentes, com site ou @ de cada um, se já tiver
      pensado nisso (se não tiver, a skill pergunta antes da Fase 2).
- [ ] `APIFY_TOKEN` configurado no `.env` da raiz e `ffmpeg` instalado (a
      verificação do sistema da interface mostra os dois).

## Fase 1 — Briefing do Cliente

### Objetivo

Consolidar em um único documento estruturado todo o conhecimento construído
nas Skills 01 a 05.

### Processo

1. Ler os resumos de decisão das etapas anteriores em `contexto/decisoes/`
   e o histórico desta conversa (no modo interface, cada etapa tem sua
   própria conversa — o que foi decidido antes está nos resumos e no dossiê).
2. **Ler novamente a pasta `contexto/` do cliente** que está sendo trabalhado
   para coletar informações que podem ter sido perdidas ao longo da conversa.
3. Preencher todos os campos do template abaixo com as informações
   levantadas. Não deixe nenhum campo em branco — se algo não foi discutido,
   registrar "Não levantado nesta sessão".
4. Usar apenas valores exatos já validados pelo analista ao longo do
   processo. Não inventar nem estimar valores não confirmados.
5. Na seção de Concorrentes, usar a lista discutida com o analista. Se não
   foi discutida, registrar "A definir com o cliente" e sinalizar como
   pendência. Se a lista tiver mais de 4 concorrentes, pergunte ao
   analista quais 4 são prioridade (sem preferência, sugira os que
   provavelmente têm mais anúncios ativos).

### Template do briefing (`entrega/ativos-aprovados/secoes/06-briefing.md`)

```markdown
# Briefing do Cliente — [Nome do Prospect]

## Identificação
Nome | Segmento | Link do e-commerce | Período analisado | Data | Analista

## 1. Contextualização Estratégica (Skill 02)
Modelo de negócio, produto, proposta de valor, público-alvo, posicionamento,
maturidade, objetivo declarado, hipóteses, gargalos, pendências.

## 2. Macro Financeiro (Skill 03, parte 1)
Investimento, receita, ROAS — médias, picos, vales, riscos.

## 3. Aquisição, Dependência e Conversão (Skill 03, parte 2)
Sessões, dependência de mídia paga, conversão por plataforma, Curva ABC.

## 4. Unidade Econômica (Skill 04)
CAC, novos vs recorrentes, LTV, LTV/CAC.

## 5. Metas do Projeto (Skill 05, parte 1)
Meta oficial, distribuição mensal, lógica de distribuição.

## 6. Cenários e Impactos Esperados (Skill 05, parte 2)
Resumo dos 3 cenários, alavancas, riscos, alavanca principal.

## 7. Concorrentes para Pesquisa de Benchmark
Até 4 concorrentes. Para cada um: nome, site, @ do Instagram, link da
Biblioteca de Anúncios (se o analista tiver) e por que analisar (foco de
atenção). Depois: contexto estratégico para orientar a análise, pontos de
atenção (opcional) e perguntas estratégicas customizadas (opcional —
substituem as 7 padrão do relatório).

## 8. Observações e Pendências
```

## Fase 2 — Benchmark de anúncios (Meta)

Segue integralmente as regras da skill `benchmark-meta-ads` da agência,
com a coleta feita pela Apify em vez do navegador. Leia antes de começar:

- `.claude/skills/_shared/benchmark-coleta-e-analise.md` — comandos, descoberta,
  análise dos criativos, arquivo de análise;
- `.claude/skills/_shared/relatorio-benchmark.md` — relatório HTML.

Nunca use navegador, Firecrawl ou o subagente `pesquisador-benchmark` nesta
fase: a análise visual precisa acontecer nesta conversa, onde as imagens são
lidas.

Avise o analista no início que a coleta leva alguns minutos por anunciante e
que você vai trabalhar sem pausas, parando só se alguma página precisar de
confirmação.

### 2a. Anunciantes

Os concorrentes da seção 7 do briefing + o próprio prospect, sempre por
último. Cada rodada analisa **no máximo 4 concorrentes**. Se a seção 7 tiver
mais de 4, **pare e pergunte ao analista quais 4 priorizar antes de qualquer
coleta**, mesmo que o briefing já esteja aprovado; nunca escolha sozinho (sem
preferência dele, sugira os que provavelmente têm mais anúncios ativos).

A coleta busca anúncios veiculados no Brasil. Referência internacional sem
operação no Brasil (ex.: marca estrangeira citada como inspiração) não entra
na conta dos 4: avise o analista que ela fica de fora deste relatório.

Concorrente sem site informado: encontre o site oficial com WebSearch antes
da descoberta.

### 2b. Descoberta das páginas

Rode `descobrir` para cada anunciante sem link da Biblioteca. Páginas
`confirmada` seguem direto; `ambigua` ou `nao_encontrada` param para uma
pergunta ao analista no chat, com a tabela de candidatas (ver
`benchmark-coleta-e-analise.md`). Pergunte todas as ambíguas de uma vez, numa
mensagem só, antes de começar a coleta.

### 2c. Coleta e análise

Um anunciante por vez: `coletar`, ler `resumo.md`, abrir cada imagem e quadro,
preencher os campos, escrever a síntese e acrescentar o bloco ao arquivo de
análise `dados/benchmark-meta/analise-benchmark.md`. Se a execução tiver
caído antes, retome a partir desse arquivo.

Concorrente sem nenhum anúncio ativo: registre e siga — no relatório ele
aparece com o bloco `bm-sem-anuncios`. Só interrompa a Fase 2 se ela ficar
severamente comprometida (quase nenhum anunciante acessível) ou se o script
sair com `ERRO:`.

### 2d. Relatório e camada estratégica

1. Montar o HTML conforme `relatorio-benchmark.md` e passar pela checagem do
   analista (interface: `propor_entregavel` tipo `html`, `nome_final`
   `benchmark`; terminal: checagem no chat e, aprovado, salvar em
   `entrega/ativos-aprovados/benchmark/benchmark.html`).
2. Depois do HTML aprovado, escrever a camada estratégica em
   `entrega/ativos-aprovados/secoes/06-benchmark.md` (na interface, pelo
   `propor_entregavel` tipo `secao`, `nome_final` `benchmark`), um bloco por
   concorrente:
   - **Lição:** o que o concorrente faz de relevante nos anúncios,
     conectado a uma aplicação direta e específica para o prospect, amarrada
     aos gargalos do diagnóstico (Skills 02 a 05). Nunca observação genérica.
   - **Evidência:** total de anúncios ativos (do `resumo.md`, com a data da
     coleta) + 1 a 3 criativos que sustentam a lição, cada um com o link da
     Biblioteca.
   Feche com 3 a 5 destaques estratégicos para o prospect. É essa camada que
   alimenta a narrativa e a apresentação final.

## Restrições

- Não resumir nem omitir informações já validadas no briefing.
- Não adicionar análise nova no briefing — apenas consolidar o que já foi
  construído.
- Não alterar valores que o analista já aprovou.

## Critério de conclusão

- Briefing completo, sem campo em branco não justificado.
- Todos os anunciantes (concorrentes + prospect) coletados e analisados, ou
  registrados como sem anúncio ativo, com o arquivo de análise completo.
- Relatório HTML montado com o template da skill `benchmark-meta-ads`: um card
  por concorrente com os criativos (links clicáveis), a análise do prospect,
  as 7 perguntas (ou as customizadas) e o ranking de intensidade.
- Camada Lição + Evidência escrita para cada concorrente.
- Tudo aprovado pelo analista e salvo: briefing e camada estratégica em
  `entrega/ativos-aprovados/secoes/`, relatório em
  `entrega/ativos-aprovados/benchmark/benchmark.html`.

## Encerramento e handoff

Ao concluir, marque "06 · Briefing e benchmark" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída! Não preciso de nada novo — só confirma se seguimos com o
cenário Realista como base para a próxima etapa. Se quiser, pode me mandar
prints de tela (imagens) das campanhas atuais das plataformas, mas isso é
opcional.

Quando estiver pronto, rode `/07-midia-paga`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
