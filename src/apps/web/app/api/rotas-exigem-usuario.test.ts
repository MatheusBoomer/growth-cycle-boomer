import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErroNaoAutenticado } from "@workspace/core/erros"

const exigirUsuario = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sessao", () => ({ exigirUsuario }))

const servico = vi.hoisted(() => ({
  listarProspects: vi.fn(),
  criarProspect: vi.fn(),
  aprovarEntregavel: vi.fn(),
  receberInsumoLink: vi.fn(),
}))
const turnos = vi.hoisted(() => ({ enviarMensagem: vi.fn(), enviarMensagemComAjustes: vi.fn() }))
const comentarios = vi.hoisted(() => ({ criar: vi.fn(), enviar: vi.fn() }))
vi.mock("@/lib/servidor", () => ({ servidor: () => ({ servico, turnos, comentarios }) }))

const { GET: listarProspects, POST: criarProspect } = await import("./prospects/route")
const { POST: enviarMensagem } = await import("./prospects/[slug]/etapas/[etapa]/mensagens/route")
const { POST: decidirEntregavel } = await import("./prospects/[slug]/entregaveis/[id]/route")
const { POST: enviarInsumo } = await import("./prospects/[slug]/etapas/[etapa]/insumos/[insumoId]/route")
const { POST: criarComentario } = await import("./prospects/[slug]/entregaveis/[id]/comentarios/route")
const { POST: enviarComentarios } = await import("./prospects/[slug]/entregaveis/[id]/comentarios/enviar/route")

// ---------------------------------------------------------------------------------------------------------------
// Varredura: toda rota de dados autentica por conta própria (defesa em profundidade além do proxy).
// ---------------------------------------------------------------------------------------------------------------

const PASTA_API = import.meta.dirname

/**
 * Rotas que NÃO chamam `exigirUsuario`, por caminho relativo a `app/api`. Cada entrada precisa continuar existindo
 * (o teste abaixo falha se uma sumir), para a lista não apodrecer.
 *   - `interno/ferramentas/route.ts`: protegida pelo token do turno (`ServicoTurnos.contextoDoToken`), chamada só pelo servidor MCP.
 *   - `dev/**`: ferramenta de comentários do modo dev, só responde em `next dev` (404 em produção).
 */
const ISENTAS = [
  "interno/ferramentas/route.ts",
  "dev/comentarios/route.ts",
  "dev/comentarios/[id]/route.ts",
  "dev/comentarios/[id]/imagem/route.ts",
] as const

const METODOS = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS"
const MARCAS_DE_TRABALHO = ["await ctx.params", "lerJson(", "servidor(", "req.json(", "req.formData(", "req.headers", "req.signal", "req.url", "req.nextUrl"]

function listarRotas(pasta: string, base = pasta): string[] {
  const achados: string[] = []
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    const cheio = path.join(pasta, e.name)
    if (e.isDirectory()) achados.push(...listarRotas(cheio, base))
    else if (e.name === "route.ts") achados.push(path.relative(base, cheio).split(path.sep).join("/"))
  }
  return achados.sort()
}

/**
 * Motivos pelos quais o fonte de uma rota não passa: sem o import, sem handler reconhecível, ou algum handler que não
 * chama `await exigirUsuario()` ou que o chama depois de ler parâmetros, corpo ou do `servidor()`. Lista vazia = ok.
 */
export function problemasDeRota(fonte: string): string[] {
  const problemas: string[] = []
  if (!/import\s*\{[^}]*\bexigirUsuario\b[^}]*\}\s*from\s*"@\/lib\/sessao"/.test(fonte)) problemas.push("não importa exigirUsuario de @/lib/sessao")
  if (new RegExp(`export\\s+(const|let|var)\\s+(${METODOS})\\b|export\\s*\\{`).test(fonte)) problemas.push("handler declarado de um jeito que a varredura não entende")
  const inicios = [...fonte.matchAll(new RegExp(`export\\s+(?:async\\s+)?function\\s+(${METODOS})\\b`, "g"))]
  if (inicios.length === 0) problemas.push("nenhum handler HTTP encontrado")
  inicios.forEach((m, i) => {
    const corpo = fonte.slice(m.index, inicios[i + 1]?.index ?? fonte.length)
    const nome = m[1]
    const chamada = corpo.indexOf("await exigirUsuario()")
    if (chamada === -1) {
      problemas.push(`${nome}: não chama await exigirUsuario()`)
      return
    }
    const abertura = corpo.indexOf("{", corpo.indexOf(")", corpo.indexOf("(")))
    const antes = corpo.slice(abertura, chamada)
    const trabalho = MARCAS_DE_TRABALHO.find((t) => antes.includes(t))
    if (trabalho) problemas.push(`${nome}: chama exigirUsuario depois de ${trabalho}`)
    if (!antes.includes("try")) problemas.push(`${nome}: exigirUsuario fora do try (respostaDeErro não converteria o 401)`)
  })
  return problemas
}

