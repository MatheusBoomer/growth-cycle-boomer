# Validação dos dados com o cliente, ao fim da etapa 04

Data: 2026-11-16. Tamanho: projeto grande (máquina de estados, tela, rota, script, skill, e a 04 passando a
poder corrigir insumos e entregáveis da 03).

## Intenção e por quê

Hoje o diagnóstico (etapas 03 e 04) vai direto para soluções, metas e apresentação. Se um dado do
histórico estiver errado, o erro só aparece na reunião final, e o ajuste vira correria de última hora.

O processo novo: ao fim do diagnóstico, o app gera um PDF com os dados históricos (gráficos aprovados e
observações sobre picos e vales) para o cliente conferir. O analista baixa o PDF, manda ao cliente e volta
ao app. Ele só avança depois de confirmar que o cliente validou. Se o cliente apontar erro, o analista
descreve a correção no chat, o diagnóstico é corrigido e o PDF é gerado de novo.

Exemplo real do formato: o "Documento de Validação" da Roberta Nave (PDF de 5 páginas, visual Boomer,
gráficos com uma caixa "Observação… confirme se esses valores estão corretos" e um bloco final sobre a
ausência do Google Analytics).

## Metas, não metas e antimetas

Metas
- O analista não consegue concluir a etapa 04 sem ter baixado o PDF e confirmado a validação do cliente.
- Corrigir é conversar no chat da etapa 04, como já funciona hoje.
- O PDF sai dos gráficos já aprovados, sem recalcular nada.
- O PDF reflete o que o prospect realmente tem: sem Google Analytics ou sem Google Ads, o PDF não finge
  que há esses dados e explica a limitação.

Não metas
- Enviar o PDF ao cliente pelo app (e-mail, WhatsApp, link público).
- Registrar a resposta do cliente de forma estruturada. As correções ficam no chat, como qualquer ajuste.
- Verificar que o cliente de fato recebeu ou leu o PDF. O app só sabe que o analista baixou e afirmou.

Antimetas (falha mesmo que "funcione")
- Um PDF desatualizado que o analista confirma sem perceber (gráfico mudou depois da geração).
- O agente conseguir pular a validação por conta própria.
- Bloquear prospects que já passaram da 04.
- O PDF entrar na apresentação final ou em `ativos-aprovados` (a Skill 09 lê aquela pasta).

## Restrições do projeto

- Regras em código, não em texto de skill (padrão do projeto, ver Regra 3 e Regra 8 de
  `regras-de-validacao.md`).
- Sem CPF, e-mail, telefone ou endereço de cliente final no PDF: só séries agregadas (CLAUDE.md, PII).
- Nome de arquivo estável, sem versão: o PDF novo sobrescreve o anterior.
- A skill e o fluxograma mudam juntos, no mesmo commit (CLAUDE.md): `fluxo.mmd` da 04,
  `etapas.json` (texto "O que esperar"), Regra 7 de `regras-de-validacao.md`. `npm test` em `src/apps/web`
  e `src/packages/core` antes de concluir.
- Ambiente: a VPS usa o Python do `docker/requirements.txt` (hoje sem biblioteca de PDF; só matplotlib,
  Pillow, python-pptx, openpyxl, pandas).

## Abordagens consideradas

- **A. Trava no código, com botão no card (escolhida).** O app guarda o estado da validação e inclui duas
  pendências na lista que já bloqueia o Concluir. Garante a regra sem depender do agente.
- B. Tudo por conversa: o agente pergunta se o cliente confirmou e sinaliza a etapa. Mais simples, mas
  depende do agente cumprir a instrução e não registra o download. Descartada.
- C. Híbrida (download registrado pelo app, confirmação dita no chat e gravada pelo agente). Ganho pequeno
  sobre a A e o agente ainda decide quando a confirmação vale. Descartada.

Escolha: A, pelo analista.

## O desenho (abordagem A)

### Fluxo para o analista

1. A 04 segue como hoje até a análise de LTV/CAC aprovada.
2. O agente monta o PDF e chama a nova ferramenta `propor_validacao_cliente`. No chat aparece o card
   "Documento de validação" com o botão **Baixar PDF**.
