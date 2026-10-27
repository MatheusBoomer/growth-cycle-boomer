import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErroNaoAutenticado } from "@workspace/core/erros"
import { problemasDePagina, problemasDeRota } from "./varredura-rotas"

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

const PASTA_APP = path.resolve(import.meta.dirname, "..")

/**
 * Rotas que NÃO chamam `exigirUsuario`, por caminho relativo a `app`. Cada entrada precisa continuar existindo
 * (o teste abaixo falha se uma sumir), para a lista não apodrecer.
 *   - `api/interno/ferramentas/route.ts`: protegida pelo token do turno (`ServicoTurnos.contextoDoToken`), chamada só pelo servidor MCP.
 *   - `api/dev/**`: ferramenta de comentários do modo dev, só responde em `next dev` (404 em produção).
 *   - `auth/**`: o próprio fluxo de login (entrar, callback, sair), que existe para quem ainda não tem sessão.
 */
const ISENTAS = [
  "api/interno/ferramentas/route.ts",
  "api/dev/comentarios/route.ts",
  "api/dev/comentarios/[id]/route.ts",
  "api/dev/comentarios/[id]/imagem/route.ts",
  "auth/entrar/route.ts",
  "auth/callback/route.ts",
  "auth/sair/route.ts",
] as const

/** Exceções declaradas à regra "página ou layout que chama servidor() checa a sessão antes". Nenhuma hoje. */
const PAGINAS_ISENTAS: readonly string[] = []

function listar(pasta: string, nomes: readonly string[], base = pasta): string[] {
  const achados: string[] = []
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    const cheio = path.join(pasta, e.name)
    if (e.isDirectory()) achados.push(...listar(cheio, nomes, base))
    else if (nomes.includes(e.name)) achados.push(path.relative(base, cheio).split(path.sep).join("/"))
  }
  return achados.sort()
}

const ehIsenta = (r: string) => (ISENTAS as readonly string[]).includes(r)
const ler = (r: string) => readFileSync(path.join(PASTA_APP, r), "utf-8")

