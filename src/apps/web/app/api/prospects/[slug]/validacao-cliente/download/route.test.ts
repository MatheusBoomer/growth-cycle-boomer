import { mkdir, mkdtemp, rm, writeFile, cp } from "node:fs/promises"
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

// Sessão de verdade (exigirAcessoAoProspect); só o Supabase Auth e os cookies são simulados. O serviço é o real,
// sobre uma pasta temporária, para o teste cobrir rota + sessão + regra de dono + gravação do download.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { GET } = await import("./route")
const { POST: acoes } = await import("../../etapas/[etapa]/acoes/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../../../../../..")
const ANA = "ana@boomer.com.br"
const BIA = "bia@boomer.com.br"
const SLUG = "da-ana"
const PDF = "entrega/validacao-cliente/documento-validacao.pdf"

let raiz: string
let servico: ServicoPlanejamento
let armazenamento: NuvemArmazenamento

function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const baixar = (slug = SLUG) => GET(new Request("http://127.0.0.1:3000/api/x"), { params: Promise.resolve({ slug }) } as never)
const confirmar = (slug = SLUG) =>
  acoes(
    new Request("http://127.0.0.1:3000/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "confirmar-validacao-cliente" }) }),
    { params: Promise.resolve({ slug, etapa: "04" }) } as never,
  )

/** 04 em andamento, como na correção feita depois do diagnóstico. */
async function prospectNaEtapa04() {
  await servico.criarProspect("Da Ana", null, ANA)
  const e = await servico.estado(SLUG)
  e.etapas["01"].status = "concluida"
  e.etapas["02"].status = "concluida"
  e.etapas["03"].status = "concluida"
  e.etapas["04"].status = "liberada"
  await armazenamento.gravarEstado(SLUG, e)
  await servico.iniciarEtapa(SLUG, "04")
}

/** O agente da 04 gera o PDF em .app/rascunhos e propõe; o app grava o arquivo final. */
async function gerarDocumento(conteudo = "%PDF-1.4 teste") {
  const dir = path.join(raiz, "clientes", SLUG, ".app/rascunhos")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, "validacao.pdf"), conteudo)
  const r = await servico.ferramenta({ slug: SLUG, etapa: "04" }, "propor_validacao_cliente", { arquivo_rascunho: `clientes/${SLUG}/.app/rascunhos/validacao.pdf` })
  expect(r.ok).toBe(true)
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
    agora: () => "2026-11-16T10:00:00.000Z",
  })
  servico.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => false })
  mundo.servidor = { servico, armazenamento, turnos: { ativo: () => false, ativoPor: () => null }, usuarios: new MemoriaUsuarios(["admin@boomer.com.br"]) }
  entrarComo(ANA)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("GET /api/prospects/[slug]/validacao-cliente/download", () => {
  it("baixar sem documento devolve 404", async () => {
    await prospectNaEtapa04()
    const r = await baixar()
    expect(r.status).toBe(404)
    expect(await r.json()).toMatchObject({ erro: "O documento de validação ainda não foi gerado.", codigo: "nao_encontrado" })
  })

  it("baixar devolve application/pdf, attachment e registra baixadoEm", async () => {
    await prospectNaEtapa04()
    await gerarDocumento("%PDF-1.4 conteudo")
    const r = await baixar()
    expect(r.status).toBe(200)
    expect(r.headers.get("content-type")).toBe("application/pdf")
    expect(r.headers.get("content-disposition")).toBe(`attachment; filename*=UTF-8''validacao-${SLUG}.pdf`)
    expect(r.headers.get("cache-control")).toBe("no-store")
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe("%PDF-1.4 conteudo")
    expect((await servico.estado(SLUG)).validacaoCliente).toMatchObject({ baixadoEm: "2026-11-16T10:00:00.000Z", baixadoPor: ANA, arquivo: PDF })
  })

  it("usuario sem acesso ao prospect e barrado no download e na confirmacao (404, sem revelar o prospect)", async () => {
    await prospectNaEtapa04()
    await gerarDocumento()
    entrarComo(BIA)
    const download = await baixar()
    expect(download.status).toBe(404)
    expect(await download.json()).toEqual({ erro: "Projeto não encontrado.", codigo: "nao_encontrado" })
    const confirmacao = await confirmar()
    expect(confirmacao.status).toBe(404)
    expect(await confirmacao.json()).toEqual({ erro: "Projeto não encontrado.", codigo: "nao_encontrado" })
    // nada foi registrado
    expect((await servico.estado(SLUG)).validacaoCliente?.baixadoEm).toBeNull()
  })
})

describe("POST /api/prospects/[slug]/etapas/[etapa]/acoes, confirmar-validacao-cliente", () => {
  it("confirmar antes de baixar devolve erro de transicao (status do ErroDominio)", async () => {
    await prospectNaEtapa04()
    await gerarDocumento()
    const r = await confirmar()
    expect(r.status).toBe(409)
    expect(await r.json()).toMatchObject({ codigo: "transicao_invalida" })
    expect((await servico.estado(SLUG)).validacaoCliente?.confirmadoEm).toBeNull()
  })

  it("confirmar depois de baixar devolve ok", async () => {
    await prospectNaEtapa04()
    await gerarDocumento()
    expect((await baixar()).status).toBe(200)
    const r = await confirmar()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect((await servico.estado(SLUG)).validacaoCliente).toMatchObject({ confirmadoEm: "2026-11-16T10:00:00.000Z", confirmadoPor: ANA })
  })
})
