---
name: 10-revisao-pos-apresentacao
description: Revisa o plano de ação depois da reunião em que o Growth Cycle foi apresentado ao cliente. Cruza a transcrição da reunião com o plano da Skill 08, separa complementos, conflitos e pontos em aberto, espera as decisões do analista e gera o plano final (documento .docx e planilha .xlsx), que é o usado na entrega formal. Use depois da Apresentação final (Skill 09), com a transcrição da reunião de apresentação em mãos.
---

# Skill 10 — Revisão do plano de ação pós-apresentação

Skill 10 de 10, a última. Corresponde ao Prompt 10 do processo manual
(`prompts/`). Na reunião de apresentação, o cliente traz a realidade dele:
restrições de equipe e de calendário, testes que já fez, decisões que muda na
hora. Nada disso está no plano da 08. Esta etapa traz essas informações para
dentro do plano antes da entrega formal.

O plano da 08 (`plano-de-acao-estrategico.*`) fica como registro do que foi
apresentado. O resultado desta etapa é uma versão separada,
`plano-de-acao-final.*`, e é ela que vai para o cliente.

A análise não sai direto num plano novo. Primeiro, o que foi dito na reunião é
separado em três grupos: **complementos** (aplicados direto), **conflitos** (o
analista decide cada um) e **pontos em aberto** (o analista dá destino). Só
depois das decisões o plano final é gerado.

Não é etapa de refazer o diagnóstico. Não é etapa de rever cenários, metas ou
verba, a menos que o analista decida isso num conflito. Não é etapa de enviar
nada ao cliente.

A proteção vem de código: tudo o que a etapa encontra fica num registro,
`revisao-plano.json`, que `scripts/validar_revisao.py` confere contra a
transcrição (todo trecho citado precisa estar nela) e contra os planos (toda
mudança do plano final precisa de motivo).

## Antes de começar

1. **Transcrição da reunião de apresentação** (insumo obrigatório, `.docx`,
   `.txt` ou `.md`; `.pdf` não é aceito: peça a exportação em Word ou texto).
   - Interface: `solicitar_insumo` com o id `apresentacao-transcricao`. Se o
     analista anexar pelo clipe do chat, confira o conteúdo e chame
     `registrar_insumo_anexado`.
   - Terminal: peça o arquivo e salve em
     `contexto/brutos/apresentacao-transcricao-bruta.<extensão>`.
2. **Plano da 08 no formato atual.** Confira que existe
   `entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json`
   com `"versao": 2`. Se não existir (plano gerado antes de o gerador gravar o
   JSON) ou não for a versão 2, pare e explique ao analista, sem citar
   caminho, que é preciso refazer a etapa 08 para gerar de novo o plano no
   formato atual e aprovar documento e planilha. Não reconstrua o JSON a
   partir do `.docx` ou do `.xlsx`.
3. **Contexto das etapas anteriores.** Leia `contexto/decisoes/` (06, 07, 08
   e 09, principalmente) e `contexto/solucoes.json`: o plano final continua
   cobrindo toda solução do registro.
4. **Leia a transcrição inteira** (`.docx` com `pandoc -t plain`; `.txt` e
   `.md` direto).
5. **Perguntas**, uma por mensagem, cada uma com a sua sugestão
   pré-preenchida pela transcrição, esperando a resposta antes da próxima:
   1. Data de hoje (dd/mm/aaaa). Vira `data_hoje`; nenhuma ação nova ou
      alterada começa antes dela.
   2. Data da reunião de apresentação (dd/mm/aaaa). Vira `data_reuniao`.
   3. Participantes da Boomer e do cliente, com a função de cada um. Viram
      `participantes`. Registre o nome do jeito que a transcrição identifica
      quem fala: o validador confere quem disse cada trecho por esse nome. Se
      a transcrição errou um nome, combine com o analista qual grafia usar.

   Se a transcrição parecer cortada (começa ou termina no meio de uma fala,
   sem abertura ou despedida, ou dura bem menos que a reunião), pergunte se
   ela cobre a reunião inteira antes de seguir.

## Arquivos da etapa

| O quê | Interface | Terminal |
|---|---|---|
| Registro da revisão | `clientes/<slug>/.app/rascunhos/revisao-plano.json` | `clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/revisao-plano.json` |
| Plano final em edição (cópia do JSON da 08) | `clientes/<slug>/.app/rascunhos/plano-final-em-edicao.json` | `clientes/<slug>/entrega/plano-final-em-edicao.json` |
| Análise da reunião (seção) | `clientes/<slug>/.app/rascunhos/revisao-pos-apresentacao.md` | `clientes/<slug>/entrega/ativos-aprovados/secoes/10-revisao-pos-apresentacao.md` |
| Plano final (`.docx`, `.xlsx` e `.json`) | `clientes/<slug>/.app/rascunhos/plano-de-acao-final.*` | `clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/plano-de-acao-final.*` |

