# Validação ponta a ponta da interface — 2026-09-28

Claude Code 2.1.251 (claude.ai, plano Team), Node 26.7, Python 3.9.6, Next.js 16.3.3.
Branch `feat/interface-planejamento`.

## Suíte automática

| Comando | Resultado |
|---|---|
| `cd src && npm test` | core 100/100, mcp-planejamento 11/11 |
| `cd src && npm run typecheck` | ok |
| `cd src && npm run lint` | 0 erros (só avisos da config `only-warn`) |
| `python3 -m pytest scripts/tests -q` | 9/9 |

## Com o executor de demonstração (sem gastar assinatura), via API

- Criar, nome repetido (409), nome só com símbolos (400), excluir com confirmação errada (400) e certa (200).
- Etapa 01: iniciar, conversa (aviso → turno_inicio → texto_agente → turno_fim), SSE com `estado`, `conversa`, `turno` e `delta`.
- Insumo de arquivo aceito; condições do Concluir corretas; endpoint interno com token errado → 401; `arquivo?caminho=../…` → 400.
- `demo:propor` de gráfico e seção reais: prévia PNG servida, ajuste, aprovação copiando para `graficos/demonstracao-grafico.png` e `secoes/01-demonstracao-secao.md`, reproposta marcando o card anterior como substituído ao aprovar o novo.
- Achado e corrigido: item da fila automática se perdia quando um turno do analista começava durante a retirada (commit `fix(core): item da fila automática…`).

## Com o Claude de verdade — Etapa 01 do prospect `teste-interface` (dados da Sottile Teste)

| Passo | Resultado |
|---|---|
| Criar prospect com site e enviar a transcrição (.docx) pelo insumo | ok |
| Iniciar etapa (114 s) | O agente carregou a skill 01, extraiu o .docx, gravou `.app/rascunhos/kickoff-transcricao.md` e chamou `propor_entregavel`; card criado |
| Aprovar | Arquivo em `entrega/ativos-aprovados/secoes/01-kickoff-transcricao.md`; turno automático; o agente atualizou o `CLAUDE.md` do prospect e pediu confirmação do site (comportamento da skill) |
| Responder no chat | O agente gravou `site-referencia.md` e chamou `sinalizar_etapa_pronta`; etapa ficou "pronta", sem pendências |
| Concluir | `contexto/decisoes/01-preparacao-de-contexto.md` completo; status atualizado; Etapa 02 liberada com o handoff |
| Escrita fora da pasta do prospect | Nenhuma (`git status` só mostrou o bloco que o `turbo` acrescenta em `src/AGENTS.md`) |

Achado e corrigido: a primeira frase do agente veio em inglês — o system prompt do modo interface agora pede português do Brasil.

Observado, sem ação: o agente tentou `cp` e `cd … &&` pelo Bash (fora da lista de permitidos) e contornou com `python3`. Deixar `cp` de fora é proposital (escaparia do hook de escrita).

## Pendente — conferência manual do analista no navegador

Não havia navegador automatizado nesta sessão. Falta conferir, em http://127.0.0.1:3000:

1. Home: cards, busca, diálogo de novo prospect (pasta ao vivo, "abrir o existente"), exclusão digitando o nome.
2. Área de trabalho: trilha, painel recolhível, "Etapa liberada", botão Concluir com a lista do que falta.
3. Chat: streaming com "Pensando…", Enter/Shift+Enter, anexo, Parar, "Tentar de novo" depois de fechar o app no meio de um turno.
4. Cards: prévia e "Ampliar" do gráfico, markdown da seção, "Pedir ajuste…", arrastar planilha no card de insumo.
5. Etapas 02 e 03 do `teste-interface` (a 02 já está liberada), reabrir a 02 e confirmar a 03 desatualizada.
6. Diálogo "Falta configurar esta máquina" com `claude auth logout`.
