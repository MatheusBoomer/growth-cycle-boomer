# Modo ensaiado do cliente de teste — Design

**Data:** 2026-11-16
**Status:** aprovado em brainstorming
**Escopo:** um modo do cliente de teste em que o agente é substituído por uma gravação real tocada de forma acelerada, para conduzir as demos dos dois treinamentos da plataforma (ver `2026-11-16-treinamento-plataforma-design.md`) sem esperar o agente nem gastar a assinatura.

## 1. Objetivo

Nas demos, o apresentador executa as ações reais da plataforma (enviar insumo, mandar mensagem, **Pedir ajuste…**, **Aprovar**, **Concluir etapa**), mas quem responde é um roteiro gravado. Assim cada etapa chega rápido aos pontos que interessam (perguntas da 02, ajuste e aprovação de gráfico na 03, PDF de validação na 04, comentários no roteiro e nos slides da apresentação final) e o resto da etapa é pulado com um botão.

**Critério de sucesso:** no app no ar, o apresentador roda as etapas 01 a 08 e a apresentação final do Verdeluz ensaiado, sem chamar o Claude, com cada etapa demonstrável em poucos minutos e cards, aprovações, Biblioteca e Concluir etapa funcionando como no uso real.

## 2. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Onde roda | App no ar (growthcycle.boomer.com.br), só no cliente de teste marcado como ensaio; o resto do app segue com o agente real |
| 2 | Texto do apresentador | Vem preenchido (compositor e Pedir ajuste…); o conteúdo enviado não muda a resposta |
| 3 | Etapas cobertas | Todas: 01 a 08 e a apresentação final |
| 4 | Origem do conteúdo | Uma rodada real do Verdeluz, gravada no nível do executor |
| 5 | Ritmo | Pontos de parada esperam a ação real; o botão **Avançar ensaio** toca o trecho seguinte, aprovando em sequência até o fim da etapa |
| 6 | Abordagem | Executor de ensaio por prospect (não injetar eventos na tela, não vídeo) |

## 3. Como o apresentador usa

1. Em **Criar cliente de teste** (só admin), marca a opção nova **Modo ensaiado**. O Verdeluz nasce com `estado.teste.ensaio = true` e a tela de trabalho mostra o selo **Ensaio**.
2. Envia os insumos de verdade (kit da etapa) e manda a mensagem. Em cada ponto de parada, o compositor já vem com o texto ensaiado; basta enviar.
3. O executor de ensaio toca o trecho: "pensando…", atividades, texto em streaming e chamadas de ferramenta (cards de entregável, insumos, perguntas, PDF de validação, sinalizar etapa pronta). Toda espera gravada é limitada a 2 s; o texto sai em streaming acelerado.
4. Nos pontos de parada que pedem ação na interface (ex.: ajustar o gráfico 1, aprovar o gráfico 2), o ensaio espera a ação real; o diálogo **Pedir ajuste…** abre com o texto ensaiado.
5. **Avançar ensaio** (visível só com a flag) toca o próximo trecho e executa as aprovações previstas nele pelo mesmo serviço do botão Aprovar, até o fim da etapa.
6. Para recomeçar uma etapa, usa o seletor "Em qual etapa o teste começa?" já existente; o roteiro daquela etapa volta ao primeiro trecho.

## 4. Peças

### 4.1 Gravador
Invólucro em volta do executor real, ligado por `PLANEJAMENTO_GRAVAR_ENSAIO=1` no app local. Para cada turno grava: a mensagem do analista, os `EventoExecutor` com o tempo relativo de cada um, as chamadas de ferramenta com a entrada completa e uma cópia de cada arquivo citado em `arquivo_rascunho` (gráficos, seções, planilhas, .docx, PDF, .pptx). Também registra as ações do analista na interface entre os turnos (aprovar, pedir ajuste com o texto, concluir). Saída crua em `clientes/_fixtures/verdeluz/ensaio/<etapa>/gravacao.jsonl` mais `arquivos/`.

### 4.2 Pacote de ensaio
Por etapa, em `clientes/_fixtures/verdeluz/ensaio/<etapa>/`:
- `roteiro.json` — lista ordenada de trechos. Cada trecho tem: o gatilho (mensagem do analista, ação na interface ou Avançar ensaio), o texto preenchido do gatilho, os eventos a tocar e as aprovações automáticas que o Avançar ensaio executa.
- `arquivos/` — as cópias dos rascunhos que os eventos citam.

Um script (`scripts/ensaio-montar.ts`) converte a gravação em `roteiro.json`: um trecho por mensagem do analista; toda mensagem vira ponto de parada com o texto usado já preenchido; o que vem depois do último ponto marcado fica no Avançar ensaio. O arquivo é editado à mão para transformar paradas em automáticas, encurtar textos longos do agente e ajustar a velocidade. O pacote vai para o repositório com o fixture e chega à VPS no deploy normal.

### 4.3 Executor de ensaio
Implementa a interface `Executor` (`packages/core/src/executor/tipos.ts`). É escolhido por prospect quando `estado.teste.ensaio` é verdadeiro; sem a flag vale o executor configurado no servidor. A cada turno, toca o trecho atual da etapa: copia os arquivos do pacote para os caminhos de rascunho, emite os eventos com os tempos comprimidos e faz as chamadas de ferramenta pelo endpoint interno (`/api/interno/ferramentas`), como `criarExecutorDemo` já faz. Os ids de entregável são gerados na hora, então cada ensaio é consistente por si.

### 4.4 Controle do ensaio
Guarda, por etapa, o índice do trecho atual (no estado do prospect, junto de `teste`). Expõe ao front o texto preenchido do próximo gatilho e a ação esperada, liga o botão **Avançar ensaio** e zera o índice quando o seletor de etapa reposiciona o cliente de teste.

## 5. Fora do roteiro e falhas

- Texto diferente do ensaiado: o trecho toca igual; o conteúdo não muda a resposta.
- Ação diferente da esperada (ex.: Aprovar onde o roteiro espera Pedir ajuste…): a ação acontece de verdade e o chat mostra o aviso "Fora do roteiro: use Avançar ensaio ou reinicie a etapa".
- Arquivo do pacote ausente ou roteiro inválido: aviso de erro no chat e o turno termina com `turno_fim` de erro; nada trava.
- Roteiro da etapa acabou: novas mensagens recebem uma resposta fixa curta dizendo que o ensaio desta etapa terminou.

## 6. Testes

- Executor de ensaio: dado um roteiro, emite os eventos e as chamadas de ferramenta na ordem, respeita paradas e avanço, comprime os tempos.
- Conversor gravação → roteiro.
- Serviço de turnos: prospect sem `teste.ensaio` continua no executor configurado; com a flag, usa o de ensaio.
- Avançar ensaio: executa as aprovações previstas e avança o índice; o seletor de etapa zera o índice.

Nenhuma skill muda, então nenhum `fluxo.mmd` muda.

## 7. Ordem de produção

1. Gravador, executor de ensaio, controle e o selo/botão na interface, com os testes.
2. Gravação local do Verdeluz, etapa por etapa, seguindo o roteiro das demos dos decks.
3. Montagem e edição dos `roteiro.json`, ensaio completo local.
4. Deploy e um ensaio completo no app no ar antes do treinamento.

## 8. Fora do escopo

Ensaio em prospect real, roteiro que ramifica conforme o texto digitado, editor visual de roteiro e qualquer mudança nas skills.