Na interface, `revisao-plano.json` e `plano-de-acao-final.json` ficam em
`.app/rascunhos/` com esses nomes exatos: o app os copia junto quando o
analista aprova o documento do plano final. O plano em edição tem nome
próprio porque o gerador não aceita gravar por cima do arquivo que está
lendo.

## Fase 1 · Leitura e cruzamento

Corresponde às Etapas 1 e 2 do Prompt 10.

### O que extrair

Leia a transcrição inteira e extraia tudo o que afeta o plano:

- **Restrições da realidade do cliente:** equipe, orçamento, ferramentas,
  plataforma, estoque, logística, calendário, dependência de terceiros.
- **Testes já realizados:** o que o cliente já tentou, como foi feito e qual
  foi o resultado.
- **Decisões tomadas na reunião:** o que ficou combinado, por quem e para
  quando.
- **Mudanças de prioridade ou de entendimento:** algo que o cliente considera
  mais ou menos importante do que o plano supõe.
- **Informações novas:** dados, contexto ou planos do cliente que não
  estavam na conversa (lançamento previsto, troca de fornecedor, nova
  contratação).
- **Compromissos da Boomer:** tudo o que alguém da Boomer disse que vai
  fazer, entregar ou acompanhar.
- **Objeções e dúvidas que ficaram sem resposta.**

### Como classificar

Compare cada ponto com as ações do plano da 08 e classifique:

- **Complemento** (aplicar direto): acrescenta ao plano sem contrariar
  nenhuma recomendação. Exemplos: ação nova que resolve algo discutido e está
  alinhada com o diagnóstico; detalhe que torna uma ação mais executável
  (ferramenta que o cliente usa, área responsável correta, dependência que
  ninguém tinha previsto); ajuste de data ou de dono pedido pelo cliente que
  não muda o efeito da ação na meta; plano B ou gatilho que surgiu na
  conversa.
- **Conflito** (parar e pedir decisão), sempre que:
  - o cliente diz que não vai, não pode ou não quer executar uma ação;
  - o cliente diz que já testou o que o plano recomenda e não funcionou;
  - o cliente quer seguir um caminho diferente do recomendado;
  - a mudança pedida altera verba, metas, cenário, KPIs validados ou a
    lógica de mídia do deck;
  - retirar ou adiar a ação compromete uma alavanca da meta;
  - um compromisso da Boomer na reunião contradiz o plano ou extrapola o
    escopo.
- **Ponto em aberto** (listar): o tema foi discutido mas não virou decisão,
  ou depende de confirmação do cliente. Sugira o destino: virar ação, ser
  descartado ou ser confirmado com o cliente até uma data.

**Na dúvida entre complemento e conflito, é conflito.**

Os compromissos da Boomer são listados à parte (com trecho), mesmo quando
também geram um complemento ou um conflito.

### Regras de leitura

- "Vou pensar", "pode ser" e "vamos ver" não são decisão: vão para pontos em
  aberto.
- Diferencie quem falou. Sugestão da Boomer que o cliente não confirmou não é
  decisão do cliente.
- Transcrição automática erra. Trecho incoerente (nome, número, quem falou) é
  sinalizado ao analista, não assumido.
- Todo ponto cita um trecho curto da conversa, quem falou e a posição
  aproximada na transcrição (minuto ou marcação de tempo).
- Não invente trecho. Se não encontrar na transcrição, não cite.

**"Já testamos e não funcionou".** Não descarte a recomendação
automaticamente. Verifique como foi o teste (verba, tempo, público,
execução) e diga, no conflito, se ele invalida a recomendação ou se foi
diferente do que o plano propõe.

### Plano em edição e complementos

Copie o JSON aprovado da 08 para o plano em edição e aplique nele só os
complementos (o Prompt 10 manda aplicá-los direto). Ação nova recebe o
próximo número livre e os 10 campos completos, seguindo todas as regras da
Skill 08. Nenhum conflito é aplicado nesta fase.

### Registro da revisão

Registre tudo em `revisao-plano.json`, versão 1. O esquema completo está em
`docs/superpowers/specs/2026-11-10-etapa-10-revisao-pos-apresentacao-design.md`
(Parte 2, "`revisao-plano.json`, versão 1"). Chaves de topo: `versao` (1),
`prospect`, `data_hoje`, `data_reuniao`, `participantes` (`boomer` e
`cliente`, cada um com `nome` e `funcao`), `resumo`, `complementos`,
`conflitos`, `abertos`, `compromissos` e `divergencias_cenario` (começa
vazia). O que o validador cobra:

