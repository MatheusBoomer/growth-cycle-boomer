import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { ErroConflitoVersao, ErroNaoEncontrado, ErroProspectExistente } from "../../src/erros"
import { estadoInicial } from "../../src/maquina-estados"
import { SupabaseArmazem, SupabaseRepositorio } from "../../src/nuvem/supabase"
import type { EventoConversa } from "../../src/tipos"

const EM = "2026-10-27T12:00:00.000Z"

type Resposta = { data: unknown; error: { message: string; code?: string; status?: number } | null }

interface Consulta {
  tabela: string
  /** Operações encadeadas, na ordem: [metodo, ...argumentos]. */
  ops: Array<[string, ...unknown[]]>
}

const op = (c: Consulta, metodo: string) => c.ops.find(([m]) => m === metodo)

/** Query builder mínimo, com as mesmas formas de chamada do supabase-js usadas pelo código. */
function criarFake(responder: (c: Consulta) => Resposta) {
  const consultas: Consulta[] = []
  const armazenamento: Array<{ bucket: string; metodo: string; args: unknown[] }> = []
  const respostasStorage: Record<string, (args: unknown[], bucket: string) => Resposta> = {}

  function builder(tabela: string) {
    const consulta: Consulta = { tabela, ops: [] }
    consultas.push(consulta)
    const b: Record<string, unknown> = {}
    for (const m of [
      "select", "insert", "update", "upsert", "delete", "eq", "is", "not", "like", "order", "range", "maybeSingle", "single",
    ]) {
      b[m] = (...args: unknown[]) => {
        consulta.ops.push([m, ...args])
        return b
      }
    }
    b.then = (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) =>
      Promise.resolve(responder(consulta)).then(ok, falha)
    return b
  }

  const cliente = {
    from: builder,
    storage: {
      from: (bucket: string) => ({
        upload: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "upload", args })
          return respostasStorage.upload?.(args, bucket) ?? { data: {}, error: null }
        },
        download: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "download", args })
          return respostasStorage.download?.(args, bucket) ?? { data: null, error: { message: "Object not found" } }
        },
        list: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "list", args })
          return respostasStorage.list?.(args, bucket) ?? { data: [], error: null }
        },
        remove: async (...args: unknown[]) => {
          armazenamento.push({ bucket, metodo: "remove", args })
          return respostasStorage.remove?.(args, bucket) ?? { data: [], error: null }
        },
      }),
    },
  }
  return { cliente: cliente as unknown as SupabaseClient, consultas, armazenamento, respostasStorage }
}

const ok = (data: unknown): Resposta => ({ data, error: null })

