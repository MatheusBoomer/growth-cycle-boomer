// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

const agora = Date.now()
const dia = 24 * 60 * 60 * 1000
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock("@/lib/api", () => ({
  api: {
    listarPessoas: async () => ({
      admins: 1,
      pessoas: [
        { email: "ana@boomer.com.br", papel: "admin", primeiroAcesso: new Date(agora - 40 * dia).toISOString(), ultimoAcesso: new Date(agora - dia).toISOString(), projetos: 2 },
        { email: "bia@boomer.com.br", papel: "usuario", primeiroAcesso: new Date(agora - 40 * dia).toISOString(), ultimoAcesso: new Date(agora - 20 * dia).toISOString(), projetos: 1 },
      ],
    }),
  },
  mensagemDeErro: (e: unknown) => String(e),
}))

const { TabelaPessoas } = await import("./tabela-pessoas")
const { ProvedorConta } = await import("@/components/marca/conta-contexto")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  document.body.innerHTML = ""
})

describe("TabelaPessoas: números no topo", () => {
  it("pessoas com acesso, admins e ativas nos últimos 7 dias", async () => {
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(ProvedorConta, { email: "ana@boomer.com.br", papel: "admin", children: createElement(TabelaPessoas) })))
    await act(async () => {})
    const cartoes = [...raiz.querySelectorAll("h3")].map((h) => `${h.textContent}=${h.nextElementSibling?.textContent}`)
    expect(cartoes).toEqual(["Pessoas com acesso=2", "Admins=1", "Ativas nos últimos 7 dias=1"])
    await act(async () => r.unmount())
  })
})
