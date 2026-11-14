import { readFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TextoRevelado } from "./texto-revelado"

const CSS = readFileSync(path.resolve(import.meta.dirname, "../../../../packages/ui/src/styles/globals.css"), "utf-8")

describe("TextoRevelado", () => {
  it("leva a classe da faixa de cor, o atraso e a cor base", () => {
    const html = renderToStaticMarkup(createElement(TextoRevelado, { atraso: 0.33, corBase: "var(--muted-foreground)", children: "Cycle" }))
    expect(html).toContain('class="texto-revelado"')
    expect(html).toContain("--atraso:0.33s")
    expect(html).toContain("--cor-base:var(--muted-foreground)")
    expect(html).toContain(">Cycle<")
  })

  it("o CSS anima a faixa e para com movimento reduzido", () => {
    expect(CSS).toMatch(/@keyframes revelar/)
    expect(CSS).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.texto-revelado\s*\{[^}]*animation:\s*none/)
  })
})
