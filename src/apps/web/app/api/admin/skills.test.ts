import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import type { ConteudoItem, ItemCatalogo } from "@workspace/core/catalogo-skills-tipos"
import { FsArmazenamento } from "@workspace/core/armazenamento"
import { NuvemArmazenamento } from "@workspace/core/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "@workspace/core/nuvem/memoria"
import { Mesa } from "@workspace/core/nuvem/mesa"
import { MemoriaUsuarios } from "@workspace/core/nuvem/usuarios"
import type { NotaSkill } from "@workspace/core/notas-skills"
import { ServicoPlanejamento } from "@workspace/core/servico-planejamento"

// Mesmo arranjo de modelos.test.ts: sessão real (exigirAdmin), Supabase Auth e cookies simulados, serviço real sobre o
// repositório em memória. A raiz é a do repositório de verdade, para o catálogo ler os arquivos reais das skills.
const getClaims = vi.hoisted(() => vi.fn())
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims } }) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }))

const mundo = vi.hoisted(() => ({ servidor: null as unknown }))
vi.mock("@/lib/servidor", () => ({ servidor: () => mundo.servidor }))

const { GET: listar } = await import("./skills/route")
const { GET: ler } = await import("./skills/[id]/route")
const { POST: criarNota } = await import("./skills/[id]/notas/route")
const { PATCH: marcarNota } = await import("./skills/notas/[notaId]/route")

const RAIZ_DO_PROJETO = path.resolve(import.meta.dirname, "../../../../../..")
const CHEFE = "chefe@boomer.com.br"
const ANA = "ana@boomer.com.br"
const MSG_SEM_NUVEM = "A administração de pessoas só existe com os dados na nuvem."

const catalogo = carregarCatalogo(RAIZ_DO_PROJETO)
let raizTemp: string
let servico: ServicoPlanejamento

function entrarComo(email: string) {
  getClaims.mockResolvedValue({ data: { claims: { email, app_metadata: { provider: "google", providers: ["google"] } } }, error: null })
}

