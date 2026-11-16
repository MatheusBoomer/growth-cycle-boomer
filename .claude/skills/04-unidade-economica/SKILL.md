---
name: unidade-economica
description: Calcula CAC, LTV histórico e a relação LTV/CAC do prospect a partir do relatório de clientes, com sanitização obrigatória de dados sensíveis (PII) e teste de consistência contra a plataforma de origem. Use após diagnostico-performance, com o relatório histórico por cliente em mãos.
---

# Skill 04 — Unidade Econômica e Estabilidade

Skill 4 de 9. Corresponde ao Prompt 4 do processo original. Isolada das
demais skills de diagnóstico por ser a única que processa dado potencialmente
sensível (PII). Ainda estamos no Diagnóstico Atual — não propor metas,
cenários, plano de mídia ou soluções.

## Antes de começar (checklist do analista)

- [ ] `dados/clientes-historico.xlsx` anexado — relatório completo de vendas
      por cliente, com o **maior histórico possível**, idealmente desde o
      início da operação (necessário para o LTV histórico real, não só do
      período do diagnóstico)
- [ ] **Antes de anexar**, confirme que o arquivo passou por tratamento:
      colunas desnecessárias removidas, cada linha representando um cliente
      único, valor total gasto e número total de pedidos consolidados por
      cliente, duplicidades removidas, identificador consistente

## ⚠️ Dados sensíveis

Este arquivo **não deve conter** CPF, e-mail, telefone, endereço ou dado de
cartão. Usar apenas ID do cliente, ou nome completo caso não haja ID. Se o
arquivo enviado contiver esses campos, interrompa e peça ao analista para
reenviar sem eles — não prossiga processando dado sensível mesmo que pareça
inofensivo fazer a conta com ele.

## Objetivo

Analisar: CAC global; clientes novos vs recorrentes (janela do diagnóstico);
LTV histórico da marca (histórico completo); relação LTV/CAC (LTV histórico
× CAC do último mês analisado). Ao fim, gerar o documento de validação que o
cliente confere antes de qualquer meta ou solução.

## Processo

1. **CAC** — gráfico mês a mês, linha de média do período, checagem manual.
2. **Clientes novos vs recorrentes** — gráfico mês a mês (% novos, %
   recorrentes), usando a janela do diagnóstico atual (12 meses). Checagem
   manual.
3. **LTV histórico** — usando o relatório completo (não só os 12 meses):
   calcular ticket médio histórico por cliente, média de pedidos por
   cliente, LTV histórico médio. Explicitar a fórmula usada, o número total
   de clientes considerados e o período histórico utilizado. **Não gerar
   gráfico para LTV** — é um número consolidado, não uma série temporal.
4. **Teste de consistência (obrigatório):** gerar ranking Top-5 clientes por
   maior gasto histórico (ID/Nome, valor total, número de pedidos) e pedir
   ao analista para confirmar contra o ranking da própria plataforma de
   e-commerce. Se houver divergência, **interromper** até corrigir — ver
   `regras-de-validacao.md`.
5. **LTV/CAC** — calcular a relação usando LTV histórico e CAC do último mês
   do diagnóstico. Classificar pela faixa de LTV/CAC em `benchmarks-kpi.md`.
6. **Documento de validação do cliente**: com a análise acima aprovada, gerar
   o PDF com o histórico do diagnóstico (etapas 03 e 04) para o cliente
   conferir. Ver a seção "Documento de validação do cliente" abaixo.

## Estrutura da análise

1. CAC — tendência, estabilidade, pressão estrutural.
2. Novos vs Recorrentes — dependência estrutural de aquisição, indícios reais
   de retenção.
3. LTV Histórico — coerência com ticket médio, nível real de recorrência,
   robustez da base.
4. LTV/CAC: classificação segundo a faixa de `benchmarks-kpi.md`, capacidade
   real de escala, risco estrutural.

## Documento de validação do cliente

Último passo da etapa, depois da análise de LTV/CAC aprovada. O objetivo é que
o cliente confira o histórico antes de qualquer meta ou solução: se um número
estiver errado, o erro aparece agora, e não na reunião final. O PDF sai só dos
gráficos e leituras **já aprovados** das etapas 03 e 04, sem recalcular nada.
Nunca inclua dado de cliente final (ID, nome, ranking de LTV): só séries
agregadas.

