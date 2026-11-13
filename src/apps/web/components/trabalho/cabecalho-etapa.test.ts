import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CabecalhoEtapa, CapaEtapa, type InfoEtapa } from "./cabecalho-etapa"

const INFO: InfoEtapa = { numero: "04", fase: "Diagnóstico", titulo: "Unidade econômica", trabalhando: false }

const barra = (compacto: boolean, extra: Partial<InfoEtapa> = {}) =>
  renderToStaticMarkup(
    createElement(CabecalhoEtapa, { ...INFO, ...extra, compacto, antes: createElement("button", null, "esq"), depois: createElement("button", null, "dir") }),
  )
const capa = (extra: Partial<InfoEtapa> = {}) => renderToStaticMarkup(createElement(CapaEtapa, { ...INFO, ...extra }))

describe("CapaEtapa (topo da conversa)", () => {
  it("número e fase pequenos, título grande em serifada que não corta o pé das letras", () => {
    const h = capa()
    expect(h).toContain(">04<")
    expect(h).toContain("Diagnóstico")
    expect(h).toMatch(/<h1 class="[^"]*font-serif[^"]*leading-\[1\.1\][^"]*">Unidade econômica<\/h1>/)
  })

  it("etapa sem número mostra só a fase", () => {
    const h = capa({ numero: null, fase: "Apresentação", titulo: "Apresentação final" })
    expect(h).not.toContain(">04<")
    expect(h).toContain("Apresentação")
  })

  it("selo 'Agente trabalhando' só com o agente rodando nesta etapa", () => {
    expect(capa({ trabalhando: true })).toContain("Agente trabalhando")
    expect(capa()).not.toContain("Agente trabalhando")
  })
})

describe("CabecalhoEtapa (barra sobre a conversa)", () => {
  it("com a capa à vista: transparente, botões dos painéis nos cantos e o nome escondido", () => {
    const h = barra(false, { trabalhando: true })
    expect(h).toContain("border-transparent")
    expect(h).toContain("esq")
    expect(h).toContain("dir")
    expect(h).toMatch(/aria-hidden="true" class="[^"]*invisible/)
    expect(h).not.toContain("Agente trabalhando")
  })

  it("compacta: uma linha com número, nome e fase, e o selo do agente quando ele roda", () => {
    const h = barra(true, { trabalhando: true })
    expect(h).toContain("data-compacto")
    expect(h).toContain("height:46px")
    expect(h).toMatch(/<h2 class="[^"]*font-serif[^"]*truncate|<h2 class="[^"]*truncate[^"]*font-serif/)
    expect(h).toContain("Unidade econômica")
    expect(h).toContain("Agente trabalhando")
  })
})