const pedido = (metodo: string, corpo?: unknown) =>
  new Request("http://127.0.0.1:3000/api/x", {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof ler>[1]
const ctxIdNotas = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof criarNota>[1]
const ctxNota = (notaId: string) => ({ params: Promise.resolve({ notaId }) }) as Parameters<typeof marcarNota>[1]

function montarServico(armazenamento: NuvemArmazenamento | FsArmazenamento) {
  return new ServicoPlanejamento({
    armazenamento,
    catalogo,
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-11-07T10:00:00.000Z",
  })
}

beforeEach(async () => {
  vi.stubEnv("PLANEJAMENTO_AUTH", "google")
  vi.stubEnv("SUPABASE_URL", "https://projeto.supabase.co")
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_teste")
  vi.stubEnv("PLANEJAMENTO_DOMINIOS_PERMITIDOS", "boomer.com.br")

  raizTemp = await mkdtemp(path.join(tmpdir(), "planejamento com espaço-"))
  const armazem = new MemoriaArmazem()
  const mesa = new Mesa({ pastaClientes: path.join(raizTemp, "clientes"), armazem, esperar: async () => {} })
  const armazenamento = new NuvemArmazenamento({
    raiz: RAIZ_DO_PROJETO,
    repositorio: new MemoriaRepositorio(),
    armazem,
    mesa,
    atrasoAgendamentoMs: 0,
  })
  servico = montarServico(armazenamento)
  mundo.servidor = { raiz: RAIZ_DO_PROJETO, catalogo, servico, armazenamento, usuarios: new MemoriaUsuarios([CHEFE]) }
})

afterEach(async () => {
  vi.unstubAllEnvs()
  getClaims.mockReset()
  await rm(raizTemp, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
})

type ItemDaLista = ItemCatalogo & { notasAbertas: number }
const lista = async () => (await (await listar()).json()) as { itens: ItemDaLista[]; textoExportacao: string }

describe("usuário comum", () => {
  it("recebe 403 nas 4 rotas e nenhuma nota é gravada", async () => {
    entrarComo(ANA)
    const respostas = [
      await listar(),
      await ler(new Request("http://127.0.0.1:3000/api/x"), ctxId("etapa%3A03")),
      await criarNota(pedido("POST", { texto: "x" }), ctxIdNotas("etapa%3A03")),
      await marcarNota(pedido("PATCH", { resolvida: true }), ctxNota("1")),
    ]
    for (const r of respostas) {
      expect(r.status).toBe(403)
      expect(await r.json()).toMatchObject({ codigo: "sem_permissao" })
    }
    expect(await servico.notasDoItem("etapa:03")).toEqual([])
  })
})

describe("GET /api/admin/skills", () => {
  it("traz os 16 itens do catálogo com a contagem de notas abertas e o texto de exportação", async () => {
    await servico.criarNota("etapa:03", "primeira", CHEFE)
    await servico.criarNota("etapa:03", "segunda", CHEFE)
    const resolvida = await servico.criarNota("etapa:03", "já feita", CHEFE)
    await servico.marcarNota(resolvida.id, true, CHEFE)
    await servico.criarNota("visao-geral", "da visão geral", CHEFE)
    entrarComo(CHEFE)

    const r = await listar()
    expect(r.status).toBe(200)
    const { itens, textoExportacao } = (await r.json()) as { itens: ItemDaLista[]; textoExportacao: string }

    expect(itens).toHaveLength(16)
    expect(itens[0]).toMatchObject({ id: "visao-geral", grupo: "Processo", temFluxo: true, notasAbertas: 1 })
    expect(itens.find((i) => i.id === "etapa:03")?.notasAbertas).toBe(2)
    expect(itens.filter((i) => i.notasAbertas === 0)).toHaveLength(14)
    for (const i of itens) expect(Object.keys(i).sort()).toEqual(["grupo", "id", "notasAbertas", "resumo", "temFluxo", "titulo"])
    expect(textoExportacao).toContain("- primeira (")
    expect(textoExportacao).toContain("- segunda (")
    expect(textoExportacao).toContain("- da visão geral (")
    expect(textoExportacao).not.toContain("já feita")
  })

  it("sem notas, o texto de exportação é Nenhuma nota aberta.", async () => {
    entrarComo(CHEFE)
    expect((await lista()).textoExportacao).toBe("Nenhuma nota aberta.")
  })
})

describe("GET /api/admin/skills/[id]", () => {
  it("traz texto, fluxo e as notas do item (id codificado na URL)", async () => {
    await servico.criarNota("etapa:03", "ajustar o gráfico", CHEFE)
    entrarComo(CHEFE)

    const r = await ler(new Request("http://127.0.0.1:3000/api/x"), ctxId("etapa%3A03"))
    expect(r.status).toBe(200)
    const corpo = (await r.json()) as ConteudoItem & { notas: NotaSkill[] }
    expect(corpo).toMatchObject({ id: "etapa:03", grupo: "Etapas" })
    expect(corpo.texto).toContain("diagnostico-performance")
    expect(corpo.fluxo).toMatch(/^\s*flowchart TD/)
    expect(corpo.notas).toMatchObject([{ item: "etapa:03", texto: "ajustar o gráfico", autor: CHEFE, resolvidaEm: null }])
  })

  it("id fora do catálogo dá 404, inclusive caminho disfarçado e codificação inválida", async () => {
    entrarComo(CHEFE)
    for (const id of ["%2E%2E%2F.env", "etapa%3A99", "%E0%A4%A", ""]) {
      const r = await ler(new Request("http://127.0.0.1:3000/api/x"), ctxId(id))
      expect(r.status).toBe(404)
      expect(await r.json()).toMatchObject({ erro: "Item não encontrado." })
    }
  })
})

describe("POST /api/admin/skills/[id]/notas", () => {
  it("cria a nota com 201, o autor é o e-mail do admin e a contagem sobe", async () => {
    entrarComo(CHEFE)

    const r = await criarNota(pedido("POST", { texto: "  trocar o exemplo  " }), ctxIdNotas("etapa%3A03"))

    expect(r.status).toBe(201)
    const { nota } = (await r.json()) as { nota: NotaSkill }
    expect(nota).toMatchObject({ item: "etapa:03", texto: "trocar o exemplo", autor: CHEFE, resolvidaEm: null })
    expect((await lista()).itens.find((i) => i.id === "etapa:03")?.notasAbertas).toBe(1)
  })

  it("texto vazio, só espaços, ausente, que não é texto ou com 2001 caracteres dá 400", async () => {
    entrarComo(CHEFE)
    for (const corpo of [{ texto: "" }, { texto: "   " }, {}, { texto: 5 }, { texto: "a".repeat(2001) }]) {
      const r = await criarNota(pedido("POST", corpo), ctxIdNotas("etapa%3A03"))
      expect(r.status).toBe(400)
    }
    expect(await servico.notasDoItem("etapa:03")).toEqual([])
    expect((await criarNota(pedido("POST", { texto: "a".repeat(2000) }), ctxIdNotas("etapa%3A03"))).status).toBe(201)
  })

  it("corpo que não é JSON dá 400", async () => {
    entrarComo(CHEFE)
    const r = await criarNota(new Request("http://127.0.0.1:3000/api/x", { method: "POST", body: "{" }), ctxIdNotas("etapa%3A03"))
    expect(r.status).toBe(400)
  })

  it("item fora do catálogo dá 404 e nada é gravado", async () => {
    entrarComo(CHEFE)
    for (const id of ["etapa%3A99", "%2E%2E%2F.env", "%E0%A4%A"]) {
      const r = await criarNota(pedido("POST", { texto: "x" }), ctxIdNotas(id))
      expect(r.status).toBe(404)
      expect(await r.json()).toMatchObject({ erro: "Item não encontrado." })
    }
  })
})

describe("PATCH /api/admin/skills/notas/[notaId]", () => {
  it("resolve e reabre a nota, registrando quem resolveu", async () => {
    const criada = await servico.criarNota("regra:padrao-visual", "revisar as cores", CHEFE)
    entrarComo(CHEFE)

    const resolvida = await marcarNota(pedido("PATCH", { resolvida: true }), ctxNota(String(criada.id)))
    expect(resolvida.status).toBe(200)
    const { nota } = (await resolvida.json()) as { nota: NotaSkill }
    expect(nota).toMatchObject({ id: criada.id, resolvidaPor: CHEFE })
    expect(nota.resolvidaEm).not.toBeNull()
    expect((await lista()).itens.find((i) => i.id === "regra:padrao-visual")?.notasAbertas).toBe(0)

    const reaberta = await marcarNota(pedido("PATCH", { resolvida: false }), ctxNota(String(criada.id)))
    expect(reaberta.status).toBe(200)
    expect(((await reaberta.json()) as { nota: NotaSkill }).nota).toMatchObject({ resolvidaEm: null, resolvidaPor: null })
    expect((await lista()).itens.find((i) => i.id === "regra:padrao-visual")?.notasAbertas).toBe(1)
  })

  it("nota inexistente, ou notaId que não é inteiro positivo, dá 404", async () => {
    entrarComo(CHEFE)
    for (const id of ["999", "0", "-1", "1.5", "abc", "", "1e3", "99999999999999999999"]) {
      const r = await marcarNota(pedido("PATCH", { resolvida: true }), ctxNota(id))
      expect(r.status).toBe(404)
    }
  })

  it("resolvida que não é booleano dá 400", async () => {
    const criada = await servico.criarNota("etapa:01", "x", CHEFE)
    entrarComo(CHEFE)
    for (const corpo of [{}, { resolvida: "sim" }, { resolvida: null }]) {
      const r = await marcarNota(pedido("PATCH", corpo), ctxNota(String(criada.id)))
      expect(r.status).toBe(400)
    }
  })
})

describe("sem repositório de usuários (modo fs)", () => {
  beforeEach(() => {
    const armazenamento = new FsArmazenamento(RAIZ_DO_PROJETO)
    mundo.servidor = { raiz: RAIZ_DO_PROJETO, catalogo, servico: montarServico(armazenamento), armazenamento, usuarios: null }
  })

  it("as rotas de notas respondem 400 com a mensagem da nuvem", async () => {
    entrarComo(CHEFE)
    for (const r of [
      await criarNota(pedido("POST", { texto: "x" }), ctxIdNotas("etapa%3A03")),
      await marcarNota(pedido("PATCH", { resolvida: true }), ctxNota("1")),
    ]) {
      expect(r.status).toBe(400)
      expect(await r.json()).toMatchObject({ erro: MSG_SEM_NUVEM })
    }
  })

  it("as rotas de leitura continuam em 200, sem notas", async () => {
    entrarComo(CHEFE)

    const l = await listar()
    expect(l.status).toBe(200)
    const corpo = (await l.json()) as { itens: ItemDaLista[]; textoExportacao: string }
    expect(corpo.itens).toHaveLength(16)
    expect(corpo.itens.every((i) => i.notasAbertas === 0)).toBe(true)
    expect(corpo.textoExportacao).toBe("Nenhuma nota aberta.")

    const d = await ler(new Request("http://127.0.0.1:3000/api/x"), ctxId("etapa%3A03"))
    expect(d.status).toBe(200)
    expect(await d.json()).toMatchObject({ id: "etapa:03", notas: [] })
  })
})