- **Trecho** = `{"texto", "quem", "posicao"}`. `texto` copiado da transcrição
  (curto, até cerca de 300 caracteres; aspas, travessões e espaços
  diferentes não atrapalham, palavras diferentes sim). `quem` no formato
  `"Nome (lado)"`, ex.: `"Marina (cliente)"`, com o Nome escrito igual ao
  `nome` de um participante. `posicao` aproximada, ex.: `"≈23 min"`.
- **Números de ação** (`acao`, `acoes`, `acoes_afetadas`): existem no plano
  da 08 ou, se forem ações novas, no plano em edição. Eles dizem quais ações
  o item muda ou cria: é por eles que o validador confere, no fim, que toda
  mudança do plano final tem motivo.
- **Conflito:** `opcoes` com A e B obrigatórias e C opcional;
  `recomendacao_boomer` sempre preenchida com uma das opções existentes;
  `decisao` fica `null` até o analista decidir. Quando alguma opção tira a
  ação do plano, preencha já `alavanca_descoberta` e `substituta`;
  `remove_acao` fica true quando a ação sai, e o validador recusa a remoção
  de ação que é alavanca da meta sem esses dois campos.
- **Ponto em aberto:** `destino_sugerido` em texto e `destino` `null` até o
  analista decidir.
- **Compromisso:** `no_plano`, `fora_do_escopo`, `acoes` e `tratamento`
  (`null` por enquanto).
- **Datas** sempre dd/mm/aaaa.

Rode:

```
python3 scripts/validar_revisao.py \
  --revisao <revisao-plano.json> \
  --transcricao clientes/<slug>/contexto/brutos/apresentacao-transcricao-bruta.<extensão> \
  --plano-08 clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json \
  --plano-final <plano-final-em-edicao.json> \
  --rascunho
```

`ERRO:` → corrija e rode de novo antes de mostrar qualquer coisa. Trecho não
encontrado: releia a transcrição e copie o trecho como está; se ele não
existir, o ponto sai (nunca ajuste o texto para passar). `AVISO:` → corrija
(trecho longo, posição vazia, resumo com mais de 5 linhas) ou mostre ao
analista com a sua leitura. A saída `OK:` traz a contagem de cada grupo.

## Fase 2 · Análise para o analista

Corresponde à Etapa 3 do Prompt 10. Escreva a análise em Markdown, **sem
tabelas**, nesta ordem:

1. **Resumo da reunião** (até 5 linhas): o que mudou no entendimento do
   cliente e do projeto.
2. **Complementos aplicados:** para cada um, o número da ação (nova ou
   alterada), o que foi feito e o trecho da conversa que justifica.
3. **Conflitos para decisão**, numerados (Conflito 1, Conflito 2…), cada um
   neste formato:

   ```
   CONFLITO [nº]
   AÇÃO DO PLANO: [nº e nome da ação]
   O QUE O PLANO RECOMENDA: [resumo]
   O QUE FOI DITO NA REUNIÃO: [trecho curto, quem falou, minuto aproximado]
   IMPACTO: [qual alavanca ou meta é afetada e quanto, se der para estimar]
   OPÇÃO A · Manter o plano: [o que significa e o risco]
   OPÇÃO B · Seguir o que foi dito: [como a ação ficaria e o risco]
   OPÇÃO C · Caminho intermediário: [se existir]
   RECOMENDAÇÃO DA BOOMER: [qual opção e por quê]
   ```

   Quando o cliente disse que já testou algo, o conflito diz como o teste foi
   feito e se ele invalida a recomendação. Se uma opção tira a ação do plano,
   diga qual alavanca da meta fica descoberta e qual ação poderia
   substituí-la.
4. **Pontos em aberto:** cada um com o trecho e a sugestão de destino.
5. **Compromissos da Boomer na reunião:** tudo o que a Boomer prometeu fazer,
   entregar ou acompanhar, com o trecho. Sinalize o que não está no plano ou
   parece fora do escopo.
6. **Pedido de decisão:** termine pedindo que o analista responda cada
   conflito (ex.: "Conflito 1: Opção B") e dê destino a cada ponto em aberto
   (virar ação, descartar com motivo, ou confirmar com o cliente até uma
   data), e diga o que fazer com compromisso fora do plano ou do escopo.

Os números de ação e os trechos da seção são os mesmos do
`revisao-plano.json`.