3. O agente chama `sinalizar_etapa_pronta` logo em seguida (resumo e handoff da 04 já existem). O Concluir
   continua bloqueado por duas pendências: "Baixar o documento de validação" e "Confirmar que o cliente
   validou os dados".
4. O analista baixa o PDF (o app registra o download) e só então o botão **Cliente confirmou, sem
   alterações** fica ativo.
5. Dois caminhos a partir daqui:
   - Sem alterações: o analista clica no botão. As pendências somem e o Concluir libera.
   - Com correções: o analista escreve no chat da 04 o que o cliente apontou. A mensagem reabre a etapa (já é
     o comportamento atual de `registrarMensagemAnalista`). O agente corrige, qualquer que seja a origem do
     erro (ver "Correções: tudo na etapa 04"), e gera um PDF novo. O PDF novo zera download e confirmação, e
     o ciclo recomeça do passo 2.

### Correções: tudo na etapa 04

Decisão do analista: todo apontamento do cliente é tratado no chat da 04, inclusive o que nasce em dados ou
leituras da 03. A 03 não é reaberta, continua "concluída", e as etapas seguintes ainda não começaram, então
nada a jusante fica desatualizado.

O que a 04 passa a poder fazer, só enquanto a 04 não está concluída:
- **Trocar um insumo da 03** (`historico-mensal`, `produtos-curva-abc`) e também o da própria 04. A
  ferramenta `solicitar_insumo` e o registro de anexo aceitam ids dessas etapas nesse período. O insumo fica
  registrado na etapa dona dele (03), com a mesma validação de hoje. O card aparece no chat da 04.
- **Propor de novo gráficos, tabelas e leituras da 03**. `propor_entregavel` ganha o parâmetro opcional
  `etapa_origem` (só "03" ou "04"). O entregável nasce com a etapa de origem, então o destino aprovado continua
  correto (leituras em `secoes/03-...`, gráficos pelo mesmo `nome_final`, sobrescrevendo). O card aparece no
  chat da 04, e entregáveis pendentes da 03 entram nas pendências do Concluir da 04.
- **Usar o `analista-dados`**: a etapa 04 passa a listar esse subagente em `etapas.json`, já que refazer
  gráfico e conta da 03 é trabalho dele.

Regras em código (rede de segurança contra correção pela metade):
- **Dependências:** só conta a troca de insumo feita depois da primeira geração do PDF (antes disso é o
  fluxo normal, e os gráficos da 03 foram aprovados antes do envio da planilha da 04). Depois da primeira
  geração, qualquer entregável aprovado da 03 ou da 04 (gráfico, tabela ou leitura) cuja aprovação
  seja anterior ao envio mais recente de um insumo da 03 ou da 04 conta como desatualizado. A geração do PDF
  é recusada, com a lista de itens a refazer, e o Concluir mostra a mesma lista. O app não sabe qual gráfico
  depende de qual planilha, então pode listar item que não mudou: o agente o propõe de novo e o analista
  aprova em seguida.
- **Resumo da 03:** as etapas seguintes leem o resumo de decisões da 03 pelo dossiê. Se algum entregável ou
  insumo da 03 foi refeito nesta etapa, `sinalizar_etapa_pronta` na 04 exige `resumo_decisoes_03` (resumo
  corrigido, que substitui o da 03) além do resumo da 04. O app recusa o sinal sem ele.
- **Registro:** o resumo da 04 inclui uma seção "Correções pedidas pelo cliente" (o que o cliente apontou e
  o que mudou), para a Skill 05 e as demais saberem que os números mudaram depois da primeira aprovação.

### Estado e regras (núcleo, `src/packages/core`)

Novo campo opcional em `Estado`: `validacaoCliente`, com `{ arquivo, geradoEm, baixadoEm, baixadoPor,
confirmadoEm, confirmadoPor }`. Campos de data são `null` até acontecerem. Estado antigo, sem o campo,
continua válido.

`condicoesConcluir` para a etapa 04 acrescenta, nesta ordem:
- "Gerar o documento de validação do cliente", se `validacaoCliente` não existe;
- "Gerar de novo o documento de validação: os gráficos mudaram depois dele", se algum entregável aprovado
  das etapas 03 ou 04 tem `decididoEm` posterior a `geradoEm`;
