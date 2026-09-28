# Regras de validação — comuns a todas as skills

Referenciado por todas as skills. Não copie este conteúdo para dentro de uma
skill — referencie este arquivo.

## 1. Checagem manual obrigatória

Depois de gerar qualquer gráfico, tabela ou cálculo, a skill **para** e pede
confirmação explícita do analista antes de avançar para a próxima etapa. Nunca
assumir que um resultado está correto automaticamente. Se houver qualquer
inconsistência apontada, interromper e corrigir — não seguir em frente "só
essa vez".

## 2. Salvar o aprovado

Assim que a checagem manual confirmar um gráfico ou uma seção de texto
(Análises/Insights), a skill salva o artefato em:

- Gráficos → `entrega/ativos-aprovados/graficos/<nome-do-grafico>.png`
- Texto → `entrega/ativos-aprovados/secoes/<numero-da-skill>-<nome>.md`

**Nome de arquivo estável, sem versionamento.** Se o analista pedir para
refazer um gráfico ou reescrever uma análise mais tarde, a nova versão
aprovada **sobrescreve** a anterior no mesmo caminho — não criar `-v2`, `-v3`
nem manter histórico. Só a versão aprovada mais recente importa.

Isso desacopla a montagem da apresentação final (feita pelo subagente
`designer-apresentacao`, ao final de tudo) da conversa em si: o
`designer-apresentacao` lê apenas essa pasta, não precisa saber quantas
iterações aconteceram em cada gráfico ou texto.

## 3. Regra do não-flat

Nenhuma distribuição mensal — meta anual quebrada por mês, cenários de KPI,
alocação de verba por plataforma — pode ser uniforme (o mesmo valor ou a mesma
proporção todo mês). Isso é garantido em código pelo `scripts/projecao.py`
(usado pelo subagente `analista-dados`), não por instrução em texto: o script
recusa uma distribuição flat e obriga o uso da sazonalidade histórica real do
prospect.

## 4. Teste de consistência cruzada

Sempre que um número ou ranking calculado tiver uma fonte de verdade na
plataforma de origem (ex.: ranking Top-5 clientes por gasto histórico, na
Skill 04), pedir ao analista que confirme comparando com o que a plataforma
mostra diretamente. Se houver divergência, interromper até esclarecer — nunca
seguir com um número que diverge de uma fonte que poderia ter sido checada.

## 5. Sanitização de PII

Ver `CLAUDE.md` raiz. Vale para qualquer skill que processe dado de cliente
final do prospect, não só a Skill 04.

## 6. Handoff estruturado ao final de cada etapa

Ao atingir o critério de conclusão, toda skill numerada (e a `criar-prospect`)
apresenta ao analista um bloco fechado de handoff, em vez de só dizer "avance
para a Skill NN": o que foi produzido nesta etapa, e o que precisa estar
pronto — arquivo, decisão ou resposta — para iniciar a próxima, terminando
com o comando exato para chamá-la.

O pedido é sempre em linguagem natural, como um colega pediria, nunca citando
caminho de arquivo interno (ex.: nunca `contexto/brutos/kickoff-transcricao-
bruta.docx` na mensagem ao analista). Quando o pedido envolver arquivo, o
formato sempre é nomeado do jeito que o analista reconhece — planilha/Excel,
documento Word, PDF, print/imagem, link — nunca deixado implícito.

Ao mesmo tempo, a skill atualiza `contexto/status-planejamento.md` do
prospect: marca sua própria linha como concluída (data) e reescreve o bloco
"Próximo passo" com o mesmo pedido feito ao analista no chat. Isso torna o
handoff persistente — se a conversa for reaberta em outra sessão ou
compactada por excesso de histórico, basta ler esse arquivo para saber onde o
processo parou e o que falta preparar, sem depender do chat.

Se o "Antes de começar" de uma skill mudar no futuro, atualizar também o
bloco de handoff da skill anterior correspondente — os dois textos descrevem
a mesma exigência e não podem divergir.
