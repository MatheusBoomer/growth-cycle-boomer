# Molde da apresentação final

`molde-apresentacao.pptx` tem um slide-modelo por tipo (ver
`docs/superpowers/specs/2026-10-07-apresentacao-final-pptx-design.md`, seção 3).
O script `scripts/gerar_apresentacao.py` duplica esses modelos na ordem do
roteiro e preenche os campos.

- **Campos:** cada caixa de texto ou imagem preenchida tem texto alternativo
  `campo:<nome>` (no Google Slides: botão direito → Texto alternativo).
- **Tipo do slide-modelo:** nas anotações do apresentador, `tipo:<tipo>`.
- **Capa:** o nome do prospect entra no lugar de `{{prospect}}`.

Para mudar o visual: abrir no Google Slides, editar mantendo os textos
alternativos e as anotações, exportar como .pptx por cima deste arquivo e
rodar `python3 -m pytest scripts/tests/test_molde_apresentacao.py`.
