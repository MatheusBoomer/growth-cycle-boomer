import { describe, expect, it } from "vitest"
import { LIMITE_IMAGEM_BYTES } from "@workspace/core/reports"
import { base64ParaBlob, contextoDaTela, extraAceito, montarFormularioReport } from "./report-envio"

const janela = { innerWidth: 1440, innerHeight: 900 }

describe("contextoDaTela", () => {
  it("pega o prospect do caminho /prospects/<slug>", () => {
    expect(contextoDaTela({ pathname: "/prospects/acme", search: "?aba=2" }, { userAgent: "UA" }, janela)).toEqual({
      url: "/prospects/acme?aba=2",
      prospect: "acme",
      navegador: "UA",
      tela: { largura: 1440, altura: 900 },
    })
    expect(contextoDaTela({ pathname: "/prospects/acme/x", search: "" }, { userAgent: "UA" }, janela).prospect).toBe("acme")
  })

  it("fora de um prospect, prospect é null", () => {
    expect(contextoDaTela({ pathname: "/admin/skills", search: "" }, { userAgent: "UA" }, janela).prospect).toBeNull()
  })
})

describe("montarFormularioReport", () => {
  const contexto = contextoDaTela({ pathname: "/", search: "" }, { userAgent: "UA" }, janela)

  it("sem tela não manda o campo; extras vão todos; dados não têm autor", () => {
    const extras = [new File(["a"], "a.png", { type: "image/png" }), new File(["b"], "b.jpg", { type: "image/jpeg" })]
    const form = montarFormularioReport({ tipo: "bug", comentario: "x", contexto, tela: null, extras })
    expect(form.get("tela")).toBeNull()
    expect(form.getAll("extras")).toHaveLength(2)
    const dados = JSON.parse(String(form.get("dados")))
    expect(dados).toEqual({ tipo: "bug", comentario: "x", contexto })
    expect(dados).not.toHaveProperty("autor")
  })

  it("com tela manda o print como tela.png", () => {
    const form = montarFormularioReport({ tipo: "melhoria", comentario: "x", contexto, tela: new Blob(["p"], { type: "image/png" }), extras: [] })
    expect((form.get("tela") as File).name).toBe("tela.png")
  })
})

describe("extraAceito", () => {
  it("recusa formato e tamanho; aceita JPEG pequeno", () => {
    expect(extraAceito(new File(["g"], "a.gif", { type: "image/gif" }))).toBe("Imagem em formato não aceito. Use PNG ou JPEG.")
    expect(extraAceito(new File([new Uint8Array(LIMITE_IMAGEM_BYTES + 1)], "a.png", { type: "image/png" }))).toBe(
      "Cada imagem pode ter no máximo 5 MB.",
    )
    expect(extraAceito(new File(["j"], "a.jpg", { type: "image/jpeg" }))).toBeNull()
  })
})

describe("base64ParaBlob", () => {
  it("decodifica os bytes, com ou sem o prefixo data:", async () => {
    expect(base64ParaBlob("iVBORw0KGgo=", "image/png").size).toBe(8)
    const blob = base64ParaBlob("data:image/png;base64,iVBORw0KGgo=", "image/png")
    expect(blob.size).toBe(8)
    expect(blob.type).toBe("image/png")
  })
})
