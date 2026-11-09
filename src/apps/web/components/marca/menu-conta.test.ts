import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BarraTopo } from "./barra-topo"
import { ProvedorConta } from "./conta-contexto"

const comConta = (email: string | null, filho: ReactElement) => renderToStaticMarkup(createElement(ProvedorConta, { email, children: filho }))

describe("BarraTopo com o menu da conta", () => {
  it("com e-mail: mostra o nome curto, o e-mail e o botão Sair que faz POST em /auth/sair", () => {
    const html = comConta("ana.silva@boomer.com.br", createElement(BarraTopo, { titulo: "Growth Cycle" }))
    expect(html).toContain("Ana Silva")
    expect(html).toContain("ana.silva@boomer.com.br")
    expect(html).toMatch(/<form [^>]*action="\/auth\/sair"/)
    expect(html).toMatch(/<form [^>]*method="post"/i)
    expect(html).toContain("Sair")
  })

  it("sem e-mail (modo off): nada da conta aparece, e a barra segue com o título", () => {
    const html = comConta(null, createElement(BarraTopo, { titulo: "Growth Cycle", subtitulo: "Acme" }))
    expect(html).not.toContain("/auth/sair")
    expect(html).not.toContain("Sair")
    expect(html).toContain("Growth Cycle")
    expect(html).toContain("Acme")
  })

  it("fora de um provedor (páginas que usavam a barra antes): nada da conta aparece", () => {
    const html = renderToStaticMarkup(createElement(BarraTopo, { titulo: "Growth Cycle" }))
    expect(html).not.toContain("Sair")
    expect(html).toContain("Growth Cycle")
  })
})
