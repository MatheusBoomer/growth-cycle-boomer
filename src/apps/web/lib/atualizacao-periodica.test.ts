import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { atualizarEnquantoVisivel, type DocumentoVisivel } from "./atualizacao-periodica"

function documentoFalso(estado: string) {
  const ouvintes = new Set<() => void>()
  const doc = {
    visibilityState: estado,
    addEventListener: (_: "visibilitychange", o: () => void) => void ouvintes.add(o),
    removeEventListener: (_: "visibilitychange", o: () => void) => void ouvintes.delete(o),
  } satisfies DocumentoVisivel
  return {
    doc,
    ouvintes,
    mudarPara(novo: string) {
      doc.visibilityState = novo
      for (const o of [...ouvintes]) o()
    },
  }
}

describe("atualizarEnquantoVisivel", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("atualiza a cada intervalo com a aba visível, sem chamar na partida", () => {
    const carregar = vi.fn()
    const { doc } = documentoFalso("visible")
    atualizarEnquantoVisivel(carregar, 60_000, doc)
    expect(carregar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(180_000)
    expect(carregar).toHaveBeenCalledTimes(3)
  })

  it("não atualiza com a aba escondida e atualiza uma vez ao voltar a ficar visível", () => {
    const carregar = vi.fn()
    const { doc, mudarPara } = documentoFalso("visible")
    atualizarEnquantoVisivel(carregar, 60_000, doc)
    mudarPara("hidden")
    vi.advanceTimersByTime(300_000)
    expect(carregar).not.toHaveBeenCalled()
    mudarPara("visible")
    expect(carregar).toHaveBeenCalledTimes(1)
  })

  it("ao parar, solta o relógio e o ouvinte", () => {
    const carregar = vi.fn()
    const { doc, ouvintes, mudarPara } = documentoFalso("visible")
    const parar = atualizarEnquantoVisivel(carregar, 60_000, doc)
    expect(ouvintes.size).toBe(1)
    parar()
    expect(ouvintes.size).toBe(0)
    vi.advanceTimersByTime(120_000)
    mudarPara("visible")
    expect(carregar).not.toHaveBeenCalled()
  })
})
