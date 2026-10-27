import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const redirect = vi.fn((destino: string) => {
  throw new Error(`NEXT_REDIRECT:${destino}`)
})
vi.mock("next/navigation", () => ({ redirect: (d: string) => redirect(d) }))

const { default: Pagina } = await import("./page")

async function renderizar(params: Record<string, string | string[] | undefined> = {}) {
  const elemento = await Pagina({ searchParams: Promise.resolve(params) } as never)
  return renderToStaticMarkup(createElement("div", null, elemento))
}

describe("página /login", () => {
  const fetchFalso = vi.fn()
  beforeEach(() => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "google")
    vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x")
    vi.stubGlobal("fetch", fetchFalso)
    fetchFalso.mockReset()
    redirect.mockClear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("mostra o botão Entrar com Google, um link para /auth/entrar", async () => {
    const html = await renderizar()
    expect(html).toContain("Entrar com Google")
    expect(html).toMatch(/<a [^>]*href="\/auth\/entrar"/)
  })

  it("sem erro, não mostra mensagem de erro", async () => {
    const html = await renderizar()
    expect(html).not.toContain("Use a conta Google da Boomer")
    expect(html).not.toContain("Não foi possível entrar agora")
    expect(html).not.toContain('role="alert"')
  })

  it("erro=dominio mostra a mensagem exata", async () => {
    const html = await renderizar({ erro: "dominio" })
    expect(html).toContain("Use a conta Google da Boomer (@boomer.com.br ou @gestaoboomer.com).")
    expect(html).toContain('role="alert"')
  })

  it("erro=falha mostra a mensagem exata", async () => {
    expect(await renderizar({ erro: "falha" })).toContain("Não foi possível entrar agora. Tente de novo.")
  })

  it("erro desconhecido (inclusive HTML) não aparece na página", async () => {
    const html = await renderizar({ erro: "<script>alert(1)</script>" })
    expect(html).not.toContain("<script>")
    expect(html).not.toContain('role="alert"')
  })

  it("proximo seguro é repassado ao /auth/entrar, codificado", async () => {
    const html = await renderizar({ proximo: "/prospects/a?etapa=03" })
    expect(html).toContain('href="/auth/entrar?proximo=%2Fprospects%2Fa%3Fetapa%3D03"')
  })

  it("proximo malicioso é descartado", async () => {
    for (const ruim of ["//evil.com", "http://evil.com", "/\\evil.com"]) {
      const html = await renderizar({ proximo: ruim })
      expect(html).toContain('href="/auth/entrar"')
      expect(html).not.toContain("evil.com")
    }
  })

  it("não faz nenhuma chamada de API ao carregar", async () => {
    await renderizar({ erro: "falha" })
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it("modo off: não há login, vai para /", async () => {
    vi.stubEnv("PLANEJAMENTO_AUTH", "")
    await expect(renderizar()).rejects.toThrow("NEXT_REDIRECT:/")
  })
})
