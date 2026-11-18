import { describe, expect, it } from "vitest"
import { alvoDeDigitacao, layoutParaPainel, layoutParaVisualizador } from "./layout-colunas"

const fechado = { trilha: 20, chat: 50, visualizador: 0, painel: 30 }

describe("layout ao abrir e fechar o visualizador", () => {
  it("usa o layout salvo daquela combinação quando existe e é válido", () => {
    const salvo = { trilha: 10, chat: 30, visualizador: 40, painel: 20 }
    expect(layoutParaVisualizador(fechado, salvo, true)).toEqual(salvo)
  })

  it("sem layout salvo, abre com metade da largura, tirada proporcionalmente das outras colunas", () => {
    const r = layoutParaVisualizador(fechado, null, true)
    expect(r).toEqual({ trilha: 10, chat: 25, visualizador: 50, painel: 15 })
  })

  it("ao fechar sem layout salvo, devolve a largura do visualizador ao chat", () => {
    const aberto = { trilha: 10, chat: 30, visualizador: 40, painel: 20 }
    expect(layoutParaVisualizador(aberto, null, false)).toEqual({ trilha: 10, chat: 70, visualizador: 0, painel: 20 })
  })

  it("ignora layout salvo de outra combinação ou com colunas diferentes", () => {
    expect(layoutParaVisualizador(fechado, { trilha: 20, chat: 80, visualizador: 0, painel: 0 }, true).visualizador).toBe(50)
    expect(layoutParaVisualizador(fechado, { trilha: 20, chat: 80 }, true).visualizador).toBe(50)
  })
})

describe("layout ao abrir o visualizador respeita o estado atual do painel lateral (coluna 3)", () => {
  const soma = (l: Record<string, number>) => Object.values(l).reduce((t, v) => t + v, 0)
  const recolhido = { trilha: 20, chat: 80, visualizador: 0, painel: 0 }
  const salvoComPainel = { trilha: 10, chat: 30, visualizador: 40, painel: 20 }

  it("painel recolhido continua recolhido, mesmo com layout salvo que o tinha aberto; a largura vai para o chat", () => {
    const r = layoutParaVisualizador(recolhido, salvoComPainel, true, { recolhido: true, largura: 30 })
    expect(r).toEqual({ trilha: 10, chat: 50, visualizador: 40, painel: 0 })
    expect(soma(r)).toBe(100)
  })

  it("painel recolhido, sem layout salvo: abre o visualizador e o painel segue recolhido", () => {
    const r = layoutParaVisualizador(recolhido, null, true, { recolhido: true, largura: 30 })
    expect(r.painel).toBe(0)
    expect(r.visualizador).toBe(50)
    expect(soma(r)).toBeCloseTo(100)
  })

  it("painel aberto continua aberto, mesmo com layout salvo que o tinha recolhido", () => {
    const salvoSemPainel = { trilha: 20, chat: 40, visualizador: 40, painel: 0 }
    const r = layoutParaVisualizador(fechado, salvoSemPainel, true, { recolhido: false, largura: 22 })
    expect(r.painel).toBe(22)
    expect(Object.values(r).every((v) => v >= 0)).toBe(true)
    expect(soma(r)).toBeCloseTo(100)
  })

  it("painel aberto e layout salvo que já o tem aberto: devolve o salvo, sem alteração", () => {
    expect(layoutParaVisualizador(fechado, salvoComPainel, true, { recolhido: false, largura: 22 })).toEqual(salvoComPainel)
  })

  it("ao fechar o visualizador com o painel recolhido, ele segue recolhido", () => {
    const aberto = { trilha: 10, chat: 50, visualizador: 40, painel: 0 }
    const salvoFechadoComPainel = { trilha: 20, chat: 50, visualizador: 0, painel: 30 }
    const r = layoutParaVisualizador(aberto, salvoFechadoComPainel, false, { recolhido: true, largura: 30 })
    expect(r.painel).toBe(0)
    expect(soma(r)).toBe(100)
  })
})

describe("Esc não fecha o visualizador enquanto o analista digita", () => {
  const el = (tagName: string, extra: Partial<{ isContentEditable: boolean; dentroDeDialogo: boolean }> = {}) => ({
    tagName,
    isContentEditable: extra.isContentEditable ?? false,
    closest: (seletor: string) => (seletor.includes("dialog") && extra.dentroDeDialogo ? {} : null),
  })

  it("reconhece campos de texto, editáveis e diálogos", () => {
    expect(alvoDeDigitacao(el("TEXTAREA"))).toBe(true)
    expect(alvoDeDigitacao(el("INPUT"))).toBe(true)
    expect(alvoDeDigitacao(el("DIV", { isContentEditable: true }))).toBe(true)
    expect(alvoDeDigitacao(el("BUTTON", { dentroDeDialogo: true }))).toBe(true)
  })

  it("não bloqueia o Esc fora deles", () => {
    expect(alvoDeDigitacao(el("BUTTON"))).toBe(false)
    expect(alvoDeDigitacao(el("BODY"))).toBe(false)
    expect(alvoDeDigitacao(null)).toBe(false)
  })
})

describe("painel lateral recolhido e mostrado pelo botão", () => {
  it("ao recolher, a largura do painel vai para a área de trabalho, não para o visualizador fechado", () => {
    expect(layoutParaPainel(fechado, false, 30)).toEqual({ trilha: 20, chat: 80, visualizador: 0, painel: 0 })
  })

  it("ao mostrar, o painel volta com a largura anterior, tirada da área de trabalho", () => {
    const recolhido = { trilha: 20, chat: 80, visualizador: 0, painel: 0 }
    expect(layoutParaPainel(recolhido, true, 30)).toEqual(fechado)
  })

  it("se a área de trabalho ficaria estreita demais, divide o espaço proporcionalmente entre as outras colunas", () => {
    const apertado = { trilha: 20, chat: 30, visualizador: 50, painel: 0 }
    const r = layoutParaPainel(apertado, true, 20)
    expect(r.painel).toBe(20)
    expect(r.trilha).toBeCloseTo(16)
    expect(r.chat).toBeCloseTo(24)
    expect(r.visualizador).toBeCloseTo(40)
  })
})

describe("semVisualizadorFantasma", () => {
  it("visualizador fechado com largura (o painel foi arrastado para a direita): a largura volta para o chat", async () => {
    const { semVisualizadorFantasma } = await import("./layout-colunas")
    expect(semVisualizadorFantasma({ trilha: 20, chat: 40, visualizador: 32, painel: 8 }, false)).toEqual({ trilha: 20, chat: 72, visualizador: 0, painel: 8 })
  })
  it("visualizador aberto ou já sem largura: nada a corrigir", async () => {
    const { semVisualizadorFantasma } = await import("./layout-colunas")
    expect(semVisualizadorFantasma({ trilha: 20, chat: 40, visualizador: 32, painel: 8 }, true)).toBeNull()
    expect(semVisualizadorFantasma({ trilha: 20, chat: 60, visualizador: 0, painel: 20 }, false)).toBeNull()
  })
})