1. **Montar o JSON de entrada** (em `.app/rascunhos/`, no modo interface). Use
   os PNGs aprovados em `entrega/ativos-aprovados/graficos/` e as leituras
   aprovadas em `entrega/ativos-aprovados/secoes/`:
   - `prospect` e `periodo` (ex.: "Novembro/2025 a Outubro/2026", a janela do
     diagnóstico).
   - `secoes`, agrupando os gráficos por assunto, por exemplo "Vendas e
     catálogo", "Receita e investimento", "Tráfego e conversão" e "Clientes".
     Cada gráfico é só o nome do PNG, com a `observacao` opcional.
   - A `observacao` de cada gráfico aponta os picos, os vales e as rupturas da
     série real (com mês e valor, tirados dos dados aprovados) e termina pedindo
     que o cliente confirme se esses valores estão corretos. Gráfico sem nada a
     destacar (ex.: Curva ABC) pode ficar sem observação.
   - Gráficos que o prospect não tem ficam de fora (ex.: ROAS do Google sem
     investimento em Google). Não invente série.
   - `limitacoes`: inclua o bloco só quando o prospect não tem algum dado (ex.:
     sem Google Analytics, sem Google Ads), explicando a consequência para a
     leitura (ex.: sem sessões totais, a taxa de conversão e a dependência de
     mídia paga ficam fora). Sem limitação real, use `null`.
2. **Gerar o PDF** com `scripts/gerar_documento_validacao.py` (nunca montar o
   PDF na mão), passando `--input`, `--pasta-prospect clientes/<slug>` e
   `--output clientes/<slug>/.app/rascunhos/documento-validacao.pdf`. O script
   recusa e-mail, CPF e telefone nos textos e gráfico que não existe, e não
   deixa PDF parcial.
