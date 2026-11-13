import { readFileSync, readdirSync, statSync } from "node:fs"
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

  it("proporção do protótipo (36 px de altura, 16 px de folga lateral no padrão)", () => {
    expect(buttonVariants({ size: "default" })).toMatch(/\bh-9\b/)
    expect(buttonVariants({ size: "default" })).toMatch(/\bpx-4\b/)
    expect(buttonVariants({ size: "sm" })).toMatch(/\bh-8\b/)
    expect(buttonVariants({ size: "sm" })).toMatch(/\bpx-3\.5\b/)
    expect(buttonVariants({ size: "lg" })).toMatch(/\bh-10\b/)
    expect(buttonVariants({ size: "icon" })).toMatch(/\bsize-9\b/)
  })

  it("selo é pílula", () => expect(badgeVariants({})).toContain("rounded-full"))

  it("card tem raio de 18 px", () => expect(ler("card.tsx")).toContain("rounded-[18px]"))

  it("a lista de abas padrão é um segmentado em pílula", () => {
    const lista = /const tabsListVariants = cva\(\s*"([^"]+)"/.exec(ler("tabs.tsx"))![1]!
    expect(lista).toContain("rounded-full")
  })

  it("campo de texto é pílula", () => expect(ler("input.tsx")).toContain("rounded-full"))

  it("transição com lista própria que anima posição inclui 'translate' (no Tailwind 4 -translate-* usa essa propriedade; sem ela o texto pula)", () => {
    const raiz = path.resolve(import.meta.dirname, "../components")
    const arquivos = (pasta: string): string[] =>
      readdirSync(pasta).flatMap((n) => {
        const c = path.join(pasta, n)
        return statSync(c).isDirectory() ? arquivos(c) : c.endsWith(".tsx") ? [c] : []
      })
    const ruins = arquivos(raiz).flatMap((f) =>
      [...readFileSync(f, "utf-8").matchAll(/transition-\[([^\]]*)\]/g)].filter((m) => m[1]!.includes("transform") && !m[1]!.includes("translate")).map(() => path.relative(raiz, f)),
    )
    expect(ruins).toEqual([])
  })
})
