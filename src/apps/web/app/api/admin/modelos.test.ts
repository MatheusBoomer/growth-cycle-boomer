import { cp, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { montarListaDeModelos, type ListaDeModelos, type Sugestao } from "@workspace/core/modelos"
import { NuvemArmazenamento } from "@workspace/core/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "@workspace/core/nuvem/memoria"
import { Mesa } from "@workspace/core/nuvem/mesa"
import { MemoriaUsuarios } from "@workspace/core/nuvem/usuarios"
import type { LinhaConfigModelo } from "@workspace/core/nuvem/tipos"
import { ServicoPlanejamento } from "@workspace/core/servico-planejamento"

// Mesmo arranjo de admin.test.ts: sessão real (exigirAdmin), Supabase Auth e cookies simulados, serviço real sobre o
// repositório em memória. Só a lista de modelos é falsa (a real abriria o CLI do Claude).
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { GET: lerModelos } = await import("./modelos/route")
const { PUT: gravarModelo } = await import("./modelos/[etapa]/[alvo]/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../../..")
const CHEFE = "chefe@boomer.com.br"
const ANA = "ana@boomer.com.br"
const MSG_SEM_NUVEM = "A administração de pessoas só existe com os dados na nuvem."

const LISTA: ListaDeModelos = montarListaDeModelos([
  { value: "claude-sonnet-x", displayName: "Sonnet X", description: "d", supportsEffort: true, supportedEffortLevels: ["low", "high"] },
  { value: "claude-simples", displayName: "Simples", description: "d", supportsEffort: false },
])

let raiz: string
let servico: ServicoPlanejamento
let armazenamento: NuvemArmazenamento
let usuarios: MemoriaUsuarios
const catalogo = carregarCatalogo(RAIZ_DO_PROJETO)

function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const pedido = (corpo?: unknown) =>
  new Request("http://127.0.0.1:3000/api/x", { method: "PUT", headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
const contexto = (etapa: string, alvo: string) => ({ params: Promise.resolve({ etapa, alvo }) }) as Parameters<typeof gravarModelo>[1]

const linhas = (): Promise<LinhaConfigModelo[]> => servico.configModelos()

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
    catalogo,
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-11-07T10:00:00.000Z",
  })
  usuarios = new MemoriaUsuarios([CHEFE])
  mundo.servidor = { raiz: RAIZ_DO_PROJETO, catalogo, servico, armazenamento, usuarios, modelosDisponiveis: async () => LISTA }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("usuário comum", () => {
  it("recebe 403 nas duas rotas e nada é gravado", async () => {
    entrarComo(ANA)
    for (const r of [await lerModelos(), await gravarModelo(pedido({ modelo: "sonnet", esforco: null }), contexto("01", "principal"))]) {
      expect(r.status).toBe(403)
      expect(await r.json()).toMatchObject({ codigo: "sem_permissao" })
    }
    expect(await linhas()).toEqual([])
  })
})

describe("GET /api/admin/modelos", () => {
  it("traz as 10 etapas com rótulo e alvos, a config gravada, as sugestões e a lista", async () => {
    await servico.salvarConfigModelo("03", "principal", { modelo: "sonnet", esforco: "high" }, CHEFE, LISTA)
    entrarComo(CHEFE)

    const r = await lerModelos()
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as {
      etapas: { id: string; rotulo: string; alvos: string[] }[]
      config: LinhaConfigModelo[]
      sugestoes: Sugestao[]
      lista: ListaDeModelos
    }
    expect(corpo.etapas.map((e) => e.id)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "final"])
    for (const e of corpo.etapas) {
      expect(e.rotulo).not.toBe("")
      expect(e.alvos[0]).toBe("principal")
    }
    expect(corpo.etapas.find((e) => e.id === "03")?.alvos).toContain("analista-dados")
    expect(corpo.etapas.find((e) => e.id === "01")?.alvos).toEqual(["principal"])
    expect(corpo.config).toMatchObject([{ etapa: "03", alvo: "principal", modelo: "sonnet", esforco: "high", alteradoPor: CHEFE }])
    expect(corpo.sugestoes.length).toBeGreaterThan(0)
    expect(corpo.sugestoes[0]).toHaveProperty("motivo")
    expect(corpo.lista).toEqual(LISTA)
  })
})