- **Interface:** grave em `.app/rascunhos/revisao-pos-apresentacao.md` e
  chame `propor_entregavel` com tipo `secao` e `nome_final`
  `revisao-pos-apresentacao`. Depois de propor, encerre a resposta.
- **Terminal:** grave em
  `entrega/ativos-aprovados/secoes/10-revisao-pos-apresentacao.md` e mostre
  a análise no chat.

Checkpoint: o analista confere os trechos na transcrição (transcrição
automática erra nomes, números e quem falou), aprova a análise e responde as
decisões no chat. Se a análise precisar de ajuste, corrija o registro, rode
o validador de novo e proponha a seção outra vez.

## Fase 3 · Plano final

Corresponde à Etapa 4 do Prompt 10. Só começa com **todos** os conflitos
decididos e todos os pontos em aberto com destino. Se faltar alguma
resposta, pergunte no chat, uma por vez.

1. **Registre as decisões** no `revisao-plano.json`: `decisao` de cada
   conflito (a opção escolhida pelo analista, nunca a recomendação por conta
   própria); `destino` de cada ponto em aberto (`{"tipo": "acao", "acoes":
   [nº]}`, `{"tipo": "descartado", "motivo": "…"}` ou `{"tipo":
   "confirmar", "ate": "dd/mm/aaaa"}`, com data a partir de hoje); para cada
   compromisso fora do plano ou do escopo, as `acoes` em que virou ou o
   `tratamento` (ex.: "fora do escopo: alinhar com o cliente na próxima
   reunião"); e os números de ação que cada decisão muda ou cria
   (`acoes_afetadas`, `acoes`).
2. **Aplique as decisões no plano em edição.** Revise em cadeia as ações
   afetadas: dependências (`depende_de`), datas, gatilhos e ações que
   dependiam de algo que saiu ou mudou; cada ação que mudar por causa da
   cadeia também entra nos números de ação do item que a provocou. Confira
   que toda alavanca da meta continua coberta por pelo menos uma ação e que
   toda solução do registro continua com uma ação (se a ação removida era a
   única de uma solução, a substituta passa a citá-la; nunca apague solução
   do registro). Mantenha `data_referencia`, `janela_prova` e `fim_ciclo` do
   plano da 08; ação nova ou alterada começa a partir de hoje.
3. **Mudança de meta, verba ou número do cenário** só com decisão explícita
   do analista num conflito. Ela vale só no plano final, com rastro: registre
   cada número que passou a divergir da 06/07 em `divergencias_cenario`
   (`item`, `antes`, `depois` e os `slides` do deck afetados). Quando for uma
   meta da abertura, o `item` é o `kpi` da meta escrito **exatamente igual**
   ao do plano (o validador compara o texto). O deck não é mexido; para
   refazer na origem, o analista reabre a 06 ou a 07 pelo fluxo normal.
4. **Valide a revisão em modo final**, já com o plano em edição:

   ```
   python3 scripts/validar_revisao.py \
     --revisao <revisao-plano.json> \
     --transcricao clientes/<slug>/contexto/brutos/apresentacao-transcricao-bruta.<extensão> \
     --plano-08 clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json \
     --plano-final <plano-final-em-edicao.json>
   ```

   Sem `--rascunho`, ele recusa conflito sem decisão, ponto em aberto sem
   destino, compromisso fora do plano sem tratamento, ação incluída, alterada
   ou removida sem nenhum item da revisão que cite o número dela, e meta que
   mudou sem registro em `divergencias_cenario`. `ERRO:` → corrija o registro
   ou o plano e rode de novo.
5. **Valide o plano** com as regras da 08:

   ```
   python3 scripts/validar_plano_acao.py \
     --plano <plano-final-em-edicao.json> \
     --registro clientes/<slug>/contexto/solucoes.json
   ```

   O plano final segue todas as regras da Skill 08: os 10 campos em toda
   ação, os 6 critérios, os 7 erros a evitar, um número por KPI e nenhuma
   menção à garantia. Sem marcações [VALIDAR] ou [PREENCHER].
6. **Gere os arquivos** de uma vez:

   ```
   python3 scripts/gerar_plano_acao.py \
     --plano <plano-final-em-edicao.json> \
     --registro clientes/<slug>/contexto/solucoes.json \
     --saida-docx <pasta>/plano-de-acao-final.docx \
     --saida-xlsx <pasta>/plano-de-acao-final.xlsx \
     --saida-json <pasta>/plano-de-acao-final.json
   ```

   O script valida de novo em modo final e, com `ERRO:`, não gera nada.
   Nunca escreva o `.docx`, o `.xlsx` ou o `.json` final na mão.

- **Interface:** `<pasta>` = `clientes/<slug>/.app/rascunhos/`. Com
  `revisao-plano.json` e `plano-de-acao-final.json` já nessa pasta, proponha
  os dois arquivos com `propor_entregavel`: o `.docx` com tipo `documento` e
  o `.xlsx` com tipo `planilha`, ambos com `nome_final`
  `plano-de-acao-final`.
- **Terminal:** `<pasta>` = `clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/`
  (nomes estáveis, sobrescrevem).

Se alguma decisão mudou meta, verba ou número do cenário, avise que o deck
também precisa de atualização e liste os slides afetados.

Checkpoint: o analista confere e aprova os dois arquivos.

## Fase 4 · Relatório final

Corresponde à Etapa 5 do Prompt 10. Rode:

```
python3 scripts/relatorio_revisao.py \
  --plano-08 clientes/<slug>/entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.json \
  --plano-final <pasta>/plano-de-acao-final.json \
  --revisao <revisao-plano.json>
```

A saída traz "O que mudou", "Metas e cenário", "Cobertura da meta" e
"Pendências". Com base nela, escreva no chat, **sem tabelas**:

1. **O que mudou:** ações incluídas, alteradas e removidas, cada uma com o
   motivo (complemento, conflito decidido ou ponto em aberto resolvido).
2. **Cobertura da meta:** cada KPI influenciador do cenário e as ações que o
   movem na versão final. Aponte toda alavanca que ficou mais fraca e todo
   KPI sem ação.
3. **Coerência:** documento e planilha iguais (garantido pelo
   `gerar_plano_acao.py`, que gera os dois do mesmo JSON); números que
   divergem da 06/07, com o antes e o depois, e os slides do deck que
   precisam de atualização. Sem divergência, diga que os números batem com o
   deck.
4. **Pendências:** tudo o que ainda depende de confirmação do cliente, com
   data.
5. **Pergunta-guia:** a sua resposta sincera a "Se o cliente fizer
   exatamente isto, e só isto, por 3 meses, eu apostaria o dinheiro do
   projeto que o resultado vem?". Se não, diga o que falta.

Pergunte ao analista a resposta dele à pergunta-guia. A etapa só fecha com
"sim". "Não" volta à Fase 3 com o que falta, e o relatório roda de novo.

## Restrições

- Não gerar o plano final antes das decisões do analista.
- Não aplicar nenhum conflito por conta própria.
- Não tratar como decisão o que o cliente só cogitou.
- Não remover ação sem apontar qual alavanca da meta fica descoberta e qual
  ação a substitui.
- Não alterar cenários, metas ou verba sem decisão explícita do analista.
- Não inventar trechos da conversa.
- Não mencionar a garantia nos arquivos.
- Não refazer o diagnóstico.
- Não enviar nada ao cliente.

## Critério de conclusão

- Todos os conflitos decididos pelo analista.
- Nenhum ponto em aberto sem destino (virou ação, foi descartado com motivo
  ou está para confirmar com o cliente com data).
- Toda ação nova ou alterada com os 10 campos completos.
- `validar_revisao.py` em modo final e `gerar_plano_acao.py` sem `ERRO:`.
- Documento e planilha finais gerados e aprovados pelo analista.
- Relatório final entregue e "sim" do analista à pergunta-guia.

## Encerramento e handoff

Ao concluir, converse com o analista em linguagem natural, sem citar caminho
de arquivo:

"Nesta sessão, o plano de ação foi revisado com o que o cliente trouxe na
reunião de apresentação. O plano final, em documento Word e planilha Excel,
é o que vai para a entrega formal ao cliente; o plano apresentado fica
guardado como registro. Não preciso de mais nada: esta era a última etapa do
Growth Cycle."

Se houve número divergente da 06/07, acrescente: "Antes de enviar o deck ao
cliente, atualize estes slides: [slides]. Para refazer o número na origem,
reabra a etapa de metas e cenários ou a de mídia paga."

Depois, conforme o modo (Regras 6 e 7):

- **Terminal:** marque "10 · Revisão pós-apresentação" como ✅ em
  `contexto/status-planejamento.md`, reescreva o bloco "Próximo passo" desse
  arquivo (entrega formal do plano final e, se houver, os slides a
  atualizar) e grave `contexto/decisoes/10-revisao-pos-apresentacao.md` com
  as decisões de cada conflito, o destino dos pontos em aberto, os
  compromissos e as divergências com a 06/07.
- **Interface:** não edite `contexto/status-planejamento.md` nem
  `contexto/decisoes/`. Chame `sinalizar_etapa_pronta` com o
  `resumo_decisoes` e o mesmo texto de handoff; o app grava os dois.
