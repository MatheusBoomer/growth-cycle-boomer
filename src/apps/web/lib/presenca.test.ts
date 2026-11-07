import { describe, expect, it } from "vitest"
import { criarMedidorPresenca } from "./presenca"

describe("criarMedidorPresenca", () => {
  it("sem interação, 30 s depois do início, dá 30 s sem interação", () => {
    let agora = 1_000_000
    const medidor = criarMedidorPresenca(() => agora)
    agora += 30_000
    expect(medidor.corpo("03", true)).toEqual({ etapa: "03", visivel: true, segundosSemInteracao: 30 })
  })

  it("registrarInteracao zera o tempo sem interação", () => {
    let agora = 1_000_000
    const medidor = criarMedidorPresenca(() => agora)
    agora += 90_000
    medidor.registrarInteracao()
    agora += 4_000
    expect(medidor.corpo("03", true).segundosSemInteracao).toBe(4)
  })

  it("arredonda para baixo", () => {
    let agora = 0
    const medidor = criarMedidorPresenca(() => agora)
    agora += 29_999
    expect(medidor.corpo("03", true).segundosSemInteracao).toBe(29)
  })

  it("repassa a etapa e se a aba está visível", () => {
    const medidor = criarMedidorPresenca(() => 0)
    expect(medidor.corpo("final", false)).toEqual({ etapa: "final", visivel: false, segundosSemInteracao: 0 })
  })

  it("não passa de 24 h (limite que a rota aceita)", () => {
    let agora = 0
    const medidor = criarMedidorPresenca(() => agora)
    agora += 30 * 3_600_000
    expect(medidor.corpo("01", false).segundosSemInteracao).toBe(86_400)
  })
})