- "Baixar o documento de validação", se `baixadoEm` é nulo;
- "Confirmar que o cliente validou os dados", se `confirmadoEm` é nulo.

Transições (funções puras em `maquina-estados.ts`, no estilo das existentes):
- `registrarValidacaoGerada`: grava o novo documento, zera `baixadoEm` e `confirmadoEm`.
- `registrarDownloadValidacao`: grava `baixadoEm` e quem baixou.
- `confirmarValidacaoCliente`: exige `baixadoEm` preenchido e a etapa 04 em andamento ou pronta; grava
  `confirmadoEm` e quem confirmou. Recusa com `TransicaoInvalida` se o PDF está desatualizado.

Prospects que já têm a 04 concluída não são afetados: a regra só é avaliada enquanto a 04 não está
concluída.

### Arquivo e rotas (`src/apps/web`)

- PDF gravado em `entrega/validacao-cliente/documento-validacao.pdf` (nome estável; sobrescreve).
- Rota de download própria, dentro de `/api/prospects/[slug]/`, que registra o download e entrega o arquivo.
  A rota `arquivo` existente não registra nada e continua como está.
- Rota de confirmação, na mesma família de `etapas/[etapa]/acoes` (nova ação, por exemplo
  `confirmar-validacao-cliente`).
- Segue o controle de acesso atual (`exigirAcessoAoProspect`, teste de rotas que exigem usuário).

### Tela

- Card "Documento de validação" no chat, no estilo de `card-entregavel.tsx`: título, data de geração,
  estado em três passos (gerado → baixado → confirmado) e os dois botões.
- Botão de confirmar desativado até o download, com a explicação em uma linha.
- Texto do card em coluna estreita, itens curtos (Regra 7 de `regras-de-validacao.md`).
- Aparência segue `docs/design-system` e as regras duras do redesign (confete só ao concluir etapa).

### Geração do PDF

- Script novo em `scripts/` (nome sugerido `gerar_documento_validacao.py`), no padrão dos scripts
  existentes: recebe `--input` (JSON) e `--output` (em `.app/rascunhos/`).
- O JSON é escrito pelo agente e contém: nome do prospect, período analisado, seções
  ("Vendas e catálogo", "Receita e investimento", "Tráfego e conversão", "Clientes") e, em cada uma, os
  gráficos (caminhos em `ativos-aprovados/graficos/`) com a observação de cada um; mais a lista de limitações
  (Google Analytics ausente, Google Ads ausente, etc.).
- O script valida: todo gráfico citado existe e foi aprovado; nenhuma observação cita dado de cliente final.
  A observação de cada gráfico é opcional (no exemplo, a Curva ABC não tem). Falha com mensagem clara, sem
  gerar PDF parcial.
- As observações apontam picos, vales e rupturas da série e terminam pedindo a confirmação do cliente, como
  no exemplo. Quem escreve é o agente, a partir dos dados da 03 e da 04.
- Gráficos que o prospect não tem (ex.: ROAS Google sem investimento em Google) ficam de fora, e a limitação
  correspondente entra no bloco final.
- Layout e identidade: reproduzir o exemplo. O PDF de referência (Roberta Nave) deve ser copiado para
  `docs/referencias/validacao-cliente/` antes da construção. Pelo exemplo:
  - topo: faixa azul-marinho escuro com o logo Boomer (branco e laranja) e, embaixo, o texto "DOCUMENTO DE
    VALIDAÇÃO PRÉ-APRESENTAÇÃO" em maiúsculas espaçadas, com filete laranja;
  - nome do prospect em azul-marinho, grande e em negrito; período analisado em cinza;
  - caixa de introdução cinza-claro com barra azul-marinho à esquerda;
  - título de cada seção em maiúsculas, azul-marinho, com filete laranja embaixo;
  - cada gráfico dentro de um cartão cinza-claro de borda arredondada;
  - "Observação" em caixa amarelo-claro com barra âmbar à esquerda;
  - bloco final de fundo azul-marinho com texto centralizado ("Confirme os dados antes da apresentação");
  - rodapé cinza centralizado: "Documento de validação · Boomer | Página N de M".
  Cores, fontes e espaçamentos exatos saem do exemplo e de `docs/design-system`. O logo existe só em SVG em
  `public/marca/`: usar uma versão PNG exportada, ou a dependência que o construtor escolher para ler SVG.

