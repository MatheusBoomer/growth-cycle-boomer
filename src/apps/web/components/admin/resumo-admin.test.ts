// @vitest-environment jsdom
import { act, createElement, Fragment } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ caminho: "/admin/reports" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.caminho, useSearchParams: () => new URLSearchParams() }))
const resumoAdmin = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api", () => ({ api: { resumoAdmin } }))

const { ProvedorResumoAdmin, ConteudoAba } = await import("./resumo-admin")
const { CabecalhoAdmin } = await import("./cabecalho-admin")
const { AbasAdmin } = await import("./abas-admin")
const { avisarResumoAdmin } = await import("@/lib/resumo-admin")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  nav.caminho = "/admin/reports"
  resumoAdmin.mockResolvedValue({ pessoas: 6, admins: 2, etapas: 9, notasAbertas: 5, reportsAbertos: 3 })
})
afterEach(() => {
  document.body.innerHTML = ""
})

async function montar() {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () =>
    r.render(createElement(ProvedorResumoAdmin, null, createElement(Fragment, null, createElement(CabecalhoAdmin), createElement(AbasAdmin), createElement(ConteudoAba, null, "conteúdo")))),
  )
  return { raiz, r }
}

describe("resumo do admin", () => {
  it("selo de contexto acima do título e contagem de abertos na pílula Reports", async () => {
    const { raiz, r } = await montar()
    const selo = raiz.querySelector("[data-selo-contexto]")!
    expect(selo.textContent).toBe("3 abertos")
    expect(selo.className).toContain("rounded-full")
    const contagem = raiz.querySelector('a[href="/admin/reports"] [data-contagem]')!
    expect(contagem.textContent).toBe("3")
    expect(raiz.querySelector('a[href="/admin/reports"]')!.getAttribute("aria-label")).toBe("Reports, 3 abertos")
    await act(async () => r.unmount())
  })

  it("sem reports abertos (ou sem a nuvem) a pílula fica sem número", async () => {
    resumoAdmin.mockResolvedValue({ pessoas: null, admins: null, etapas: 9, notasAbertas: null, reportsAbertos: 0 })
    const { raiz, r } = await montar()
    expect(raiz.querySelector("[data-contagem]")).toBeNull()
    expect(raiz.querySelector("[data-selo-contexto]")!.textContent).toBe("Nenhum aberto")
    await act(async () => r.unmount())
  })

  it("relê o resumo quando uma tela avisa que mudou algo", async () => {
    const { raiz, r } = await montar()
    resumoAdmin.mockResolvedValue({ pessoas: 6, admins: 2, etapas: 9, notasAbertas: 5, reportsAbertos: 2 })
    await act(async () => avisarResumoAdmin())
    expect(raiz.querySelector("[data-contagem]")!.textContent).toBe("2")
    await act(async () => r.unmount())
  })

  it("conteúdo da aba entra com a animação e recomeça ao trocar de aba", async () => {
    const { raiz, r } = await montar()
    const antes = raiz.querySelector(".entrar-aba")!
    expect(antes.textContent).toBe("conteúdo")
    nav.caminho = "/admin/pessoas"
    await act(async () =>
      r.render(createElement(ProvedorResumoAdmin, null, createElement(ConteudoAba, null, "conteúdo"))),
    )
    expect(raiz.querySelector(".entrar-aba")).not.toBe(antes)
    await act(async () => r.unmount())
  })
})
