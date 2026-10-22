---
name: solucoes
description: Abre cada problema encontrado no diagnóstico (Skills 03 e 04) em hipóteses de causa, 1 a 3 soluções concretas e impacto em R$ ou %, e grava o registro de soluções validado em código. Use após unidade-economica e antes de metas-e-cenarios.
---

# Skill 05 · Soluções

Skill 5 de 10. Aplica a regra de ouro do treinamento "Do diagnóstico à
solução": **nenhum problema sai do diagnóstico sem solução.** O cliente compra
o plano, não o gráfico.

As Skills 03 e 04 apontam os problemas; esta etapa os resolve. Ela não cria
gráfico novo nem pede arquivo novo: trabalha sobre o que já foi aprovado.

## Antes de começar (checklist do analista)

- [ ] Skills 01 a 04 concluídas e aprovadas.
- [ ] Ter em mente o que o prospect já tentou para resolver cada dor (ajuda a
      descartar soluções que já falharam).

## Leitura obrigatória

- `contexto/contextualizacao-estrategica.md` (hipóteses e gargalos da 02);
- `contexto/decisoes/03-diagnostico-performance.md` e
  `contexto/decisoes/04-unidade-economica.md`;
- `entrega/ativos-aprovados/secoes/03-*.md` e `04-*.md`;
- `.claude/skills/_shared/benchmarks-kpi.md`;
- `.claude/skills/_shared/repertorio-solucoes.md`.

## Passo 1 · Levantar os achados

Percorra cada KPI analisado nas Skills 03 e 04 e classifique:

- **Problema:** fora da faixa de `benchmarks-kpi.md`, com tendência negativa,
  ou que confirma um gargalo da 02.
- **Ponto forte:** acima da faixa. Vira argumento (ex.: "carrinho → checkout
  acima do mercado prova que o problema está nas pontas do funil").

KPI sem faixa em `benchmarks-kpi.md`: peça o valor ao analista ou acione o
`pesquisador-benchmark` com fonte citada. Nunca use valor de memória.

O repertório **não é lista fechada**: todo desvio vira problema, esteja ou não
lá. Problemas correlatos podem ser agrupados num só, se o analista concordar.

Mostre a lista (problemas e pontos fortes, com o dado de cada um) e peça ao
analista para confirmar e ordenar por prioridade. Na interface, use
`fazer_perguntas` para a ordem quando houver mais de 5 problemas.

## Passo 2 · Abrir cada problema

Para cada problema confirmado, nesta ordem:

1. **Dado:** o número, com o valor em R$ quando houver.
2. **Benchmark:** a faixa e o recorte usados.
3. **Hipóteses de causa:** pelo menos 1, idealmente 2 a 5. "Por que acontece"
   vem antes de "o que fazer".
4. **Soluções:** de 1 a 3, cada uma ligada a uma hipótese. Concretas: verbo +
   objeto + mecanismo ("régua de reativação para clientes de 1 compra aos 150
   dias"), nunca genéricas ("fortalecer CRM", "melhorar SEO"). Sem nível de
   criativo, copy ou configuração de campanha.
5. **Impacto:** em R$ ou %, com a fórmula e a premissa. A conta é feita pelo
   subagente `analista-dados`. Se realmente não der para estimar, use
   `nao_quantificavel` com a justificativa (ex.: funil sem eventos no GA4).
6. **Frente:** uma das 5 do plano de ação (texto exato):
   `Mídia Paga / Canal Principal`, `Eficiência Operacional`,
   `Produto / Mix / Portfólio`, `Redução de Dependências`,
   `Monitoramento e Governança`.

Dono e prazo ficam para a Skill 09.

## Passo 3 · Gravar e validar o registro

Grave `contexto/solucoes.json`:

    {
      "versao": 1,
      "prospect": "<nome>",
      "problemas": [
        {
          "id": "P1", "tema": "quebra", "titulo": "...", "origem": "03 · Taxa de quebra",
          "dado": "...", "benchmark": "...",
          "hipoteses": [{ "id": "H1", "texto": "..." }],
          "solucoes": [{ "id": "P1.S1", "acao": "...", "hipotese": "H1" }],
          "impacto": { "tipo": "R$", "valor": "...", "calculo": "..." },
          "frente": "Eficiência Operacional"
        }
      ],
      "pontos_fortes": [{ "titulo": "...", "dado": "...", "uso": "..." }]
    }

Rode (na interface, `--markdown clientes/<slug>/.app/rascunhos/solucoes.md`;
no terminal, `--markdown clientes/<slug>/entrega/ativos-aprovados/secoes/05-solucoes.md`):

    python3 scripts/validar_solucoes.py --modo registro \
      --registro clientes/<slug>/contexto/solucoes.json \
      --markdown <destino>

`ERRO:`: corrija o registro e rode de novo. `AVISO:`: mostre ao analista.
Nunca edite a seção gerada à mão: mude o registro e gere de novo.

## Passo 4 · Checkpoint

Apresente o checklist da Regra 8 de `regras-de-validacao.md` (itens 1 a 3
desta etapa) e peça a checagem da seção. Interface: `propor_entregavel` tipo
`secao`, `nome_final` `solucoes`. Terminal: checagem no chat; a seção já está
no destino.

## Restrições

- Não propor metas, cenários, alocação de verba nem calendário: isso é das
  Skills 06 e 08.
- Não inventar número: dado vem das Skills 03 e 04; impacto vem do
  `analista-dados`; benchmark vem de `benchmarks-kpi.md`, do analista ou de
  pesquisa com fonte.
- PII: o registro nunca cita cliente final do prospect.

## Critério de conclusão

- Todo problema confirmado no Passo 1 está no registro.
- `validar_solucoes.py --modo registro` sem `ERRO:`.
- Seção aprovada pelo analista.
- Resumo em `contexto/decisoes/05-solucoes.md` (no terminal; na interface,
  pelo `resumo_decisoes`): problemas, soluções e impactos aprovados.

## Encerramento e handoff

Ao concluir, marque "05 · Soluções" como ✅ em
`contexto/status-planejamento.md` e converse com o analista em linguagem
natural, sem citar caminho de arquivo:

"Nesta sessão, cada problema do diagnóstico ganhou hipóteses, soluções e
impacto. Não preciso de arquivo novo: só pensa numa meta clara (qual número,
em quanto tempo) e tenha em mente a receita do ano passado e alguma
sazonalidade importante do negócio, porque vou te perguntar isso logo no
início da próxima etapa. As soluções com impacto vão virar alavancas dos
cenários.

Quando estiver pronto, rode `/06-metas-e-cenarios`."

Reescreva também o bloco "Próximo passo" de `contexto/status-planejamento.md`
com esse mesmo pedido.