describe("varredura de app: toda rota exige usuário", () => {
  const rotas = listar(PASTA_APP, ["route.ts"])

  it("encontra as rotas (a varredura não é vazia)", () => {
    expect(rotas.length).toBeGreaterThan(20)
  })

  it("cada entrada da lista de isentas ainda existe", () => {
    const sumidas = ISENTAS.filter((i) => !rotas.includes(i))
    expect(sumidas, `isentas que não existem mais: ${sumidas.join(", ")}`).toEqual([])
  })

  it("toda rota de dev/** e de auth/** existente está declarada (nenhuma rota nova escapa por ficar lá)", () => {
    const naoDeclaradas = rotas.filter((r) => /^(api\/dev|auth)\//.test(r) && !ehIsenta(r))
    expect(naoDeclaradas).toEqual([])
  })

  it("nenhuma rota fora da lista de isentas esquece exigirUsuario", () => {
    const ofensoras = rotas.filter((r) => !ehIsenta(r)).flatMap((r) => problemasDeRota(ler(r)).map((p) => `${r}: ${p}`))
    expect(ofensoras, `rotas sem exigirUsuario:\n${ofensoras.join("\n")}`).toEqual([])
  })

  it("as isentas não chamam exigirUsuario (a lista não esconde rota que já autentica)", () => {
    expect(ISENTAS.filter((r) => ler(r).includes("exigirUsuario"))).toEqual([])
  })
})

describe("varredura de app: páginas e layouts que leem dados checam a sessão antes", () => {
  const paginas = listar(PASTA_APP, ["page.tsx", "layout.tsx"])

  it("encontra as páginas", () => {
    expect(paginas.length).toBeGreaterThanOrEqual(3)
  })

  it("cada exceção declarada ainda existe", () => {
    expect(PAGINAS_ISENTAS.filter((p) => !paginas.includes(p))).toEqual([])
  })

  it("nenhuma chama servidor() sem checar a sessão antes", () => {
    const ofensoras = paginas.filter((p) => !PAGINAS_ISENTAS.includes(p)).flatMap((p) => problemasDePagina(ler(p)).map((m) => `${p}: ${m}`))
    expect(ofensoras, `páginas lendo dados sem sessão:\n${ofensoras.join("\n")}`).toEqual([])
  })
})

describe("problemasDePagina (sondas)", () => {
  it("aceita a sessão antes de servidor()", () => {
    expect(problemasDePagina('const u = await usuarioDaRequisicao()\nawait servidor().servico.x()')).toEqual([])
  })
  it("pega servidor() sem sessão, sessão depois, ou só em comentário", () => {
    expect(problemasDePagina("await servidor().servico.x()")).toHaveLength(1)
    expect(problemasDePagina("await servidor().x()\nawait usuarioDaRequisicao()")).toHaveLength(1)
    expect(problemasDePagina("// usuarioDaRequisicao()\nawait servidor().x()")).toHaveLength(1)
  })
  it("página que não lê dados passa", () => {
    expect(problemasDePagina("export default function P() { return null }")).toEqual([])
  })
})

describe("problemasDeRota (sondas: a varredura pega ofensoras de verdade)", () => {
  const importe = `import { exigirUsuario } from "@/lib/sessao"\nimport { json, respostaDeErro } from "@/lib/http"\n`
  const arquivo = (corpo: string, verbo = "GET") => `${importe}export async function ${verbo}(_req: Request, ctx: Ctx) {\n${corpo}\n}\n`
  const padrao = (dentro: string) => `  try {\n${dentro}\n  } catch (e) {\n    return respostaDeErro(e)\n  }`

  it("aceita a forma correta, com e sem usuario", () => {
    expect(problemasDeRota(arquivo(padrao("    await exigirUsuario()\n    return json({})")))).toEqual([])
    expect(problemasDeRota(arquivo(padrao("    const usuario = await exigirUsuario()\n    return json(usuario)")))).toEqual([])
  })

  it("aceita a forma curta (SSE, sistema), com o resto fora do try", () => {
    const fonte = arquivo("  try {\n    await exigirUsuario()\n  } catch (e) {\n    return respostaDeErro(e)\n  }\n  const fluxo = new ReadableStream()\n  return new Response(fluxo)")
    expect(problemasDeRota(fonte)).toEqual([])
  })

  it("aceita try externo com try interno de arquivo ausente (modelos)", () => {
    const fonte = arquivo(padrao("    await exigirUsuario()\n    try {\n      return new Response()\n    } catch {\n      return json({}, 404)\n    }"))
    expect(problemasDeRota(fonte)).toEqual([])
  })

  it("aceita arquivo com vários verbos e handlers com helper depois", () => {
    const fonte = `${arquivo(padrao("    await exigirUsuario()\n    return json({})"))}\nexport async function PATCH() {\n${padrao("    await exigirUsuario()\n    return json({})")}\n}\n\nfunction ajuda() {\n  return 1\n}\n`
    expect(problemasDeRota(fonte)).toEqual([])
  })

  it("aceita relançar o erro no catch", () => {
    expect(problemasDeRota(arquivo("  try {\n    await exigirUsuario()\n  } catch (e) {\n    throw e\n  }\n  return json({})"))).toEqual([])
  })

  it("pega rota sem a chamada", () => {
    expect(problemasDeRota(arquivo(padrao("    return json({})")))).toHaveLength(1)
  })

  it("pega rota sem o import, ou com o import só em comentário", () => {
    expect(problemasDeRota(arquivo(padrao("    await exigirUsuario()")).replace(importe.split("\n")[0]!, ""))).toContain("não importa exigirUsuario de @/lib/sessao")
    const comentado = arquivo(padrao("    await exigirUsuario()")).replace(importe.split("\n")[0]!, '// import { exigirUsuario } from "@/lib/sessao"')
    expect(problemasDeRota(comentado)).toContain("não importa exigirUsuario de @/lib/sessao")
  })

  it("pega a chamada depois de ler parâmetros ou corpo", () => {
    expect(problemasDeRota(arquivo(padrao("    const { slug } = await ctx.params\n    await exigirUsuario()")))).toHaveLength(1)
  })

  it("pega a chamada fora do try", () => {
    expect(problemasDeRota(arquivo("  await exigirUsuario()\n  try {\n    return json({})\n  } catch (e) {\n    return respostaDeErro(e)\n  }"))).toHaveLength(1)
  })

  it("cobra cada handler do arquivo, não só o primeiro", () => {
    const fonte = `${arquivo(padrao("    await exigirUsuario()"))}\nexport async function PATCH() {\n  try {\n    return json({})\n  } catch (e) {\n    return respostaDeErro(e)\n  }\n}\n`
    expect(problemasDeRota(fonte)).toEqual([expect.stringContaining("PATCH")])
  })

  it("não aceita handler que a varredura não consegue ler", () => {
    expect(problemasDeRota(`${importe}export const GET = async () => json({})\n`)).toContain("handler declarado de um jeito que a varredura não entende")
    expect(problemasDeRota(`${importe}export { GET } from "./outra"\n`)).toContain("handler declarado de um jeito que a varredura não entende")
  })

  // As seis formas que enganavam a primeira versão da varredura.
  it("sonda 1: chamada só em comentário", () => {
    expect(problemasDeRota(arquivo(padrao("    // await exigirUsuario()\n    return json({})")))).toHaveLength(1)
    expect(problemasDeRota(arquivo(padrao("    /* await exigirUsuario() */\n    return json({})")))).toHaveLength(1)
  })

  it("sonda 1b: chamada só dentro de texto", () => {
    expect(problemasDeRota(arquivo(padrao('    const t = "await exigirUsuario()"\n    return json({ t })')))).toHaveLength(1)
    expect(problemasDeRota(arquivo(padrao("    const t = `await exigirUsuario() ${1}`\n    return json({ t })")))).toHaveLength(1)
  })

  it("sonda 2: ramo morto", () => {
    expect(problemasDeRota(arquivo(padrao("    if (false) await exigirUsuario()\n    return json({})")))).toHaveLength(1)
    expect(problemasDeRota(arquivo("  if (false) await exigirUsuario()\n  try {\n    return json({})\n  } catch (e) {\n    return respostaDeErro(e)\n  }"))).toHaveLength(1)
  })

  it("sonda 3: efeito colateral antes da chamada, fora de qualquer lista de nomes", () => {
    for (const antes of ['execFile("open", [])', "await readFile(x)", "await req.text()", "await req.arrayBuffer()", "const c = req.body", "armazenamento.limpar()", "new RegistroUso(r)", "algoNovo()"]) {
      expect(problemasDeRota(arquivo(padrao(`    ${antes}\n    await exigirUsuario()\n    return json({})`))), antes).toHaveLength(1)
    }
  })

  it("sonda 4: 'try' como pedaço de outro nome", () => {
    expect(problemasDeRota(arquivo("  const retry = 1\n  await exigirUsuario()\n  return json({ retry })"))).toHaveLength(1)
    expect(problemasDeRota(arquivo("  await exigirUsuario() // sem try\n  return json({})"))).toHaveLength(1)
  })

  it("sonda 5: catch vazio engole o erro e depois serve dados", () => {
    expect(problemasDeRota(arquivo("  try { await exigirUsuario() } catch {}\n  return json({ dados: 1 })"))).toHaveLength(1)
    expect(problemasDeRota(arquivo("  try { await exigirUsuario() } catch (e) {}\n  return json({ dados: 1 })"))).toHaveLength(1)
    expect(problemasDeRota(arquivo("  try { await exigirUsuario() } catch (e) { console.log(e) }\n  return json({ dados: 1 })"))).toHaveLength(1)
    expect(problemasDeRota(arquivo("  try { await exigirUsuario() } finally {}\n  return json({ dados: 1 })"))).toHaveLength(1)
    expect(problemasDeRota(arquivo("  try { await exigirUsuario() } catch (e) { return respostaDeErro(outro) }\n  return json({})"))).toHaveLength(1)
  })

  it("sonda 6: helper não exportado depois do handler não credita o handler anterior", () => {
    const fonte = `${importe}export async function GET() {\n  try {\n    return json({})\n  } catch (e) {\n    return respostaDeErro(e)\n  }\n}\n\nasync function ajuda() {\n  await exigirUsuario()\n}\n`
    expect(problemasDeRota(fonte)).toHaveLength(1)
  })

  it("exigirUsuario encadeado ou combinado não vale", () => {
    expect(problemasDeRota(arquivo(padrao("    await exigirUsuario().catch(() => null)\n    return json({})")))).toHaveLength(1)
    expect(problemasDeRota(arquivo(padrao("    await exigirUsuario() || null\n    return json({})")))).toHaveLength(1)
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
