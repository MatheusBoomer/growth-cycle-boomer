import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { ErroFixture } from "../src/erros"
import { carregarRoteiro, classificarGatilho, pastaEnsaio, type RoteiroEnsaio } from "../src/ensaio/roteiro"
import { mensagemAjuste, mensagemAjustes, mensagemAprovacao } from "../src/prompts"
import { raizTemporaria } from "./ajuda"

let raiz: string

beforeEach(async () => {
  raiz = await raizTemporaria()
})

describe("classificarGatilho", () => {
  it("reconhece a mensagem de aprovação", () => {
    expect(classificarGatilho(mensagemAprovacao("T", "n", "d"), false)).toBe("aprovar")
  })

  it("reconhece o pedido de ajuste de um entregável e de vários", () => {
    expect(classificarGatilho(mensagemAjuste("T", "n", "x"), false)).toBe("ajuste")
    const itens = [{ titulo: "T", nomeFinal: "n", marcacoes: ["1. a"] }]
    expect(classificarGatilho(mensagemAjustes("x", itens), false)).toBe("ajuste")
  })

  it("separa mensagem do analista de mensagem automática", () => {
    expect(classificarGatilho("oi", false)).toBe("mensagem")
    expect(classificarGatilho("oi", true)).toBe("automatica")
  })
})

describe("pastaEnsaio", () => {
  it("fica dentro do fixture, por etapa", () => {
    expect(pastaEnsaio("/r", "verdeluz", "03")).toBe(path.join("/r", "clientes", "_fixtures", "verdeluz", "ensaio", "03"))
  })
})

describe("carregarRoteiro", () => {
  async function gravar(etapa: string, conteudo: string): Promise<void> {
    const pasta = pastaEnsaio(raiz, "mini", etapa as "03")
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "roteiro.json"), conteudo)
  }

  it("lê um roteiro gravado e devolve os trechos", async () => {
    const roteiro: RoteiroEnsaio = {
      versao: 1,
      etapa: "03",
      trechos: [
        {
          gatilho: "mensagem",
          textoPreenchido: null,
          passos: [
            { dtMs: 10, evento: { tipo: "texto", texto: "olá" } },
            { dtMs: 20, ferramenta: "propor_entregavel", entrada: { titulo: "T" } },
          ],
        },
      ],
    }
    await gravar("03", JSON.stringify(roteiro))
    expect(await carregarRoteiro(raiz, "mini", "03")).toEqual(roteiro)
  })

  it("pasta sem roteiro.json rejeita com ErroFixture citando o caminho", async () => {
    const erro = await carregarRoteiro(raiz, "mini", "03").catch((e) => e)
    expect(erro).toBeInstanceOf(ErroFixture)
    expect((erro as Error).message).toContain("ensaio/03/roteiro.json")
  })

  it("JSON inválido rejeita com ErroFixture citando o caminho", async () => {
    await gravar("03", "{não é json")
    const erro = await carregarRoteiro(raiz, "mini", "03").catch((e) => e)
    expect(erro).toBeInstanceOf(ErroFixture)
    expect((erro as Error).message).toContain("ensaio/03/roteiro.json")
  })

  it("versão diferente de 1 rejeita", async () => {
    await gravar("03", JSON.stringify({ versao: 2, etapa: "03", trechos: [] }))
    await expect(carregarRoteiro(raiz, "mini", "03")).rejects.toBeInstanceOf(ErroFixture)
  })

  it("roteiro de outra etapa ou sem trechos rejeita", async () => {
    await gravar("03", JSON.stringify({ versao: 1, etapa: "04", trechos: [] }))
    await expect(carregarRoteiro(raiz, "mini", "03")).rejects.toBeInstanceOf(ErroFixture)
    await gravar("03", JSON.stringify({ versao: 1, etapa: "03" }))
    await expect(carregarRoteiro(raiz, "mini", "03")).rejects.toBeInstanceOf(ErroFixture)
  })
})
