// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

let caminho = "/"
vi.mock("next/navigation", () => ({ usePathname: () => caminho }))

const { NavegacaoPrincipal } = await import("./navegacao-principal")
const { ProvedorConta } = await import("./conta-contexto")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function montar(papel: "admin" | "usuario") {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(ProvedorConta, { email: "ana@boomer.com", papel, children: createElement(NavegacaoPrincipal) }))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

const link = (raiz: HTMLElement, texto: string) => [...raiz.querySelectorAll("a")].find((a) => a.textContent === texto)!

afterEach(() => {
  document.body.innerHTML = ""
  caminho = "/"
})

describe("NavegacaoPrincipal", () => {
  it("quem não é admin não vê o menu", async () => {
    const { raiz, desmontar } = await montar("usuario")
    expect(raiz.querySelector("nav")).toBeNull()
    await desmontar()
  })

  it("admin vê Prospects e Administração com os destinos certos", async () => {
    const { raiz, desmontar } = await montar("admin")
    expect(link(raiz, "Prospects").getAttribute("href")).toBe("/")
    expect(link(raiz, "Administração").getAttribute("href")).toBe("/admin/pessoas")
    await desmontar()
  })

  it("em /admin/projetos, Administração é a página atual", async () => {
    caminho = "/admin/projetos"
    const { raiz, desmontar } = await montar("admin")
    expect(link(raiz, "Administração").getAttribute("aria-current")).toBe("page")
    expect(link(raiz, "Prospects").getAttribute("aria-current")).toBeNull()
    await desmontar()
  })

  it("dentro de um prospect, Prospects fica marcado como seção, não como a página atual", async () => {
    caminho = "/prospects/verdeluz"
    const { raiz, desmontar } = await montar("admin")
    expect(link(raiz, "Prospects").getAttribute("aria-current")).toBe("true")
    await desmontar()
    caminho = "/"
    const home = await montar("admin")
    expect(link(home.raiz, "Prospects").getAttribute("aria-current")).toBe("page")
    await home.desmontar()
  })

  it("abaixo de lg (celular, tablet, meia tela), os itens ficam só ícone e o nome vai para leitor de tela", async () => {
    const { raiz, desmontar } = await montar("admin")
    for (const nome of ["Prospects", "Administração"]) {
      const item = link(raiz, nome)
      expect(item.querySelector("svg")?.getAttribute("class"), nome).toContain("lg:hidden")
      expect(item.querySelector("span")?.className, nome).toContain("max-lg:sr-only")
    }
    await desmontar()
  })

  it("o relógio só aparece de lg para cima, para a barra caber em meia tela", async () => {
    const { Relogio } = await import("./relogio")
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(Relogio)))
    expect(raiz.querySelector("span")?.className).toContain("max-lg:hidden")
    await act(async () => r.unmount())
  })
})
