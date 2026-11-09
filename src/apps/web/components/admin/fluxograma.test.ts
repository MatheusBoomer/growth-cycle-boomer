import { describe, expect, it } from "vitest"
import { larguraNatural, NIVEIS_ZOOM, proximoZoom } from "./fluxograma"

describe("zoom do fluxograma", () => {
  it("aproxima e afasta aos poucos, parando nas pontas", () => {
    expect(proximoZoom(100, 1)).toBe(125)
    expect(proximoZoom(100, -1)).toBe(75)
    expect(proximoZoom(NIVEIS_ZOOM.at(-1)!, 1)).toBe(NIVEIS_ZOOM.at(-1))
    expect(proximoZoom(NIVEIS_ZOOM[0]!, -1)).toBe(NIVEIS_ZOOM[0])
  })

  it("de um zoom fora dos degraus (ajuste à janela), vai ao degrau vizinho", () => {
    expect(proximoZoom(87, 1)).toBe(100)
    expect(proximoZoom(87, -1)).toBe(75)
  })

  it("lê a largura natural do viewBox do Mermaid", () => {
    expect(larguraNatural('<svg viewBox="-8 -8 612.5 840" width="100%">')).toBe(612.5)
    expect(larguraNatural('<svg viewBox="0 0 300 200">')).toBe(300)
    expect(larguraNatural("<svg></svg>")).toBeNull()
  })
})
