---
name: metas-e-cenarios
description: Define a meta do projeto, quebra ela mês a mês respeitando sazonalidade histórica (nunca de forma flat), e constrói os 3 cenários (Pessimista/Realista/Otimista) com a cadeia de KPIs Influenciadores para KPIs Resultado. Use após unidade-economica, com o diagnóstico completo já concluído.
---

# Skill 06 — Metas e Cenários

Skill 6 de 10. Corresponde aos Prompts 5 (Metas do Projeto) e 6
(Cenários/Impactos Esperados) do processo original. O Diagnóstico Atual está
concluído — esta skill define o alvo e a engenharia matemática que sustenta
os cenários.

Delega todo cálculo ao subagente `analista-dados`, que usa
`scripts/projecao.py`. Esta skill não faz a conta na cabeça nem deixa o
modelo "estimar" a distribuição mensal — isso é sempre calculado pelo script.

## Nota de nomenclatura

O cenário do meio é chamado de **"Realista"** (não "Meta") — é o termo que
aparece na frente do prospect no deck final. Use esse nome em toda saída
desta skill.

## Antes de começar (checklist do analista)

- [ ] Meta numérica clara: qual KPI representa a meta (faturamento, pedidos,
      outro), e em quanto tempo.
- [ ] Receita do ano anterior e eventual sazonalidade relevante já em mente.
- [ ] Diagnóstico das Skills 03 e 04 concluído e aprovado.
- [ ] Skill 05 (Soluções) concluída e aprovada: os cenários usam as soluções do
      registro como alavancas.

**Regra crítica do analista:** se o resultado dividir a meta igualmente por
todos os meses, interrompa imediatamente e peça redistribuição — isso não
deveria acontecer, já que `scripts/projecao.py` recusa distribuição flat, mas
é a checagem final antes de seguir.

## Parte 1 — Meta do Projeto

1. **Definir a meta:** confirmar o KPI-alvo e o horizonte temporal. Se não
   estiver explícito, perguntar ao analista.
2. **Avaliar criticamente a meta** usando o Diagnóstico Atual: receita do
   ano-1, crescimento histórico, sazonalidade observada, LTV/CAC, estrutura
   implícita. Classificar tecnicamente como Conservadora, Realista,
   Agressiva.
3. **Decidir sobre cenários:** dar a opinião técnica inicial sobre o nível
   da meta, então perguntar ao analista se prefere cenário único ou
   múltiplos cenários. A decisão final é do analista, mas a etapa 2 abaixo
   sempre constrói os 3 cenários de qualquer forma (a decisão do analista
   aqui só afeta o que é mostrado ao prospect depois).
4. **Quebrar a meta mês a mês** — chamar `scripts/projecao.py` com o
   histórico do ano anterior. O script identifica meses de maior e menor
   potencial histórico e distribui o crescimento de forma proporcional,
   nunca flat.
5. **Gerar gráfico comparativo** (padrão `padrao-visual.md`): resultado mês a
   mês do ano analisado vs. resultado projetado mês a mês do ano seguinte.
6. **Checagem manual:** "Confirme se a soma anual está correta e se a
   distribuição mensal faz sentido estratégico." Teste de coerência: a soma
   mensal atinge a meta anual? Respeita a sazonalidade? Existe exagero em
   meses estruturalmente fracos?

## Parte 2 — Cenários e Impactos Esperados

Construir os 3 cenários — **Pessimista, Realista e Otimista** — sempre, mesmo
que o analista tenha optado por mostrar só um ao prospect depois.

**KPIs Influenciadores** (definidos mês a mês, por cenário):
Investimento Total em Mídia Paga · Ticket Médio · Taxa de Conversão do
E-commerce · Custo por Sessão Paga (CPS) · % de Sessões Pagas (dependência)

**KPIs Resultado** (calculados automaticamente pela cadeia abaixo — nunca
preenchidos manualmente):
Sessões Totais · Vendas · Receita

A cadeia de cálculo, implementada em `scripts/projecao.py` e **confirmada**
contra dados reais de cliente:

```
sessões_pagas  = investimento / custo_por_sessão_paga
sessões_totais = sessões_pagas / %_sessões_pagas
vendas         = sessões_totais * taxa_de_conversão
receita        = vendas * ticket_médio
```

### Regras obrigatórias de construção

1. Os resultados mês a mês do cenário Realista devem bater exatamente com a
   meta quebrada na Parte 1.
2. Não é permitido crescimento flat em nenhum KPI Influenciador.
3. Deve respeitar sazonalidade histórica, sazonalidade de mercado e
   benchmarks aceitáveis (ver `benchmarks-kpi.md` para os benchmarks de
   conversão e dependência já usados no diagnóstico).
4. Nenhum KPI Influenciador pode melhorar sem justificativa apoiada no
   diagnóstico.
5. O raciocínio deve fechar matematicamente — `scripts/projecao.py` valida
   isso e recusa um cenário que não feche.

### Alavancas nomeadas (soluções do registro)

As soluções do `contexto/solucoes.json` com impacto quantificado são
**alavancas nomeadas**: para cada cenário, registre quais ids de solução ele
assume e em que intensidade (ex.: "Otimista assume P1.S1: quebra cai para
10%"). Pessimista não assume nenhuma; Realista assume as de execução mais
simples; Otimista, as demais. A tabela de cenários ganha a linha "Soluções
consideradas".

### Entrega ao analista

1. Devolver a tabela com os 3 cenários.
2. Gerar sempre os dois artefatos visuais do "Padrão de visualização dos
   cenários" abaixo — não é opcional, mesmo que o analista só peça a tabela
   em texto.
3. Pedir checagem manual — comparando com o histórico já analisado.
4. Depois de aprovado, gerar bullet points explicando: a lógica de cada
   cenário, o papel de cada KPI Influenciador, onde está o risco, onde está
   a alavanca principal.

### Padrão de visualização dos cenários (obrigatório)

Além da tabela em texto e do gráfico comparativo da Parte 1 (Ano Atual vs.
Realista), gerar sempre estes dois artefatos — independente de quantos
cenários o analista decidiu mostrar ao prospect no final (a decisão da Parte
1, etapa 3, só afeta o deck final, não o que se produz aqui):

1. **Gráfico combinado de cenários**
   (`entrega/ativos-aprovados/graficos/cenarios-pessimista-realista-otimista.png`)
   — todas as linhas na mesma imagem: Ano Atual (azul, sólida) e os 3
   cenários construídos (Pessimista cinza tracejada, Realista laranja
   tracejada, Otimista verde tracejada), marcador circular, eixo X por mês
   sem ano, legenda com folga de ~20-25% no `ylim` para nunca sobrepor o
   ponto de maior valor. Se fizer sentido, incluir linhas horizontais
   pontilhadas de referência (ex.: o piso de faturamento de cada cenário).
   Exceção justificada ao limite de "1 linha principal + até 3 de
   referência" do `padrao-visual.md`: aqui são 4 séries de dados reais, não
   linhas de referência, então o limite não se aplica da mesma forma.
2. **Tabela-imagem dos cenários**
   (`entrega/ativos-aprovados/graficos/tabela-cenarios-projecao.png`) —
   tabela renderizada em PNG (via `analista-dados`/matplotlib, não
   markdown): 1 linha por mês + linha de "TOTAL ANO", colunas Mês | Ano
   Atual | um por cenário construído, cada célula de cenário com o valor em
   R$ e, abaixo, a variação % sobre o Ano Atual daquele mês. Cabeçalho azul
   escuro com texto branco, linhas alternadas branco/cinza-claro, linha de
   TOTAL ANO destacada.

Essas duas visualizações somam-se à tabela de texto e ao gráfico
comparativo já exigidos — não os substituem.

### Planilha de Projeção de Cenários (output final)

Depois que os 3 cenários estiverem **aprovados** pelo analista, gerar a
planilha de Projeção de Cenários — é um entregável que vai para a apresentação
e é enviado ao cliente. O subagente `analista-dados` monta a planilha rodando
`scripts/preencher_projecao_xlsx.py` (nunca preenchendo célula na mão):

- **Modelo:** `.claude/skills/_shared/[MODELO] Projeção de Cenários.xlsx` — não
  editar o modelo; o script escreve numa cópia.
- **Saída:** `entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx` do
  prospect (nome estável, sobrescreve — ver `regras-de-validacao.md`).

O script preenche **só os KPIs Influenciadores** (Investimento, Ticket, Taxa de
Conversão, CPS, % de Sessões Pagas). As colunas de resultado (Sessões, Vendas,
Receita) já são **fórmulas** no modelo e recalculam ao abrir no Excel/Google
Sheets — a mesma cadeia do `scripts/projecao.py`, então batem com os cenários
aprovados.

#### Os meses são posicionais (M-1 … M-12) — ancorados na Skill 03

O modelo **não fixa** meses de calendário. A coluna "Mês" corre de `Mês m-12`
(mais antigo) a `Mês m-1` (mais recente), e qual mês real cada posição
representa depende **inteiramente da coluna de mês da planilha
`dados/historico-mensal.xlsx` da Skill 03** — que varia de planejamento para
planejamento (pode ser relativo m-1…m-12, ou meses absolutos de um período de
planejamento). Antes de montar a planilha:

1. Ler a coluna de mês do histórico da Skill 03 e fixar a **ordem
   cronológica** dos 12 meses (mais antigo → mais recente).
2. Alimentar o script com as listas nessa ordem: posição 1 = mês mais antigo
   (linha do `Mês m-12`), posição 12 = mais recente (`Mês m-1`). O
   **Período anterior** segue exatamente a ordem do histórico; cada cenário
   projetado é alinhado **posição a posição** ao mês sazonalmente equivalente.
3. Por padrão, manter os rótulos `Mês m-1 … m-12` do modelo. Se o analista
   quiser exibir os meses reais, passar a lista `meses` ao script (também na
   ordem mais antigo → mais recente).

Não inverter a ordem nem assumir Jan→Dez ou qualquer janela fixa.

A planilha tem quatro abas:

- **Comparação Meta vs Período Anterior** — pares "Novo período" × "Período
  anterior" por KPI. O **Novo período** é o cenário **Realista**; o **Período
  anterior** são os KPIs Influenciadores históricos, já levantados na **Skill
  03**: investimento, ticket médio e taxa de conversão vêm direto do histórico;
  o CPS é `investimento ÷ sessões pagas` do período; o % de sessões pagas é a
  dependência de mídia paga do período. Usar apenas valores já validados no
  diagnóstico — não recalcular nem estimar.
- **Meta** (= Realista), **Pessimista**, **Otimista** — os KPIs Influenciadores
  mês a mês de cada cenário.

Antes de salvar, conferir a checagem manual de sempre: a soma anual de receita
de cada aba bate com o cenário aprovado? A aba de comparação mostra o "Período
anterior" coerente com o diagnóstico da Skill 03? **A ordem dos meses (linha a
linha) corresponde à coluna de mês do histórico da Skill 03**, sem inversão?

## Restrições

- Não definir estrutura de campanha ou plano de mídia ainda — isso é a
  Skill 07.
- Um KPI Influenciador pode (e deve) ser "compensado" por outro para que os
  KPIs Resultado batam com a meta — não force todos os KPIs a melhorarem
  igualmente.

## Critério de conclusão

- Meta quebrada mês a mês, sem distribuição flat, soma anual confirmada.
- 3 cenários construídos e validados matematicamente pelo script.
- Gráfico combinado de cenários e tabela-imagem gerados (ver "Padrão de
  visualização dos cenários"), aprovados pelo analista.
- Bullets explicativos aprovados e salvos em `entrega/ativos-aprovados/`.
- Planilha de Projeção de Cenários gerada a partir do modelo, com o Período
  anterior (Skill 03) e os 3 cenários preenchidos, salva em
  `entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx`.

## Encerramento e handoff

Ao concluir, marque "06 · Metas e cenários" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Nesta sessão, a meta e os cenários ficaram fechados. Não preciso de nada
novo para a próxima etapa — só confirma comigo se seguimos com o cenário
Realista como base do plano de mídia paga.

Quando estiver pronto, rode `/07-midia-paga`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
