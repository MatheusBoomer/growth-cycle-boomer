---
name: dev-comentarios
description: Executa os ajustes de interface que o desenvolvedor marcou na tela com o modo dev de comentários (pinos numerados no app web em src/apps/web) e apaga os resolvidos. Use quando o desenvolvedor pedir para ler ou resolver os comentários do modo dev, fazer os ajustes marcados na tela, ou citar .dev-comentarios. Ferramenta de desenvolvimento da interface; não é etapa do planejamento (01→09).
---

# Comentários do modo dev

O desenvolvedor roda o app (`npm run dev` em `src/`), liga o modo dev (botão "Dev" no canto inferior esquerdo ou Ctrl/⌘ + Shift + D), aponta blocos da tela (↑/↓ sobem e descem de nível) e escreve ajustes. Cada comentário fica em `.dev-comentarios/` na raiz do repositório, com página, cadeia de componentes, seletor CSS, texto visível e um recorte PNG.

Seu trabalho: executar os ajustes e deixar a lista só com o que ficou pendente.

Isto não é uma etapa do planejamento estratégico. Não se aplicam `regras-de-validacao.md`, checkpoints nem o handoff da Regra 6.

## 1. Ler

Em `src/`, rode:

```bash
npm run dev:comentarios
```

Abra cada PNG da linha `recorte:` com a ferramenta Read, para ver o que o desenvolvedor viu. Comentário sem recorte: use o texto visível e o seletor.

## 2. Localizar

- O primeiro nome depois de `#N ·` é o componente mais próximo do bloco. Ache o arquivo:
  `grep -rn "function NomeDoComponente" src/apps/web --include=*.tsx`
- Confirme com o resto da cadeia (quem renderiza quem), o `seletor` (`data-slot`, `aria-label`, ids) e o `texto` visível.
- "(componente não identificado)": procure pelo texto visível (`grep -rn "trecho do texto" src/apps/web`) e pela página (`src/apps/web/app/<página>/page.tsx`).
- Os componentes genéricos de `src/packages/ui` (Button, Card, Dialog…) ficam fora da cadeia de propósito: o ajuste quase sempre é no componente do app que os usa. Só mexa em `packages/ui` se o pedido for sobre o componente genérico no app inteiro.

## 3. Planejar

Agrupe por página e escreva para o desenvolvedor uma linha por comentário: número, arquivo e o que muda.

Pergunte antes de executar só quando o pedido for ambíguo (dá para entender de dois jeitos) ou mudar regra de negócio (fluxo das etapas, validações, dados gravados). Ajustes visuais e de texto seguem direto.

## 4. Executar e verificar

- Siga os padrões do projeto: Tailwind, componentes de `@workspace/ui`, nomes e textos em português.
- Em `src/`, rode `npm run typecheck`, `npm run lint` e `npm test`. Corrija o que quebrar antes de seguir.
- Faça um commit por grupo de ajustes (normalmente um por página), no padrão do repositório. Exemplo: `fix(web): espaçamento do painel da etapa (modo dev #1, #3)`.

## 5. Limpar

Logo depois de verificar e commitar, apague **sem perguntar** os comentários resolvidos:

```bash
npm run dev:comentarios -- --limpar 1,3
```

Se algum ficou pendente, nunca use `--limpar` sem números. No fim, diga quais ficaram e por quê, e peça para o desenvolvedor recarregar a página e conferir os ajustes.
