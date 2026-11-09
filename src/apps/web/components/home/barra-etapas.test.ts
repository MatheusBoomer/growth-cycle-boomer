// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { BarraEtapas } from "./barra-etapas"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function montar(props: Parameters<typeof BarraEtapas>[0]) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(BarraEtapas, props))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("BarraEtapas", () => {
  it("tem um segmento por etapa e descreve o progresso para leitor de tela", async () => {
    const { raiz, desmontar } = await montar({ concluidas: 3, total: 8, atual: true })
    const barra = raiz.querySelector('[role="img"]')!
    expect(barra.getAttribute("aria-label")).toBe("3 de 8 etapas concluídas")
    expect(barra.children).toHaveLength(8)
    await desmontar()
  })

  it("concluídas verdes, a próxima laranja e o resto neutro", async () => {
    const { raiz, desmontar } = await montar({ concluidas: 2, total: 5, atual: true })
    const cores = [...raiz.querySelector('[role="img"]')!.children].map((c) => c.getAttribute("data-estado"))
    expect(cores).toEqual(["concluida", "concluida", "atual", "pendente", "pendente"])
    await desmontar()
  })

  it("sem etapa atual (tudo concluído ou nada em andamento) não pinta o laranja", async () => {
    const { raiz, desmontar } = await montar({ concluidas: 5, total: 5, atual: false })
    const estados = [...raiz.querySelector('[role="img"]')!.children].map((c) => c.getAttribute("data-estado"))
    expect(estados).toEqual(Array(5).fill("concluida"))
    await desmontar()
  })

  it("não passa de total mesmo com concluidas maior", async () => {
    const { raiz, desmontar } = await montar({ concluidas: 9, total: 4, atual: true })
    expect(raiz.querySelector('[role="img"]')!.children).toHaveLength(4)
    await desmontar()
  })

  it("a etapa atual aguardando aprovação tem estado próprio e avisa por texto", async () => {
    const { raiz, desmontar } = await montar({ concluidas: 2, total: 5, atual: true, aguardando: true })
    const barra = raiz.querySelector('[role="img"]')!
    const estados = [...barra.children].map((c) => c.getAttribute("data-estado"))
    expect(estados).toEqual(["concluida", "concluida", "aguardando", "pendente", "pendente"])
    expect(barra.getAttribute("aria-label")).toBe("2 de 5 etapas concluídas, etapa atual aguardando aprovação")
    await desmontar()
  })

  it("aguardando sem etapa atual não muda nada", async () => {
    const { raiz, desmontar } = await montar({ concluidas: 5, total: 5, atual: false, aguardando: true })
    const barra = raiz.querySelector('[role="img"]')!
    expect([...barra.children].map((c) => c.getAttribute("data-estado"))).toEqual(Array(5).fill("concluida"))
    expect(barra.getAttribute("aria-label")).toBe("5 de 5 etapas concluídas")
    await desmontar()
  })

  it("os quatro estados têm cores diferentes e a futura não some (não usa a trilha de 10%)", async () => {
    const { raiz, desmontar } = await montar({ concluidas: 1, total: 4, atual: true, aguardando: true })
    const classes = [...raiz.querySelector('[role="img"]')!.children].map((c) => c.className)
    expect(new Set(classes).size).toBe(3)
    const futura = classes[3]!
    expect(futura).not.toMatch(/bg-foreground\/(?:[0-9]|1[0-9])(?!\d)/)
    expect(futura).toMatch(/bg-foreground\/(2[5-9]|[3-9]\d)/)
    await desmontar()
  })
})
