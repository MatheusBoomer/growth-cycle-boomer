import { describe, expect, it } from "vitest"
import { cabecalhoDaAba } from "./cabecalho-admin"

describe("cabecalhoDaAba", () => {
  it("cada aba tem título, destaque em serifada e frase", () => {
    expect(cabecalhoDaAba("/admin/pessoas")).toMatchObject({ titulo: "Pessoas", destaque: "da equipe" })
    expect(cabecalhoDaAba("/admin/projetos")).toMatchObject({ titulo: "Projetos", destaque: "e custos" })
    expect(cabecalhoDaAba("/admin/modelos")).toMatchObject({ titulo: "Modelos", destaque: "por etapa" })
    expect(cabecalhoDaAba("/admin/skills")).toMatchObject({ titulo: "Skills", destaque: "e fluxos" })
    expect(cabecalhoDaAba("/admin/reports")).toMatchObject({ titulo: "Reports", destaque: "da equipe" })
    expect(cabecalhoDaAba("/admin/modelos").frase).toBe("Vale a partir do próximo turno de cada etapa. Padrão deixa a escolha com o Claude Code.")
  })

  it("sub-rota usa a aba mãe", () => expect(cabecalhoDaAba("/admin/projetos/verdeluz")).toMatchObject({ titulo: "Projetos" }))

  it("rota desconhecida cai em Administração", () => expect(cabecalhoDaAba("/admin")).toEqual({ titulo: "Administração", destaque: "", frase: "" }))
})
