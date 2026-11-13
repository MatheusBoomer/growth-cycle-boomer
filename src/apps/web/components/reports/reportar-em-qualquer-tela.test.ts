import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")

describe("botão Reportar", () => {
  it("aparece sempre, inclusive no app local (não some sem a nuvem)", () => {
    expect(ler("botao-reportar.tsx")).not.toContain("if (!nuvem) return null")
  })
  it("no app local o diálogo avisa que o report só fica guardado no app publicado e não deixa enviar", () => {
    const s = ler("dialogo-report.tsx")
    expect(s).toContain("semNuvem")
    expect(s).toMatch(/disabled=\{!podeEnviar \|\| semNuvem\}/)
    expect(s).toContain("app publicado")
  })
})

describe("barra do topo na tela do projeto", () => {
  it("o fundo da tela de trabalho cobre o brilho do topo (senão parece a barra antiga colorida)", () => {
    expect(ler("../trabalho/area-de-trabalho.tsx")).toMatch(/<div className="flex h-svh flex-col bg-background">/)
  })
})
