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

// Mesmo arranjo de projetos.test.ts: sessão e papel de admin de verdade, Supabase Auth e cookies simulados.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { GET: painel } = await import("./painel/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../../..")
const CHEFE = "chefe@boomer.com.br"
const ANA = "ana@boomer.com.br"
const MSG_SEM_NUVEM = "A administração de pessoas só existe com os dados na nuvem."

let raiz: string
let servico: ServicoPlanejamento
let armazenamento: NuvemArmazenamento
let usuarios: MemoriaUsuarios

function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const pedido = (query = "") => new Request(`http://127.0.0.1:3000/api/admin/painel${query}`)

/** Grava um turno de IA de 4 minutos e US$ 2,50 de Ana na etapa 03, no dia 7 de novembro. */
async function registrarTurno(slug: string) {
  await servico.registrarUso({
    slug,
    etapa: "03",
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
  usuarios = new MemoriaUsuarios([CHEFE])
  mundo.servidor = { servico, armazenamento, usuarios }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("GET /api/admin/painel", () => {
  it("usuário comum recebe 403", async () => {
    entrarComo(ANA)
    const r = await painel(pedido())
    expect(r.status).toBe(403)
    expect(await r.json()).toMatchObject({ codigo: "sem_permissao" })
  })

  it("sem sessão recebe 401", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("sem sessão") })
    expect((await painel(pedido())).status).toBe(401)
  })

  it("no modo disco responde 200 com um painel vazio comum, sem avatares e sem a mensagem da nuvem", async () => {
    mundo.servidor = { servico, armazenamento, usuarios: null }
    entrarComo(CHEFE)
    const r = await painel(pedido())
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as {
      erro?: string
      painel: { totais: { custoUsd: number }; porProjeto: unknown[] }
      avatares: Record<string, string>
    }
    expect(corpo.erro).toBeUndefined()
    expect(JSON.stringify(corpo)).not.toContain(MSG_SEM_NUVEM)
    expect(corpo.painel.totais.custoUsd).toBe(0)
    expect(corpo.painel.porProjeto).toEqual([])
    expect(corpo.avatares).toEqual({})
  })

  it("o admin recebe painel, opções e avatares, com o filtro lido da query", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await servico.criarProspect("Outro", null, CHEFE)
    await registrarTurno("da-ana")
    vi.spyOn(usuarios, "avatares").mockResolvedValue(new Map([[ANA, "https://lh3.googleusercontent.com/a/1"]]))
    entrarComo(CHEFE)

    const r = await painel(pedido("?de=2026-11-01&ate=2026-11-09"))
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as {
      painel: { periodo: { de: string; ate: string }; totais: { custoUsd: number }; porEtapa: Array<{ etapa: string; usd: number }> }
      opcoes: { donos: string[]; projetos: Array<{ slug: string; nome: string }>; modelos: string[] }
      avatares: Record<string, string>
    }
    expect(corpo.painel.periodo).toMatchObject({ de: "2026-11-01", ate: "2026-11-09" })
    expect(corpo.painel.totais.custoUsd).toBeCloseTo(2.5)
    expect(corpo.painel.porEtapa).toEqual([expect.objectContaining({ etapa: "03", usd: 2.5 })])
    expect(corpo.opcoes.donos).toEqual([ANA, CHEFE])
    expect(corpo.opcoes.projetos).toEqual([
      { slug: "da-ana", nome: "Da Ana" },
      { slug: "outro", nome: "Outro" },
    ])
    expect(corpo.opcoes.modelos).toEqual(["claude-opus"])
    expect(corpo.avatares).toEqual({ [ANA]: "https://lh3.googleusercontent.com/a/1" })
  })

  it("filtra por dono e aceita datas inválidas sem erro (cai no padrão)", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    await registrarTurno("da-ana")
    entrarComo(CHEFE)

    const r = await painel(pedido("?de=lixo&ate=2026-01-01&donos=outra@boomer.com.br"))
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as { painel: { periodo: { de: string; ate: string }; totais: { custoUsd: number } } }
    expect(corpo.painel.periodo.de < corpo.painel.periodo.ate).toBe(true)
    expect(corpo.painel.totais.custoUsd).toBe(0)
  })

  it("?atualizar=1 relê os dados; sem isso o segundo pedido usa o cache", async () => {
    await servico.criarProspect("Da Ana", null, ANA)
    const espia = vi.spyOn(servico, "painelDeMetricas")
    entrarComo(CHEFE)

    await painel(pedido("?periodo=7d"))
    await painel(pedido("?periodo=30d&atualizar=1"))

    expect(espia.mock.calls[0]![2]).toEqual({ atualizar: false })
    expect(espia.mock.calls[1]![2]).toEqual({ atualizar: true })
  })
})
