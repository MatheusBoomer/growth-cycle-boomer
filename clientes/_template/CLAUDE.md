# [Nome do Prospect]

## Contexto persistido deste prospect (rota de leitura)

Estes arquivos guardam o contexto acumulado das etapas iniciais em disco, para
que ele **não se perca** se a conversa for reaberta numa janela nova ou for
compactada por excesso de histórico. Antes de continuar qualquer skill numa
conversa que não acompanhou o processo desde o início, **releia os que já
existirem**:

- `contexto/kickoff-transcricao.md` — transcrição limpa e estruturada do
  kickoff (gerada pela Skill 01).
- `contexto/contextualizacao-estrategica.md` — entendimento estratégico
  consolidado: negócio, produto, público, posicionamento, hipóteses, gargalos
  e as respostas do analista às perguntas pendentes (gerado pela Skill 02).

Cada arquivo passa a existir quando a skill correspondente conclui. Se um deles
ainda não existe, é porque a etapa que o gera não rodou — não invente o
conteúdo.

## Overrides específicos deste prospect

Esta seção normalmente fica vazia. Use-a apenas se este prospect específico
precisar de uma regra que sobrescreva algo do `CLAUDE.md` da raiz ou de uma das
skills — por exemplo, um benchmark de conversão diferente por categoria de
produto muito específica, ou uma exceção pontual de processo.

Se não houver nenhuma exceção, não adicione nada aqui — as regras da raiz e das
skills já cobrem o processo padrão.
