import { describe, expect, it } from "vitest"
import { textoNotasAbertas, type NotaSkill } from "../src/notas-skills"

function nota(id: number, item: string, texto: string, extra: Partial<NotaSkill> = {}): NotaSkill {
  return {
    id,
    item,
    texto,
    autor: "ana.souza@boomer.com.br",
    criadaEm: "2026-11-09T15:00:00.000Z",
    resolvidaEm: null,
    resolvidaPor: null,
    ...extra,
  }
}

const ITENS = [
  { id: "visao-geral", titulo: "Visão geral" },
  { id: "etapa:03", titulo: "Diagnóstico de performance" },
  { id: "regra:padrao-visual", titulo: "Padrão visual" },
]

describe("textoNotasAbertas", () => {
  it("agrupa pela ordem dos itens, não pela das notas, e formata a linha com autor e dd/mm", () => {
    const texto = textoNotasAbertas(
      [
        nota(3, "regra:padrao-visual", "Trocar a paleta"),
        nota(2, "etapa:03", "Pedir o relatório de produtos antes", { autor: "bia@gestaoboomer.com", criadaEm: "2026-12-01T12:00:00.000Z" }),
        nota(1, "etapa:03", "Explicar a Curva ABC"),
      ],
      ITENS,
    )
    expect(texto).toBe(
      [
        "## Diagnóstico de performance",
        "- Pedir o relatório de produtos antes (Bia, 01/12)",
        "- Explicar a Curva ABC (Ana Souza, 09/11)",
        "",
        "## Padrão visual",
        "- Trocar a paleta (Ana Souza, 09/11)",
      ].join("\n"),
    )
  })

  it("ignora as resolvidas e os itens sem nota aberta", () => {
    const texto = textoNotasAbertas(
      [
        nota(1, "visao-geral", "Já feita", { resolvidaEm: "2026-11-10T10:00:00.000Z", resolvidaPor: "bia@gestaoboomer.com" }),
        nota(2, "etapa:03", "Aberta"),
      ],
      ITENS,
    )
    expect(texto).toBe("## Diagnóstico de performance\n- Aberta (Ana Souza, 09/11)")
  })

  it("sem nota aberta devolve a frase fixa", () => {
    expect(textoNotasAbertas([], ITENS)).toBe("Nenhuma nota aberta.")
    expect(
      textoNotasAbertas([nota(1, "etapa:03", "x", { resolvidaEm: "2026-11-10T10:00:00.000Z", resolvidaPor: "a@b.com" })], ITENS),
    ).toBe("Nenhuma nota aberta.")
  })

  it("usa o dia de Brasília: 02:00 UTC ainda é o dia anterior", () => {
    const texto = textoNotasAbertas([nota(1, "etapa:03", "x", { criadaEm: "2026-11-10T02:00:00.000Z" })], ITENS)
    expect(texto).toContain("(Ana Souza, 09/11)")
  })
})
