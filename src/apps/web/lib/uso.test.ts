import { describe, expect, it } from "vitest"
import { resumoUso } from "./uso"

const agora = Date.UTC(2026, 9, 8, 12, 0) // 12:00 UTC
const seg = (ms: number) => Math.floor(ms / 1000)

describe("barra de uso da assinatura", () => {
  it("converte em % com rótulo e nível, sessão antes da semana", () => {
    const r = resumoUso(
      {
        atualizadoEm: "2026-10-08T11:50:00.000Z",
        janelas: [
          { janela: "seven_day", utilizacao: 0.4, resetsAt: seg(agora + 3 * 86400_000) },
          { janela: "five_hour", utilizacao: 0.823, resetsAt: seg(agora + 2 * 3600_000) },
        ],
      },
      agora,
    )
    expect(r.map((j) => [j.rotulo, j.percentual, j.nivel])).toEqual([
      ["Sessão (5 h)", 82, "alerta"],
      ["Semana", 40, "ok"],
    ])
    expect(r[0]!.renova).toBeTruthy()
  })

  it("acima de 95% é crítico; janela que já renovou volta a 0%", () => {
    const r = resumoUso(
      {
        atualizadoEm: "2026-10-08T06:00:00.000Z",
        janelas: [
          { janela: "five_hour", utilizacao: 0.99, resetsAt: seg(agora - 60_000) },
          { janela: "seven_day", utilizacao: 0.97, resetsAt: seg(agora + 86400_000) },
        ],
      },
      agora,
    )
    expect(r.map((j) => [j.percentual, j.nivel, j.renovada])).toEqual([
      [0, "ok", true],
      [97, "critico", false],
    ])
  })

  it("sem dado ainda: lista vazia", () => {
    expect(resumoUso(null, agora)).toEqual([])
  })
})
