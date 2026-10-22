import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { type ArmazenamentoDev, criarArmazenamentoDev, decodificarPng } from "./armazenamento.ts"
import { ErroValidacaoDev, type NovoComentario } from "./nucleo.ts"

const ASSINATURA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG = Buffer.from([...ASSINATURA, 1, 2, 3])

function novo(pagina = "/", comentario = "Ajustar"): NovoComentario {
  return {
    pagina,
    componente: "Painel",
    cadeia: ["Painel"],
    seletor: "main",
    tag: "main",
    texto: "",
    caixa: { x: 0, y: 0, largura: 10, altura: 10, larguraTela: 100, alturaTela: 100 },
    comentario,
  }
}

let pasta: string
let armazenamento: ArmazenamentoDev

beforeEach(async () => {
  pasta = path.join(await mkdtemp(path.join(os.tmpdir(), "modo-dev-")), ".dev-comentarios")
  armazenamento = criarArmazenamentoDev(pasta)
})

afterEach(async () => {
  await rm(path.dirname(pasta), { recursive: true, force: true })
})

describe("armazenamento do modo dev", () => {
  it("pasta inexistente conta como lista vazia", async () => {
    expect(await armazenamento.listar()).toEqual([])
  })

  it("numera em sequência e grava o recorte", async () => {
    const a = await armazenamento.criar(novo(), PNG)
    const b = await armazenamento.criar(novo(), null)
    expect([a.numero, b.numero]).toEqual([1, 2])
    expect(a.captura).toBe(`capturas/${a.id}.png`)
    expect(await readFile(path.join(pasta, a.captura!))).toEqual(PNG)
    expect(b.captura).toBeNull()
    expect(a.editadoEm).toBeNull()
    const arquivo = JSON.parse(await readFile(path.join(pasta, "comentarios.json"), "utf-8"))
    expect(arquivo).toMatchObject({ versao: 1, proximoNumero: 3 })
  })

  it("grava o print da tela ao lado do recorte e apaga os dois juntos", async () => {
    const a = await armazenamento.criar(novo(), PNG, PNG)
    expect(a.tela).toBe(`capturas/${a.id}-tela.png`)
    expect(await readFile(path.join(pasta, a.tela!))).toEqual(PNG)
    expect((await armazenamento.criar(novo(), PNG)).tela).toBeNull()
    await armazenamento.apagar(a.id)
    expect(existsSync(path.join(pasta, a.captura!))).toBe(false)
    expect(existsSync(path.join(pasta, a.tela!))).toBe(false)
  })

  it("limpar por números também apaga o print da tela", async () => {
    const a = await armazenamento.criar(novo(), PNG, PNG)
    await armazenamento.limpar([1])
    expect(existsSync(path.join(pasta, a.tela!))).toBe(false)
  })

  it("abre a imagem do comentário pelo tipo e devolve null quando não existe", async () => {
    const a = await armazenamento.criar(novo(), PNG, null)
    expect(await armazenamento.imagem(a.id, "recorte")).toEqual(PNG)
    expect(await armazenamento.imagem(a.id, "tela")).toBeNull()
    await expect(armazenamento.imagem("nada", "recorte")).rejects.toMatchObject({ status: 404 })
  })

  it("não reaproveita número depois de apagar", async () => {
    await armazenamento.criar(novo(), null)
    const b = await armazenamento.criar(novo(), null)
    await armazenamento.apagar(b.id)
    expect((await armazenamento.criar(novo(), null)).numero).toBe(3)
  })

  it("editar troca o texto e marca editadoEm", async () => {
    const a = await armazenamento.criar(novo(), null)
    const editado = await armazenamento.editar(a.id, "Outro texto")
    expect(editado).toMatchObject({ id: a.id, numero: 1, comentario: "Outro texto" })
    expect(editado.editadoEm).not.toBeNull()
    expect((await armazenamento.listar())[0]!.comentario).toBe("Outro texto")
  })

  it("editar e apagar id inexistente dão 404", async () => {
    await expect(armazenamento.editar("nada", "x")).rejects.toMatchObject({ status: 404 })
    await expect(armazenamento.apagar("nada")).rejects.toMatchObject({ status: 404 })
  })

  it("apagar remove o recorte", async () => {
    const a = await armazenamento.criar(novo(), PNG)
    await armazenamento.apagar(a.id)
    expect(existsSync(path.join(pasta, a.captura!))).toBe(false)
    expect(await armazenamento.listar()).toEqual([])
  })

  it("listar filtra por página e ordena por número", async () => {
    await armazenamento.criar(novo("/a"), null)
    await armazenamento.criar(novo("/b"), null)
    await armazenamento.criar(novo("/a"), null)
    expect((await armazenamento.listar("/a")).map((c) => c.numero)).toEqual([1, 3])
    expect((await armazenamento.listar()).map((c) => c.numero)).toEqual([1, 2, 3])
  })

  it("limpar sem números zera tudo, apaga os recortes e volta a contar do 1", async () => {
    await armazenamento.criar(novo(), PNG)
    await armazenamento.criar(novo(), null)
    expect(await armazenamento.limpar()).toEqual({ apagados: [1, 2], inexistentes: [] })
    expect(existsSync(path.join(pasta, "capturas"))).toBe(false)
    expect((await armazenamento.criar(novo(), null)).numero).toBe(1)
  })

  it("limpar por números apaga só esses, com recortes, e informa os inexistentes", async () => {
    const a = await armazenamento.criar(novo(), PNG)
    await armazenamento.criar(novo(), null)
    await armazenamento.criar(novo(), null)
    expect(await armazenamento.limpar([3, 1, 9])).toEqual({ apagados: [1, 3], inexistentes: [9] })
    expect((await armazenamento.listar()).map((c) => c.numero)).toEqual([2])
    expect(existsSync(path.join(pasta, a.captura!))).toBe(false)
    expect((await armazenamento.criar(novo(), null)).numero).toBe(4)
  })

  it("JSON corrompido conta como lista vazia e é recriado na próxima escrita", async () => {
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "comentarios.json"), "{oops")
    expect(await armazenamento.listar()).toEqual([])
    expect((await armazenamento.criar(novo(), null)).numero).toBe(1)
  })

  it("a gravação não deixa arquivo temporário", async () => {
    await armazenamento.criar(novo(), PNG)
    expect((await readdir(pasta)).sort()).toEqual(["capturas", "comentarios.json"])
  })

  it("criações simultâneas não perdem comentário nem repetem número", async () => {
    const criados = await Promise.all(Array.from({ length: 5 }, () => armazenamento.criar(novo(), null)))
    expect(criados.map((c) => c.numero).sort()).toEqual([1, 2, 3, 4, 5])
    expect(await armazenamento.listar()).toHaveLength(5)
  })
})

describe("decodificarPng", () => {
  it("aceita base64 puro ou como data URL", () => {
    const base64 = PNG.toString("base64")
    expect(decodificarPng(base64)).toEqual(PNG)
    expect(decodificarPng(`data:image/png;base64,${base64}`)).toEqual(PNG)
  })

  it("recusa o que não é PNG", () => {
    expect(() => decodificarPng(Buffer.from("GIF89a....").toString("base64"))).toThrow(ErroValidacaoDev)
    expect(() => decodificarPng("")).toThrow(ErroValidacaoDev)
  })

  it("recusa acima de 5 MB", () => {
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1)
    grande.set(ASSINATURA)
    expect(() => decodificarPng(grande.toString("base64"))).toThrow(/5 MB/)
  })
})
