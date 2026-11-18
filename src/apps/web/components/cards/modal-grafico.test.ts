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

describe("ModalGrafico: foco ao fechar", () => {
  // Como no card: o botão "Ampliar" que abriu o modal some quando o ajuste é pedido (a prévia dá lugar ao marcador), e o
  // foco deve ir para o campo de mensagem, onde o pedido é escrito, em vez de cair no corpo da página.
  async function montarComPai() {
    const { useState } = await import("react")
    function Pai() {
      const [aberto, setAberto] = useState(false)
      const [ajustando, setAjustando] = useState(false)
      return createElement(
        "div",
        null,
        !ajustando && createElement("button", { id: "ampliar", onClick: () => setAberto(true) }, "Ampliar"),
        createElement("textarea", { id: "mensagem" }),
        createElement(ModalGrafico, {
          aberto,
          aoMudarAberto: setAberto,
          titulo: "ROAS",
          urlImagem: "/a.png",
          urlDownload: "/a.png?baixar=1",
          pendente: true,
          aprovarDesabilitado: false,
          ocupado: false,
          aoAprovar: async () => true,
          aoPedirAjuste: () => setAjustando(true),
          focoAoPedirAjuste: () => document.getElementById("mensagem"),
        }),
      )
    }
    raiz = document.createElement("div")
    document.body.append(raiz)
    r = createRoot(raiz)
    await act(async () => r.render(createElement(Pai)))
    const ampliar = document.getElementById("ampliar")!
    ampliar.focus()
    await act(async () => ampliar.click())
  }
  const esperar = () => act(async () => void (await new Promise((resolver) => setTimeout(resolver, 50))))

  it("Pedir ajuste leva o foco para o campo de mensagem, mesmo com o botão que abriu o modal já desmontado", async () => {
    await montarComPai()
    await act(async () => botao("Pedir ajuste")!.click())
    await esperar()
    expect(document.activeElement).toBe(document.getElementById("mensagem"))
  })

  it("fechar sem pedir ajuste devolve o foco ao botão que abriu o modal", async () => {
    await montarComPai()
    await act(async () => document.body.querySelector<HTMLElement>('[data-slot="dialog-close"]')!.click())
    await esperar()
    expect(document.activeElement).toBe(document.getElementById("ampliar"))
  })
})
