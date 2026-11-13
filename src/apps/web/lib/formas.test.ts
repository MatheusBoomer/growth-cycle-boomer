import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { badgeVariants } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"

// Formas do redesign: botões, selos, abas e campos em pílula; cards com raio de 18 px.
const COMPONENTES = path.resolve(import.meta.dirname, "../../../packages/ui/src/components")
const ler = (nome: string) => readFileSync(path.join(COMPONENTES, nome), "utf-8")

describe("formas do redesign", () => {
  it("todo tamanho de botão é pílula", () => {
    for (const size of ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
      const cls = buttonVariants({ size })
      expect(cls, size).toContain("rounded-full")
      expect(cls, size).not.toMatch(/\brounded-(lg|xl|md)\b/)
    }
  })

  it("botão principal é laranja sólido, sem gradiente", () => {
    const cls = buttonVariants({ variant: "default" })
    expect(cls).toContain("bg-primary")
    expect(cls).not.toMatch(/bg-linear|from-primario-claro/)
  })

  it("selo é pílula", () => expect(badgeVariants({})).toContain("rounded-full"))

  it("card tem raio de 18 px", () => expect(ler("card.tsx")).toContain("rounded-[18px]"))

  it("a lista de abas padrão é um segmentado em pílula", () => {
    const lista = /const tabsListVariants = cva\(\s*"([^"]+)"/.exec(ler("tabs.tsx"))![1]!
    expect(lista).toContain("rounded-full")
  })

  it("campo de texto é pílula", () => expect(ler("input.tsx")).toContain("rounded-full"))
})
