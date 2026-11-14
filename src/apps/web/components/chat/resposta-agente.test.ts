import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")

describe("conversa: bolha só na mensagem da pessoa", () => {
  it("a resposta do agente vai sem bolha", () => expect(ler("resposta-agente.tsx")).not.toMatch(/<Bubble\b/))
  it("a mensagem da pessoa continua em bolha", () => expect(ler("item-conversa.tsx")).toMatch(/<Bubble\b/))
  it("o selo de custo some no celular, para a barra caber em 375 px", () =>
    expect(ler("../trabalho/area-de-trabalho.tsx")).toMatch(/<span className="max-sm:hidden">\s*<SeloCusto/))
})