describe("varredura de app/api: toda rota exige usuário", () => {
  const rotas = listarRotas(PASTA_API)

  it("encontra as rotas (a varredura não é vazia)", () => {
    expect(rotas.length).toBeGreaterThan(20)
  })

  it("cada entrada da lista de isentas ainda existe", () => {
    const sumidas = ISENTAS.filter((i) => !rotas.includes(i))
    expect(sumidas, `isentas que não existem mais: ${sumidas.join(", ")}`).toEqual([])
  })

  it("toda dev/** existente está na lista de isentas (nenhuma rota nova escapa por ficar em dev)", () => {
    const naoDeclaradas = rotas.filter((r) => r.startsWith("dev/") && !(ISENTAS as readonly string[]).includes(r))
    expect(naoDeclaradas).toEqual([])
  })

  it("nenhuma rota fora da lista de isentas esquece exigirUsuario", () => {
    const ofensoras = rotas
      .filter((r) => !(ISENTAS as readonly string[]).includes(r))
      .flatMap((r) => problemasDeRota(readFileSync(path.join(PASTA_API, r), "utf-8")).map((p) => `${r}: ${p}`))
    expect(ofensoras, `rotas sem exigirUsuario:\n${ofensoras.join("\n")}`).toEqual([])
  })

  it("as isentas não chamam exigirUsuario (a lista não esconde rota que já autentica)", () => {
    const chamam = ISENTAS.filter((r) => readFileSync(path.join(PASTA_API, r), "utf-8").includes("exigirUsuario"))
    expect(chamam).toEqual([])
  })
})

