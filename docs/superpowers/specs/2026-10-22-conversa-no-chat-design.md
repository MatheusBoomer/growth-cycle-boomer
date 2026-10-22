# Conversa no chat principal: sem card de perguntas, pedido de ajuste como anexo

Data: 2026-10-22. Origem: conversa com o analista (Matheus) no modo dev.

## Intenção

O analista sente que os cards de "Pergunta do agente" e os campos de "Pedir ajuste"
dentro dos cards o afastam da conversa com o agente. O chat principal quase não é
usado, e isso arrisca deixar o analista em modo automático (clicar opções, aprovar).
O objetivo é forçar a conversa: perguntas do agente e pedidos de ajuste passam a
acontecer no chat principal, em texto.

## Objetivos

1. Acabar com o card "Pergunta do agente". O agente pergunta no chat, em texto, e o
   analista responde na caixa de mensagem.
2. "Pedir ajuste" (em gráficos, tabelas, seções, planilhas, documentos e relatórios
   HTML) não abre mais um campo de texto no card. Ele coloca o item no chat
   principal como um anexo/citação acima da caixa de mensagem, como os arquivos
   anexados hoje, e o analista escreve o pedido na caixa do chat.
3. Em gráficos e tabelas, as marcações (retângulo, círculo, número) continuam sendo
   feitas sobre a imagem, e passam a viajar com o anexo do chat. O que mudar em cada
   número é escrito pelo analista na própria mensagem ("1: eixo X em meses por
   extenso").

## Não objetivos

- Roteiro e apresentação final mantêm o fluxo próprio de comentários por slide.
- Citar trecho de seção, @ de arquivo e anexar arquivo continuam como são.
- Aprovar continua sendo o botão do card; aprovar por conversa não entra.
- Nenhuma mudança na máquina de estados das etapas além do necessário abaixo.

## Anti-objetivos (seria fracasso mesmo que funcione)

- Qualquer caminho que deixe o analista decidir só clicando, sem escrever ao agente.
- Marcações do gráfico que se percam ao trocar de etapa ou de tela sem aviso.
- O agente receber o pedido de ajuste sem saber qual entregável é, ou sem a imagem
  marcada quando houver marcações.

## Como funciona (decisões do analista)

- O card de perguntas sai por inteiro (decidido pelo analista).
- Pedir ajuste vira anexo no chat principal (decidido).
- Marcações aparecem no chat como parte do anexo (decidido); o texto de cada número
  é escrito na mensagem, não ao lado da marca (decidido por "isso mesmo").

## Decisões do desenho (chamadas minhas, a conferir)

1. **Anexo de ajuste.** Clicar em "Pedir ajuste…" adiciona uma "referência" ao
   compositor da etapa: etiqueta acima da caixa, com ícone do tipo, o título do
   entregável e, nos gráficos, "· N marcações"; tem X para remover. Podem existir
   várias referências na mesma mensagem (ajustar dois gráficos de uma vez). Clicar
   de novo no mesmo entregável não duplica. O foco vai para a caixa de mensagem.
2. **Gráfico e tabela.** Ao pedir ajuste, a imagem do card entra em modo de marcar
   (barra Retângulo, Círculo, Número, como hoje, mas sem caixas de texto por marca).
   As marcas ficam guardadas junto da referência. A etiqueta abre de novo o modo de
   marcar. Para marcar com a imagem grande, o modo funciona também no visualizador
   da coluna larga (decisão de construção; se complicar, só no card).
3. **Envio.** O envio da mensagem aceita uma lista opcional de ajustes
   (`entregavelId` e marcações). No envio, o cliente desenha o PNG anotado e o
   sobe pelo mesmo caminho dos anexos de arquivo. O servidor valida que cada
   entregável está pendente, grava `ajustePedido` (o card continua mostrando
   "Ajuste pedido … aguardando a nova versão") e monta a mensagem ao agente com:
   o texto do analista, para cada ajuste "AJUSTE no entregável “título”
   (nome_final): refaça, salve em .app/rascunhos/ e proponha de novo com o mesmo
   nome_final", a lista numerada das marcações com posição em % e o caminho da
   imagem anotada. Se um entregável deixou de estar pendente, o envio inteiro falha
   com a mensagem de erro e nada é enviado.
4. **Mensagem em branco.** Com referência e sem texto, o envio fica bloqueado: a
   conversa é o ponto.
5. **Versão nova.** Se o agente propõe uma nova versão do entregável, a referência
   antiga é descartada (as marcas eram da imagem anterior).
6. **Perguntas do agente.** A ferramenta `fazer_perguntas` é removida do servidor
   MCP, do serviço, das instruções do agente e das skills. As instruções passam a
   dizer: pergunte no chat, em texto, uma pergunta por vez, com a sua
   recomendação quando houver, e espere a resposta. A etapa 02 (perguntas
   estratégicas abertas) segue o mesmo princípio, uma por vez.
7. **Histórico.** Conversas antigas já têm eventos `card_perguntas`. Eles passam a
   ser mostrados como leitura apenas (pergunta e resposta em texto; "sem resposta"
   quando ficaram pendentes), sem opção de responder. O campo `perguntas` do
   estado.json continua aceito na leitura.
8. **Limpeza.** Saem: rota `/perguntas/[id]`, `CardPerguntas`, `api.responderPerguntas`,
   `mensagemRespostas`, a ação `ajuste` da rota de entregáveis e o editor com caixas
   de texto por marca (a parte de marcar é reaproveitada).

## Escolhas fechadas depois da leitura do revisor (chamadas minhas)

9. **Histórico do chat.** O evento da mensagem do analista guarda só o que ele
   escreveu, mais uma lista estruturada de referências (entregável, título e
   marcações). O balão mostra o texto dele e as etiquetas das referências, também
   depois de recarregar. A mensagem longa para o agente (instruções, lista das
   marcações, caminho da imagem) é montada no servidor e não aparece no balão.
   `ajustePedido` guarda o texto do analista; com duas referências na mesma
   mensagem, as duas cards mostram o mesmo texto.
10. **Várias referências na mesma mensagem.** As marcações são numeradas de forma
    contínua entre as referências (gráfico A com 1 e 2, gráfico B com 3), tanto
    na imagem quanto na mensagem. Assim "3: trocar a cor" nunca é ambíguo. A
    etiqueta mostra a faixa, por exemplo "Gráfico B · marcações 3 a 4".
11. **Sobrevivência das referências.** Ficam em memória, por etapa, e sobrevivem à
    troca de card e de etapa durante a sessão. Ao recarregar a página elas se
    perdem, e por isso o navegador avisa antes de sair enquanto houver referência
    não enviada. Se o agente propõe nova versão do entregável, a referência é
    descartada com um aviso na tela ("A versão mudou; as marcações antigas foram
    descartadas"); o texto já digitado fica como está.
12. **Quando o agente está rodando.** "Pedir ajuste" continua clicável e a
    referência fica na caixa, mas o envio segue as regras do compositor (só envia
    com o agente livre). Em etapa concluída ou desatualizada, o botão não aparece,
    como hoje.
13. **Imagem anotada.** Vai junto da requisição de envio e o servidor grava em
    `.app/ajustes/<id>/ajuste-N.png`, fora da Biblioteca. Como só é gravada depois
    da validação, uma falha no envio não deixa imagem órfã.
14. **Primeira entrega.** O modo de marcar existe só no card. Marcar no visualizador
    da coluna larga fica para depois (a decisão 2 passa a valer como "só no card").

## Restrições

- Cor só por token (teste de paleta); sem travessão fora de intervalo numérico
  (teste `sem-travessao`) nos arquivos de `src/`.
- Textos e nomes em português.
- O app web roda no `next dev` com serviços em memória: código de servidor novo
  precisa ser recriado após mudança (já há tratamento para os serviços e para o
  armazenamento do modo dev).

## Deixado para quem for construir

- Estrutura do estado compartilhado das referências (contexto React no visualizador
  ou estado do chat), desde que sobreviva à troca de card dentro da mesma etapa.
- Forma exata da etiqueta e do ícone por tipo de entregável.
- Como o texto antigo da `mensagemAjuste` é reaproveitado.
- Testes: o serviço (envio com ajustes, entregável não pendente), a função pura que
  monta o texto das marcações (já existe `textoDoPedido`, ajustar) e a leitura do
  histórico de perguntas.

## Estado da implementação

Entregue: card de perguntas removido (histórico antigo só leitura) e "Pedir ajuste" como referência
no chat, com marcação sobre a imagem no card (decisão 14). Plano em
`docs/superpowers/plans/2026-10-22-conversa-no-chat.md`. O envio de ponta a ponta com o agente
real ainda não foi exercitado (só testes com executor falso e a interface no navegador).
