// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import type { Ambiente } from "./conta-contexto"
import { BarraTopo } from "./barra-topo"
import { ProvedorConta } from "./conta-contexto"
import { iniciais } from "./menu-conta"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const barra = (email: string | null, ambiente?: Ambiente): ReactElement =>
  createElement(ProvedorConta, { email, papel: "admin", ambiente, children: createElement(BarraTopo, { titulo: "Growth Cycle", subtitulo: "Acme" }) })

/** Monta a barra e abre o menu da conta pelo avatar; devolve o texto do menu aberto. */
async function abrirMenu(el: ReactElement) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(el))
  const gatilho = raiz.querySelector<HTMLElement>("[data-ilha-topo] [data-slot=dropdown-menu-trigger]")!
  await act(async () => gatilho.click())
  const menu = document.querySelector("[data-slot=dropdown-menu-content]")
  return { raiz, gatilho, menu, desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("iniciais", () => {
  it("primeira e última palavra; nome único vira as duas primeiras letras", () => {
    expect(iniciais("Ana Maria Silva")).toBe("AS")
    expect(iniciais("Matheus")).toBe("MA")
    expect(iniciais("")).toBe("?")
  })
})

describe("BarraTopo: ilha à direita com o menu da conta", () => {
  it("fechada: só a ilha com Reportar e o avatar com as iniciais; nome e e-mail não ocupam a barra", () => {
    const html = renderToStaticMarkup(barra("ana.silva@boomer.com.br"))
    expect(html).toContain("data-ilha-topo")
    expect(html).toContain('aria-label="Conta de Ana Silva"')
    expect(html).toContain(">AS<")
    expect(html).not.toContain("ana.silva@boomer.com.br")
    expect(html).toContain("Growth Cycle")
    expect(html).toContain("Acme")
  })

  it("aberto: nome, e-mail, papel, horário de São Paulo, tema e Sair (POST em /auth/sair)", async () => {
    const { raiz, menu, desmontar } = await abrirMenu(barra("ana.silva@boomer.com.br"))
    expect(menu?.textContent).toContain("Ana Silva")
    expect(menu?.textContent).toContain("ana.silva@boomer.com.br · Admin")
    expect(menu?.textContent).toContain("São Paulo")
    expect(menu?.textContent).toContain("Tema claro")
    expect(menu?.textContent).toContain("Tema escuro")
    expect(menu?.textContent).toContain("Sair")
    const form = raiz.querySelector("form")!
    expect(form.getAttribute("action")).toBe("/auth/sair")
    expect(form.getAttribute("method")).toBe("post")
    await desmontar()
  })

  it("sem e-mail (modo off): avatar genérico; o menu tem horário e tema, sem Sair", async () => {
    const { raiz, gatilho, menu, desmontar } = await abrirMenu(barra(null))
    expect(gatilho.getAttribute("aria-label")).toBe("Conta e preferências")
    expect(menu?.textContent).toContain("Tema escuro")
    expect(menu?.textContent).not.toContain("Sair")
    expect(raiz.querySelector("form")).toBeNull()
    await desmontar()
  })

  it("modo local sem login: o menu tem Sair, que volta à tela de login", async () => {
    const { raiz, menu, desmontar } = await abrirMenu(barra(null, { executor: "cli", nuvem: false, semLogin: true }))
    expect(menu?.textContent).toContain("Modo local, sem login")
    expect(menu?.textContent).toContain("Sair")
    expect(raiz.querySelector("form")?.getAttribute("action")).toBe("/auth/sair")
    await desmontar()
  })

  it("fora de um provedor (páginas que usavam a barra antes): nada da conta aparece", () => {
    const html = renderToStaticMarkup(createElement(BarraTopo, { titulo: "Growth Cycle" }))
    expect(html).not.toContain("Sair")
    expect(html).not.toContain("<form")
    expect(html).toContain("Growth Cycle")
  })
})
