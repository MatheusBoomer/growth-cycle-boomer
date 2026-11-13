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
  it("detalhe: título em serifada", () => expect(detalhe).toMatch(/<SheetTitle className="[^"]*font-serif/))
})
