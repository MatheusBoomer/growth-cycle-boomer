// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { LinkAdministracao } from "./link-administracao"
import { ProvedorConta } from "./conta-contexto"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function montar(papel: "admin" | "usuario") {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(ProvedorConta, { email: "ana@boomer.com", papel, children: createElement(LinkAdministracao) }))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("LinkAdministracao", () => {
  it("só o admin vê o link", async () => {
    const comum = await montar("usuario")
    expect(comum.raiz.querySelector("a")).toBeNull()
    await comum.desmontar()
  })

  it("no celular fica só o ícone, mas o nome continua para leitor de tela", async () => {
    const { raiz, desmontar } = await montar("admin")
    const link = raiz.querySelector("a")!
    expect(link.getAttribute("href")).toBe("/admin/pessoas")
    expect(link.textContent).toBe("Administração")
    expect(link.querySelector("svg")?.getAttribute("class")).toContain("sm:hidden")
    expect(link.querySelector("span")?.className).toContain("max-sm:sr-only")
    await desmontar()
  })
})
