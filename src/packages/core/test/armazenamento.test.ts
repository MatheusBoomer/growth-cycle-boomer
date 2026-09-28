import { existsSync } from "node:fs"
import { mkdir, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { ErroCaminhoForaDoProspect, ErroProspectExistente } from "../src/erros"
import { estadoInicial } from "../src/maquina-estados"
import { raizTemporaria } from "./ajuda"

let raiz: string
let lixeira: string[]
let arm: FsArmazenamento

beforeEach(async () => {
  raiz = await raizTemporaria()
  lixeira = []
  arm = new FsArmazenamento(raiz, async (p) => {
    lixeira.push(p)
  })
})

describe("FsArmazenamento", () => {
  it("cria a pasta a partir do _template e recusa sobrescrever", async () => {
    await arm.criarPasta("iszi")
    expect(existsSync(path.join(raiz, "clientes/iszi/contexto/status-planejamento.md"))).toBe(true)
    await expect(arm.criarPasta("iszi")).rejects.toBeInstanceOf(ErroProspectExistente)
  })

  it("lista prospects ignorando _template e pastas ocultas", async () => {
    await arm.criarPasta("b")
    await arm.criarPasta("a")
    await mkdir(path.join(raiz, "clientes/.lixo"))
    expect(await arm.listarSlugs()).toEqual(["a", "b"])
  })

  it("grava o estado de forma atômica e lê de volta", async () => {
    await arm.criarPasta("a")
    const e = estadoInicial({ slug: "a", nome: "A", site: null }, "2026-09-28T00:00:00.000Z")
    await arm.gravarEstado("a", e)
    expect(await arm.lerEstado("a")).toEqual(e)
    const arquivos = await readdir(path.join(raiz, "clientes/a/.app"))
    expect(arquivos).toEqual(["estado.json"])
  })

  it("recusa caminho que escapa da pasta do prospect", async () => {
    await arm.criarPasta("a")
    expect(() => arm.caminhoAbsoluto("a", "../b/x.md")).toThrow(ErroCaminhoForaDoProspect)
    expect(() => arm.caminhoAbsoluto("a", "/etc/passwd")).toThrow(ErroCaminhoForaDoProspect)
  })

  it("normaliza caminhos relativos à raiz, absolutos e relativos ao prospect", async () => {
    await arm.criarPasta("a")
    const esperado = ".app/rascunhos/g.png"
    expect(arm.relativoAoProspect("a", ".app/rascunhos/g.png")).toBe(esperado)
    expect(arm.relativoAoProspect("a", "clientes/a/.app/rascunhos/g.png")).toBe(esperado)
    expect(arm.relativoAoProspect("a", path.join(raiz, "clientes/a/.app/rascunhos/g.png"))).toBe(esperado)
    expect(() => arm.relativoAoProspect("a", "clientes/b/x.png")).toThrow(ErroCaminhoForaDoProspect)
  })

  it("anexa e lê a conversa, ignorando linha corrompida", async () => {
    await arm.criarPasta("a")
    await arm.anexarConversa("a", "03", { tipo: "turno_inicio", em: "t1" })
    await writeFile(path.join(raiz, "clientes/a/.app/conversas/03.jsonl"), "{quebrado\n", { flag: "a" })
    await arm.anexarConversa("a", "03", { tipo: "texto_agente", texto: "oi", em: "t2" })
    expect((await arm.lerConversa("a", "03")).map((e) => e.tipo)).toEqual(["turno_inicio", "texto_agente"])
    expect(await arm.lerConversa("a", "04")).toEqual([])
  })

  it("lista aprovados sem README e .DS_Store", async () => {
    await arm.criarPasta("a")
    await arm.gravarTexto("a", "entrega/ativos-aprovados/secoes/03-macro.md", "x")
    await arm.gravarBinario("a", "entrega/ativos-aprovados/graficos/roas.png", new Uint8Array([1]))
    expect(await arm.listarAprovados("a")).toEqual([
      "entrega/ativos-aprovados/graficos/roas.png",
      "entrega/ativos-aprovados/secoes/03-macro.md",
    ])
  })

  it("copia e move para dentro da pasta", async () => {
    await arm.criarPasta("a")
    await arm.gravarTexto("a", ".app/rascunhos/s.md", "texto")
    await arm.copiar("a", ".app/rascunhos/s.md", "entrega/ativos-aprovados/secoes/03-s.md")
    expect(await arm.lerTexto("a", "entrega/ativos-aprovados/secoes/03-s.md")).toBe("texto")
    const fora = path.join(raiz, "tmp-upload.xlsx")
    await writeFile(fora, "bin")
    await arm.moverParaDentro("a", fora, "dados/historico-mensal.xlsx")
    expect(existsSync(fora)).toBe(false)
    expect(await arm.existeArquivo("a", "dados/historico-mensal.xlsx")).toBe(true)
  })

  it("excluir manda a pasta para a lixeira", async () => {
    await arm.criarPasta("a")
    await arm.excluir("a")
    expect(lixeira).toEqual([path.join(raiz, "clientes", "a")])
  })
})
