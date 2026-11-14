import { describe, expect, it } from "vitest"
import { horaEmSaoPaulo } from "./relogio"

describe("horaEmSaoPaulo", () => {
  it("formata em São Paulo com dois dígitos", () => expect(horaEmSaoPaulo(new Date("2026-11-12T00:04:00Z"))).toBe("21:04"))
})
