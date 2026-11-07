import { cp, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { NuvemArmazenamento } from "@workspace/core/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "@workspace/core/nuvem/memoria"
import { Mesa } from "@workspace/core/nuvem/mesa"
import { MemoriaUsuarios } from "@workspace/core/nuvem/usuarios"
import { ServicoPlanejamento } from "@workspace/core/servico-planejamento"

// A sessão é a de verdade (exigirAdmin): só o Supabase Auth e os cookies são simulados, e o servidor entrega o serviço
// real sobre o repositório em memória. Assim o teste cobre rota + sessão + regras de papel e de dono.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { GET: listarPessoas } = await import("./pessoas/route")
const { POST: alterarPapel } = await import("./pessoas/papel/route")
const { POST: trocarDono } = await import("./prospects/[slug]/dono/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../../..")
const CHEFE = "chefe@boomer.com.br"
const ANA = "ana@boomer.com.br"
const BIA = "bia@boomer.com.br"
const MSG_SEM_NUVEM = "A administração de pessoas só existe com os dados na nuvem."

let raiz: string
let servico: ServicoPlanejamento
let armazenamento: NuvemArmazenamento
let usuarios: MemoriaUsuarios

/** Define quem é o usuário logado nas próximas requisições. */
function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const pedido = (corpo?: unknown) =>
  new Request("http://127.0.0.1:3000/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
const contexto = (slug: string) => ({ params: Promise.resolve({ slug }) }) as Parameters<typeof trocarDono>[1]

/** Põe `servidor()` para responder sem repositório de usuários, como no modo fs. */
function semBanco() {
  mundo.servidor = { servico, armazenamento, usuarios: null }
}

beforeEach(async () => {
  vi.stubEnv("PLANEJAMENTO_AUTH", "google")
  vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")
  vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "boomer.com.br")

  raiz = await mkdtemp(path.join(tmpdir(), "planejamento com espaço-"))
  await cp(path.join(RAIZ_DO_PROJETO, "clientes/_template"), path.join(raiz, "clientes/_template"), { recursive: true })
  await mkdir(path.join(raiz, ".claude/skills/_shared/modelos-insumo"), { recursive: true })
  const armazem = new MemoriaArmazem()
  const mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem, esperar: async () => {} })
  armazenamento = new NuvemArmazenamento({ raiz, repositorio: new MemoriaRepositorio(), armazem, mesa, atrasoAgendamentoMs: 0 })
  servico = new ServicoPlanejamento({
    armazenamento,
    catalogo: carregarCatalogo(RAIZ_DO_PROJETO),
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-11-07T10:00:00.000Z",
  })
  servico.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => false })
  usuarios = new MemoriaUsuarios([CHEFE])
  mundo.servidor = { servico, armazenamento, usuarios }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("usuário comum", () => {
  it("recebe 403 nas três rotas e nada muda", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ANA)

    const respostas = [
      await listarPessoas(),
      await alterarPapel(pedido({ email: ANA, papel: "admin" })),
      await trocarDono(pedido({ email: ANA }), contexto("da-ana")),
    ]
    for (const r of respostas) {
      expect(r.status).toBe(403)
      expect(await r.json()).toMatchObject({ codigo: "sem_permissao" })
    }
    expect(await usuarios.registrarAcesso(ANA)).toBe("usuario")
  })

  it("sem sessão recebe 401", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("sem sessão") })
    expect((await listarPessoas()).status).toBe(401)
  })
})

describe("GET /api/admin/pessoas", () => {
  it("lista as pessoas com a contagem de projetos ativos de cada uma (sem diferença de maiúsculas) e o total de admins", async () => {
    await usuarios.registrarAcesso(ANA)
    await usuarios.registrarAcesso(BIA)
    await servico.criarProspect("Primeiro", null, ANA)
    await servico.criarProspect("Segundo", null, "ANA@Boomer.com.br")
    await servico.criarProspect("Da Bia", null, BIA)
    await servico.criarProspect("Excluido", null, ANA)
    await servico.excluirProspect("excluido", "excluido")
    await servico.criarProspect("Sem Dono", null)
    entrarComo(CHEFE)

    const r = await listarPessoas()
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as { pessoas: { email: string; papel: string; projetos: number }[]; admins: number }
    expect(corpo.admins).toBe(1)
    expect(corpo.pessoas.map((p) => [p.email, p.papel, p.projetos])).toEqual([
      [ANA, "usuario", 2],
      [BIA, "usuario", 1],
      [CHEFE, "admin", 0],
    ])
    expect(corpo.pessoas[0]).toHaveProperty("primeiroAcesso")
    expect(corpo.pessoas[0]).toHaveProperty("ultimoAcesso")
  })
})

