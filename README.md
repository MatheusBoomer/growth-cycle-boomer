# Agência — Growth Cycle (Claude Code)

Estrutura de projeto para padronizar a produção do documento de
Growth Cycle entregue a prospects.

## Como usar, para um prospect novo

1. **Crie a pasta do prospect** com o comando (recomendado, evita erro de
   digitação no nome da pasta):

   ```
   /novo-prospect nome-do-prospect
   ```

   Isso roda a skill `criar-prospect`, que copia `clientes/_template/` e
   nunca sobrescreve um prospect já existente. Alternativa manual:

   ```bash
   cp -r clientes/_template clientes/nome-do-prospect
   ```

2. **Preencha os insumos brutos**, em `clientes/nome-do-prospect/`:
   - `contexto/brutos/kickoff-transcricao-bruta.docx`
   - `contexto/brutos/formulario-cliente.docx` (se existir)
   - `dados/historico-mensal.xlsx`
   - `dados/produtos-curva-abc.xlsx`
   - `dados/clientes-historico.xlsx` (⚠️ sem PII — ver `dados/README.md`)

3. **Abra o Claude Code a partir da raiz deste projeto** (não de dentro da
   pasta do cliente, para que o `CLAUDE.md` raiz e as skills compartilhadas
   carreguem) e comece pela Skill 01 — por comando direto:

   ```
   /01-preparacao-de-contexto
   ```

   ou pedindo em linguagem natural:

   > "Vamos iniciar o Growth Cycle do [nome do prospect]. Use a
   > skill `preparacao-de-contexto`."

4. **Siga a sequência das 8 skills de conteúdo, em ordem**, confirmando cada checagem
   manual que a skill pedir. Não pule etapas — use os comandos
   `/01-preparacao-de-contexto` até `/08-plano-de-acao`, na ordem:

   ```
   01-preparacao-de-contexto → 02-contextualizacao-estrategica →
   03-diagnostico-performance → 04-unidade-economica →
   05-solucoes → 06-metas-e-cenarios →
   07-midia-paga → 08-plano-de-acao
   ```

   Ao final de cada etapa, a skill já avisa em linguagem natural o que
   preparar para a próxima (arquivo, decisão ou resposta) e atualiza
   `contexto/status-planejamento.md` do prospect — abra esse arquivo a
   qualquer momento para ver em que etapa o prospect está e o que falta,
   mesmo reabrindo o projeto em outro dia.

5. **Depois da Skill 08 concluída**, rode o comando `/apresentacao-final`
   para montar a apresentação — o subagente `designer-apresentacao` lê só
   `entrega/ativos-aprovados/` e produz o arquivo final em `entrega/`.

## Interface web (protótipo)

Em vez de chamar as skills no terminal, dá para conduzir o planejamento pela
interface local, que cria o prospect, mostra o chat por etapa, os cards de
aprovação e de envio de planilha, e libera a próxima etapa quando você
conclui a atual.

    cd src
    npm install
    npm run dev          # http://127.0.0.1:3000

Requisitos: Node ≥ 22.18, Python 3 com openpyxl/pandas/matplotlib e o Claude
Code instalado e logado (`claude auth login`). O protótipo usa a sua
assinatura do Claude, não uma chave de API. Para mexer na tela sem gastar
uso: `PLANEJAMENTO_EXECUTOR=demo npm run dev`.

Os modelos de planilha que o analista baixa ficam em
`.claude/skills/_shared/modelos-insumo/` (ver o README de lá). Design:
`docs/superpowers/specs/2026-09-28-interface-planejamento-design.md`.

## Pré-requisitos de configuração (uma vez só, não por cliente)

- **Brand Template no Canva** — o `designer-apresentacao` depende de um
  template já publicado no Canva para este tipo de deck. Ver
  `.claude/agents/designer-apresentacao.md`.
- **Dependências do `scripts/projecao.py`** — só biblioteca padrão do
  Python 3 (nenhuma instalação extra necessária).

## Mapa da estrutura

```
CLAUDE.md                      # regras gerais da agência
.claude/
  skills/
    _shared/                   # padrao-visual.md e regras-de-validacao.md
    criar-prospect/            # skill utilitária — duplica _template/
    01-preparacao-de-contexto/
    02-contextualizacao-estrategica/
    03-diagnostico-performance/
    04-unidade-economica/
    05-solucoes/
    06-metas-e-cenarios/
    07-midia-paga/
    08-plano-de-acao/
    09-apresentacao-final/
    _desativadas/              # etapas fora do fluxo (briefing-e-benchmark)
  agents/
    analista-dados.md          # cálculo, gráficos, motor de projeção
    pesquisador-benchmark.md   # pesquisa de concorrentes via Firecrawl
    designer-apresentacao.md   # montagem final no Canva
  commands/                    # atalho direto pra cada skill/subagente
    novo-prospect.md           # /novo-prospect [nome]
    01-preparacao-de-contexto.md ... 08-plano-de-acao.md
    apresentacao-final.md      # /apresentacao-final
scripts/
  projecao.py                  # motor de projeção (testado — ver spec)
clientes/
  _template/                   # nunca editar direto — só copiar
  <prospect>/                  # uma pasta por prospect real
```
