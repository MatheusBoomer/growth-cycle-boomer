---
name: contextualizacao-estrategica
description: Constrói o entendimento estratégico do negócio do prospect — modelo de negócio, produto, público, posicionamento, hipóteses e gargalos — antes de qualquer análise numérica. Use logo após a Skill 01 (preparacao-de-contexto), como primeira etapa analítica do planejamento estratégico.
---

# Skill 02 — Contextualização Estratégica

Skill 2 de 10. Corresponde ao Prompt 1 do processo original.

## Antes de começar (checklist do analista)

- [ ] `contexto/kickoff-transcricao.md` já gerado pela Skill 01
- [ ] `contexto/site-referencia.md` com o link do e-commerce confirmado

Sua responsabilidade durante esta etapa: responder com clareza e profundidade
às perguntas estratégicas que a IA fizer ao final. Quanto melhor a resposta,
melhor o diagnóstico. Não antecipe números — essa etapa é só entendimento
qualitativo.

## Objetivo

Você atua como estrategista sênior de e-commerce e crescimento digital. Seu
papel **não é analisar números ainda**. É construir a Contextualização
Estratégica do Diagnóstico Atual.

## Processo

1. Ler `contexto/kickoff-transcricao.md` com atenção.
2. Analisar o site do prospect (`contexto/site-referencia.md`): proposta de
   valor, posicionamento, tipo de produto, comunicação, estrutura da página,
   sinais visíveis de maturidade do negócio.
3. Organizar o entendimento estratégico do negócio.
4. Formular hipóteses estratégicas iniciais — não conclusões, hipóteses a
   validar na etapa quantitativa (Skills 03 e 04). Exemplos de linha de
   raciocínio: dependência excessiva de mídia paga, fragilidade de mix de
   produto, potencial de aumento de ticket médio, risco de compressão de
   ROAS em escala.
5. Identificar possíveis gargalos estruturais (branding, recorrência,
   retenção, margem, logística, posicionamento) com base apenas na
   transcrição e no site.
6. Formular **no máximo 10 perguntas estratégicas pendentes** — altamente
   estratégicas, com potencial real de mudar o entendimento do negócio, e que
   preencham lacunas que a transcrição deixou. Se algum ponto relevante não
   ficou claro, ele **deve** virar pergunta. Não gaste perguntas com questões
   operacionais irrelevantes.

   **Na interface** (ferramentas do MCP `planejamento` disponíveis), não
   liste as perguntas no texto: escreva os blocos 1 a 4 da resposta e, no
   bloco 5, só diga que as perguntas seguem no card. Depois chame
   `fazer_perguntas` uma vez com todas elas, como perguntas abertas (sem
   `opcoes`; use opções só quando a resposta for claramente uma escolha entre
   alternativas). O analista responde uma por vez, revisa e envia tudo junto;
   encerre a resposta e espere o "RESPONDEU". **No terminal**, liste as
   perguntas numeradas no bloco 5, como sempre.

## Estrutura da resposta

1. **Entendimento do Negócio** — modelo de negócio, tipo de produto, proposta
   de valor, perfil de público, posicionamento percebido, nível de maturidade
   da marca, indícios de diferenciação ou comoditização.
2. **Objetivo Declarado pelo Cliente** — meta principal mencionada, horizonte
   temporal, nível de agressividade, indícios de desalinhamento entre
   ambição e maturidade atual.
3. **Hipóteses Estratégicas Iniciais**
4. **Possíveis Gargalos Estruturais**
5. **Perguntas Estratégicas Pendentes** (máximo 10)

## Restrições

- Não analisar dados numéricos.
- Não discutir ROAS, CAC, LTV, conversão ou investimento.
- Não propor metas, plano de mídia ou soluções.

Estamos apenas construindo entendimento estratégico.

## Salvar o contexto consolidado

Depois de realizar a formulação das hipóteses estratégicas inicias, Identificar possíveis gargalos estruturais e ter as respostas do analista às perguntas estratégicas e confirmar que não
há lacuna relevante, consolide o entendimento **final** — já com os levantamentos feitos e as respostas
do analista incorporadas, não as perguntas em aberto — em:

`contexto/contextualizacao-estrategica.md`

Organize o arquivo pelos mesmos blocos da resposta (Entendimento do Negócio,
Objetivo Declarado, Hipóteses Estratégicas Iniciais, Possíveis Gargalos
Estruturais) e feche com um bloco **Definições da conversa**, registrando o que
as respostas do analista esclareceram sobre cada pergunta que estava pendente.

Este arquivo é a fonte de contexto estratégico que as Skills 03–09 assumem já
construída — em especial quando a conversa é reaberta numa janela nova ou
compactada por excesso de histórico. Por isso ele precisa **bastar sozinho**,
sem depender do que ficou dito no chat. Ele está registrado como rota de
leitura no `CLAUDE.md` do prospect, junto com o `contexto/kickoff-transcricao.md`
da Skill 01.

Nome de arquivo estável, sem versionamento: se algo for revisto depois, a
versão atualizada **sobrescreve** este mesmo arquivo (mesma lógica da
`regras-de-validacao.md`). Continua valendo a sanitização de PII do `CLAUDE.md`
raiz.

## Critério de conclusão

- Todas as perguntas estratégicas respondidas pelo analista, com
  profundidade.
- Sem lacuna relevante restante sobre produto, público, posicionamento,
  maturidade ou ambição do prospect.
- `contexto/contextualizacao-estrategica.md` salvo com o entendimento
  consolidado (ver "Salvar o contexto consolidado" acima).

## Encerramento e handoff

Ao concluir, marque "02 · Contextualização estratégica" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Nesta sessão, o entendimento do negócio ficou fechado. Para começarmos a
Skill 03, preciso que você me mande duas
planilhas (Excel): uma com o histórico dos últimos 12 meses de mídia paga e
vendas — investimento, receita, ROAS, sessões e conversão, separados por
Google e Meta — e outra com o relatório de produtos vendidos no ano, para eu
montar a Curva ABC. Se conseguir, mande também uma terceira, opcional: a
receita captada e aprovada de cada mês separada por meio de pagamento (PIX,
cartão, boleto).

Quando estiver tudo pronto, rode `/03-diagnostico-performance`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
