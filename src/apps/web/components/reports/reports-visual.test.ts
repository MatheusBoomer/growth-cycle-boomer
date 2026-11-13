import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")
const dialogo = ler("dialogo-report.tsx")
const painel = ler("../admin/reports/painel-reports.tsx")
const detalhe = ler("../admin/reports/detalhe-report.tsx")

describe("reports na linguagem nova", () => {
  it("diálogo: 'Reportar um bug ou ideia', com o destaque em serifada", () =>
    expect(dialogo).toMatch(/<DialogTitle[^>]*>\s*Reportar <em className="[^"]*font-serif[^"]*">um bug ou ideia<\/em>/))
  it("diálogo: tipo num segmentado em pílula", () => expect(dialogo).toMatch(/role="radiogroup" aria-label="Tipo" className="[^"]*rounded-full/))
  it("painel: tipo num segmentado em pílula", () => expect(painel).toMatch(/role="group" aria-label="Tipo" className="[^"]*rounded-full/))
  it("painel: lista em cards finos, sem divisórias de tabela", () => {
    expect(painel).not.toContain("divide-y")
    expect(painel).toMatch(/rounded-\[14px\]/)
  })
  it("detalhe: o número do report em serifada", () => expect(detalhe).toMatch(/<span className="font-serif[^"]*">Report #/))
  it("diálogo: o título não encosta as linhas ao quebrar (entrelinha 1.1)", () => expect(dialogo).toMatch(/<DialogTitle className="[^"]*leading-\[1\.1\]/))
})
