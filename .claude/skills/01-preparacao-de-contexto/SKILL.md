---
name: preparacao-de-contexto
description: Primeira etapa do planejamento estratégico de um prospect novo. Lê a transcrição bruta da reunião de kickoff (.docx) e o outros materiais pré-kickoff (quando existir), separa conteúdo de alta qualidade de ruído de reunião, e gera a versão limpa que alimenta a etapa de contextualização estratégica. Use quando iniciar o planejamento de um prospect novo, antes de qualquer outra skill deste projeto.
---

# Skill 01 — Preparação de Contexto

Skill 1 de 10 do processo de Planejamento Estratégico. Etapa nova, sem
equivalente nos prompts originais — criada para tirar do analista o trabalho
manual de limpar a transcrição antes de usá-la.

## Antes de começar (checklist do analista)

- [ ] Transcrição bruta da reunião de kickoff exportada e salva em
      `contexto/brutos/kickoff-transcricao-bruta.docx` (ou `.docx`)
- [ ] Formulário pré-kickoff, se o prospect preencheu um, salvo em
      `contexto/brutos/formulario-cliente.docx` (ou `.pdf`)
- [ ] Link do e-commerce do prospect em mãos, para preencher
      `contexto/site-referencia.md`

## Objetivo

Construir `contexto/kickoff-transcricao.md` — uma versão limpa e estruturada
da transcrição, pronta para a Skill 02 usar — e deixar o `CLAUDE.md` do
prospect com o nome real preenchido e com qualquer exceção específica dele
já registrada. Você não está analisando o negócio ainda, só preparando o
material bruto.

## Processo

1. Ler os arquivos de `contexto/brutos/` na íntegra (use
   `pandoc -t markdown` para extrair o texto do `.docx`).
2. Se existir outros arquivos nessa pasta, ler também.
3. Separar o conteúdo em duas categorias:
   - **Alta qualidade:** decisões tomadas, contexto de negócio explicado pelo
     cliente, respostas diretas a perguntas estratégicas, números ou fatos
     mencionados.
   - **Ruído:** small talk, interrupções, repetições, trechos puramente
     administrativos (agendamento, apresentação de participantes sem
     contexto de negócio), falas incompletas ou cortadas sem sentido.
4. Quando houver formulário e transcrição, cruzar as duas fontes sem duplicar
   informação — se o formulário já responde algo que também apareceu na
   reunião, mencionar uma vez só, indicando as duas origens se forem
   complementares.
5. Escrever `contexto/kickoff-transcricao.md` organizado por tema (não por
   ordem cronológica da reunião) — modelo de negócio, produto, público,
   objetivos declarados, restrições operacionais, qualquer outro tema que
   tenha surgido.
6. Confirmar com o analista se `contexto/site-referencia.md` já tem o link
   correto do e-commerce preenchido. Se não tiver, pedir.
7. Preencher o `CLAUDE.md` do prospect (já copiado de `clientes/_template/`
   pela skill `criar-prospect`):
   - Trocar o placeholder `# [Nome do Prospect]` pelo nome real do prospect.
   - Se a transcrição ou o formulário revelarem alguma regra que sobrescreve
     o processo padrão só para este prospect — ex.: um benchmark de
     conversão diferente por categoria de produto muito específica, ou uma
     exceção pontual de processo —, registrar isso num bloco de overrides,
     citando de onde veio (transcrição/formulário).
   - Se nenhuma exceção aparecer, manter o texto padrão do template abaixo do
     nome, sem inventar override nenhum.

## Restrições

- Não interprete ou analise o negócio aqui — isso é trabalho da Skill 02.
  Esta etapa é só organização e limpeza do material bruto.
- Não descarte informação por parecer irrelevante à primeira vista — na
  dúvida, mantenha e deixe a Skill 02 decidir o peso estratégico.
- Não invente ou complete informação que não estava no material bruto.
- No `CLAUDE.md`, só registre override que estiver de fato ancorado na
  transcrição ou nos outros documentos de apoio. Na dúvida se algo é uma exceção de processo
  ou só contexto de negócio, não coloque no `CLAUDE.md` — contexto de negócio
  é trabalho da Skill 02.
- Nunca edite o `CLAUDE.md` de `clientes/_template/` — só o do prospect.

## Critério de conclusão

- `contexto/kickoff-transcricao.md` revisado pelo analista, sem trecho de
  ruído de reunião remanescente.
- `contexto/site-referencia.md` confirmado com o link correto e público
  (não ambiente de teste).
- `CLAUDE.md` do prospect com o nome real no lugar do placeholder e, se
  houver exceção específica dele, com o override registrado; caso contrário,
  com o texto padrão do template.

## Encerramento e handoff

Ao concluir, marque "01 · Preparação de contexto" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Etapa concluída! Não preciso de nada novo agora — só fique pronto para
responder com profundidade a algumas perguntas estratégicas que vou te fazer
no fim da próxima etapa. Quanto melhor a resposta, melhor o diagnóstico.

Quando estiver pronto, rode `/02-contextualizacao-estrategica`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo aviso.
