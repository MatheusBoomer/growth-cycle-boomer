import { describe, expect, it } from "vitest"
import { comCoresDoTema, misturar, variaveisMermaid } from "./tema-mermaid"

const CORES = { fundo: "#141416", texto: "#f4f4f5", borda: "#2a2a2e", textoApagado: "#8b8b93", acento: "#eb610a", azul: "#5b9df0", verde: "#2fbf8c" }

describe("tema do Mermaid", () => {
  it("mistura em hex", () => {
    expect(misturar("#ffffff", "#000000", 0.5)).toBe("#808080")
    expect(misturar("#eb610a", "#141416", 1)).toBe("#eb610a")
  })
  it("troca só as três classes do catálogo, mantendo o resto", () => {
    const codigo = "flowchart TD\n  A --> B\n  classDef checkpoint fill:#fff1e6,stroke:#e8803a,color:#7a3d0c\n  classDef subagente fill:#e8f0fd,stroke:#1f4fa8,color:#173a7a\n  classDef entrega fill:#e6f6ec,stroke:#16743b,color:#0f4f28\n  classDef outra fill:#000"
    const novo = comCoresDoTema(codigo, CORES)
    expect(novo).toContain("A --> B")
    expect(novo).toContain("classDef checkpoint fill:#321f14,stroke:#eb610a,color:#f4f4f5")
    expect(novo).toMatch(/classDef subagente fill:#[0-9a-f]{6},stroke:#5b9df0,color:#f4f4f5/)
    expect(novo).toMatch(/classDef entrega fill:#[0-9a-f]{6},stroke:#2fbf8c,color:#f4f4f5/)
    expect(novo).toContain("classDef outra fill:#000")
    expect(novo).not.toContain("#fff1e6")
  })
  it("variáveis da base vêm das cores do app", () => {
    const v = variaveisMermaid(CORES)
    expect(v.primaryTextColor).toBe("#f4f4f5")
    expect(v.lineColor).toBe("#8b8b93")
  })
})
