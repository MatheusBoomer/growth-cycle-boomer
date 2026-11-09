---
name: criar-prospect
description: Cria a pasta de um prospect novo, copiando a estrutura completa de clientes/_template/ e normalizando o nome da pasta. Use sempre que for iniciar o planejamento estratégico de um prospect que ainda não tem pasta própria em clientes/ — antes da Skill 01.
---

# Skill utilitária — Criar Prospect

Não faz parte da sequência numerada 01–09: é um passo de preparação, usado
uma vez por prospect, antes de tudo o resto começar. Também disponível como
comando direto: `/novo-prospect [nome]`.

## Objetivo

Duplicar `clientes/_template/` para `clientes/<nome-do-prospect>/`, com a
estrutura de subpastas intacta, pronta para o analista preencher os insumos
brutos e começar pela Skill 01.

## Processo

1. Receber o nome do prospect do analista.
2. Normalizar o nome para um formato de pasta seguro: minúsculo, sem
   acento, espaços viram hífen, sem caracteres especiais (ex.: "Iszi
   Cosméticos" → `iszi-cosmeticos`).
3. Verificar se `clientes/<nome-normalizado>/` já existe.
   - Se já existir, **parar e perguntar ao analista** o que fazer — nunca
     sobrescrever uma pasta de prospect existente automaticamente. Pode ser
     um nome parecido de outro prospect, ou o analista pode estar tentando
     recomeçar um prospect já iniciado por engano.
4. Copiar `clientes/_template/` inteira para `clientes/<nome-normalizado>/`,
   preservando todas as subpastas: `contexto/brutos/`, `dados/`,
   `entrega/ativos-aprovados/graficos/`, `entrega/ativos-aprovados/secoes/`,
   `entrega/ativos-aprovados/benchmark/`, `entrega/ativos-aprovados/projecao/`.
5. Confirmar ao analista o caminho da pasta criada e seguir para o
   "Encerramento e handoff" abaixo.

## Restrições

- Nunca sobrescrever uma pasta de prospect que já existe.
- Não preencher nenhum arquivo de conteúdo aqui — só a estrutura de pastas.
  O preenchimento dos insumos é manual, pelo analista.
- Não alterar nada dentro de `clientes/_template/` — ela é só a origem da
  cópia, nunca o destino de uma edição.

## Critério de conclusão

Pasta `clientes/<nome-normalizado>/` existe, com a mesma estrutura de
`_template/`, e o analista confirmou que vai preencher os insumos antes de
seguir para a Skill 01.

## Encerramento e handoff

Ao concluir, marque a linha "00 · Criar prospect" como ✅ em
`contexto/status-planejamento.md` (recém-copiado junto com o resto de
`_template/`) e converse com o analista em linguagem natural, sem citar
caminho de arquivo:

"Prospect criado em `clientes/<nome-normalizado>/`! Para começarmos a Skill
01, preciso que você:
- Me manda a transcrição do kickoff em Word ou PDF.
- Se o cliente respondeu algum formulário antes da reunião, me manda
  também, em Word ou PDF.
- Me passa o link do site/e-commerce dele.

Quando estiver tudo pronto, rode `/01-preparacao-de-contexto`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
