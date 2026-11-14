import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CabecalhoEtapa } from "./cabecalho-etapa"

const html = (extra: Partial<Parameters<typeof CabecalhoEtapa>[0]> = {}) =>
  renderToStaticMarkup(createElement(CabecalhoEtapa, { numero: "04", fase: "Diagnóstico", titulo: "Unidade econômica", trabalhando: false, ...extra }))

describe("CabecalhoEtapa", () => {
  it("número e fase pequenos, título grande em serifada", () => {
    const h = html()
    expect(h).toContain("Etapa 04 · Diagnóstico")
    expect(h).toMatch(/<h1 class="[^"]*font-serif[^"]*">Unidade econômica<\/h1>/)
  })

  it("etapa sem número mostra só a fase", () => {
    const h = html({ numero: null, fase: "Apresentação", titulo: "Apresentação final" })
    expect(h).not.toContain("Etapa ")
    expect(h).toContain(">Apresentação<")
  })

  it("o título não corta o pé das letras (entrelinha 1.1, não leading-none)", () => expect(html()).toMatch(/<h1 class="[^"]*leading-\[1\.1\]/))

  it("selo 'Agente trabalhando' só com o agente rodando nesta etapa", () => {
    expect(html({ trabalhando: true })).toContain("Agente trabalhando")
    expect(html()).not.toContain("Agente trabalhando")
  })
})
