import { describe, expect, it } from "vitest"
import { ErroEntrada, ErroNaoEncontrado, ErroSemPermissao, ErroUltimoAdmin } from "../../src/erros"
import type { Papel } from "../../src/papeis"
import { MemoriaUsuarios } from "../../src/nuvem/usuarios"
import { SupabaseUsuarios } from "../../src/nuvem/usuarios-supabase"
import { contratoUsuarios } from "./contrato-usuarios"
import { criarFake, ok, op } from "./supabase-fake"

const AGORA = new Date("2026-11-07T12:00:00.000Z")
const DEPOIS_DE_1H = new Date("2026-11-07T13:00:01.000Z")

contratoUsuarios("memória", async (agora) => {
  const repo = new MemoriaUsuarios([], agora)
  return { repo, semearAdmin: async (email) => repo.semearAdmin(email) }
})

describe("MemoriaUsuarios", () => {
  it("os admins do construtor já nascem admin", async () => {
    const repo = new MemoriaUsuarios(["  Ana@X  "], () => AGORA)
    expect(await repo.registrarAcesso("ana@x")).toBe("admin")
    expect(await repo.existe("ANA@x")).toBe(true)
  })

  it("não deixa rebaixar o último admin", async () => {
    const repo = new MemoriaUsuarios(["ana@x"], () => AGORA)
    await expect(repo.alterarPapel("ana@x", "usuario", "ana@x")).rejects.toBeInstanceOf(ErroUltimoAdmin)
    expect(await repo.registrarAcesso("ana@x")).toBe("admin")
  })

  it("um admin único pode se manter admin (mesmo papel não é rebaixamento)", async () => {
    const repo = new MemoriaUsuarios(["ana@x"], () => AGORA)
    await expect(repo.alterarPapel("ana@x", "admin", "ana@x")).resolves.toBeUndefined()
  })

  it("papel inválido vence as outras checagens, na ordem da função SQL", async () => {
    const repo = new MemoriaUsuarios(["ana@x"], () => AGORA)
    await expect(repo.alterarPapel("ninguem@x", "dono" as Papel, "intruso@x")).rejects.toBeInstanceOf(ErroEntrada)
  })

  it("autor não admin vence alvo inexistente", async () => {
    const repo = new MemoriaUsuarios(["ana@x"], () => AGORA)
    await expect(repo.alterarPapel("ninguem@x", "admin", "intruso@x")).rejects.toBeInstanceOf(ErroSemPermissao)
  })

  it("alvo inexistente vence a checagem de último admin", async () => {
    const repo = new MemoriaUsuarios(["ana@x"], () => AGORA)
    await expect(repo.alterarPapel("ninguem@x", "usuario", "ana@x")).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })

  it("listar devolve cópias: mudar o resultado não altera o repositório", async () => {
    const repo = new MemoriaUsuarios(["ana@x"], () => AGORA)
    const [pessoa] = await repo.listar()
    pessoa!.papel = "usuario"
    expect(await repo.registrarAcesso("ana@x")).toBe("admin")
  })
})

