# Validação da apresentação final — Entrega B (2026-10-08)

Plano: `docs/superpowers/plans/2026-10-08-apresentacao-final-entrega-b.md`.

## Suítes

| Comando | Resultado |
|---|---|
| `python3 -m pytest scripts/tests -q` | 117/117 (testes de conversão rodando, nenhum `skipped`) |
| `cd src && npx turbo test typecheck lint` | core 154/154, web 27/27, mcp 11/11; typecheck ok; lint sem erros (avisos já existentes) |

## Ferramentas

- `brew install --cask libreoffice` (26.8), `brew install poppler`, `brew install --cask font-montserrat`.
- Achado: o molde usa **Century Gothic** (fonte da Microsoft, ausente no Mac) nos títulos, e o
  LibreOffice sem janela só enxerga fontes pelo fontconfig. A primeira prévia saiu em fonte
  serifada, com quebras de linha diferentes. Corrigido: o script grava um `fonts.conf`
  temporário (pastas de fontes do sistema e do usuário + troca Century Gothic → TeX Gyre
  Adventor, clone métrico livre: `brew install --cask font-tex-gyre-adventor`). Conferido no
  PDF: só Montserrat, TeX Gyre Adventor e Arial.

## Prévia e comentários com as ferramentas reais

Teste de integração temporário (`ServicoComentarios` + `criarPreviaPython` de verdade) sobre
o deck de teste do sottile-teste (14 slides), numa pasta temporária:

- Prévia: 14 PNGs em ~10 s; segunda abertura usa o cache.
- Região sobre as conclusões do slide 4 → campo `conclusoes`; região 0×0 recusada.
- Envio: 2 comentários → uma mensagem de ajuste estruturada; segundo envio recusado
  ("Nenhum comentário novo para enviar").
- Recorte conferido: área das conclusões com margem e contorno laranja.
- Achado corrigido: em slides sem campo de título (análises em 2 colunas), o rótulo juntava
  os dois blocos e cortava no meio da palavra. Agora usa a 1ª linha do texto mais acima à
  esquerda ("Análises sobre o investimento"), com teste.

## Pendente: conferência na tela

O app que já estava rodando na porta 3000 precisa ser **reiniciado**: o conjunto de serviços
fica guardado no processo e foi criado antes de existir o serviço de comentários. Depois de
reiniciar, o analista abre um prospect com a apresentação proposta, clica em "Abrir prévia",
arrasta sobre um slide, comenta, envia e confere a mensagem que chega ao agente.
