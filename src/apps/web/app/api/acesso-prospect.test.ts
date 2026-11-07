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

// A sessão é a de verdade (exigirAdmin, exigirAcessoAoProspect): só o Supabase Auth e os cookies são simulados, e o
// servidor entrega o serviço real sobre o repositório em memória. Assim o teste cobre rota + sessão + regra de dono.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { GET: listarProspects } = await import("./prospects/route")
const { GET: estado } = await import("./prospects/[slug]/estado/route")
const { POST: criarClienteTeste } = await import("./cliente-teste/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../..")
const ANA = "ana@boomer.com.br"
const BIA = "bia@boomer.com.br"
const ADM = "admin@boomer.com.br"

let raiz: string
let servico: ServicoPlanejamento

/** Define quem é o usuário logado nas próximas requisições. */
function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const contexto = (slug: string) => ({ params: Promise.resolve({ slug }) }) as Parameters<typeof estado>[1]
const pedido = (corpo?: unknown) =>
  new Request("http://127.0.0.1:3000/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })

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
  servico = new ServicoPlanejamento({
    armazenamento: new NuvemArmazenamento({ raiz, repositorio: new MemoriaRepositorio(), armazem, mesa, atrasoAgendamentoMs: 0 }),
    catalogo: carregarCatalogo(RAIZ_DO_PROJETO),
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-11-07T10:00:00.000Z",
  })
  servico.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => false })
  mundo.servidor = { servico, turnos: { ativo: () => false, ativoPor: () => null }, usuarios: new MemoriaUsuarios([ADM]) }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("GET /api/prospects/[slug]/estado, usuário comum", () => {
  it("prospect alheio, inexistente e excluído dão exatamente a mesma resposta (404, sem revelar se existe)", async () => {
    await servico.criarProspect("Da Bia", null, BIA)
    await servico.criarProspect("Excluida", null, ANA)
    await servico.excluirProspect("excluida", "excluida")
    entrarComo(ANA)

    const respostas = []
    for (const slug of ["da-bia", "nao-existe", "excluida"]) {
      const r = await estado(new Request("http://127.0.0.1:3000/api/x"), contexto(slug))
      respostas.push({ status: r.status, corpo: await r.json() })
    }
    expect(respostas[0]).toEqual({ status: 404, corpo: { erro: "Projeto não encontrado.", codigo: "nao_encontrado" } })
    expect(respostas[1]).toEqual(respostas[0])
    expect(respostas[2]).toEqual(respostas[0])
  })

  it("slug malformado também dá o mesmo 404", async () => {
    entrarComo(ANA)
    const r = await estado(new Request("http://127.0.0.1:3000/api/x"), contexto("../etc"))
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ erro: "Projeto não encontrado.", codigo: "nao_encontrado" })
  })

  it("o prospect do próprio usuário abre; o admin abre o de qualquer um", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ANA)
    expect((await estado(new Request("http://127.0.0.1:3000/api/x"), contexto("da-ana"))).status).toBe(200)
    entrarComo(BIA)
    expect((await estado(new Request("http://127.0.0.1:3000/api/x"), contexto("da-ana"))).status).toBe(404)
    entrarComo(ADM)
    expect((await estado(new Request("http://127.0.0.1:3000/api/x"), contexto("da-ana"))).status).toBe(200)
  })
})

describe("GET /api/prospects", () => {
  it("o usuário comum recebe só os prospects dele", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await servico.criarProspect("Da Bia", null, BIA)
    await servico.criarProspect("Sem Dono", null)
    entrarComo(ANA)
    const r = await listarProspects()
    expect(r.status).toBe(200)
    expect(((await r.json()) as { slug: string }[]).map((p) => p.slug)).toEqual(["da-ana"])
  })

  it("o admin recebe todos", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await servico.criarProspect("Da Bia", null, BIA)
    entrarComo(ADM)
    const r = await listarProspects()
    expect(((await r.json()) as { slug: string }[]).map((p) => p.slug).sort()).toEqual(["da-ana", "da-bia"])
  })
})

describe("POST /api/cliente-teste", () => {
  it("usuário comum recebe 403 e nada é criado", async () => {
    entrarComo(ANA)
    const r = await criarClienteTeste(pedido({ etapa: "03" }))
    expect(r.status).toBe(403)
    expect(await r.json()).toMatchObject({ codigo: "sem_permissao" })
    expect((await servico.listarProspects({ email: ADM, papel: "admin" })).map((p) => p.slug)).toEqual([])
  })
})