### Skill, MCP e documentação

- `04-unidade-economica/SKILL.md`: novo passo final (montar o JSON, gerar o PDF, propor, sinalizar) e novo
  critério de conclusão. Handoff passa a dizer, em linguagem natural, que falta o analista baixar o PDF,
  levar ao cliente e voltar.
- MCP `planejamento`: nova ferramenta `propor_validacao_cliente` (recebe o caminho do PDF em `.app/rascunhos/`).
- `fluxo.mmd` da 04: nós para "Gerar o PDF de validação" e decisão "Analista aprova?" (classe `checkpoint`,
  saídas `sim` e `não, ajustar`), seguindo as convenções do CLAUDE.md. Atualizar também `fluxo-geral.mmd` se
  o desenho dele citar a 04.
- `etapas.json` (04): `oQueEsperar` passa a avisar que a etapa termina com o PDF para o cliente conferir.
- `regras-de-validacao.md`: Regra 7 ganha a ferramenta nova; nova regra curta descreve a validação do cliente.
- Modo terminal (sem MCP): a skill gera o PDF em `entrega/validacao-cliente/` e pede ao analista, no chat, a
  confirmação do download e da validação, sem o gate em código.
- `CLAUDE.md` raiz: lista de ferramentas do modo interface, se citada.

## Decisões minhas (para o analista conferir)

- O gatilho fica na etapa 04, porque o exemplo traz CAC e clientes novos vs recorrentes (gráficos da 04).
- Sem passo "Aprovar/Pedir ajuste" para o PDF: a conferência do analista é baixar e abrir.
- O agente sinaliza a etapa como pronta junto com a geração do PDF; o gate fica no app, não na sinalização.
- Qualquer entregável de 03 ou 04 aprovado depois do PDF o torna desatualizado. Assim, uma correção que muda
  um gráfico não deixa passar uma confirmação antiga.
- Troca de insumo da 03 pela etapa 04 invalida, por data, os entregáveis aprovados antes dela. Aceito o custo
  de o agente propor de novo itens que não mudaram, em troca de nenhum número velho escapar.
- O app registra "baixado" quando serve o arquivo pela rota própria. Não prova que o cliente recebeu.
- Uma mensagem do analista depois da confirmação desfaz a confirmação (o download continua registrado).
  Mensagem nova significa correção nova, e o analista confirma de novo no botão.
- A regra vale para todo prospect cuja 04 ainda não foi concluída, inclusive quem está com a 04 "pronta" no
  momento da publicação. Esse prospect passa a ter a pendência "Gerar o documento de validação do cliente", a
  etapa volta para "em andamento" e a próxima mensagem do analista faz o agente gerar o PDF. Quem já concluiu
  a 04 fica como está. Se o analista preferir poupar os prospects em andamento, a mudança é aplicar a regra só
  a quem iniciou a 04 depois da publicação.

## Fica com quem construir

- Biblioteca de PDF: sugestão é `reportlab` (texto selecionável, controle de layout), fixada em versão exata
  em `docker/requirements.txt` e testada no build da VPS (amd64 e arm64). Pillow ou matplotlib só gerariam PDF
  de imagem, sem texto selecionável.
- Detalhes de permissão no executor: o agente da 04 precisa poder gravar e ler o que a 03 usa
  (`dados/`, `.app/rascunhos/`, `hook-escrita.ts` do MCP) e o `analista-dados` precisa estar liberado na 04.
- Atualizar junto, por regra do CLAUDE.md, por a 04 passar a usar o `analista-dados`: `fluxo-geral.mmd`,
  `.claude/agents/analista-dados.fluxo.mmd`, a lista "Subagentes disponíveis" do CLAUDE.md e o campo
  `subagentes` da 04 em `etapas.json`.
- Texto do `SKILL.md` da 04 para o laço de correção: como o agente identifica a origem do erro, quais regras da
  03 seguir ao refazer (padrão visual, checagem manual) e que, após trocar uma planilha, regera tudo que
  depende dela e informa ao analista a lista.
- Clientes de teste e fixtures que pulam etapas: ajustar para passarem pelo gate sem travar.
- Nome exato da ação de confirmar, textos dos botões e das pendências, e testes.
