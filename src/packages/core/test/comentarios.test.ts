import { describe, expect, it } from "vitest"
import { campoDaRegiao, emOrdemDeEnvio, regiaoValida, textoDoAjuste, type Comentario } from "../src/comentarios"

const campos = {
  titulo: { x: 4.4, y: 7, w: 84, h: 9 },
  imagem: { x: 3.6, y: 27, w: 64, h: 63 },
  conclusoes: { x: 69, y: 37, w: 29, h: 37 },
}

describe("comentários de slide", () => {
  it("região válida: dentro do slide e com tamanho", () => {
    expect(regiaoValida({ x: 10, y: 10, w: 20, h: 20 })).toBe(true)
    expect(regiaoValida({ x: 90, y: 10, w: 20, h: 20 })).toBe(false)
    expect(regiaoValida({ x: 10, y: 10, w: 0, h: 20 })).toBe(false)
    expect(regiaoValida({ x: "a", y: 1, w: 1, h: 1 })).toBe(false)
    expect(regiaoValida(null)).toBe(false)
  })

  it("campo da região é o de maior sobreposição", () => {
    expect(campoDaRegiao({ x: 70, y: 40, w: 25, h: 20 }, campos)).toBe("conclusoes")
    expect(campoDaRegiao({ x: 5, y: 30, w: 30, h: 30 }, campos)).toBe("imagem")
  })

  it("região que quase não toca em campo nenhum fica sem campo", () => {
    expect(campoDaRegiao({ x: 0, y: 92, w: 10, h: 7 }, campos)).toBeNull()
  })

  it("texto do ajuste numera, rotula, cita recortes e orienta o agente", () => {
    const base = { criadoEm: "2026-10-08T10:00:00.000Z", enviadoEm: null }
    const comentarios: Comentario[] = [
      { ...base, id: "c1", slide: 12, regiao: { x: 69, y: 37, w: 29, h: 37 }, campo: "conclusoes", texto: "a 2ª conclusão está errada" },
      { ...base, id: "c2", slide: 18, regiao: null, campo: null, texto: "esse slide pode sair" },
    ]
    const t = textoDoAjuste({
      titulo: "Apresentação final",
      comentarios,
      rotulo: (n) => (n === 12 ? 'Slide 12 · "ROAS Global"' : `Slide ${n}`),
      recortes: { c1: "clientes/x/.app/comentarios/e1/c1.png" },
    })
    expect(t).toContain('Ajustes em "Apresentação final" (2):')
    expect(t).toContain('1. Slide 12 · "ROAS Global" · região: conclusoes (recorte: clientes/x/.app/comentarios/e1/c1.png)')
    expect(t).toContain('   "a 2ª conclusão está errada"')
    expect(t).toContain("2. Slide 18 · slide inteiro")
    expect(t).toContain("Corrija só o roteiro nos slides citados")
  })
})

describe("ordem dos comentários", () => {
  it("pendentes por slide e, no mesmo slide, por criação (a mesma numeração na tela e no ajuste)", () => {
    const c = (id: string, slide: number, criadoEm: string, enviadoEm: string | null = null): Comentario => ({ id, slide, regiao: null, campo: null, texto: id, criadoEm, enviadoEm })
    const lista = [c("a", 20, "1"), c("b", 3, "2"), c("x", 1, "0", "9"), c("d", 3, "1")]
    expect(emOrdemDeEnvio(lista).map((x) => x.id)).toEqual(["d", "b", "a"])
  })
})
