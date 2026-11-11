import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { ErroEntrada, ErroNaoEncontrado } from "../src/erros"
import { NuvemArmazenamento } from "../src/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "../src/nuvem/memoria"
import { Mesa } from "../src/nuvem/mesa"
import { MSG_REPORTS_SEM_NUVEM } from "../src/reports"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import { catalogoReal, raizTemporaria } from "./ajuda"

const ANA = "ana@boomer.com.br"
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 2])
const entrada = { tipo: "bug", comentario: "Botão não salva", contexto: { url: "/prospects/acme", prospect: "acme" } }

let armazem: MemoriaArmazem
let servico: ServicoPlanejamento

function montar(armazenamento: FsArmazenamento) {
  return new ServicoPlanejamento({
    armazenamento,
    catalogo: catalogoReal(),
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-11-11T10:00:00.000Z",
  })
}

beforeEach(async () => {
  const raiz = await raizTemporaria()
  armazem = new MemoriaArmazem()
  const mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem, esperar: async () => {} })
  servico = montar(new NuvemArmazenamento({ raiz, repositorio: new MemoriaRepositorio(), armazem, mesa, atrasoAgendamentoMs: 0 }))
})

describe("reports no serviço (dados na nuvem)", () => {
  it("cria com tela e extra, gravando os caminhos e o autor", async () => {
    const r = await servico.criarReport(entrada, ANA, PNG, [JPG])
    expect(r).toMatchObject({ tipo: "bug", autor: ANA, status: "aberto", imagens: [`${r.id}/0.png`, `${r.id}/1.jpg`] })
    expect((await servico.listarReports()).map((x) => x.id)).toEqual([r.id])
  })

  it("desfaz linha e imagens quando um upload falha no meio", async () => {
    let envios = 0
    armazem.falharEm = (op) => op === "enviarImagemReport" && ++envios === 2
    await expect(servico.criarReport(entrada, ANA, PNG, [JPG])).rejects.toThrow("Falha simulada")
    expect(await servico.listarReports()).toEqual([])
    await expect(armazem.baixarImagemReport("1/0.png")).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("entrada inválida não grava nada", async () => {
    await expect(servico.criarReport({ ...entrada, comentario: " " }, ANA, null, [])).rejects.toBeInstanceOf(ErroEntrada)
    await expect(servico.criarReport(entrada, ANA, JPG, [])).rejects.toBeInstanceOf(ErroEntrada)
    expect(await servico.listarReports()).toEqual([])
  })

  it("devolve a imagem pelo índice com o tipo certo", async () => {
    const r = await servico.criarReport(entrada, ANA, PNG, [JPG])
    expect(await servico.imagemReport(r.id, 1)).toEqual({ bytes: JPG, contentType: "image/jpeg" })
    expect((await servico.imagemReport(r.id, 0)).contentType).toBe("image/png")
    await expect(servico.imagemReport(r.id, 5)).rejects.toBeInstanceOf(ErroNaoEncontrado)
    await expect(servico.imagemReport(999, 0)).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("atualiza status e nota, recusando report inexistente e status inválido", async () => {
    const r = await servico.criarReport(entrada, ANA, null, [])
    expect(await servico.atualizarReport(r.id, { status: "resolvido", notaAdmin: "ok" }, "chefe@boomer.com.br")).toMatchObject({
      status: "resolvido",
      notaAdmin: "ok",
      atualizadoPor: "chefe@boomer.com.br",
    })
    await expect(servico.atualizarReport(999, { status: "resolvido" }, "x")).rejects.toThrow("Report não encontrado.")
    await expect(servico.atualizarReport(r.id, { status: "fechado" }, "x")).rejects.toBeInstanceOf(ErroEntrada)
  })

  it("filtra por status e tipo", async () => {
    const a = await servico.criarReport(entrada, ANA, null, [])
    const b = await servico.criarReport({ ...entrada, tipo: "melhoria" }, ANA, null, [])
    await servico.atualizarReport(a.id, { status: "descartado" }, "x")
    expect((await servico.listarReports({ status: ["aberto"] })).map((r) => r.id)).toEqual([b.id])
    expect((await servico.listarReports({ tipo: "bug" })).map((r) => r.id)).toEqual([a.id])
  })
})

describe("reports no serviço (dados em disco)", () => {
  it("toda operação diz que só existe na nuvem", async () => {
    const disco = montar(new FsArmazenamento(await raizTemporaria()))
    await expect(disco.criarReport(entrada, ANA, null, [])).rejects.toThrow(MSG_REPORTS_SEM_NUVEM)
    await expect(disco.listarReports()).rejects.toThrow(MSG_REPORTS_SEM_NUVEM)
  })
})
