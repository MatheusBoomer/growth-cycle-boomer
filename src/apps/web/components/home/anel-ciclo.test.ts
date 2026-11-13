import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AnelCiclo } from "./anel-ciclo"

const html = (props: Parameters<typeof AnelCiclo>[0]) => renderToStaticMarkup(createElement(AnelCiclo, props))
const estados = (h: string) => [...h.matchAll(/data-estado="(\w+)"/g)].map((m) => m[1])

describe("AnelCiclo", () => {
  it("um arco por etapa: concluídas, a atual e as pendentes", () => {
    const h = html({ concluidas: 3, total: 9, atual: true, tamanho: 200 })
    expect(estados(h)).toEqual(["concluida", "concluida", "concluida", "atual", "pendente", "pendente", "pendente", "pendente", "pendente"])
  })

  it("descreve o progresso para leitor de tela", () => {
    expect(html({ concluidas: 3, total: 9, atual: true, tamanho: 26 })).toContain('aria-label="3 de 9 etapas concluídas"')
  })

  it("grande mostra o número no centro; pequeno não", () => {
    expect(html({ concluidas: 3, total: 9, atual: true, tamanho: 200 })).toContain("etapas concluídas</text>")
    expect(html({ concluidas: 3, total: 9, atual: true, tamanho: 26 })).not.toContain("</text>")
  })

  it("tamanho explícito, nunca esticado", () => {
    const h = html({ concluidas: 0, total: 9, atual: false, tamanho: 26 })
    expect(h).toContain('width="26"')
    expect(h).toContain('height="26"')
    expect(h).not.toContain("100%")
  })

  it("sem etapa atual não pinta laranja", () => {
    expect(estados(html({ concluidas: 9, total: 9, atual: false, tamanho: 26 }))).not.toContain("atual")
  })
})
