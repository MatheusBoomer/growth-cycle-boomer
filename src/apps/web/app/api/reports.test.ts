import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { FsArmazenamento } from "@workspace/core/armazenamento"
import { NuvemArmazenamento } from "@workspace/core/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "@workspace/core/nuvem/memoria"
import { Mesa } from "@workspace/core/nuvem/mesa"
import { MemoriaUsuarios } from "@workspace/core/nuvem/usuarios"
import { MSG_REPORTS_SEM_NUVEM, type Report } from "@workspace/core/reports"
import { ServicoPlanejamento } from "@workspace/core/servico-planejamento"

// Mesmo arranjo de admin/skills.test.ts: sessão real (exigirUsuario/exigirAdmin), Supabase Auth e cookies simulados,
// serviço real sobre o repositório em memória.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { POST: enviar } = await import("./reports/route")
const { GET: listar } = await import("./admin/reports/route")
const { PATCH: atualizar } = await import("./admin/reports/[id]/route")
const { GET: imagem } = await import("./admin/reports/[id]/imagens/[n]/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../..")
const CHEFE = "chefe@boomer.com.br"
const ANA = "ana@boomer.com.br"
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 2])
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

const catalogo = carregarCatalogo(RAIZ_DO_PROJETO)
let raizTemp: string
let servico: ServicoPlanejamento

function entrarComo(email: string | null) {
  getClaims.mockResolvedValue(
    email === null
      ? { data: null, error: null }
      : { data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null },
  )
}

function montarServico(armazenamento: NuvemArmazenamento | FsArmazenamento) {
  return new ServicoPlanejamento({
    armazenamento,
    catalogo,
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-11-11T10:00:00.000Z",
  })
}

function formulario(dados: unknown, tela: Uint8Array | null, extras: Uint8Array[] = []): Request {
  const form = new FormData()
  form.set("dados", typeof dados === "string" ? dados : JSON.stringify(dados))
  if (tela) form.set("tela", new File([tela as BlobPart], "tela.png", { type: "image/png" }))
  for (const [i, e] of extras.entries()) form.append("extras", new File([e as BlobPart], `extra-${i}.png`, { type: "image/png" }))
  return new Request("http://127.0.0.1:3000/api/reports", { method: "POST", body: form })
}

