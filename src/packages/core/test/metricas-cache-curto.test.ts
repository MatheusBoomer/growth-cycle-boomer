import { describe, expect, it, vi } from "vitest"
import { CacheCurto } from "../src/metricas/cache-curto"

describe("CacheCurto", () => {
  it("a segunda chamada dentro do prazo não recarrega e depois do prazo recarrega", async () => {
    let agora = 1000
    const cache = new CacheCurto<number>(30_000, () => agora)
    const carregar = vi.fn(async () => agora)

    expect(await cache.obter(carregar)).toBe(1000)
    agora += 29_999
    expect(await cache.obter(carregar)).toBe(1000)
    expect(carregar).toHaveBeenCalledTimes(1)

    agora += 1
    expect(await cache.obter(carregar)).toBe(31_000)
    expect(carregar).toHaveBeenCalledTimes(2)
  })

  it("forçar recarrega mesmo dentro do prazo", async () => {
    let n = 0
    const cache = new CacheCurto<number>(30_000, () => 0)
    const carregar = async () => ++n
    expect(await cache.obter(carregar)).toBe(1)
    expect(await cache.obter(carregar, true)).toBe(2)
    expect(await cache.obter(carregar)).toBe(2)
  })

  it("erro não fica em cache: a chamada seguinte tenta de novo", async () => {
    const cache = new CacheCurto<string>(30_000, () => 0)
    await expect(cache.obter(async () => Promise.reject(new Error("banco fora")))).rejects.toThrow("banco fora")
    expect(await cache.obter(async () => "ok")).toBe("ok")
  })

  it("um erro de recarga forçada não apaga o valor ainda válido", async () => {
    const cache = new CacheCurto<string>(30_000, () => 0)
    await cache.obter(async () => "velho")
    await expect(cache.obter(async () => Promise.reject(new Error("falhou")), true)).rejects.toThrow("falhou")
    expect(await cache.obter(async () => "novo")).toBe("velho")
  })

  it("duas chamadas simultâneas disparam uma só carga", async () => {
    const cache = new CacheCurto<number>(30_000, () => 0)
    let liberar!: () => void
    const porta = new Promise<void>((r) => (liberar = r))
    const carregar = vi.fn(async () => {
      await porta
      return 7
    })
    const a = cache.obter(carregar)
    const b = cache.obter(carregar)
    liberar()
    expect(await Promise.all([a, b])).toEqual([7, 7])
    expect(carregar).toHaveBeenCalledTimes(1)
  })
})