describe("SupabaseRepositorio (cliente falso)", () => {
  it("gravarEstado: atualiza só com a versão lida e devolve a nova", async () => {
    const e = estadoInicial({ slug: "p", nome: "Nome P", site: null }, EM)
    const fake = criarFake(() => ok([{ versao: 4 }]))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    expect(await repo.gravarEstado("p", e, 3)).toBe(4)
    const c = fake.consultas[0]!
    expect(c.tabela).toBe("prospects")
    expect(op(c, "update")![1]).toEqual({
      estado: e,
      nome: "Nome P",
      etapa_atual: "01",
      versao: 4,
      atualizado_em: EM,
    })
    expect(c.ops.filter(([m]) => m === "eq")).toEqual([
      ["eq", "slug", "p"],
      ["eq", "versao", 3],
    ])
    expect(op(c, "is")).toEqual(["is", "excluido_em", null])
    expect(op(c, "select")).toEqual(["select", "versao"])
  })

  it("gravarEstado: zero linhas em prospect existente vira ErroConflitoVersao", async () => {
    const e = estadoInicial({ slug: "p", nome: "P", site: null }, EM)
    const fake = criarFake((c) => (op(c, "update") ? ok([]) : ok({ slug: "p" })))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await expect(repo.gravarEstado("p", e, 0)).rejects.toBeInstanceOf(ErroConflitoVersao)
  })

  it("gravarEstado: zero linhas em prospect ausente ou excluído vira ErroNaoEncontrado", async () => {
    const e = estadoInicial({ slug: "p", nome: "P", site: null }, EM)
    const fake = criarFake((c) => (op(c, "update") ? ok([]) : ok(null)))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await expect(repo.gravarEstado("p", e, 0)).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("gravarEstado: etapa_atual é a primeira etapa não concluída, ou null", async () => {
    const e = estadoInicial({ slug: "p", nome: "P", site: null }, EM)
    for (const id of ["01", "02", "03"] as const) e.etapas[id].status = "concluida"
    e.etapas["04"].status = "em_andamento"
    const fake = criarFake(() => ok([{ versao: 1 }]))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await repo.gravarEstado("p", e, 0)
    expect((op(fake.consultas[0]!, "update")![1] as { etapa_atual: string | null }).etapa_atual).toBe("04")

    for (const id of Object.keys(e.etapas) as Array<keyof typeof e.etapas>) e.etapas[id].status = "concluida"
    await repo.gravarEstado("p", e, 1)
    expect((op(fake.consultas[1]!, "update")![1] as { etapa_atual: string | null }).etapa_atual).toBeNull()
  })

  it("criarProspect: código 23505 em prospect ativo vira ErroProspectExistente", async () => {
    const fake = criarFake((c) =>
      op(c, "insert") ? { data: null, error: { message: "duplicate key", code: "23505" } } : ok({ excluido_em: null }),
    )
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await expect(repo.criarProspect("p")).rejects.toBeInstanceOf(ErroProspectExistente)
    expect(op(fake.consultas[0]!, "insert")![1]).toEqual({ slug: "p" })
  })

  it("criarProspect: outro erro vira Error com a mensagem, sem URL", async () => {
    const fake = criarFake(() => ({
      data: null,
      error: { message: "falhou em https://abc.supabase.co/rest/v1/prospects", code: "XX000" },
    }))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    const erro = await repo.criarProspect("p").catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).message).toContain("falhou")
    expect((erro as Error).message).not.toContain("supabase.co")
  })

  describe("criarProspect sobre um slug excluído", () => {
    /** Insert bate na chave duplicada; o resto responde conforme a tabela e a operação. */
    function fakeDeExcluido(opts: { excluidoEm: string | null; atualizadas?: unknown[] }) {
      return criarFake((c) => {
        if (op(c, "insert")) return { data: null, error: { message: "duplicate key", code: "23505" } }
        if (op(c, "maybeSingle")) return ok({ excluido_em: opts.excluidoEm })
        if (op(c, "update")) return ok(opts.atualizadas ?? [{ slug: "p" }])
        return ok(null)
      })
    }

    it("apaga os filhos antes do prospect e zera a linha só se ela continua excluída", async () => {
      const fake = fakeDeExcluido({ excluidoEm: "2026-10-26T00:00:00.000Z" })
      await new SupabaseRepositorio(fake.cliente, () => EM).criarProspect("p")

      const passos = fake.consultas.map((c) => [c.tabela, c.ops[0]![0]])
      expect(passos).toEqual([
        ["prospects", "insert"],
        ["prospects", "select"],
        ["eventos_conversa", "delete"],
        ["comentarios", "delete"],
        ["uso_turnos", "delete"],
        ["arquivos", "delete"],
        ["arquivos_lixeira", "delete"],
        ["prospects", "update"],
      ])
      for (const c of fake.consultas.slice(2, 7)) {
        expect(c.ops.filter(([m]) => m === "eq")).toEqual([["eq", "slug", "p"]])
      }
      const checagem = fake.consultas[1]!
      expect(op(checagem, "select")).toEqual(["select", "excluido_em"])
      expect(op(checagem, "eq")).toEqual(["eq", "slug", "p"])

      const reset = fake.consultas[7]!
      expect(op(reset, "update")![1]).toEqual({
        nome: null,
        estado: null,
        etapa_atual: null,
        versao: 0,
        sincronizacao_pendente: false,
        excluido_em: null,
        criado_em: EM,
        atualizado_em: EM,
        criado_por: null,
      })
      expect(reset.ops.filter(([m]) => m === "eq")).toEqual([["eq", "slug", "p"]])
      expect(op(reset, "not")).toEqual(["not", "excluido_em", "is", null])
      expect(op(reset, "select")).toEqual(["select", "slug"])
    })

    it("slug ativo continua sendo ErroProspectExistente e nada é apagado", async () => {
      const fake = fakeDeExcluido({ excluidoEm: null })
      await expect(new SupabaseRepositorio(fake.cliente, () => EM).criarProspect("p")).rejects.toBeInstanceOf(
        ErroProspectExistente,
      )
      expect(fake.consultas.some((c) => op(c, "delete") || op(c, "update"))).toBe(false)
    })

    it("zero linhas no reset (outro criou antes) vira ErroProspectExistente", async () => {
      const fake = fakeDeExcluido({ excluidoEm: "2026-10-26T00:00:00.000Z", atualizadas: [] })
      await expect(new SupabaseRepositorio(fake.cliente, () => EM).criarProspect("p")).rejects.toBeInstanceOf(
        ErroProspectExistente,
      )
    })

    it("falha ao apagar um filho interrompe sem zerar a linha e sem vazar a URL", async () => {
      const fake = criarFake((c) => {
        if (op(c, "insert")) return { data: null, error: { message: "duplicate key", code: "23505" } }
        if (op(c, "maybeSingle")) return ok({ excluido_em: EM })
        if (c.tabela === "uso_turnos") return { data: null, error: { message: "caiu em https://abc.supabase.co/rest" } }
        return ok(null)
      })
      const erro = await new SupabaseRepositorio(fake.cliente, () => EM).criarProspect("p").catch((e: unknown) => e)
      expect(erro).toBeInstanceOf(Error)
      expect((erro as Error).message).not.toContain("supabase.co")
      expect(fake.consultas.map((c) => c.tabela)).toEqual([
        "prospects",
        "prospects",
        "eventos_conversa",
        "comentarios",
        "uso_turnos",
      ])
    })
  })

  it("excluirProspect: marca excluido_em e zero linhas vira ErroNaoEncontrado", async () => {
    const fake = criarFake(() => ok([{ slug: "p" }]))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await repo.excluirProspect("p")
    expect(op(fake.consultas[0]!, "update")![1]).toEqual({ excluido_em: EM })

    const vazio = criarFake(() => ok([]))
    await expect(new SupabaseRepositorio(vazio.cliente, () => EM).excluirProspect("x")).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    )
  })

  it("listarSlugs: ignora excluídos na consulta e ordena", async () => {
    const fake = criarFake(() => ok([{ slug: "b" }, { slug: "a" }, { slug: "c-d" }]))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    expect(await repo.listarSlugs()).toEqual(["a", "b", "c-d"])
    expect(op(fake.consultas[0]!, "is")).toEqual(["is", "excluido_em", null])
  })

  it("existe: false sem linha ativa", async () => {
    const repo = new SupabaseRepositorio(criarFake(() => ok(null)).cliente, () => EM)
    expect(await repo.existe("x")).toBe(false)
    const repo2 = new SupabaseRepositorio(criarFake(() => ok({ slug: "x" })).cliente, () => EM)
    expect(await repo2.existe("x")).toBe(true)
  })

  it("lerEstado: null sem linha ou com estado nulo", async () => {
    expect(await new SupabaseRepositorio(criarFake(() => ok(null)).cliente).lerEstado("x")).toBeNull()
    expect(
      await new SupabaseRepositorio(criarFake(() => ok({ estado: null, versao: 0 })).cliente).lerEstado("x"),
    ).toBeNull()
    const e = estadoInicial({ slug: "x", nome: "X", site: null }, EM)
    expect(
      await new SupabaseRepositorio(criarFake(() => ok({ estado: e, versao: 2 })).cliente).lerEstado("x"),
    ).toEqual({ estado: e, versao: 2 })
  })

  it("lerConversa: ordena por id e pagina de 1000 em 1000 até acabar", async () => {
    const evento = (i: number): { evento: EventoConversa } => ({
      evento: { tipo: "texto_agente", texto: `t${i}`, em: EM },
    })
    const fake = criarFake((c) => {
      const [, de] = op(c, "range") as [string, number, number]
      if (de === 0) return ok(Array.from({ length: 1000 }, (_, i) => evento(i)))
      if (de === 1000) return ok(Array.from({ length: 500 }, (_, i) => evento(1000 + i)))
      return ok([])
    })
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    const lista = await repo.lerConversa("p", "01")
    expect(lista).toHaveLength(1500)
    expect(lista[1499]).toEqual({ tipo: "texto_agente", texto: "t1499", em: EM })
    expect(fake.consultas.map((c) => op(c, "range"))).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ])
    expect(op(fake.consultas[0]!, "order")![1]).toBe("id")
    expect(fake.consultas[0]!.ops.filter(([m]) => m === "eq")).toEqual([
      ["eq", "slug", "p"],
      ["eq", "etapa", "01"],
    ])
  })

  it("lerConversa: página cheia seguida de página vazia termina", async () => {
    const fake = criarFake((c) => {
      const [, de] = op(c, "range") as [string, number, number]
      return ok(de === 0 ? Array.from({ length: 1000 }, () => ({ evento: { tipo: "turno_inicio", em: EM } })) : [])
    })
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    expect(await repo.lerConversa("p", "01")).toHaveLength(1000)
    expect(fake.consultas).toHaveLength(2)
  })

  it("anexarConversa: grava o evento com o instante dele", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    const evento: EventoConversa = { tipo: "texto_agente", texto: "oi", em: "2026-10-27T13:00:00.000Z" }
    await repo.anexarConversa("p", "02", evento)
    expect(op(fake.consultas[0]!, "insert")![1]).toEqual({
      slug: "p",
      etapa: "02",
      evento,
      autor: null,
      em: "2026-10-27T13:00:00.000Z",
    })
  })

  it("gravarComentarios faz upsert por slug e entregável; lerComentarios cai em lista vazia", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await repo.gravarComentarios("p", "apresentacao", [])
    const c = fake.consultas[0]!
    expect(op(c, "upsert")).toEqual([
      "upsert",
      { slug: "p", entregavel_id: "apresentacao", lista: [], atualizado_em: EM },
      { onConflict: "slug,entregavel_id" },
    ])
    expect(await repo.lerComentarios("p", "apresentacao")).toEqual([])
  })

  it("limparConversasEComentarios: apaga eventos_conversa e comentarios só do slug", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await repo.limparConversasEComentarios("p")
    expect(fake.consultas.map((c) => c.tabela).sort()).toEqual(["comentarios", "eventos_conversa"])
    for (const c of fake.consultas) {
      expect(op(c, "delete")).toBeDefined()
      expect(c.ops.filter(([m]) => m === "eq")).toEqual([["eq", "slug", "p"]])
    }

    const falho = criarFake(() => ({ data: null, error: { message: "caiu em https://abc.supabase.co/rest" } }))
    const erro = await new SupabaseRepositorio(falho.cliente).limparConversasEComentarios("p").catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).message).not.toContain("supabase.co")
  })

  it("marcarSincronizacao: zero linhas é ErroNaoEncontrado", async () => {
    const repo = new SupabaseRepositorio(criarFake(() => ok([])).cliente, () => EM)
    await expect(repo.marcarSincronizacao("x", true)).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("registrarUso: mapeia para as colunas de uso_turnos", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await repo.registrarUso({
      slug: "p",
      etapa: "01",
      autor: null,
      custoUsd: 0.12,
      tokensEntrada: 10,
      tokensSaida: 2,
      inicio: EM,
      fim: EM,
      status: "ok",
    })
    expect(fake.consultas[0]!.tabela).toBe("uso_turnos")
    expect(op(fake.consultas[0]!, "insert")![1]).toEqual({
      slug: "p",
      etapa: "01",
      autor: null,
      custo_usd: 0.12,
      tokens_entrada: 10,
      tokens_saida: 2,
      inicio: EM,
      fim: EM,
      status: "ok",
    })
  })
})

