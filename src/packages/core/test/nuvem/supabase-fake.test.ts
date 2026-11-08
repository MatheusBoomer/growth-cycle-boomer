import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { ErroConflitoVersao, ErroNaoEncontrado, ErroProspectExistente } from "../../src/erros"
import { estadoInicial } from "../../src/maquina-estados"
import { SupabaseArmazem, SupabaseRepositorio } from "../../src/nuvem/supabase"
import type { EventoConversa } from "../../src/tipos"
import { criarFake, ok, op } from "./supabase-fake"

const EM = "2026-10-27T12:00:00.000Z"

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
        ["presenca", "delete"],
        ["arquivos", "delete"],
        ["arquivos_lixeira", "delete"],
        ["prospects", "update"],
      ])
      for (const c of fake.consultas.slice(2, 8)) {
        expect(c.ops.filter(([m]) => m === "eq")).toEqual([["eq", "slug", "p"]])
      }
      const checagem = fake.consultas[1]!
      expect(op(checagem, "select")).toEqual(["select", "excluido_em"])
      expect(op(checagem, "eq")).toEqual(["eq", "slug", "p"])

      const reset = fake.consultas[8]!
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

  it("criarProspect: grava criado_por quando há criador; sem criador, só o slug", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await repo.criarProspect("p", "ana.souza@boomer.com.br")
    await repo.criarProspect("q")
    await repo.criarProspect("r", null)
    expect(op(fake.consultas[0]!, "insert")![1]).toEqual({ slug: "p", criado_por: "ana.souza@boomer.com.br" })
    expect(op(fake.consultas[1]!, "insert")![1]).toEqual({ slug: "q" })
    expect(op(fake.consultas[2]!, "insert")![1]).toEqual({ slug: "r" })
  })

  it("criarProspect: ao recriar um excluído, o reset grava o novo criador (null sem criador)", async () => {
    const recriar = async (criador?: string) => {
      const fake = criarFake((c) => {
        if (op(c, "insert")) return { data: null, error: { message: "duplicate key", code: "23505" } }
        if (op(c, "update")) return ok([{ slug: "p" }])
        if (op(c, "delete")) return ok(null)
        return ok({ excluido_em: EM })
      })
      await new SupabaseRepositorio(fake.cliente, () => EM).criarProspect("p", criador)
      return (op(fake.consultas.find((c) => op(c, "update"))!, "update")![1] as { criado_por: string | null }).criado_por
    }
    expect(await recriar("bia@gestaoboomer.com")).toBe("bia@gestaoboomer.com")
    expect(await recriar()).toBeNull()
  })

  it("lerDono: lê criado_por do prospect ativo; sem linha ativa vira ErroNaoEncontrado", async () => {
    const fake = criarFake(() => ok({ criado_por: "ana.souza@boomer.com.br" }))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    expect(await repo.lerDono("p")).toBe("ana.souza@boomer.com.br")
    const c = fake.consultas[0]!
    expect(op(c, "select")).toEqual(["select", "criado_por"])
    expect(op(c, "eq")).toEqual(["eq", "slug", "p"])
    expect(op(c, "is")).toEqual(["is", "excluido_em", null])

    const semDono = new SupabaseRepositorio(criarFake(() => ok({ criado_por: null })).cliente, () => EM)
    expect(await semDono.lerDono("p")).toBeNull()
    const ausente = new SupabaseRepositorio(criarFake(() => ok(null)).cliente, () => EM)
    await expect(ausente.lerDono("p")).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("listarDonos: só ativos, em páginas, com null para quem não tem dono", async () => {
    const fake = criarFake((c) => {
      const [, de] = op(c, "range") as [string, number, number]
      return ok(
        de === 0
          ? [
              ...Array.from({ length: 999 }, (_, i) => ({ slug: `p${i}`, criado_por: "ana@boomer.com.br" })),
              { slug: "sem-dono", criado_por: null },
            ]
          : [{ slug: "ultimo", criado_por: "bia@gestaoboomer.com" }],
      )
    })
    const donos = await new SupabaseRepositorio(fake.cliente, () => EM).listarDonos()
    expect(donos.size).toBe(1001)
    expect(donos.get("sem-dono")).toBeNull()
    expect(donos.get("ultimo")).toBe("bia@gestaoboomer.com")
    expect(fake.consultas).toHaveLength(2)
    expect(op(fake.consultas[0]!, "select")).toEqual(["select", "slug, criado_por"])
    expect(op(fake.consultas[0]!, "is")).toEqual(["is", "excluido_em", null])
  })

  it("trocarDono: atualiza criado_por só de prospect ativo; zero linhas vira ErroNaoEncontrado", async () => {
    const fake = criarFake(() => ok([{ slug: "p" }]))
    await new SupabaseRepositorio(fake.cliente, () => EM).trocarDono("p", "carla@boomer.com.br")
    const c = fake.consultas[0]!
    expect(op(c, "update")![1]).toEqual({ criado_por: "carla@boomer.com.br" })
    expect(op(c, "eq")).toEqual(["eq", "slug", "p"])
    expect(op(c, "is")).toEqual(["is", "excluido_em", null])
    expect(op(c, "select")).toEqual(["select", "slug"])

    const vazio = new SupabaseRepositorio(criarFake(() => ok([])).cliente, () => EM)
    await expect(vazio.trocarDono("p", "carla@boomer.com.br")).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("anexarConversa: a coluna autor vem da mensagem do analista; outros eventos gravam null", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    const msg: EventoConversa = { tipo: "mensagem_analista", texto: "oi", automatica: false, autor: "ana.souza@boomer.com.br", em: EM }
    const auto: EventoConversa = { tipo: "mensagem_analista", texto: "auto", automatica: true, em: EM }
    const agente: EventoConversa = { tipo: "texto_agente", texto: "olá", em: EM }
    await repo.anexarConversa("p", "01", msg)
    await repo.anexarConversa("p", "01", auto)
    await repo.anexarConversa("p", "01", agente)
    const autores = fake.consultas.map((c) => (op(c, "insert")![1] as { autor: string | null }).autor)
    expect(autores).toEqual(["ana.souza@boomer.com.br", null, null])
    expect((op(fake.consultas[0]!, "insert")![1] as { evento: EventoConversa }).evento).toEqual(msg)
  })

  describe("custo por turno e presença", () => {
    it("ultimoUsoDaSessao: pega o turno mais recente da sessão e devolve o acumulado", async () => {
      const fake = criarFake(() => ok({ custo_usd: "0.5000", modelos_acumulado: { opus: 0.5 } }))
      const repo = new SupabaseRepositorio(fake.cliente, () => EM)
      expect(await repo.ultimoUsoDaSessao("p", "s1")).toEqual({ custoUsd: 0.5, modelos: { opus: 0.5 } })
      const c = fake.consultas[0]!
      expect(c.tabela).toBe("uso_turnos")
      expect(c.ops.filter(([m]) => m === "eq")).toEqual([
        ["eq", "slug", "p"],
        ["eq", "sessao", "s1"],
      ])
      expect(c.ops.filter(([m]) => m === "order")[0]).toEqual(["order", "fim", { ascending: false }])
      expect(op(c, "limit")).toEqual(["limit", 1])
    })

    it("ultimoUsoDaSessao: sem linha é null e falha vira Error sem a URL", async () => {
      expect(await new SupabaseRepositorio(criarFake(() => ok(null)).cliente).ultimoUsoDaSessao("p", "s1")).toBeNull()
      const falho = criarFake(() => ({ data: null, error: { message: "caiu em https://abc.supabase.co/rest" } }))
      const erro = await new SupabaseRepositorio(falho.cliente).ultimoUsoDaSessao("p", "s1").catch((e: unknown) => e)
      expect((erro as Error).message).not.toContain("supabase.co")
    })

    it("ultimoUsoAntigo: filtra etapa e linhas antigas, pega a mais recente e não traz modelos", async () => {
      const fake = criarFake(() => ok({ custo_usd: "0.6000" }))
      const repo = new SupabaseRepositorio(fake.cliente, () => EM)
      expect(await repo.ultimoUsoAntigo("p", "03")).toEqual({ custoUsd: 0.6, modelos: null })
      const c = fake.consultas[0]!
      expect(c.tabela).toBe("uso_turnos")
      expect(c.ops.filter(([m]) => m === "eq")).toEqual([
        ["eq", "slug", "p"],
        ["eq", "etapa", "03"],
      ])
      expect(c.ops.filter(([m]) => m === "is")).toEqual([
        ["is", "sessao", null],
        ["is", "custo_turno_usd", null],
      ])
      expect(c.ops.filter(([m]) => m === "order")[0]).toEqual(["order", "fim", { ascending: false }])
      expect(op(c, "limit")).toEqual(["limit", 1])
    })

    it("ultimoUsoAntigo: sem linha é null e falha vira Error sem a URL", async () => {
      expect(await new SupabaseRepositorio(criarFake(() => ok(null)).cliente).ultimoUsoAntigo("p", "03")).toBeNull()
      const falho = criarFake(() => ({ data: null, error: { message: "caiu em https://abc.supabase.co/rest" } }))
      const erro = await new SupabaseRepositorio(falho.cliente).ultimoUsoAntigo("p", "03").catch((e: unknown) => e)
      expect((erro as Error).message).not.toContain("supabase.co")
    })

    const linhaUso = (slug: string) => ({
      slug,
      etapa: "03",
      autor: "ana@x.com",
      sessao: "s1",
      custo_usd: 0.5,
      custo_turno_usd: "0.2000",
      modelos: { opus: 0.2 },
      inicio: EM,
      fim: EM,
    })

    it("listarUsos com slug: filtra pelo slug, pagina e mapeia as colunas", async () => {
      const fake = criarFake((c) => {
        const [, de] = op(c, "range") as [string, number, number]
        return ok(de === 0 ? Array.from({ length: 1000 }, () => linhaUso("p")) : [linhaUso("p")])
      })
      const usos = await new SupabaseRepositorio(fake.cliente).listarUsos("p")
      expect(usos).toHaveLength(1001)
      expect(usos[0]).toEqual({
        slug: "p",
        etapa: "03",
        autor: "ana@x.com",
        sessao: "s1",
        custoUsd: 0.5,
        custoTurnoUsd: 0.2,
        modelos: { opus: 0.2 },
        inicio: EM,
        fim: EM,
      })
      expect(fake.consultas.map((c) => op(c, "range"))).toEqual([
        ["range", 0, 999],
        ["range", 1000, 1999],
      ])
      expect(fake.consultas.every((c) => c.tabela === "uso_turnos")).toBe(true)
      expect(op(fake.consultas[0]!, "eq")).toEqual(["eq", "slug", "p"])
    })

    it("listarUsos sem slug: busca os slugs ativos uma vez e descarta as linhas de excluídos", async () => {
      const fake = criarFake((c) =>
        c.tabela === "prospects" ? ok([{ slug: "ativo" }]) : ok([linhaUso("ativo"), linhaUso("excluido")]),
      )
      const usos = await new SupabaseRepositorio(fake.cliente).listarUsos()
      expect(usos.map((u) => u.slug)).toEqual(["ativo"])
      expect(fake.consultas.map((c) => c.tabela)).toEqual(["prospects", "uso_turnos"])
      expect(op(fake.consultas[0]!, "is")).toEqual(["is", "excluido_em", null])
    })

    it("listarUsos e listarPresencas sem slug com ativos informados não consultam prospects", async () => {
      const usos = criarFake(() => ok([linhaUso("ativo"), linhaUso("excluido")]))
      const lidos = await new SupabaseRepositorio(usos.cliente).listarUsos(undefined, new Set(["ativo"]))
      expect(lidos.map((u) => u.slug)).toEqual(["ativo"])
      expect(usos.consultas.map((c) => c.tabela)).toEqual(["uso_turnos"])

      const linha = (slug: string) => ({ slug, email: "a@x.com", etapa: "03", em: EM, visivel: true, segundos_sem_interacao: 0 })
      const presencas = criarFake(() => ok([linha("ativo"), linha("excluido")]))
      const lista = await new SupabaseRepositorio(presencas.cliente).listarPresencas(undefined, new Set(["ativo"]))
      expect(lista.map((p) => p.slug)).toEqual(["ativo"])
      expect(presencas.consultas.map((c) => c.tabela)).toEqual(["presenca"])
    })

    it("registrarPresenca: grava nas colunas de presenca, sem `em` (o banco preenche)", async () => {
      const fake = criarFake(() => ok(null))
      await new SupabaseRepositorio(fake.cliente, () => EM).registrarPresenca({
        slug: "p",
        email: "ana@x.com",
        etapa: "03",
        visivel: true,
        segundosSemInteracao: 12,
      })
      expect(fake.consultas[0]!.tabela).toBe("presenca")
      expect(op(fake.consultas[0]!, "insert")![1]).toEqual({
        slug: "p",
        email: "ana@x.com",
        etapa: "03",
        visivel: true,
        segundos_sem_interacao: 12,
      })
      const falho = criarFake(() => ({ data: null, error: { message: "caiu em https://abc.supabase.co/rest" } }))
      const erro = await new SupabaseRepositorio(falho.cliente)
        .registrarPresenca({ slug: "p", email: "a@x.com", etapa: "03", visivel: true, segundosSemInteracao: 0 })
        .catch((e: unknown) => e)
      expect((erro as Error).message).not.toContain("supabase.co")
    })

    it("listarPresencas: ordena por em, mapeia as colunas e respeita os prospects ativos", async () => {
      const linha = (slug: string) => ({
        slug,
        email: "ana@x.com",
        etapa: "03",
        em: EM,
        visivel: false,
        segundos_sem_interacao: 40,
      })
      const fake = criarFake((c) => (c.tabela === "prospects" ? ok([{ slug: "ativo" }]) : ok([linha("ativo"), linha("excluido")])))
      const lista = await new SupabaseRepositorio(fake.cliente).listarPresencas()
      expect(lista).toEqual([
        { slug: "ativo", email: "ana@x.com", etapa: "03", em: EM, visivel: false, segundosSemInteracao: 40 },
      ])
      expect(op(fake.consultas[1]!, "order")).toEqual(["order", "em"])

      const comSlug = criarFake(() => ok([linha("p")]))
      expect(await new SupabaseRepositorio(comSlug.cliente).listarPresencas("p")).toHaveLength(1)
      expect(comSlug.consultas.map((c) => c.tabela)).toEqual(["presenca"])
      expect(op(comSlug.consultas[0]!, "eq")).toEqual(["eq", "slug", "p"])
    })
  })

  it("registrarUso: grava o autor do turno", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseRepositorio(fake.cliente, () => EM)
    await repo.registrarUso({
      slug: "p",
      etapa: "01",
      autor: "ana.souza@boomer.com.br",
      sessao: null,
      custoUsd: null,
      custoTurnoUsd: null,
      modelos: null,
      modelosAcumulado: null,
      esforco: null,
      tokensEntrada: null,
      tokensSaida: null,
      inicio: EM,
      fim: EM,
      status: "ok",
    })
    expect((op(fake.consultas[0]!, "insert")![1] as { autor: string | null }).autor).toBe("ana.souza@boomer.com.br")
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
      sessao: "s1",
      custoUsd: 0.12,
      custoTurnoUsd: 0.05,
      modelos: { opus: 0.05 },
      modelosAcumulado: { opus: 0.12 },
      esforco: null,
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
      sessao: "s1",
      custo_usd: 0.12,
      custo_turno_usd: 0.05,
      modelos: { opus: 0.05 },
      modelos_acumulado: { opus: 0.12 },
      esforco: null,
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
