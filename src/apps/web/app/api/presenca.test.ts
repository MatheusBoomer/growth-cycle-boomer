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

// A sessão é a de verdade (exigirAcessoAoProspect): só o Supabase Auth e os cookies são simulados, e o servidor entrega
// o serviço real sobre o repositório em memória. Assim o teste cobre rota + sessão + regra de dono + o que foi gravado.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { POST: presenca } = await import("./prospects/[slug]/presenca/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../..")
const ANA = "ana@boomer.com.br"
const BIA = "bia@boomer.com.br"
const ADM = "admin@boomer.com.br"

let raiz: string
let servico: ServicoPlanejamento
let repositorio: MemoriaRepositorio
let armazenamento: NuvemArmazenamento

function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const contexto = (slug: string) => ({ params: Promise.resolve({ slug }) }) as Parameters<typeof presenca>[1]
const aviso = (corpo?: unknown) =>
  new Request("http://127.0.0.1:3000/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
const valido = { etapa: "03", visivel: true, segundosSemInteracao: 12 }

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
  repositorio = new MemoriaRepositorio()
  armazenamento = new NuvemArmazenamento({ raiz, repositorio, armazem, mesa, atrasoAgendamentoMs: 0 })
  servico = new ServicoPlanejamento({
    armazenamento,
    catalogo: carregarCatalogo(RAIZ_DO_PROJETO),
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-11-07T10:00:00.000Z",
  })
  servico.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => false })
  mundo.servidor = { servico, armazenamento, usuarios: new MemoriaUsuarios([ADM]) }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("POST /api/prospects/[slug]/presenca", () => {
  it("o usuário no próprio projeto recebe 204 e a linha gravada leva o e-mail da sessão", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ANA)
    const r = await presenca(aviso(valido), contexto("da-ana"))
    expect(r.status).toBe(204)
    expect(await r.text()).toBe("")
    expect(repositorio.presencas).toEqual([
      { slug: "da-ana", email: ANA, etapa: "03", visivel: true, segundosSemInteracao: 12, em: expect.any(String) },
    ])
  })

  it("aceita a etapa final, aba escondida e os extremos de 0 e 86400 segundos", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ANA)
    for (const segundosSemInteracao of [0, 86400]) {
      expect((await presenca(aviso({ etapa: "final", visivel: false, segundosSemInteracao }), contexto("da-ana"))).status).toBe(204)
    }
    expect(repositorio.presencas.map((p) => [p.etapa, p.visivel, p.segundosSemInteracao])).toEqual([
      ["final", false, 0],
      ["final", false, 86400],
    ])
  })

  it("o admin avisa em projeto de outra pessoa, com o próprio e-mail", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ADM)
    expect((await presenca(aviso(valido), contexto("da-ana"))).status).toBe(204)
    expect(repositorio.presencas.map((p) => p.email)).toEqual([ADM])
  })

  it("projeto alheio ou inexistente dá 404 e não grava nada", async () => {
    await servico.criarProspect("Da Bia", null, BIA)
    entrarComo(ANA)
    for (const slug of ["da-bia", "nao-existe"]) {
      const r = await presenca(aviso(valido), contexto(slug))
      expect(r.status).toBe(404)
      expect(await r.json()).toEqual({ erro: "Projeto não encontrado.", codigo: "nao_encontrado" })
    }
    expect(repositorio.presencas).toEqual([])
  })

  it("sem sessão dá 401 e não grava", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    getClaims.mockResolvedValue({ data: null, error: new Error("sem sessão") })
    expect((await presenca(aviso(valido), contexto("da-ana"))).status).toBe(401)
    expect(repositorio.presencas).toEqual([])
  })

  it.each([
    ["segundosSemInteracao negativo", { ...valido, segundosSemInteracao: -1 }],
    ["segundosSemInteracao acima de um dia", { ...valido, segundosSemInteracao: 86401 }],
    ["segundosSemInteracao como texto", { ...valido, segundosSemInteracao: "10" }],
    ["segundosSemInteracao fracionário", { ...valido, segundosSemInteracao: 1.5 }],
    ["segundosSemInteracao ausente", { etapa: "03", visivel: true }],
    ["etapa fora da lista", { ...valido, etapa: "99" }],
    ["etapa que não é texto", { ...valido, etapa: 3 }],
    ["etapa ausente", { visivel: true, segundosSemInteracao: 1 }],
    ["visivel como texto", { ...valido, visivel: "true" }],
    ["visivel ausente", { etapa: "03", segundosSemInteracao: 1 }],
    ["corpo nulo", null],
  ])("%s dá 400 e não grava", async (_nome, corpo) => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ANA)
    const r = await presenca(aviso(corpo), contexto("da-ana"))
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ codigo: "entrada_invalida" })
    expect(repositorio.presencas).toEqual([])
  })

  it("corpo que não é JSON dá 400", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ANA)
    const r = await presenca(new Request("http://127.0.0.1:3000/api/x", { method: "POST", body: "não é json" }), contexto("da-ana"))
    expect(r.status).toBe(400)
  })

  it("no modo fs (sem repositório de usuários) o aviso é aceito e descartado", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    mundo.servidor = { servico, armazenamento, usuarios: null }
    entrarComo(ANA)
    expect((await presenca(aviso(valido), contexto("da-ana"))).status).toBe(204)
    expect(repositorio.presencas).toEqual([])
  })

  it("no modo off (sem e-mail) o aviso é aceito e descartado", async () => {
    await servico.criarProspect("Sem Dono", null)
    vi.stubEnv("PLANEJAMENTO_AUTH", "off")
    expect((await presenca(aviso(valido), contexto("sem-dono"))).status).toBe(204)
    expect(repositorio.presencas).toEqual([])
  })
})