describe("SupabaseUsuarios (cliente falso)", () => {
  const linha = (papel: Papel, ultimo = AGORA.toISOString()) => ({ papel, ultimo_acesso: ultimo })

  it("registrarAcesso: pessoa conhecida e recente custa uma consulta só", async () => {
    const fake = criarFake(() => ok(linha("admin")))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    expect(await repo.registrarAcesso("  ANA@X ")).toBe("admin")
    expect(fake.consultas).toHaveLength(1)
    const c = fake.consultas[0]!
    expect(c.tabela).toBe("usuarios")
    expect(op(c, "select")).toEqual(["select", "papel, ultimo_acesso"])
    expect(op(c, "eq")).toEqual(["eq", "email", "ana@x"])
  })

  it("registrarAcesso: pessoa nova é criada com ignoreDuplicates e relida", async () => {
    let selects = 0
    const fake = criarFake((c) => {
      if (op(c, "upsert")) return ok(null)
      selects += 1
      return ok(selects === 1 ? null : linha("usuario"))
    })
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    expect(await repo.registrarAcesso("Ana@X")).toBe("usuario")
    expect(fake.consultas.map((c) => (op(c, "upsert") ? "upsert" : "select"))).toEqual(["select", "upsert", "select"])
    const upsert = op(fake.consultas[1]!, "upsert")!
    expect(upsert[1]).toEqual({ email: "ana@x", primeiro_acesso: AGORA.toISOString(), ultimo_acesso: AGORA.toISOString() })
    expect(upsert[2]).toEqual({ onConflict: "email", ignoreDuplicates: true })
  })

  it("registrarAcesso: acesso com mais de 1 h atualiza ultimo_acesso; com menos, não", async () => {
    const fake = criarFake(() => ok(linha("usuario")))
    const repo = new SupabaseUsuarios(fake.cliente, () => DEPOIS_DE_1H)
    await repo.registrarAcesso("ana@x")
    expect(fake.consultas).toHaveLength(2)
    const atualiza = fake.consultas[1]!
    expect(op(atualiza, "update")![1]).toEqual({ ultimo_acesso: DEPOIS_DE_1H.toISOString() })
    expect(op(atualiza, "eq")).toEqual(["eq", "email", "ana@x"])
  })

  it("registrarAcesso: erro do banco vira Error sem URL", async () => {
    const fake = criarFake(() => ({ data: null, error: { message: "falhou em https://abc.supabase.co/rest/v1/usuarios" } }))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    const erro = await repo.registrarAcesso("ana@x").catch((e: unknown) => e)
    expect((erro as Error).message).toContain("falhou")
    expect((erro as Error).message).not.toContain("supabase.co")
  })

  it("listar: converte as colunas e ordena por e-mail", async () => {
    const fake = criarFake(() =>
      ok([
        { email: "b@x", papel: "usuario", primeiro_acesso: "2026-11-01T10:00:00+00:00", ultimo_acesso: "2026-11-02T10:00:00+00:00" },
        { email: "a@x", papel: "admin", primeiro_acesso: "2026-11-01T09:00:00+00:00", ultimo_acesso: "2026-11-01T09:00:00+00:00" },
      ]),
    )
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    expect(await repo.listar()).toEqual([
      { email: "a@x", papel: "admin", primeiroAcesso: "2026-11-01T09:00:00.000Z", ultimoAcesso: "2026-11-01T09:00:00.000Z" },
      { email: "b@x", papel: "usuario", primeiroAcesso: "2026-11-01T10:00:00.000Z", ultimoAcesso: "2026-11-02T10:00:00.000Z" },
    ])
    expect(fake.consultas[0]!.tabela).toBe("usuarios")
  })

  it("existe: consulta pelo e-mail normalizado", async () => {
    const fake = criarFake((c) => ok(op(c, "eq")![2] === "ana@x" ? { email: "ana@x" } : null))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    expect(await repo.existe(" ANA@x ")).toBe(true)
    expect(await repo.existe("outra@x")).toBe(false)
  })

  it("alterarPapel: chama a função alterar_papel com os e-mails normalizados", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    await repo.alterarPapel(" Bia@X ", "admin", "ANA@x")
    expect(fake.consultas).toHaveLength(1)
    expect(fake.consultas[0]).toEqual({
      tabela: "rpc:alterar_papel",
      ops: [["rpc", { alvo: "bia@x", novo_papel: "admin", autor: "ana@x" }]],
    })
  })

  it.each([
    ["autor_nao_admin", ErroSemPermissao],
    ["alvo_inexistente", ErroNaoEncontrado],
    ["ultimo_admin", ErroUltimoAdmin],
    ["papel_invalido", ErroEntrada],
  ])("alterarPapel: mensagem %s vira o erro de domínio certo", async (message, Erro) => {
    const fake = criarFake(() => ({ data: null, error: { message, code: "P0001" } }))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    await expect(repo.alterarPapel("b@x", "admin", "a@x")).rejects.toBeInstanceOf(Erro)
  })

  it("alterarPapel: outra mensagem vira Error comum, sem URL", async () => {
    const fake = criarFake(() => ({ data: null, error: { message: "queda em https://abc.supabase.co/rest/v1/rpc" } }))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    const erro = await repo.alterarPapel("b@x", "admin", "a@x").catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).message).toContain("queda")
    expect((erro as Error).message).not.toContain("supabase.co")
  })

  it("registrarAvatar: atualiza só avatar_url, pelo e-mail normalizado", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    await repo.registrarAvatar(" ANA@x ", "https://lh3.googleusercontent.com/a/abc")
    expect(fake.consultas).toHaveLength(1)
    const c = fake.consultas[0]!
    expect(c.tabela).toBe("usuarios")
    expect(op(c, "update")).toEqual(["update", { avatar_url: "https://lh3.googleusercontent.com/a/abc" }])
    expect(op(c, "eq")).toEqual(["eq", "email", "ana@x"])
    expect(op(c, "upsert")).toBeUndefined()
    expect(op(c, "insert")).toBeUndefined()
  })

  it("registrarAvatar: null grava null", async () => {
    const fake = criarFake(() => ok(null))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    await repo.registrarAvatar("ana@x", null)
    expect(op(fake.consultas[0]!, "update")).toEqual(["update", { avatar_url: null }])
  })

  it("registrarAvatar: erro do banco vira Error sem URL", async () => {
    const fake = criarFake(() => ({ data: null, error: { message: "queda em https://abc.supabase.co/rest/v1/usuarios" } }))
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    const erro = await repo.registrarAvatar("ana@x", null).catch((e: unknown) => e)
    expect((erro as Error).message).toContain("queda")
    expect((erro as Error).message).not.toContain("supabase.co")
  })

  it("avatares: seleciona email e avatar_url só de quem tem foto e monta o mapa", async () => {
    const fake = criarFake(() =>
      ok([
        { email: "a@x", avatar_url: "https://lh3.googleusercontent.com/a/1" },
        { email: "b@x", avatar_url: "https://lh3.googleusercontent.com/a/2" },
      ]),
    )
    const repo = new SupabaseUsuarios(fake.cliente, () => AGORA)
    const mapa = await repo.avatares()
    expect([...mapa]).toEqual([
      ["a@x", "https://lh3.googleusercontent.com/a/1"],
      ["b@x", "https://lh3.googleusercontent.com/a/2"],
    ])
    const c = fake.consultas[0]!
    expect(c.tabela).toBe("usuarios")
    expect(op(c, "select")).toEqual(["select", "email, avatar_url"])
    expect(op(c, "not")).toEqual(["not", "avatar_url", "is", null])
    expect(op(c, "order")).toEqual(["order", "email"])
    expect(op(c, "range")).toEqual(["range", 0, 999])
  })
})

describe("MemoriaUsuarios: avatares", () => {
  it("avatares devolve cópia: mudar o mapa não altera o repositório", async () => {
    const repo = new MemoriaUsuarios(["ana@x"], () => AGORA)
    await repo.registrarAvatar("ana@x", "https://lh3.googleusercontent.com/a/abc")
    ;(await repo.avatares()).clear()
    expect((await repo.avatares()).size).toBe(1)
  })
})