describe("problemasDeRota (a varredura pega ofensoras de verdade)", () => {
  const cabecalho = `import { exigirUsuario } from "@/lib/sessao"\nimport { json, respostaDeErro } from "@/lib/http"\n`
  const handler = (corpo: string) => `${cabecalho}export async function GET(_req: Request, ctx: Ctx) {\n  try {\n${corpo}\n  } catch (e) {\n    return respostaDeErro(e)\n  }\n}\n`

  it("aceita a forma correta", () => {
    expect(problemasDeRota(handler("    await exigirUsuario()\n    const { slug } = await ctx.params\n    return json({ slug })"))).toEqual([])
  })

  it("pega rota sem a chamada", () => {
    expect(problemasDeRota(handler("    const { slug } = await ctx.params\n    return json({ slug })"))).toEqual(["GET: não chama await exigirUsuario()"])
  })

  it("pega rota sem o import", () => {
    const fonte = handler("    await exigirUsuario()\n    return json({})").replace(cabecalho.split("\n")[0] ?? "", "")
    expect(problemasDeRota(fonte)).toContain("não importa exigirUsuario de @/lib/sessao")
  })

  it("pega a chamada depois de ler parâmetros ou corpo", () => {
    expect(problemasDeRota(handler("    const { slug } = await ctx.params\n    await exigirUsuario()\n    return json({ slug })"))).toEqual([
      "GET: chama exigirUsuario depois de await ctx.params",
    ])
  })

  it("pega a chamada fora do try", () => {
    const fonte = `${cabecalho}export async function GET() {\n  await exigirUsuario()\n  try {\n    return json({})\n  } catch (e) {\n    return respostaDeErro(e)\n  }\n}\n`
    expect(problemasDeRota(fonte)).toEqual(["GET: exigirUsuario fora do try (respostaDeErro não converteria o 401)"])
  })

  it("cobra cada handler do arquivo, não só o primeiro", () => {
    const fonte = `${handler("    await exigirUsuario()\n    return json({})")}\nexport async function PATCH() {\n  try {\n    return json({})\n  } catch (e) {\n    return respostaDeErro(e)\n  }\n}\n`
    expect(problemasDeRota(fonte)).toEqual(["PATCH: não chama await exigirUsuario()"])
  })

  it("não aceita handler que a varredura não consegue ler", () => {
    expect(problemasDeRota(`${cabecalho}export const GET = async () => json({})\n`)).toContain("handler declarado de um jeito que a varredura não entende")
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Amostras: sem sessão, 401 e o serviço nem é tocado; com sessão, o e-mail vai como autor.
// ---------------------------------------------------------------------------------------------------------------

const EMAIL = "ana@boomer.com.br"
const requisicao = (corpo?: unknown, metodo = "POST") =>
  new Request("http://127.0.0.1:3000/api/x", { method: metodo, headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })

beforeEach(() => {
  exigirUsuario.mockReset()
  for (const m of [...Object.values(servico), ...Object.values(turnos), ...Object.values(comentarios)]) m.mockReset()
})

function semSessao() {
  exigirUsuario.mockRejectedValue(new ErroNaoAutenticado())
}
function comSessao(email: string | null = EMAIL) {
  exigirUsuario.mockResolvedValue({ email })
}
async function esperar401(r: Response) {
  expect(r.status).toBe(401)
  expect(await r.json()).toMatchObject({ codigo: "nao_autenticado", erro: "Você precisa entrar para continuar." })
}
function nenhumServicoChamado() {
  for (const m of [...Object.values(servico), ...Object.values(turnos), ...Object.values(comentarios)]) expect(m).not.toHaveBeenCalled()
}

describe("GET /api/prospects", () => {
  it("sem sessão responde 401 e não lista", async () => {
    semSessao()
    await esperar401(await listarProspects())
    nenhumServicoChamado()
  })

  it("com sessão lista", async () => {
    comSessao()
    servico.listarProspects.mockResolvedValue([])
    expect((await listarProspects()).status).toBe(200)
    expect(servico.listarProspects).toHaveBeenCalledOnce()
  })
})

describe("POST /api/prospects", () => {
  it("sem sessão responde 401 e não cria", async () => {
    semSessao()
    await esperar401(await criarProspect(requisicao({ nome: "Acme", site: "" })))
    nenhumServicoChamado()
  })

  it("com sessão cria com o e-mail como autor", async () => {
    comSessao()
    servico.criarProspect.mockResolvedValue("acme")
    const r = await criarProspect(requisicao({ nome: "Acme", site: " https://acme.com " }))
    expect(r.status).toBe(201)
    expect(servico.criarProspect).toHaveBeenCalledWith("Acme", "https://acme.com", EMAIL)
  })

  it("no modo off (e-mail nulo) o autor segue nulo", async () => {
    comSessao(null)
    servico.criarProspect.mockResolvedValue("acme")
    await criarProspect(requisicao({ nome: "Acme" }))
    expect(servico.criarProspect).toHaveBeenCalledWith("Acme", null, null)
  })
})

describe("POST .../etapas/[etapa]/mensagens", () => {
  const ctx = params({ slug: "acme", etapa: "03" })

  it("sem sessão responde 401 e não manda ao agente", async () => {
    semSessao()
    await esperar401(await enviarMensagem(requisicao({ texto: "oi" }), ctx))
    nenhumServicoChamado()
  })

  it("com sessão manda a mensagem com o e-mail como autor", async () => {
    comSessao()
    const r = await enviarMensagem(requisicao({ texto: " oi " }), ctx)
    expect(r.status).toBe(202)
    expect(turnos.enviarMensagem).toHaveBeenCalledWith("acme", "03", "oi", EMAIL)
  })
})

describe("POST .../entregaveis/[id] (aprovar)", () => {
  const ctx = params({ slug: "acme", id: "e1" })

  it("sem sessão responde 401 e não aprova", async () => {
    semSessao()
    await esperar401(await decidirEntregavel(requisicao({ acao: "aprovar" }), ctx))
    nenhumServicoChamado()
  })

  it("com sessão aprova com o e-mail como autor", async () => {
    comSessao()
    expect((await decidirEntregavel(requisicao({ acao: "aprovar" }), ctx)).status).toBe(200)
    expect(servico.aprovarEntregavel).toHaveBeenCalledWith("acme", "e1", EMAIL)
  })
})

describe("POST .../insumos/[insumoId] (link)", () => {
  const ctx = params({ slug: "acme", etapa: "03", insumoId: "site" })

  it("sem sessão responde 401 e não recebe o insumo", async () => {
    semSessao()
    await esperar401(await enviarInsumo(requisicao({ url: "https://acme.com" }), ctx))
    nenhumServicoChamado()
  })

  it("com sessão recebe o link com o e-mail como autor", async () => {
    comSessao()
    servico.receberInsumoLink.mockResolvedValue({ ok: true })
    await enviarInsumo(requisicao({ url: "https://acme.com" }), ctx)
    expect(servico.receberInsumoLink).toHaveBeenCalledWith("acme", "03", "site", "https://acme.com", EMAIL)
  })
})

describe("comentários", () => {
  const ctx = params({ slug: "acme", id: "e1" })

  it("criar: sem sessão 401; com sessão passa o autor", async () => {
    semSessao()
    await esperar401(await criarComentario(requisicao({ slide: 1, texto: "x" }), ctx))
    nenhumServicoChamado()
    comSessao()
    comentarios.criar.mockResolvedValue({ id: "c1" })
    expect((await criarComentario(requisicao({ slide: 1, texto: "x" }), ctx)).status).toBe(201)
    expect(comentarios.criar).toHaveBeenCalledWith("acme", "e1", { slide: 1, regiao: null, texto: "x" }, EMAIL)
  })

  it("enviar: sem sessão 401; com sessão passa o autor", async () => {
    semSessao()
    await esperar401(await enviarComentarios(requisicao(), ctx))
    nenhumServicoChamado()
    comSessao()
    comentarios.enviar.mockResolvedValue(2)
    await enviarComentarios(requisicao(), ctx)
    expect(comentarios.enviar).toHaveBeenCalledWith("acme", "e1", EMAIL)
  })
})
