# Agência — Planejamento Estratégico

Este projeto gera o documento de Planejamento Estratégico que a agência entrega a
prospects (ainda não são clientes fechados): diagnóstico dos últimos 12 meses,
benchmark de concorrentes, metas, projeções e plano de ação. É o argumento
comercial para fechar um contrato de 12 meses.

**O documento é produzido uma única vez por prospect.** Não existe recorrência,
não existe reexecução, não existe comparação entre ciclos. Nenhuma skill deve
assumir dado de um período anterior do mesmo prospect ou versionar por data.

## Criando um prospect novo

Use a skill `criar-prospect` (ou o comando `/novo-prospect [nome]`) para
duplicar `clientes/_template/` automaticamente, em vez de copiar a pasta na
mão. Ela roda uma vez, antes da Skill 01, e nunca sobrescreve um prospect
que já existe.

## Ordem de execução

As skills rodam nesta sequência fixa, na mesma conversa, do início ao fim.
Cada uma também está disponível como comando direto (`.claude/commands/`),
para pular direto a uma etapa sem depender do Claude reconhecer a skill
certa pela descrição — ex.: `/03-diagnostico-performance`.

```
01-preparacao-de-contexto
        ↓
02-contextualizacao-estrategica
        ↓
03-diagnostico-performance
        ↓
04-unidade-economica
        ↓
05-metas-e-cenarios
        ↓
06-briefing-e-benchmark
        ↓
07-midia-paga
        ↓
08-plano-de-acao
        ↓
designer-apresentacao (subagente — roda uma vez, ao final; comando: /apresentacao-final)
```

Nenhuma etapa avança sem a checagem manual da etapa anterior confirmada pelo
analista. Não pule etapas, mesmo que pareçam repetir informação já discutida —
cada uma tem uma restrição própria sobre o que pode e não pode ser feito naquele
momento (ver cada `SKILL.md`).

## Regras que valem para qualquer skill, em qualquer etapa

### Sanitização de dados sensíveis (PII)

Nunca processar ou reproduzir CPF, e-mail, telefone, endereço completo ou dado
de cartão de nenhum cliente final do prospect. Usar apenas ID do cliente ou
nome completo quando necessário (ex.: rankings de LTV na Skill 04). Isso vale
para qualquer arquivo de qualquer prospect, não só para a planilha de dados de
unidade econômica.

### Arquivos de regra compartilhada

Toda skill que gerar gráfico ou tabela segue `.claude/skills/_shared/padrao-visual.md`.
Toda skill segue os rituais de checagem definidos em
`.claude/skills/_shared/regras-de-validacao.md` — incluindo salvar os artefatos
aprovados em `entrega/ativos-aprovados/` a cada checkpoint confirmado, e o
handoff estruturado ao final de cada etapa (Regra 6): nunca terminar só com
"avance para a próxima skill" — sempre dizer, em linguagem natural, o que
precisa estar pronto para a próxima, e atualizar
`contexto/status-planejamento.md` do prospect.

Quando a skill roda dentro da interface web (ferramentas do MCP
`planejamento` disponíveis), vale também a Regra 7 de
`regras-de-validacao.md`: checkpoints por `propor_entregavel`, pedidos de
arquivo por `solicitar_insumo` e encerramento por `sinalizar_etapa_pronta`.
Nesse modo cada etapa tem a própria conversa, e o contexto das anteriores
chega pelo dossiê e por `contexto/decisoes/`.

### Estrutura por prospect

Cada prospect novo nasce de uma cópia de `clientes/_template/`. Ver
`clientes/_template/CLAUDE.md` para overrides específicos de um prospect,
quando existirem — a regra padrão é não ter nenhum.

## Subagentes disponíveis

- **`analista-dados`** — cálculo de KPIs, geração de gráficos, motor de projeção (`scripts/projecao.py`). Usado pelas Skills 03 e 05.
- **`pesquisador-benchmark`** — pesquisa de mercado e referências via Firecrawl. Usado pela Skill 07 (e pontualmente pela 02). O benchmark de anúncios da Skill 06 não usa subagente: roda `scripts/coleta_meta_ads.py` (Apify) na própria conversa.
- **`designer-apresentacao`** — montagem da apresentação final no Canva. Roda uma única vez, ao final, lendo apenas `entrega/ativos-aprovados/`.

## Pré-requisitos da Skill 06

O benchmark de anúncios coleta a Biblioteca de Anúncios do Meta pela Apify:
precisa de `APIFY_TOKEN` no `.env` da raiz (modelo em `.env.example`) e do
`ffmpeg` instalado (`brew install ffmpeg`). O token nunca aparece em arquivo
gerado nem na conversa.