describe("POST /api/admin/pessoas/papel", () => {
  it("promove uma pessoa a admin", async () => {
    await usuarios.registrarAcesso(ANA)
    entrarComo(CHEFE)
    const r = await alterarPapel(pedido({ email: ANA, papel: "admin" }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(await usuarios.registrarAcesso(ANA)).toBe("admin")
  })

  it("o admin rebaixa a si mesmo havendo outro admin: 200, e a chamada seguinte do mesmo usuário vira 403", async () => {
    usuarios.semearAdmin(ANA)
    entrarComo(CHEFE)
    expect((await listarPessoas()).status).toBe(200)

    const r = await alterarPapel(pedido({ email: CHEFE, papel: "usuario" }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })

    const depois = await listarPessoas()
    expect(depois.status).toBe(403)
    expect(await depois.json()).toMatchObject({ codigo: "sem_permissao" })
  })

  it("rebaixar o último admin dá 409 ultimo_admin e ele segue admin", async () => {
    entrarComo(CHEFE)
    const r = await alterarPapel(pedido({ email: CHEFE, papel: "usuario" }))
    expect(r.status).toBe(409)
    expect(await r.json()).toMatchObject({ codigo: "ultimo_admin" })
    expect((await listarPessoas()).status).toBe(200)
  })

  it("papel inválido dá 400", async () => {
    await usuarios.registrarAcesso(ANA)
    entrarComo(CHEFE)
    for (const papel of ["dono", undefined, 1]) {
      const r = await alterarPapel(pedido({ email: ANA, papel }))
      expect(r.status).toBe(400)
    }
    expect(await usuarios.registrarAcesso(ANA)).toBe("usuario")
  })

  it("e-mail ausente ou de tipo errado dá 400, corpo ilegível também", async () => {
    entrarComo(CHEFE)
    expect((await alterarPapel(pedido({ papel: "admin" }))).status).toBe(400)
    expect((await alterarPapel(pedido({ email: 7, papel: "admin" }))).status).toBe(400)
    expect((await alterarPapel(new Request("http://127.0.0.1:3000/api/x", { method: "POST", body: "{" }))).status).toBe(400)
  })

  it("pessoa que nunca entrou dá 404", async () => {
    entrarComo(CHEFE)
    const r = await alterarPapel(pedido({ email: "ninguem@boomer.com.br", papel: "admin" }))
    expect(r.status).toBe(404)
    expect(await r.json()).toMatchObject({ codigo: "nao_encontrado" })
  })
})

describe("POST /api/admin/prospects/[slug]/dono", () => {
  it("normaliza o e-mail e grava o novo dono", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await usuarios.registrarAcesso(BIA)
    entrarComo(CHEFE)

    const r = await trocarDono(pedido({ email: "  Bia@Boomer.com.br " }), contexto("da-ana"))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect((await armazenamento.listarDonos()).get("da-ana")).toBe(BIA)
  })

  it("e-mail de quem ainda não entrou no app dá 400 e o dono não muda", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(CHEFE)

    const r = await trocarDono(pedido({ email: "novo@boomer.com.br" }), contexto("da-ana"))
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ erro: "Essa pessoa ainda não entrou no app." })
    expect((await armazenamento.listarDonos()).get("da-ana")).toBe(ANA)
  })

  it("e-mail ausente dá 400", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(CHEFE)
    expect((await trocarDono(pedido({}), contexto("da-ana"))).status).toBe(400)
  })

  it("prospect que não existe dá 404", async () => {
    await usuarios.registrarAcesso(BIA)
    entrarComo(CHEFE)
    const r = await trocarDono(pedido({ email: BIA }), contexto("nao-existe"))
    expect(r.status).toBe(404)
  })
})

describe("sem repositório de usuários (modo fs)", () => {
  it("as três rotas respondem 400 com a mesma mensagem", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    semBanco()
    entrarComo(CHEFE)

    const respostas = [
      await listarPessoas(),
      await alterarPapel(pedido({ email: ANA, papel: "admin" })),
      await trocarDono(pedido({ email: ANA }), contexto("da-ana")),
    ]
    for (const r of respostas) {
      expect(r.status).toBe(400)
      expect(await r.json()).toMatchObject({ erro: MSG_SEM_NUVEM })
    }
  })
})