3. **Propor o documento:** chame `propor_validacao_cliente` com o caminho do
   PDF. O app copia o arquivo e mostra no chat o card com o botão de baixar e,
   depois do download, o de confirmar. Se algum gráfico, tabela ou leitura de
   03 ou 04 foi aprovado depois da troca de um insumo (ver "Correções pedidas
   pelo cliente"), é esta chamada que é recusada, com a lista dos títulos a
   aprovar de novo: refaça os itens listados e chame de novo. O `Concluir` da
   etapa fica bloqueado até o analista baixar o PDF e confirmar a validação do
   cliente: essa regra está no app, não depende de você.
4. **Sinalizar a etapa pronta antes de encerrar o turno.** Esta é a única
   exceção à regra de encerrar a resposta logo depois de propor: assim que
   `propor_validacao_cliente` der certo, chame `sinalizar_etapa_pronta`
   (`resumo_decisoes` e `handoff_proxima`, como em "Encerramento e handoff") e só
   então escreva a mensagem de encerramento do passo 5. Não espere a confirmação
   do cliente para sinalizar. O resultado da ferramenta diz se a etapa ainda
   precisa ser sinalizada.
5. **Mensagem de encerramento do turno (só no chat):** diga ao analista, em
   linguagem natural, o que falta: baixar o PDF pelo card, mandar ao cliente, e
   voltar a esta conversa com as correções que o cliente apontar ou, se não
   houve nenhuma, confirmar no card que o cliente validou sem alterações. Nunca
   cite caminho de arquivo. Esse pedido do PDF fica só nesta mensagem do chat:
   o `handoff_proxima` e o "Próximo passo" do status trazem apenas o texto da
   próxima etapa.

**Modo terminal (sem as ferramentas do MCP):** gere o PDF direto em
`entrega/validacao-cliente/documento-validacao.pdf` (mesmo script, `--output`
nesse caminho) e peça ao analista, no chat, que confirme o download e a
validação do cliente antes de marcar a etapa 04 como concluída. Nesse modo não
há trava em código: só marque a etapa depois dessa confirmação por escrito. O
PDF fica fora de `entrega/ativos-aprovados/`: a Skill 09 não o usa.

## Correções pedidas pelo cliente

Depois do PDF, o analista volta a esta conversa com o que o cliente apontou.
Qualquer correção é tratada **aqui, na etapa 04**, mesmo quando o erro nasceu
em dado ou leitura da 03: a etapa 03 não é reaberta. Cada mensagem do analista
reabre a etapa 04, então depois de corrigir é preciso gerar o PDF de novo e
sinalizar a etapa pronta de novo.

1. **Achar a origem de cada erro apontado.** Confira, com o analista se
   preciso, se o número errado vem de um arquivo de origem (a planilha de
   histórico mensal, o relatório de produtos ou o de clientes), de um gráfico,
   de uma leitura ou de um cálculo. Pergunte no chat, uma pergunta por vez,
   quando a origem não estiver clara. Não corrija "no olho": confirme a causa
   antes de refazer.
2. **Dado de origem errado.** Peça o arquivo novo com `solicitar_insumo`
   (`historico-mensal`, `produtos-curva-abc` ou `clientes-historico`), ou
   registre o anexo do chat com `registrar_insumo_anexado`. Os insumos da 03
   continuam registrados na 03. Confira o novo arquivo, e mantenha a regra de
   PII para o de clientes.
3. **Refazer o que mudou**, seguindo as regras da Skill 03 para o que é da 03:
   cálculo e gráfico pelo subagente `analista-dados`, no padrão de
   `padrao-visual.md`, e checagem manual de cada peça refeita (proponha uma
   por vez, com `propor_entregavel`). As peças da 03 vão com
   `etapa_origem: "03"` (gráfico, tabela ou leitura); as da 04, sem o
   parâmetro. Aprovada a peça, ela sobrescreve a anterior pelo mesmo nome.
4. **Refazer tudo o que depende do dado trocado**, não só o item apontado.
   Depois de trocar uma planilha, o app trata como desatualizado todo gráfico,
   tabela e leitura de 03 e 04 aprovado antes da troca, e recusa gerar o PDF
   enquanto houver algum (quem recusa é `propor_validacao_cliente`, que lista
   os títulos a aprovar de novo). Proponha de novo cada item da lista que o app
   devolver (mesmo os que não mudaram de valor) e avise o analista, em lista
   curta, o que foi refeito e por quê.
5. **Gerar o PDF novo**, propor com `propor_validacao_cliente` e, antes de
   encerrar o turno, sinalizar a etapa pronta de novo (a mensagem do analista
   reabriu a etapa, então o sinal é preciso outra vez). Se qualquer peça ou
   insumo da 03 foi refeito, o sinal exige também `resumo_decisoes_03`: o resumo das decisões da 03
   **corrigido** (ele substitui o da 03 no dossiê das etapas seguintes). Inclua
   o campo em todo sinal depois de uma correção da 03, não só no primeiro.
6. **Registrar no resumo da 04** uma seção "Correções pedidas pelo cliente":
   o que o cliente apontou e o que mudou (números antes e depois, quando
   couber), para a Skill 05 e as seguintes saberem que os números mudaram
   depois da primeira aprovação.
7. Só depois de sinalizar, escreva a mensagem de encerramento do turno: o PDF
   novo está no card, para baixar e levar ao cliente de novo, e a confirmação é
   feita outra vez ao fim. Esse pedido do PDF fica só nesta mensagem do chat;
   o `handoff_proxima` continua sendo apenas o texto da próxima etapa.

Uma mensagem nova do analista depois da confirmação desfaz a confirmação: o
analista confirma de novo no card quando o cliente validar o PDF novo.

## Restrições

- Não propor metas, plano de mídia nem soluções: registre cada achado com
  clareza. As soluções são da Skill 05. Isso vale também nas correções do
  cliente: corrija dado e leitura do diagnóstico, nada além.
- O documento de validação nunca leva dado de cliente final (PII) e nunca vai
  para `entrega/ativos-aprovados/`.

## Critério de conclusão

- CAC validado, LTV histórico corretamente calculado com fórmula explícita.
- Ranking Top-5 confirmado contra a plataforma (ou divergência resolvida).
- LTV/CAC classificado.
- Análise salva em `entrega/ativos-aprovados/secoes/` após aprovação.
- Documento de validação gerado a partir dos gráficos aprovados, baixado pelo
  analista e confirmado como validado pelo cliente (sem alterações, ou com as
  correções feitas e um PDF novo gerado e confirmado). No modo interface essa
  condição é trava do app; no terminal, a confirmação é pedida no chat.
- Se houve correção do cliente, o resumo da 04 traz a seção "Correções pedidas
  pelo cliente" e, quando algo da 03 mudou, o resumo corrigido da 03 foi
  enviado ao sinalizar.

## Encerramento e handoff

Ao concluir, marque "04 · Unidade econômica" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo. A mensagem começa com "Nesta sessão, ..."
e nunca diz "Etapa concluída": a etapa só é concluída quando o analista clica
em Concluir (Regra 6).

São dois textos diferentes, que não se misturam:

**1. Handoff para a 05** (é o `handoff_proxima` e o "Próximo passo" do status;
só fala da próxima etapa, porque é o que continua valendo depois da validação):

"Nesta sessão, a unidade econômica ficou fechada e não preciso de arquivo
novo agora. Na próxima etapa vou
abrir cada problema que encontramos no diagnóstico em hipóteses, soluções e
impacto em reais; vale lembrar o que o prospect já tentou para resolver cada
um.

Quando estiver pronto, rode `/05-solucoes`."

No modo interface, envie esse texto em `handoff_proxima` (sem a última linha, o
comando `/05-solucoes`, que é do terminal). Reescreva também o bloco "Próximo
passo" de `contexto/status-planejamento.md` com esse mesmo aviso (só no terminal;
no modo interface o app grava o status).

**2. Mensagem de encerramento do turno do PDF** (só no chat, nunca no
`handoff_proxima` nem no "Próximo passo"): vem depois de propor o documento e
de sinalizar a etapa, e pede o que falta da validação:

"Nesta sessão, a unidade econômica ficou fechada e o documento de validação
está pronto. Falta você baixar o PDF, mandar para o cliente conferir o
histórico e voltar aqui: se ele apontar algum número errado, me conta e eu
corrijo e gero o PDF de novo; se estiver tudo certo, é só confirmar que o
cliente validou, sem alterações, e concluir a etapa."
