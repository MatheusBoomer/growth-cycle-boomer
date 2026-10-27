import { createHash } from "node:crypto"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { ErroSincronizacao } from "../../src/erros"
import { MemoriaArmazem } from "../../src/nuvem/memoria"
import { ignorarNaSincronizacao, Mesa } from "../../src/nuvem/mesa"
import { raizTemporaria } from "../ajuda"

const SLUG = "acme"

function sha(texto: string): string {
  return createHash("sha256").update(Buffer.from(texto)).digest("hex")
}

describe("Mesa", () => {
  let pastaClientes: string
  let armazem: MemoriaArmazem
  let esperas: number[]
  let mesa: Mesa

  beforeEach(async () => {
    pastaClientes = path.join(await raizTemporaria(), "clientes")
    await mkdir(path.join(pastaClientes, SLUG), { recursive: true })
    armazem = new MemoriaArmazem()
    esperas = []
    mesa = new Mesa({
      pastaClientes,
      armazem,
      esperar: async (ms) => {
        esperas.push(ms)
      },
    })
  })

  const abs = (caminho: string) => path.join(pastaClientes, SLUG, ...caminho.split("/"))
  const noDisco = async (caminho: string, conteudo: string) => {
    await mkdir(path.dirname(abs(caminho)), { recursive: true })
    await writeFile(abs(caminho), conteudo)
  }
  const doDisco = (caminho: string) => readFile(abs(caminho), "utf8")
  const existeNoDisco = (caminho: string) =>
    stat(abs(caminho)).then(
      () => true,
      () => false,
    )
  const naNuvem = (caminho: string, conteudo: string) => armazem.enviar(SLUG, caminho, Buffer.from(conteudo))
  const manifesto = async () =>
    Object.fromEntries((await armazem.listarManifesto(SLUG)).map((e) => [e.caminho, e.sha256]))
  const daNuvem = async (caminho: string) => {
    const entrada = (await armazem.listarManifesto(SLUG)).find((e) => e.caminho === caminho)
    if (!entrada) return null
    return Buffer.from(await armazem.baixar(SLUG, entrada.sha256)).toString("utf8")
  }
  const base = async (): Promise<Record<string, string> | null> => {
    try {
      return JSON.parse(await readFile(path.join(pastaClientes, ".mesa", `${SLUG}.json`), "utf8"))
    } catch {
      return null
    }
  }
  /** Deixa disco, nuvem e base iguais com os arquivos dados. */
  const sincronizado = async (arquivos: Record<string, string>) => {
    for (const [c, t] of Object.entries(arquivos)) {
      await noDisco(c, t)
      await naNuvem(c, t)
    }
    await mesa.sincronizar(SLUG)
    expect(await base()).toEqual(Object.fromEntries(Object.entries(arquivos).map(([c, t]) => [c, sha(t)])))
  }

  // Tabela 5.2 do spec, linha a linha.

  it("disco novo e ausente da base: envia", async () => {
    await sincronizado({})
    await noDisco("dados/novo.md", "n")
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 1, baixados: 0, removidosNaNuvem: 0, removidosNoDisco: 0 })
    expect(await daNuvem("dados/novo.md")).toBe("n")
    expect(await base()).toEqual({ "dados/novo.md": sha("n") })
  })

  it("disco mudado e nuvem igual: envia, não baixa", async () => {
    await sincronizado({ "a.md": "1" })
    await noDisco("a.md", "2")
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 1, baixados: 0, removidosNaNuvem: 0, removidosNoDisco: 0 })
    expect(await daNuvem("a.md")).toBe("2")
    expect(await doDisco("a.md")).toBe("2")
    expect(await base()).toEqual({ "a.md": sha("2") })
  })

  it("disco igual e nuvem mudada: baixa", async () => {
    await sincronizado({ "a.md": "1" })
    await naNuvem("a.md", "2")
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 0, baixados: 1, removidosNaNuvem: 0, removidosNoDisco: 0 })
    expect(await doDisco("a.md")).toBe("2")
    expect(await base()).toEqual({ "a.md": sha("2") })
  })

  it("disco igual e nuvem nova: baixa, criando as pastas", async () => {
    await sincronizado({ "a.md": "1" })
    await naNuvem("entrega/ativos-aprovados/g.png", "png")
    const r = await mesa.sincronizar(SLUG)
    expect(r.baixados).toBe(1)
    expect(await doDisco("entrega/ativos-aprovados/g.png")).toBe("png")
    expect(await base()).toEqual({ "a.md": sha("1"), "entrega/ativos-aprovados/g.png": sha("png") })
  })

  it("os dois mudaram: o disco vence", async () => {
    await sincronizado({ "a.md": "1" })
    await noDisco("a.md", "disco")
    await naNuvem("a.md", "nuvem")
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 1, baixados: 0, removidosNaNuvem: 0, removidosNoDisco: 0 })
    expect(await doDisco("a.md")).toBe("disco")
    expect(await daNuvem("a.md")).toBe("disco")
    expect(await base()).toEqual({ "a.md": sha("disco") })
  })

  it("apagado no disco e nuvem igual: tira do manifesto (vai para a lixeira)", async () => {
    await sincronizado({ "a.md": "1", "b.md": "2" })
    await rm(abs("a.md"))
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 0, baixados: 0, removidosNaNuvem: 1, removidosNoDisco: 0 })
    expect(await manifesto()).toEqual({ "b.md": sha("2") })
    expect(armazem.lixeira.map((l) => l.entrada.caminho)).toEqual(["a.md"])
    expect(await base()).toEqual({ "b.md": sha("2") })
  })

  it("disco igual e apagada na nuvem: apaga do disco, sem apagar a pasta", async () => {
    await sincronizado({ "dados/a.md": "1", "b.md": "2" })
    await armazem.remover(SLUG, "dados/a.md")
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 0, baixados: 0, removidosNaNuvem: 0, removidosNoDisco: 1 })
    expect(await existeNoDisco("dados/a.md")).toBe(false)
    expect(await existeNoDisco("dados")).toBe(true)
    expect(await base()).toEqual({ "b.md": sha("2") })
  })

  it("disco mudado e apagada na nuvem: o disco vence e envia", async () => {
    await sincronizado({ "a.md": "1" })
    await noDisco("a.md", "2")
    await armazem.remover(SLUG, "a.md")
    const r = await mesa.sincronizar(SLUG)
    expect(r.enviados).toBe(1)
    expect(await daNuvem("a.md")).toBe("2")
  })

  it("apagado no disco e mudada na nuvem: não perde a versão da nuvem, baixa", async () => {
    await sincronizado({ "a.md": "1" })
    await rm(abs("a.md"))
    await naNuvem("a.md", "2")
    const r = await mesa.sincronizar(SLUG)
    expect(r.baixados).toBe(1)
    expect(await doDisco("a.md")).toBe("2")
    expect(await daNuvem("a.md")).toBe("2")
  })

  it("nada mudou: não envia nem baixa", async () => {
    await sincronizado({ "a.md": "1" })
    let chamadas = 0
    armazem.falharEm = (op) => {
      if (op !== "listar") chamadas++
      return false
    }
    expect(await mesa.sincronizar(SLUG)).toEqual({ enviados: 0, baixados: 0, removidosNaNuvem: 0, removidosNoDisco: 0 })
    expect(chamadas).toBe(0)
  })

  it("primeira sincronização sem base: baixa o que só está na nuvem e envia o que só está no disco", async () => {
    await noDisco("local.md", "L")
    await naNuvem("remoto.md", "R")
    await noDisco("igual.md", "I")
    await naNuvem("igual.md", "I")
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 1, baixados: 1, removidosNaNuvem: 0, removidosNoDisco: 0 })
    expect(await doDisco("remoto.md")).toBe("R")
    expect(await daNuvem("local.md")).toBe("L")
    expect(await base()).toEqual({ "local.md": sha("L"), "remoto.md": sha("R"), "igual.md": sha("I") })
  })

  it("pasta do prospect ausente no disco: baixa tudo e não apaga nada da nuvem", async () => {
    await sincronizado({ "a.md": "1", "dados/b.md": "2" })
    await rm(path.join(pastaClientes, SLUG), { recursive: true })
    const r = await mesa.sincronizar(SLUG)
    expect(r).toEqual({ enviados: 0, baixados: 2, removidosNaNuvem: 0, removidosNoDisco: 0 })
    expect(await doDisco("dados/b.md")).toBe("2")
    expect(armazem.lixeira).toEqual([])
  })

  it("ignora .DS_Store, ~$x.xlsx, __pycache__/, .tmp, .app/previas/, .app/estado.json, .app/conversas/ e .app/comentarios/<id>.json, mas sincroniza .app/comentarios/<id>/c1.png", async () => {
    const ignorados = [
      ".DS_Store",
      "dados/.DS_Store",
      "dados/~$x.xlsx",
      "scripts/__pycache__/m.pyc",
      "contexto/status.md.0b1c.tmp",
      ".app/previas/p.html",
      ".app/estado.json",
      ".app/conversas/01.jsonl",
      ".app/comentarios/ent-1.json",
    ]
    for (const c of ignorados) await noDisco(c, "x")
    await noDisco(".app/comentarios/ent-1/c1.png", "img")
    const r = await mesa.sincronizar(SLUG)
    expect(r.enviados).toBe(1)
    expect(Object.keys(await manifesto())).toEqual([".app/comentarios/ent-1/c1.png"])
    for (const c of ignorados) expect(ignorarNaSincronizacao(c)).toBe(true)
    expect(ignorarNaSincronizacao(".app/comentarios/ent-1/c1.png")).toBe(false)
    expect(ignorarNaSincronizacao("dados/historico.xlsx")).toBe(false)
    // Um ignorado apagado do disco não mexe na nuvem.
    await rm(abs(".app/estado.json"))
    await mesa.sincronizar(SLUG)
    expect(armazem.lixeira).toEqual([])
  })

  it("preserva nome com acento e espaço", async () => {
    const caminho = "dados/Relatório de clientes.xlsx"
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252])
    await mkdir(path.dirname(abs(caminho)), { recursive: true })
    await writeFile(abs(caminho), bytes)
    await mesa.sincronizar(SLUG)
    expect(Object.keys(await manifesto())).toEqual([caminho])
    // Uma mesa nova (servidor reiniciado, disco vazio) traz de volta com o nome exato.
    await rm(path.join(pastaClientes, SLUG), { recursive: true })
    await mesa.esquecer(SLUG)
    expect(await base()).toBeNull()
    await mesa.sincronizar(SLUG)
    expect(Buffer.compare(await readFile(abs(caminho)), bytes)).toBe(0)
    expect(Object.keys(await manifesto())).toEqual([caminho])
  })

  it("sincronizações simultâneas rodam uma depois da outra", async () => {
    await noDisco("a.md", "1")
    await noDisco("dados/b.md", "2")
    const envios = new Map<string, number>()
    armazem.falharEm = (op, caminho) => {
      if (op === "enviar") envios.set(caminho, (envios.get(caminho) ?? 0) + 1)
      return false
    }
    await Promise.all([mesa.sincronizar(SLUG), mesa.sincronizar(SLUG)])
    for (const n of envios.values()) expect(n).toBeLessThanOrEqual(1)
    expect([...envios.keys()].sort()).toEqual(["a.md", "dados/b.md"])
    expect(await base()).toEqual(await manifesto())
  })

  it("uma sincronização que falhou não trava a próxima do mesmo prospect", async () => {
    await noDisco("a.md", "1")
    armazem.falharEm = (op) => op === "enviar"
    const primeira = mesa.sincronizar(SLUG)
    const segunda = mesa.sincronizar(SLUG)
    await expect(primeira).rejects.toBeInstanceOf(ErroSincronizacao)
    armazem.falharEm = undefined
    await expect(segunda).resolves.toEqual({ enviados: 1, baixados: 0, removidosNaNuvem: 0, removidosNoDisco: 0 })
  })

  it("falha 3 vezes: ErroSincronizacao com o caminho e a base intacta", async () => {
    await sincronizado({ "a.md": "1" })
    const antes = await base()
    await noDisco("dados/Relatório.xlsx", "x")
    let tentativas = 0
    armazem.falharEm = (op) => {
      if (op === "enviar") tentativas++
      return op === "enviar"
    }
    const erro = await mesa.sincronizar(SLUG).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroSincronizacao)
    expect((erro as ErroSincronizacao).caminho).toBe("dados/Relatório.xlsx")
    expect((erro as Error).message).toContain("dados/Relatório.xlsx")
    expect(tentativas).toBe(3)
    expect(esperas).toEqual([500, 1000, 2000])
    expect(await base()).toEqual(antes)
  })

  it("falha 2 vezes e depois passa", async () => {
    await noDisco("a.md", "1")
    let falhas = 0
    armazem.falharEm = (op) => {
      if (op === "enviar" && falhas < 2) {
        falhas++
        return true
      }
      return false
    }
    const r = await mesa.sincronizar(SLUG)
    expect(r.enviados).toBe(1)
    expect(esperas).toEqual([500, 1000])
    expect(await base()).toEqual({ "a.md": sha("1") })
  })

  it("falha de outra natureza (erro comum) também vira ErroSincronizacao com o caminho", async () => {
    await sincronizado({ "a.md": "1" })
    await naNuvem("b.md", "2")
    armazem.falharEm = (op) => {
      if (op === "baixar") throw new Error("rede caiu")
      return false
    }
    const erro = await mesa.sincronizar(SLUG).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroSincronizacao)
    expect((erro as ErroSincronizacao).caminho).toBe("b.md")
    expect(await existeNoDisco("b.md")).toBe(false)
  })
})

describe("Mesa com manifesto corrompido", () => {
  it("recusa caminho que sai da pasta do prospect, sem escrever fora dela", async () => {
    const raiz = await raizTemporaria()
    const pastaClientes = path.join(raiz, "clientes")
    await mkdir(path.join(pastaClientes, SLUG), { recursive: true })
    const armazem = new MemoriaArmazem()
    await armazem.enviar(SLUG, "../fora.md", Buffer.from("x"))
    const mesa = new Mesa({ pastaClientes, armazem, esperar: async () => {} })
    const erro = await mesa.sincronizar(SLUG).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroSincronizacao)
    expect((erro as ErroSincronizacao).caminho).toBe("../fora.md")
    await expect(stat(path.join(pastaClientes, "fora.md"))).rejects.toThrow()
  })
})
