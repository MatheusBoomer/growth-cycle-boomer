import { beforeEach, describe, expect, it, vi } from "vitest"

const avatares = vi.fn()
const estadoDoServidor: { usuarios: { avatares: typeof avatares } | null } = { usuarios: { avatares } }
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ usuarios: estadoDoServidor.usuarios }) }))

const { avataresDosDonos } = await import("./avatares")

describe("avataresDosDonos", () => {
  beforeEach(() => {
    avatares.mockReset()
    estadoDoServidor.usuarios = { avatares }
  })

  it("devolve o mapa do repositório como objeto", async () => {
    avatares.mockResolvedValue(new Map([["ana@x", "https://lh3.googleusercontent.com/a/1"]]))
    expect(await avataresDosDonos()).toEqual({ "ana@x": "https://lh3.googleusercontent.com/a/1" })
  })

  it("modo disco (usuarios null): {} sem consultar", async () => {
    estadoDoServidor.usuarios = null
    expect(await avataresDosDonos()).toEqual({})
    expect(avatares).not.toHaveBeenCalled()
  })

  it("erro do repositório vira {}", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    avatares.mockRejectedValue(new Error("banco fora"))
    expect(await avataresDosDonos()).toEqual({})
    erro.mockRestore()
  })
})