const dadosValidos = { tipo: "bug", comentario: "Botão não salva", contexto: { url: "/prospects/acme", prospect: "acme" }, autor: "x@y.com" }
const pedidoJson = (metodo: string, corpo?: unknown) =>
  new Request("http://127.0.0.1:3000/api/x", { method: metodo, headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof atualizar>[1]
const ctxImagem = (id: string, n: string) => ({ params: Promise.resolve({ id, n }) }) as Parameters<typeof imagem>[1]
const listarPor = (consulta = "") => listar(new Request(`http://127.0.0.1:3000/api/admin/reports${consulta}`))

beforeEach(async () => {
  vi.stubEnv("PLANEJAMENTO_AUTH", "google")
  vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")
  vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "boomer.com.br")
  raizTemp = await mkdtemp(path.join(tmpdir(), "planejamento com espaço-"))
  const armazem = new MemoriaArmazem()
  const mesa = new Mesa({ pastaClientes: path.join(raizTemp, "clientes"), armazem, esperar: async () => {} })
  const armazenamento = new NuvemArmazenamento({ raiz: RAIZ_DO_PROJETO, repositorio: new MemoriaRepositorio(), armazem, mesa, atrasoAgendamentoMs: 0 })
  servico = montarServico(armazenamento)
  mundo.servidor = { raiz: RAIZ_DO_PROJETO, catalogo, servico, armazenamento, usuarios: new MemoriaUsuarios([CHEFE]) }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raizTemp, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

describe("sem sessão", () => {
  it("envio e listagem dão 401", async () => {
    entrarComo(null)
    expect((await enviar(formulario(dadosValidos, PNG))).status).toBe(401)
    expect((await listarPor()).status).toBe(401)
  })
})

describe("POST /api/reports", () => {
  it("usuário comum envia com print e extra; o autor vem da sessão", async () => {
    entrarComo(ANA)
    const r = await enviar(formulario(dadosValidos, PNG, [JPG]))
    expect(r.status).toBe(201)
    const { id } = (await r.json()) as { id: number }
    const [report] = await servico.listarReports()
    expect(report).toMatchObject({ id, autor: ANA, imagens: [`${id}/0.png`, `${id}/1.jpg`] })
  })

  it("recusa formato estranho, extras demais e dados inválidos", async () => {
    entrarComo(ANA)
    const gif = await enviar(formulario(dadosValidos, null, [GIF]))
    expect(gif.status).toBe(400)
    expect(await gif.json()).toMatchObject({ erro: "Imagem em formato não aceito. Use PNG ou JPEG." })
    expect((await enviar(formulario(dadosValidos, null, [PNG, PNG, PNG, PNG]))).status).toBe(400)
    const quebrado = await enviar(formulario("{", null))
    expect(quebrado.status).toBe(400)
    expect(await quebrado.json()).toMatchObject({ erro: "Dados do report inválidos." })
    expect(await servico.listarReports()).toEqual([])
  })

  it("com os dados em disco diz que só existe na nuvem", async () => {
    const armazenamento = new FsArmazenamento(raizTemp)
    mundo.servidor = { raiz: RAIZ_DO_PROJETO, catalogo, servico: montarServico(armazenamento), armazenamento, usuarios: new MemoriaUsuarios([CHEFE]) }
    entrarComo(ANA)
    const r = await enviar(formulario(dadosValidos, null))
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ erro: MSG_REPORTS_SEM_NUVEM })
  })
})

describe("rotas do admin", () => {
  it("usuário comum recebe 403 em listar, atualizar e ver imagem", async () => {
    const report = await servico.criarReport(dadosValidos, ANA, PNG, [])
    entrarComo(ANA)
    for (const r of [
      await listarPor(),
      await atualizar(pedidoJson("PATCH", { status: "resolvido" }), ctxId(String(report.id))),
      await imagem(new Request("http://127.0.0.1:3000/api/x"), ctxImagem(String(report.id), "0")),
    ]) {
      expect(r.status).toBe(403)
    }
  })

  it("admin lista com filtro, atualiza e lê a imagem", async () => {
    const report = await servico.criarReport(dadosValidos, ANA, PNG, [])
    const outro = await servico.criarReport({ ...dadosValidos, tipo: "melhoria" }, ANA, null, [])
    entrarComo(CHEFE)

    const lista = (await (await listarPor("?status=aberto,inventado&tipo=bug")).json()) as { reports: Report[] }
    expect(lista.reports.map((r) => r.id)).toEqual([report.id])
    const todos = (await (await listarPor()).json()) as { reports: Report[] }
    expect(todos.reports.map((r) => r.id)).toEqual([outro.id, report.id])

    const r = await atualizar(pedidoJson("PATCH", { status: "resolvido" }), ctxId(String(report.id)))
    expect(r.status).toBe(200)
    expect(((await r.json()) as { report: Report }).report).toMatchObject({ status: "resolvido", atualizadoPor: CHEFE })

    const img = await imagem(new Request("http://127.0.0.1:3000/api/x"), ctxImagem(String(report.id), "0"))
    expect(img.status).toBe(200)
    expect(img.headers.get("content-type")).toBe("image/png")
    expect(img.headers.get("cache-control")).toBe("private, max-age=3600")
    expect(new Uint8Array(await img.arrayBuffer())).toEqual(PNG)

    expect((await imagem(new Request("http://127.0.0.1:3000/api/x"), ctxImagem(String(report.id), "9"))).status).toBe(404)
    const semId = await atualizar(pedidoJson("PATCH", { status: "resolvido" }), ctxId("abc"))
    expect(semId.status).toBe(404)
    expect(await semId.json()).toMatchObject({ erro: "Report não encontrado." })
  })
})
