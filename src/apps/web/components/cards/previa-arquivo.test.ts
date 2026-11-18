import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PreviaArquivo } from "./previa-arquivo"

const base = { slug: "x", caminho: "entrega/a.png", titulo: "ROAS" } as const
const html = (props: Parameters<typeof PreviaArquivo>[0]) => renderToStaticMarkup(createElement(PreviaArquivo, props))

describe("PreviaArquivo: gráfico e tabela são ampliados num modal", () => {
  it.each(["grafico", "tabela"] as const)("%s com aoAmpliar: botão Ampliar e imagem clicável", (tipo) => {
    const h = html({ ...base, tipo, aoAmpliar: () => {} })
    expect(h).toContain("Ampliar")
    expect(h).toMatch(/<button[^>]*aria-label="Abrir ROAS"/)
    expect(h).not.toMatch(/<button[^>]*aria-label="Abrir ROAS"[^>]*disabled/)
  })

  it("sem aoAmpliar: sem botão Ampliar e imagem não clicável, mesmo com aoAbrir", () => {
    const h = html({ ...base, tipo: "grafico", aoAbrir: () => {} })
    expect(h).not.toContain("Ampliar")
    expect(h).toMatch(/<button[^>]*aria-label="Abrir ROAS"[^>]*disabled/)
  })

  it("html e apresentação continuam abrindo pelo aoAbrir", () => {
    expect(html({ ...base, tipo: "html", aoAbrir: () => {} })).toContain("Abrir")
    expect(html({ ...base, tipo: "apresentacao", aoAbrir: () => {} })).toContain("Abrir prévia")
  })
})
