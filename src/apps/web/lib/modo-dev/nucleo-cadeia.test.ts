import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { cadeiaDeComponentes, nomeIgnorado } from "./nucleo.ts"

function componente(nome: string): () => null {
  const fn = () => null
  Object.defineProperty(fn, "name", { value: nome })
  return fn
}

/** Monta um nó DOM falso com fibers encadeados; `tipos` vai do mais interno (o host) para fora. */
function noComFiber(tipos: unknown[]): object {
  let fiber: { type: unknown; return: unknown } | null = null
  for (const tipo of [...tipos].reverse()) fiber = { type: tipo, return: fiber }
  return { __reactFiber$teste: fiber }
}

describe("cadeiaDeComponentes", () => {
  it("sobe do nó até a raiz, do mais interno para fora, pulando elementos host", () => {
    const no = noComFiber(["div", componente("CardEntregavel"), "section", componente("PainelEtapa"), componente("AreaDeTrabalho")])
    expect(cadeiaDeComponentes(no)).toEqual(["CardEntregavel", "PainelEtapa", "AreaDeTrabalho"])
  })

  it("ignora internos do Next/React, primitivos e genéricos de packages/ui", () => {
    const no = noComFiber([
      "button",
      componente("Button"),
      componente("Slot"),
      componente("Primitive.button"),
      componente("CardProspect"),
      componente("ThemeProvider"),
      componente("ErrorBoundary"),
      componente("_Anonimo"),
      componente("InnerLayoutRouter"),
      componente("GradeProspects"),
    ])
    expect(cadeiaDeComponentes(no)).toEqual(["CardProspect", "GradeProspects"])
  })

  it("ignora o Link do Next, internos vistos no next dev e nomes abreviados de bibliotecas", () => {
    const no = noComFiber([
      "a",
      componente("LinkComponent"),
      componente("CardProspect"),
      componente("GradeProspects"),
      componente("InnerScrollHandlerNew"),
      componente("V"),
      componente("J"),
      componente("Pagina"),
    ])
    expect(cadeiaDeComponentes(no)).toEqual(["CardProspect", "GradeProspects", "Pagina"])
  })

  it("não ignora componentes do app que começam com nome genérico", () => {
    for (const nome of ["CardEntregavel", "CardProspect", "DialogoNovoProspect", "IconeStatus"]) {
      expect(nomeIgnorado(nome), nome).toBe(false)
    }
  })

  it("usa displayName e desembrulha memo e forwardRef", () => {
    const comDisplay = Object.assign(componente("x"), { displayName: "Chamado" })
    const memo = { $$typeof: Symbol.for("react.memo"), type: componente("ListaMemo") }
    const comRef = { $$typeof: Symbol.for("react.forward_ref"), render: componente("CampoRef") }
    expect(cadeiaDeComponentes(noComFiber(["div", comDisplay, memo, comRef]))).toEqual(["Chamado", "ListaMemo", "CampoRef"])
  })

  it("contexto e funções anônimas não viram nome", () => {
    const contexto = { $$typeof: Symbol.for("react.context"), _currentValue: null }
    expect(cadeiaDeComponentes(noComFiber(["span", contexto, () => null, componente("Painel")]))).toEqual(["Painel"])
  })

  it("não repete nomes consecutivos", () => {
    const no = noComFiber(["div", componente("Painel"), componente("Painel"), componente("Lista")])
    expect(cadeiaDeComponentes(no)).toEqual(["Painel", "Lista"])
  })

  it("para em 8 nomes", () => {
    const tipos = ["div", ...Array.from({ length: 12 }, (_, i) => componente(`Comp${i}`))]
    expect(cadeiaDeComponentes(noComFiber(tipos))).toEqual(["Comp0", "Comp1", "Comp2", "Comp3", "Comp4", "Comp5", "Comp6", "Comp7"])
  })

  it("procura o fiber no ancestral quando o nó não tem", () => {
    const pai = noComFiber(["div", componente("Painel")])
    expect(cadeiaDeComponentes({ parentElement: pai })).toEqual(["Painel"])
  })

  it("nó sem fiber dá lista vazia", () => {
    expect(cadeiaDeComponentes({})).toEqual([])
  })

  it("todo componente de packages/ui está na lista de ignorados", () => {
    const pasta = path.resolve(import.meta.dirname, "../../../../packages/ui/src/components")
    const nomes = new Set<string>()
    for (const arquivo of readdirSync(pasta).filter((a) => a.endsWith(".tsx"))) {
      const fonte = readFileSync(path.join(pasta, arquivo), "utf-8")
      for (const m of fonte.matchAll(/^(?:export )?(?:function|const) ([A-Z][a-z][A-Za-z]*)/gm)) nomes.add(m[1]!)
    }
    expect(nomes.size).toBeGreaterThan(20)
    for (const nome of nomes) expect(nomeIgnorado(nome), nome).toBe(true)
  })
})
