import { describe, expect, it } from "vitest"
import { larguraAjustada, limitarZoom, proximoZoom, ZOOM_MAX, ZOOM_MIN } from "./zoom"

describe("zoom do modal de gráfico", () => {
  it("anda pelos níveis nas duas direções e para nos limites", () => {
    expect(proximoZoom(1, 1)).toBe(1.25)
    expect(proximoZoom(1, -1)).toBe(0.75)
    expect(proximoZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
    expect(proximoZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
  })

  it("de um zoom entre níveis (pinça), vai para o nível seguinte na direção pedida", () => {
    expect(proximoZoom(1.1, 1)).toBe(1.25)
    expect(proximoZoom(1.1, -1)).toBe(1)
  })

  it("limita o zoom contínuo da pinça", () => {
    expect(limitarZoom(10)).toBe(ZOOM_MAX)
    expect(limitarZoom(0.1)).toBe(ZOOM_MIN)
    expect(limitarZoom(1.7)).toBe(1.7)
  })

  it("ajusta pela altura quando a imagem é mais larga que alta e a área é baixa", () => {
    // área 1000x402 (400 úteis), imagem 2000x1000: cabe pela altura, 800px
    expect(larguraAjustada({ w: 1002, h: 402 }, { w: 2000, h: 1000 })).toBe(800)
  })

  it("ajusta pela largura quando a área é estreita", () => {
    expect(larguraAjustada({ w: 502, h: 2000 }, { w: 2000, h: 1000 })).toBe(500)
  })

  it("não amplia além do tamanho real da imagem no zoom 1", () => {
    expect(larguraAjustada({ w: 3000, h: 3000 }, { w: 600, h: 400 })).toBe(600)
  })
})
