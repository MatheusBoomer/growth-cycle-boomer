// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ModalGrafico } from "./modal-grafico"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Props = Parameters<typeof ModalGrafico>[0]

let raiz: HTMLDivElement
let r: Root
async function montar(extra: Partial<Props> = {}) {
  const props: Props = {
    aberto: true,
    aoMudarAberto: vi.fn(),
    titulo: "ROAS por plataforma",
    urlImagem: "/api/x/arquivo?caminho=a.png",
    urlDownload: "/api/x/arquivo?caminho=a.png&baixar=1",
    pendente: true,
    aprovarDesabilitado: false,
    ocupado: false,
    aoAprovar: vi.fn().mockResolvedValue(true),
    aoPedirAjuste: vi.fn(),
    ...extra,
  }
  raiz = document.createElement("div")
  document.body.append(raiz)
  r = createRoot(raiz)
  await act(async () => r.render(createElement(ModalGrafico, props)))
  return props
}
afterEach(async () => {
  await act(async () => r.unmount())
  document.body.innerHTML = ""
})

const botao = (texto: string) => [...document.body.querySelectorAll<HTMLElement>("button, a")].find((b) => b.textContent?.includes(texto))

describe("ModalGrafico", () => {
  it("pendente: imagem grande, abrir em nova aba, baixar, aprovar e pedir ajuste", async () => {
    await montar()
    const img = document.body.querySelector("img")!
    expect(img.getAttribute("src")).toBe("/api/x/arquivo?caminho=a.png")
    expect(img.getAttribute("alt")).toBe("ROAS por plataforma")
    const nova = botao("Abrir em nova aba") as HTMLAnchorElement
    expect(nova.getAttribute("href")).toBe("/api/x/arquivo?caminho=a.png")
    expect(nova.getAttribute("target")).toBe("_blank")
    const baixar = botao("Baixar") as HTMLAnchorElement
    expect(baixar.getAttribute("href")).toBe("/api/x/arquivo?caminho=a.png&baixar=1")
    expect(baixar.hasAttribute("download")).toBe(true)
    expect(botao("Aprovar")).toBeDefined()
    expect(botao("Pedir ajuste")).toBeDefined()
  })

  it("já aprovado: só ver, abrir em nova aba e baixar", async () => {
    await montar({ pendente: false })
    expect(botao("Abrir em nova aba")).toBeDefined()
    expect(botao("Baixar")).toBeDefined()
    expect(botao("Aprovar")).toBeUndefined()
    expect(botao("Pedir ajuste")).toBeUndefined()
  })

  it("com ajuste pedido, Aprovar fica desabilitado e explica o motivo", async () => {
    await montar({ aprovarDesabilitado: true, motivoAprovarDesabilitado: "Disponível quando o agente gerar a nova versão com o ajuste" })
    const aprovar = botao("Aprovar") as HTMLButtonElement
    expect(aprovar.disabled).toBe(true)
    expect(aprovar.getAttribute("title")).toBe("Disponível quando o agente gerar a nova versão com o ajuste")
  })

  it("Aprovar chama aoAprovar e fecha o modal quando deu certo", async () => {
    const p = await montar()
    await act(async () => botao("Aprovar")!.click())
    expect(p.aoAprovar).toHaveBeenCalledTimes(1)
    expect(p.aoMudarAberto).toHaveBeenCalledWith(false)
  })

  it("Aprovar com erro (aoAprovar devolve false) não fecha o modal", async () => {
    const p = await montar({ aoAprovar: vi.fn().mockResolvedValue(false) })
    await act(async () => botao("Aprovar")!.click())
    expect(p.aoAprovar).toHaveBeenCalledTimes(1)
    expect(p.aoMudarAberto).not.toHaveBeenCalled()
  })

  it("Pedir ajuste chama aoPedirAjuste e depois fecha o modal", async () => {
    const ordem: string[] = []
    const p = await montar({ aoPedirAjuste: vi.fn(() => ordem.push("ajuste")), aoMudarAberto: vi.fn(() => ordem.push("fechou")) })
    await act(async () => botao("Pedir ajuste")!.click())
    expect(p.aoPedirAjuste).toHaveBeenCalledTimes(1)
    expect(ordem).toEqual(["ajuste", "fechou"])
  })

  it("fechado: não desenha nada", async () => {
    await montar({ aberto: false })
    expect(document.body.querySelector("img")).toBeNull()
  })
})