describe("PUT /api/admin/modelos/[etapa]/[alvo]", () => {
  it("grava a escolha com o e-mail do admin em alteradoPor", async () => {
    entrarComo(CHEFE)
    const r = await gravarModelo(pedido({ modelo: "claude-sonnet-x", esforco: "high" }), contexto("03", "principal"))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(await linhas()).toMatchObject([{ etapa: "03", alvo: "principal", modelo: "claude-sonnet-x", esforco: "high", alteradoPor: CHEFE }])
  })

  it("grava a escolha de um subagente da etapa", async () => {
    entrarComo(CHEFE)
    const r = await gravarModelo(pedido({ modelo: "haiku", esforco: null }), contexto("03", "analista-dados"))
    expect(r.status).toBe(200)
    expect(await linhas()).toMatchObject([{ etapa: "03", alvo: "analista-dados", modelo: "haiku", esforco: null }])
  })

  it("os dois campos nulos apagam a linha", async () => {
    await servico.salvarConfigModelo("03", "principal", { modelo: "sonnet", esforco: null }, CHEFE, LISTA)
    entrarComo(CHEFE)
    const r = await gravarModelo(pedido({ modelo: null, esforco: null }), contexto("03", "principal"))
    expect(r.status).toBe(200)
    expect(await linhas()).toEqual([])
  })

  it("sem modelo, não consulta o SDK: voltar ao padrão e salvar só o esforço", async () => {
    const modelosDisponiveis = vi.fn(async () => LISTA)
    mundo.servidor = { raiz: RAIZ_DO_PROJETO, catalogo, servico, armazenamento, usuarios, modelosDisponiveis }
    entrarComo(CHEFE)
    expect((await gravarModelo(pedido({ modelo: null, esforco: null }), contexto("03", "principal"))).status).toBe(200)
    expect((await gravarModelo(pedido({ modelo: null, esforco: "low" }), contexto("03", "principal"))).status).toBe(200)
    expect(modelosDisponiveis).not.toHaveBeenCalled()
    expect(await linhas()).toMatchObject([{ etapa: "03", alvo: "principal", modelo: null, esforco: "low" }])
    expect((await gravarModelo(pedido({ modelo: null, esforco: "enorme" }), contexto("03", "principal"))).status).toBe(400)
    expect(modelosDisponiveis).not.toHaveBeenCalled()
    expect((await gravarModelo(pedido({ modelo: "claude-sonnet-x", esforco: null }), contexto("03", "principal"))).status).toBe(200)
    expect(modelosDisponiveis).toHaveBeenCalledTimes(1)
  })

  it("subagente que a etapa não aciona dá 404", async () => {
    entrarComo(CHEFE)
    const r = await gravarModelo(pedido({ modelo: "sonnet", esforco: null }), contexto("01", "analista-dados"))
    expect(r.status).toBe(404)
    expect(await r.json()).toMatchObject({ codigo: "nao_encontrado" })
    expect(await linhas()).toEqual([])
  })

  it("etapa desconhecida dá 404", async () => {
    entrarComo(CHEFE)
    expect((await gravarModelo(pedido({ modelo: "sonnet", esforco: null }), contexto("99", "principal"))).status).toBe(404)
  })

  it("modelo fora da lista dá 400 e nada é gravado", async () => {
    entrarComo(CHEFE)
    const r = await gravarModelo(pedido({ modelo: "claude-x", esforco: null }), contexto("03", "principal"))
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ codigo: "entrada_invalida" })
    expect(await linhas()).toEqual([])
  })

  it("esforço que o modelo não aceita dá 400", async () => {
    entrarComo(CHEFE)
    expect((await gravarModelo(pedido({ modelo: "claude-simples", esforco: "high" }), contexto("03", "principal"))).status).toBe(400)
    expect((await gravarModelo(pedido({ modelo: "claude-sonnet-x", esforco: "max" }), contexto("03", "principal"))).status).toBe(400)
    expect((await gravarModelo(pedido({ modelo: "claude-sonnet-x", esforco: "enorme" }), contexto("03", "principal"))).status).toBe(400)
    expect(await linhas()).toEqual([])
  })

  it("corpo malformado dá 400", async () => {
    entrarComo(CHEFE)
    const ctx = contexto("03", "principal")
    for (const corpo of [{}, { modelo: "sonnet" }, { esforco: null }, { modelo: 3, esforco: null }, { modelo: null, esforco: 2 }]) {
      expect((await gravarModelo(pedido(corpo), ctx)).status).toBe(400)
    }
    expect((await gravarModelo(new Request("http://127.0.0.1:3000/api/x", { method: "PUT", body: "{" }), ctx)).status).toBe(400)
    expect(await linhas()).toEqual([])
  })
})

describe("sem repositório de usuários (modo fs)", () => {
  it("as duas rotas respondem 400 com a mesma mensagem", async () => {
    mundo.servidor = { raiz: RAIZ_DO_PROJETO, catalogo, servico, armazenamento, usuarios: null, modelosDisponiveis: async () => LISTA }
    entrarComo(CHEFE)
    for (const r of [await lerModelos(), await gravarModelo(pedido({ modelo: "sonnet", esforco: null }), contexto("03", "principal"))]) {
      expect(r.status).toBe(400)
      expect(await r.json()).toMatchObject({ erro: MSG_SEM_NUVEM })
    }
  })
})
