import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DELETE, PATCH } from "./[id]/route"
import { GET, POST } from "./route"

const URL_BASE = "http://127.0.0.1:3000/api/dev/comentarios"
const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString("base64")
const valido = {
  pagina: "/prospects/acme",
  componente: "PainelEtapa",
  cadeia: ["PainelEtapa"],
  seletor: "main",
  tag: "main",
  texto: "",
  caixa: { x: 0, y: 0, largura: 10, altura: 10, larguraTela: 100, alturaTela: 100 },
  comentario: "Ajustar",
}

let raiz: string

beforeEach(async () => {
  raiz = await mkdtemp(path.join(os.tmpdir(), "modo-dev-rota-"))
  vi.stubEnv("PLANEJAMENTO_ROOT", raiz)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(raiz, { recursive: true, force: true })
})

const contexto = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (corpo: unknown) => POST(new Request(URL_BASE, { method: "POST", body: JSON.stringify(corpo) }))
const patch = (id: string, corpo: unknown) =>
  PATCH(new Request(`${URL_BASE}/${id}`, { method: "PATCH", body: JSON.stringify(corpo) }), contexto(id))
const apagar = (id: string) => DELETE(new Request(`${URL_BASE}/${id}`, { method: "DELETE" }), contexto(id))

describe("fora de desenvolvimento", () => {
  it("todas as rotas respondem 404 em produção", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const respostas = [await GET(new Request(URL_BASE)), await post(valido), await patch("x", { comentario: "a" }), await apagar("x")]
    for (const r of respostas) expect(r.status).toBe(404)
  })
})

describe("em desenvolvimento", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
  })

  it("cria com recorte, lista por página, edita e apaga", async () => {
    const criado = await post({ ...valido, png: PNG_BASE64 })
    expect(criado.status).toBe(201)
    const { comentario } = (await criado.json()) as { comentario: { id: string; numero: number; captura: string } }
    expect(comentario).toMatchObject({ numero: 1, captura: `capturas/${comentario.id}.png` })

    const daPagina = await (await GET(new Request(`${URL_BASE}?pagina=/prospects/acme`))).json()
    const deOutra = await (await GET(new Request(`${URL_BASE}?pagina=/outra`))).json()
    expect(daPagina.comentarios).toHaveLength(1)
    expect(deOutra.comentarios).toHaveLength(0)

    const editado = await patch(comentario.id, { comentario: "Novo" })
    expect(editado.status).toBe(200)
    expect((await editado.json()).comentario.comentario).toBe("Novo")

    expect((await apagar(comentario.id)).status).toBe(200)
    expect((await (await GET(new Request(URL_BASE))).json()).comentarios).toHaveLength(0)
  })

  it("comentário vazio responde 400 com a mensagem", async () => {
    const r = await post({ ...valido, comentario: "  " })
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({ erro: "O comentário está vazio.", codigo: "entrada_invalida" })
  })

  it("comentário acima de 2000 caracteres responde 400", async () => {
    expect((await post({ ...valido, comentario: "a".repeat(2001) })).status).toBe(400)
  })

  it("png que não é PNG ou de tipo errado responde 400", async () => {
    expect((await post({ ...valido, png: Buffer.from("nao e png").toString("base64") })).status).toBe(400)
    expect((await post({ ...valido, png: 123 })).status).toBe(400)
  })

  it("corpo que não é JSON responde 400", async () => {
    expect((await POST(new Request(URL_BASE, { method: "POST", body: "{" }))).status).toBe(400)
  })

  it("id inexistente responde 404 com mensagem", async () => {
    const r = await apagar("nada")
    expect(r.status).toBe(404)
    expect((await r.json()).erro).toContain("não encontrado")
  })
})
