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
// real sobre o repositório em memória. Assim o teste cobre rota + sessão + papel de admin + as métricas calculadas.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { GET: listarProjetos } = await import("./projetos/route")
const { GET: detalharProjeto } = await import("./projetos/[slug]/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../../..")
const CHEFE = "chefe@boomer.com.br"
const ANA = "ana@boomer.com.br"
const MSG_SEM_NUVEM = "A administração de pessoas só existe com os dados na nuvem."

let raiz: string
let servico: ServicoPlanejamento
let armazenamento: NuvemArmazenamento

function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const requisicao = new Request("http://127.0.0.1:3000/api/x")
const comMedias = new Request("http://127.0.0.1:3000/api/x?medias=1")
const contexto = (slug: string) => ({ params: Promise.resolve({ slug }) }) as Parameters<typeof detalharProjeto>[1]

/** Grava um turno de IA de 4 minutos e US$ 2,50 de Ana na etapa 01 do projeto. */
async function registrarTurno(slug: string) {
  await servico.registrarUso({
    slug,
    etapa: "01",
    autor: ANA,
    sessao: "s1",
    custoUsd: 2.5,
    modelosAcumulado: { "claude-opus": 2.5 },
    retomada: false,
    esforco: null,
    tokensEntrada: null,
    tokensSaida: null,
    status: "ok",
    inicio: "2026-11-07T10:00:00.000Z",
    fim: "2026-11-07T10:04:00.000Z",
  })
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
  mundo.servidor = { servico, armazenamento, usuarios: new MemoriaUsuarios([CHEFE]) }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("usuário comum", () => {
  it("recebe 403 nas duas rotas, até no próprio projeto", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    entrarComo(ANA)
    for (const r of [await listarProjetos(), await detalharProjeto(requisicao, contexto("da-ana"))]) {
      expect(r.status).toBe(403)
      expect(await r.json()).toMatchObject({ codigo: "sem_permissao" })
    }
  })

  it("sem sessão recebe 401", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("sem sessão") })
    expect((await listarProjetos()).status).toBe(401)
    expect((await detalharProjeto(requisicao, contexto("da-ana"))).status).toBe(401)
  })
})

describe("GET /api/admin/projetos", () => {
  it("o admin recebe os projetos ativos com as métricas e as médias por etapa", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await servico.criarProspect("Sem Dono", null)
    await servico.criarProspect("Excluido", null, ANA)
    await servico.excluirProspect("excluido", "excluido")
    await registrarTurno("da-ana")
    entrarComo(CHEFE)

    const r = await listarProjetos()
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as {
      projetos: { slug: string; dono: string | null; metricas: { custoUsd: number; porPessoa: unknown[] } }[]
      medias: Record<string, unknown>
    }
    expect(corpo.projetos.map((p) => p.slug).sort()).toEqual(["da-ana", "sem-dono"])
    const daAna = corpo.projetos.find((p) => p.slug === "da-ana")!
    expect(daAna.dono).toBe(ANA)
    expect(daAna.metricas.custoUsd).toBeCloseTo(2.5)
    expect(corpo.projetos.find((p) => p.slug === "sem-dono")!.metricas.custoUsd).toBe(0)
    expect(corpo.medias).toEqual({})
  })

  it("sem projetos devolve listas vazias", async () => {
    entrarComo(CHEFE)
    expect(await (await listarProjetos()).json()).toEqual({ projetos: [], medias: {} })
  })

  it("no modo fs responde 400 com a mensagem da nuvem", async () => {
    mundo.servidor = { servico, armazenamento, usuarios: null }
    entrarComo(CHEFE)
    const r = await listarProjetos()
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ erro: MSG_SEM_NUVEM })
  })
})

describe("GET /api/admin/projetos/[slug]", () => {
  it("o admin recebe o resumo e as métricas do projeto, com medias nulo e sem varrer a base", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await servico.criarProspect("Outro", null, ANA)
    await registrarTurno("da-ana")
    const espiaGerais = vi.spyOn(servico, "metricasGerais")
    entrarComo(CHEFE)

    const r = await detalharProjeto(requisicao, contexto("da-ana"))
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as { projeto: Record<string, unknown>; metricas: { custoUsd: number; porEtapa: Record<string, unknown> }; medias: unknown }
    expect(corpo.projeto).toMatchObject({ slug: "da-ana", nome: "Da Ana", dono: ANA })
    expect(corpo.projeto).not.toHaveProperty("metricas")
    expect(corpo.metricas.custoUsd).toBeCloseTo(2.5)
    expect(Object.keys(corpo.metricas.porEtapa)).toEqual(["01"])
    expect(corpo.medias).toBeNull()
    expect(espiaGerais).not.toHaveBeenCalled()
  })

  it("com ?medias=1 traz também as médias por etapa", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await registrarTurno("da-ana")
    const espiaGerais = vi.spyOn(servico, "metricasGerais")
    entrarComo(CHEFE)

    const r = await detalharProjeto(comMedias, contexto("da-ana"))
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as { projeto: { slug: string }; metricas: { custoUsd: number }; medias: unknown }
    expect(corpo.projeto.slug).toBe("da-ana")
    expect(corpo.metricas.custoUsd).toBeCloseTo(2.5)
    expect(corpo.medias).toEqual({})
    expect(espiaGerais).toHaveBeenCalledOnce()
  })

  it("slug inexistente, excluído ou malformado dá 404 Projeto não encontrado.", async () => {
    await servico.criarProspect("Excluida", null, ANA)
    await servico.excluirProspect("excluida", "excluida")
    entrarComo(CHEFE)
    for (const slug of ["nao-existe", "excluida", "../etc"]) {
      const r = await detalharProjeto(requisicao, contexto(slug))
      expect(r.status).toBe(404)
      expect(await r.json()).toEqual({ erro: "Projeto não encontrado.", codigo: "nao_encontrado" })
    }
  })

  it("no modo fs responde 400 com a mensagem da nuvem", async () => {
    mundo.servidor = { servico, armazenamento, usuarios: null }
    entrarComo(CHEFE)
    const r = await detalharProjeto(requisicao, contexto("da-ana"))
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ erro: MSG_SEM_NUVEM })
  })
})
