import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"
import {
  comScriptDeInteracao,
  criarMedidorPresenca,
  ehMensagemDeInteracao,
  focoFoiParaIframe,
  scriptDeInteracao,
  TIPO_MENSAGEM_INTERACAO,
} from "./presenca"

describe("criarMedidorPresenca", () => {
  it("sem interação, 30 s depois do início, dá 30 s sem interação", () => {
    let agora = 1_000_000
    const medidor = criarMedidorPresenca(() => agora)
    agora += 30_000
    expect(medidor.corpo("03", true)).toEqual({ etapa: "03", visivel: true, segundosSemInteracao: 30 })
  })

  it("registrarInteracao zera o tempo sem interação", () => {
    let agora = 1_000_000
    const medidor = criarMedidorPresenca(() => agora)
    agora += 90_000
    medidor.registrarInteracao()
    agora += 4_000
    expect(medidor.corpo("03", true).segundosSemInteracao).toBe(4)
  })

  it("arredonda para baixo", () => {
    let agora = 0
    const medidor = criarMedidorPresenca(() => agora)
    agora += 29_999
    expect(medidor.corpo("03", true).segundosSemInteracao).toBe(29)
  })

  it("repassa a etapa e se a aba está visível", () => {
    const medidor = criarMedidorPresenca(() => 0)
    expect(medidor.corpo("final", false)).toEqual({ etapa: "final", visivel: false, segundosSemInteracao: 0 })
  })

  it("não passa de 24 h (limite que a rota aceita)", () => {
    let agora = 0
    const medidor = criarMedidorPresenca(() => agora)
    agora += 30 * 3_600_000
    expect(medidor.corpo("01", false).segundosSemInteracao).toBe(86_400)
  })
})

describe("scriptDeInteracao", () => {
  /** Roda o script numa janela falsa e devolve os ouvintes registrados e o que foi enviado à janela de cima. */
  function executar() {
    const ouvintes = new Map<string, () => void>()
    const enviadas: Array<[unknown, string]> = []
    let agora = 1_000_000
    const janela = { addEventListener: (tipo: string, f: () => void) => void ouvintes.set(tipo, f) }
    const pai = { postMessage: (dados: unknown, alvo: string) => void enviadas.push([dados, alvo]) }
    const codigo = scriptDeInteracao().replace(/^<script>/, "").replace(/<\/script>$/, "")
    runInNewContext(codigo, { window: janela, parent: pai, Date: { now: () => agora } })
    return { ouvintes, enviadas, avancar: (ms: number) => void (agora += ms) }
  }

  it("é uma tag script inline, sem fechar a tag no meio", () => {
    const s = scriptDeInteracao()
    expect(s.startsWith("<script>")).toBe(true)
    expect(s.endsWith("</script>")).toBe(true)
    expect(s.indexOf("</script>")).toBe(s.length - "</script>".length)
  })

  it("escuta teclado, clique, roda, rolagem e movimento", () => {
    const { ouvintes } = executar()
    expect([...ouvintes.keys()].sort()).toEqual(["keydown", "pointerdown", "pointermove", "scroll", "wheel"])
  })

  it("avisa a janela de cima com a mensagem certa, no máximo uma vez a cada 5 s", () => {
    const { ouvintes, enviadas, avancar } = executar()
    ouvintes.get("keydown")!()
    ouvintes.get("pointermove")!()
    avancar(4_999)
    ouvintes.get("scroll")!()
    expect(enviadas).toEqual([[{ tipo: TIPO_MENSAGEM_INTERACAO }, "*"]])
    avancar(1)
    ouvintes.get("wheel")!()
    expect(enviadas).toHaveLength(2)
  })
})

describe("comScriptDeInteracao", () => {
  it("põe o script no fim, sem mexer no começo do documento", () => {
    const html = "<!doctype html><html><body><p>oi</p></body></html>"
    const r = comScriptDeInteracao(html)
    expect(r.startsWith(html)).toBe(true)
    expect(r.endsWith(scriptDeInteracao())).toBe(true)
  })
})

describe("ehMensagemDeInteracao", () => {
  const janelaDoIframe = { nome: "iframe" }
  const outra = { nome: "outra" }
  const msg = { tipo: TIPO_MENSAGEM_INTERACAO }

  it("aceita a mensagem certa vinda da janela de um iframe da página", () => {
    expect(ehMensagemDeInteracao(msg, janelaDoIframe, [outra, janelaDoIframe])).toBe(true)
  })

  it("recusa origem que não é de nenhum iframe da página", () => {
    expect(ehMensagemDeInteracao(msg, outra, [janelaDoIframe])).toBe(false)
    expect(ehMensagemDeInteracao(msg, null, [janelaDoIframe])).toBe(false)
    expect(ehMensagemDeInteracao(msg, null, [null])).toBe(false)
    expect(ehMensagemDeInteracao(msg, janelaDoIframe, [])).toBe(false)
  })

  it("recusa dados de outro tipo ou de outra forma", () => {
    expect(ehMensagemDeInteracao({ tipo: "outro" }, janelaDoIframe, [janelaDoIframe])).toBe(false)
    expect(ehMensagemDeInteracao("planejamento:interacao", janelaDoIframe, [janelaDoIframe])).toBe(false)
    expect(ehMensagemDeInteracao(null, janelaDoIframe, [janelaDoIframe])).toBe(false)
    expect(ehMensagemDeInteracao(undefined, janelaDoIframe, [janelaDoIframe])).toBe(false)
  })
})

describe("focoFoiParaIframe", () => {
  it("só vale quando o elemento ativo é um iframe", () => {
    expect(focoFoiParaIframe({ tagName: "IFRAME" })).toBe(true)
    expect(focoFoiParaIframe({ tagName: "BODY" })).toBe(false)
    expect(focoFoiParaIframe({})).toBe(false)
    expect(focoFoiParaIframe(null)).toBe(false)
  })
})