describe("SupabaseArmazem (cliente falso)", () => {
  const dados = new TextEncoder().encode("conteúdo")
  const sha = createHash("sha256").update(dados).digest("hex")

  it("enviar: sobe o objeto em <slug>/<sha256> e faz upsert no manifesto", async () => {
    const fake = criarFake(() => ok(null))
    const armazem = new SupabaseArmazem(fake.cliente)
    const entrada = await armazem.enviar("p", "dados/Relatório de clientes.xlsx", dados)
    expect(entrada).toEqual({ caminho: "dados/Relatório de clientes.xlsx", sha256: sha, tamanho: dados.byteLength })
    expect(fake.armazenamento).toEqual([
      {
        bucket: "planejamento-prospects",
        metodo: "upload",
        args: [`p/${sha}`, dados, { upsert: true, contentType: "application/octet-stream" }],
      },
    ])
    const c = fake.consultas[0]!
    expect(c.tabela).toBe("arquivos")
    const [, linha, opcoes] = op(c, "upsert") as [string, Record<string, unknown>, unknown]
    expect(linha).toMatchObject({
      slug: "p",
      caminho: "dados/Relatório de clientes.xlsx",
      sha256: sha,
      tamanho: dados.byteLength,
    })
    expect(opcoes).toEqual({ onConflict: "slug,caminho" })
  })

  it("enviar: falha do upload não toca o manifesto e não vaza a URL", async () => {
    const fake = criarFake(() => ok(null))
    fake.respostasStorage.upload = () => ({
      data: null,
      error: { message: "Payload too large https://x.supabase.co/storage/v1/object/a" },
    })
    const erro = await new SupabaseArmazem(fake.cliente).enviar("p", "a.txt", dados).catch((e: unknown) => e)
    expect((erro as Error).message).toContain("Payload too large")
    expect((erro as Error).message).not.toContain("supabase.co")
    expect(fake.consultas).toHaveLength(0)
  })

  it("baixar: devolve os bytes; objeto ausente vira ErroNaoEncontrado", async () => {
    const fake = criarFake(() => ok(null))
    fake.respostasStorage.download = () => ({ data: new Blob([dados]), error: null })
    const armazem = new SupabaseArmazem(fake.cliente)
    expect(Array.from(await armazem.baixar("p", sha))).toEqual(Array.from(dados))
    expect(fake.armazenamento[0]).toMatchObject({ bucket: "planejamento-prospects", args: [`p/${sha}`] })

    const vazio = criarFake(() => ok(null))
    await expect(new SupabaseArmazem(vazio.cliente).baixar("p", sha)).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("listarManifesto: mapeia e ordena os caminhos", async () => {
    const fake = criarFake(() =>
      ok([
        { caminho: "b.txt", sha256: "2", tamanho: "7" },
        { caminho: "a.txt", sha256: "1", tamanho: 3 },
      ]),
    )
    expect(await new SupabaseArmazem(fake.cliente).listarManifesto("p")).toEqual([
      { caminho: "a.txt", sha256: "1", tamanho: 3 },
      { caminho: "b.txt", sha256: "2", tamanho: 7 },
    ])
  })

  it("remover: copia para a lixeira e apaga do manifesto, sem tocar no objeto", async () => {
    const fake = criarFake((c) =>
      op(c, "maybeSingle") ? ok({ caminho: "a.txt", sha256: "1", tamanho: 3 }) : ok(null),
    )
    await new SupabaseArmazem(fake.cliente).remover("p", "a.txt")
    expect(fake.consultas.map((c) => [c.tabela, c.ops[0]![0]])).toEqual([
      ["arquivos", "select"],
      ["arquivos_lixeira", "insert"],
      ["arquivos", "delete"],
    ])
    expect(op(fake.consultas[1]!, "insert")![1]).toEqual({ slug: "p", caminho: "a.txt", sha256: "1" })
    expect(fake.armazenamento).toEqual([])
  })

  it("remover: caminho ausente é ignorado", async () => {
    const fake = criarFake(() => ok(null))
    await new SupabaseArmazem(fake.cliente).remover("p", "x.txt")
    expect(fake.consultas).toHaveLength(1)
  })

  it("sessões vão para o bucket planejamento-sessoes como <slug>/<id>.jsonl", async () => {
    const fake = criarFake(() => ok(null))
    const armazem = new SupabaseArmazem(fake.cliente)
    await armazem.enviarSessao("p", "abc", dados)
    expect(fake.armazenamento[0]).toEqual({
      bucket: "planejamento-sessoes",
      metodo: "upload",
      args: ["p/abc.jsonl", dados, { upsert: true, contentType: "application/octet-stream" }],
    })
    expect(await armazem.baixarSessao("p", "abc")).toBeNull()
    expect(fake.armazenamento[1]).toMatchObject({ bucket: "planejamento-sessoes", metodo: "download", args: ["p/abc.jsonl"] })
  })

  describe("apagarTudo", () => {
    const nomes = (n: number, prefixo = "obj") => Array.from({ length: n }, (_, i) => ({ name: `${prefixo}${i}` }))

    it("apaga manifesto e lixeira do slug e depois os objetos dos dois buckets", async () => {
      const fake = criarFake(() => ok(null))
      fake.respostasStorage.list = ([, opcoes], bucket) =>
        (opcoes as { offset: number }).offset === 0
          ? ok(bucket === "planejamento-prospects" ? [{ name: "abc" }, { name: "def" }] : [{ name: "s1.jsonl" }])
          : ok([])
      await new SupabaseArmazem(fake.cliente).apagarTudo("p")

      expect(fake.consultas.map((c) => [c.tabela, c.ops[0]![0]])).toEqual([
        ["arquivos", "delete"],
        ["arquivos_lixeira", "delete"],
      ])
      for (const c of fake.consultas) expect(c.ops.filter(([m]) => m === "eq")).toEqual([["eq", "slug", "p"]])

      expect(fake.armazenamento.filter((a) => a.metodo === "remove")).toEqual([
        { bucket: "planejamento-prospects", metodo: "remove", args: [["p/abc", "p/def"]] },
        { bucket: "planejamento-sessoes", metodo: "remove", args: [["p/s1.jsonl"]] },
      ])
    })

    it("pagina a listagem com limit e offset até a página vir incompleta", async () => {
      const fake = criarFake(() => ok(null))
      fake.respostasStorage.list = ([, opcoes], bucket) => {
        if (bucket !== "planejamento-prospects") return ok([])
        const { offset } = opcoes as { offset: number }
        if (offset === 0) return ok(nomes(1000, "a"))
        if (offset === 1000) return ok(nomes(250, "b"))
        return ok([])
      }
      await new SupabaseArmazem(fake.cliente).apagarTudo("p")

      const listagens = fake.armazenamento.filter((a) => a.metodo === "list")
      expect(listagens).toEqual([
        { bucket: "planejamento-prospects", metodo: "list", args: ["p", { limit: 1000, offset: 0 }] },
        { bucket: "planejamento-prospects", metodo: "list", args: ["p", { limit: 1000, offset: 1000 }] },
        { bucket: "planejamento-sessoes", metodo: "list", args: ["p", { limit: 1000, offset: 0 }] },
      ])
    })

    it("remove em lotes de 100 caminhos, todos com o prefixo do slug", async () => {
      const fake = criarFake(() => ok(null))
      fake.respostasStorage.list = ([, opcoes], bucket) =>
        bucket === "planejamento-prospects" && (opcoes as { offset: number }).offset === 0 ? ok(nomes(250)) : ok([])
      await new SupabaseArmazem(fake.cliente).apagarTudo("p")

      const remocoes = fake.armazenamento.filter((a) => a.metodo === "remove")
      expect(remocoes.map((r) => (r.args[0] as string[]).length)).toEqual([100, 100, 50])
      const todos = remocoes.flatMap((r) => r.args[0] as string[])
      expect(todos).toHaveLength(250)
      expect(todos.every((t) => t.startsWith("p/"))).toBe(true)
      expect(new Set(todos).size).toBe(250)
    })

    it("sem nada para remover não chama remove (idempotente)", async () => {
      const fake = criarFake(() => ok(null))
      await new SupabaseArmazem(fake.cliente).apagarTudo("p")
      expect(fake.armazenamento.filter((a) => a.metodo === "remove")).toEqual([])
    })

    it("falha de tabela, de listagem ou de remoção vira Error sem a URL", async () => {
      const tabela = criarFake(() => ({ data: null, error: { message: "caiu https://abc.supabase.co/rest" } }))
      const e1 = await new SupabaseArmazem(tabela.cliente).apagarTudo("p").catch((e: unknown) => e)
      expect((e1 as Error).message).toContain("caiu")
      expect((e1 as Error).message).not.toContain("supabase.co")
      expect(tabela.armazenamento).toEqual([])

      const listagem = criarFake(() => ok(null))
      listagem.respostasStorage.list = () => ({ data: null, error: { message: "boom https://x.supabase.co/storage" } })
      const e2 = await new SupabaseArmazem(listagem.cliente).apagarTudo("p").catch((e: unknown) => e)
      expect((e2 as Error).message).toContain("boom")
      expect((e2 as Error).message).not.toContain("supabase.co")

      const remocao = criarFake(() => ok(null))
      remocao.respostasStorage.list = ([, o]) => ((o as { offset: number }).offset === 0 ? ok(nomes(2)) : ok([]))
      remocao.respostasStorage.remove = () => ({ data: null, error: { message: "nope https://x.supabase.co/storage" } })
      const e3 = await new SupabaseArmazem(remocao.cliente).apagarTudo("p").catch((e: unknown) => e)
      expect((e3 as Error).message).toContain("nope")
      expect((e3 as Error).message).not.toContain("supabase.co")
    })
  })
})
