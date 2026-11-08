# Aba Modelos mais clara — desenho

Data: 2026-11-08 · Ajuste da peça 3 (modelo e esforço por etapa), já no ar

## Problema

A aba Administração → Modelos (`src/apps/web/components/admin/tabela-modelos.tsx`) é uma tabela de
seletores crus. Não fica claro qual modelo e qual versão cada etapa usa (ex.: Sonnet 5.5), nem o nível
de esforço. Também não dá para ver o efeito de uma troca sem ir à aba Projetos.

## Decisões (com maquetes no companheiro visual)

| Pergunta | Decisão |
|---|---|
| Organização da tela | Cartões por etapa, em grade |
| Edição | Painel lateral com lista suspensa enriquecida (selo, versão, descrição) |
| Números de uso | Resumo discreto no rodapé de cada cartão |
| Obtenção dos números | A rota da aba Modelos já devolve o resumo (nada de chamar a rota pesada da aba Projetos) |

## 1. Tela

### Selo do modelo

- Cor por família:
  - Haiku: verde;
  - Sonnet: azul;
  - Opus: roxo;
  - família desconhecida: neutro (cinza);
  - Padrão: cinza com borda tracejada.
- O texto mostra família e versão, ex.: `Sonnet 5.5`.
  - Apelido: versão para a qual aponta hoje (`resolvedModel`), mais a marca `mais recente`.
  - Versão fixa: `Sonnet 5.5 · fixo`.
- Padrão: `Padrão (Opus 5.5)` quando o modelo padrão é conhecido, senão `Padrão`.

### Barra de esforço

- Cinco segmentos, para `low`, `medium`, `high`, `xhigh` e `max`. Acendem os segmentos até o nível
  escolhido: `low` 1, `medium` 2, `high` 3, `xhigh` 4, `max` 5.
- Rótulo ao lado: `Baixo`, `Médio`, `Alto`, `Muito alto` ou `Máximo`.
- Em padrão, os segmentos ficam apagados e o rótulo é `padrão`.

### Cartão da etapa

- Título: `<número> · <nome>`, com o rótulo do catálogo.
- Uma linha por agente que a etapa usa. Cada linha tem o selo do modelo e a barra de esforço. Rótulos:
  - `Agente principal`;
  - `Analista de dados · gráficos e projeções`;
  - `Pesquisador · benchmark e sites`.
- Faixa de sugestão quando a sugestão difere do que está salvo: `Sugestão: <modelo> · <motivo>`, com o
  botão `Aplicar`.
- Rodapé com o resumo de uso:
  - `média US$ <x> por etapa · <n> projetos` (some quando não há média);
  - `últimos turnos: <modelo>` (some quando não há turnos);
  - `sem uso ainda` quando não há nem média nem turnos.
- O cartão inteiro é clicável e abre o painel lateral.
- A grade tem 2 colunas em telas largas e 1 coluna em telas estreitas, na ordem do catálogo.

### Painel lateral

- Usa o componente `Sheet` de `@workspace/ui`, ou acrescenta-o pelo shadcn se não houver.
- Título da etapa.
- Para cada agente:
  - **Lista suspensa de modelo:** cada opção mostra o selo, a versão e a descrição curta. A primeira
    opção é `Padrão (…)`. Depois vêm os apelidos e, por último, as versões fixas.
  - **Lista suspensa de esforço:** mostra só os níveis aceitos pelo modelo, mais `Padrão`, e uma frase
    explicando o nível escolhido.
  - Sugestão com `Aplicar`, `Voltar ao padrão` e `Alterado por <nome> em <dd/mm>`.
  - O aviso `modelo não está mais na lista`, quando for o caso.
- Cada mudança salva na hora, com as mesmas regras de hoje: ao trocar o modelo, o esforço não aceito é
  limpo, e o toast confirma a gravação.
- O aviso `lista completa indisponível agora` continua no topo da aba.

Frases do esforço:

| Nível | Frase |
|---|---|
| Padrão | `deixa o Claude Code decidir` |
| `low` | `respostas rápidas, pouca reflexão` |
| `medium` | `equilíbrio entre rapidez e cuidado` |
| `high` | `pensa com cuidado antes de responder` |
| `xhigh` | `reflexão longa, para problemas difíceis` |
| `max` | `o máximo de reflexão, mais lento e caro` |

## 2. Dados

`GET /api/admin/modelos` passa a devolver, além do que já devolve:
- `uso: Partial<Record<EtapaId, { mediaUsd: number | null; projetos: number; modeloRecente: string | null }>>`;
- `padrao: string | null`.

Regras:
- **`mediaUsd` e `projetos`:**
  - é a média do custo da etapa por projeto, com a mesma regra das médias da aba Projetos: só etapas
    `concluida`, de prospects ativos, sem cliente de teste;
  - calcula só o custo (`custoPorEtapa`), sem ler presença;
  - `projetos` é quantos entraram na média, e `mediaUsd` fica `null` quando nenhum entrou.
- **`modeloRecente`:**
  - entre os 5 turnos mais recentes da etapa, por `fim`, em qualquer prospect ativo (inclusive cliente
    de teste), é o modelo com a maior soma em `modelos`;
  - fica `null` quando esses turnos não têm `modelos` (registros antigos).
- **`padrao`:** o `resolvedModel` ou o `displayName` da entrada da lista do SDK cujo `value` é `default`,
  quando existir; senão `null`.

Um método novo no serviço, `resumoDeUsoPorEtapa()`, lê `listarUsos()` uma vez e o estado de cada
prospect. Ele nunca lê presença. Nada muda no banco.

### Nome amigável do modelo

`rotuloDoModelo(id: string, nomeSdk?: string): { familia: string | null; texto: string }`:
- `claude-<familia>-<maior>-<menor>` dá `familia = <familia>` e `texto = "<Familia> <maior>.<menor>"`.
  Exemplos: `claude-sonnet-5-5` vira `Sonnet 5.5`; `claude-fable-5-1` vira `Fable 5.1`.
- Para um id fora do padrão, usa `nomeSdk` ou o próprio id, com `familia = null`.

A cor sai da família (`haiku`, `sonnet` ou `opus`), e qualquer outra família usa a cor neutra.

## 3. Testes

- **`rotuloDoModelo`:**
  - `claude-sonnet-5-5` vira `Sonnet 5.5`;
  - `claude-fable-5-1` tem família `fable` e cor neutra;
  - um id desconhecido usa o nome do SDK.
- **Selo:**
  - um apelido mostra a versão resolvida e `mais recente`;
  - uma versão fixa mostra `· fixo`;
  - padrão mostra o nome do padrão quando conhecido.
- **Barra de esforço:** quantos segmentos acendem em cada nível, e o rótulo.
- **`resumoDeUsoPorEtapa`:**
  - a média exclui cliente de teste e etapas não concluídas;
  - `modeloRecente` é o de maior gasto nos últimos 5 turnos;
  - registros antigos dão `null`;
  - sem dados, a etapa fica sem entrada.
- **Rota:** devolve `uso` e `padrao`; usuário comum recebe 403.
- **Sugestão:** a faixa só aparece quando a sugestão difere do valor salvo.
- **Build:** `next build` numa worktree isolada sem o `.env` da raiz, antes de abrir o PR.

## Fora do escopo

- Mudar a gravação, as validações, as sugestões ou o comportamento dos turnos.
- Gráficos de custo na aba Modelos. Eles ficam na aba Projetos.
