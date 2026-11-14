import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const fonte = readFileSync(path.resolve(import.meta.dirname, "card-entregavel.tsx"), "utf-8")

describe("card de entregável", () => {
  it("pendente ganha a borda sutil correndo", () => expect(fonte).toMatch(/e\.status === "pendente" && "borda-correndo"/))
  it("aprovado ganha um contorno verde fino, parado", () => expect(fonte).toMatch(/e\.status === "aprovado" && "ring-1 ring-sucesso\/30"/))
  it("título em serifada", () => expect(fonte).toMatch(/<CardTitle className="[^"]*font-serif/))
  it("botão Aprovar com o brilho que passa", () => expect(fonte).toMatch(/<Button\s+className="brilho-passa"\s+onClick=\{aprovar\}/))
  it("aprovar não solta confete (o confete é só ao concluir a etapa)", () => expect(fonte).not.toMatch(/confete|celebrar/))
})
