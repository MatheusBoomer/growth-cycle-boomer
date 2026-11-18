import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import type { Previa } from "../src/previa"
import { ServicoComentarios } from "../src/servico-comentarios"
import type { Entregavel, Estado } from "../src/tipos"
import { raizTemporaria } from "./ajuda"

const SLUG = "teste-apresentacao"
let raiz: string
let arm: FsArmazenamento
let ajustes: { id: string; texto: string; autor?: string | null }[]
let geradas: number
let geradasPlanilha: string[]
let geradosDocumento: string[]
let entregaveis: Entregavel[]
let previaFalha: string | null

const entregavel = (over: Partial<Entregavel> = {}): Entregavel => ({
  id: "e1",
  etapa: "final",
  tipo: "apresentacao",
  titulo: "Apresentação final",
  arquivoRascunho: ".app/propostas/e1.pptx",
  nomeFinal: "apresentacao-final",
  status: "pendente",
  ajustePedido: null,
  criadoEm: "2026-10-08T10:00:00.000Z",
  decididoEm: null,
  ...over,
})

const previaFalsa: Previa = {
  async gerar(_pptx, pasta) {
    if (previaFalha) return { erro: previaFalha }
    geradas++
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "slide-01.png"), "png")
    await writeFile(path.join(pasta, "slide-02.png"), "png")
    await writeFile(
      path.join(pasta, "mapa.json"),
      JSON.stringify({ slides: [{ numero: 1, titulo: "Capa", campos: {} }, { numero: 2, titulo: "Cenário Atual · ROAS", campos: { conclusoes: { x: 69, y: 37, w: 29, h: 37 } } }] }),
    )
    return { slides: 2 }
  },
  async gerarPlanilha(xlsx, pasta) {
    if (previaFalha) return { erro: previaFalha }
    geradasPlanilha.push(xlsx)
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "planilha.html"), "<html>2 abas</html>")
    return { abas: 2 }
  },
  async gerarDocumento(docx, pasta) {
    if (previaFalha) return { erro: previaFalha }
    geradosDocumento.push(docx)
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "documento.pdf"), "%PDF")
    return { pdf: "documento.pdf" }
  },
  async recortar(_slide, _r, saida) {
    await mkdir(path.dirname(saida), { recursive: true })
    await writeFile(saida, "recorte")
  },
}

function servico() {
  let n = 0
  return new ServicoComentarios({
    armazenamento: arm,
    planejamento: {
      estado: async () => ({ entregaveis }) as unknown as Estado,
      pedirAjuste: async (_slug, id, texto, _imagem, autor) => {
        ajustes.push({ id, texto, autor })
      },
    },
    previa: previaFalsa,
    agora: () => "2026-10-08T12:00:00.000Z",
    gerarId: () => `c${++n}`,
  })
}

beforeEach(async () => {
  raiz = await raizTemporaria()
  arm = new FsArmazenamento(raiz, async () => {})
  await mkdir(path.join(raiz, "clientes", SLUG, ".app/propostas"), { recursive: true })
  await writeFile(path.join(raiz, "clientes", SLUG, ".app/propostas/e1.pptx"), "pptx")
  ajustes = []
  geradas = 0
  geradasPlanilha = []
  geradosDocumento = []
  previaFalha = null
  entregaveis = [entregavel()]
})

describe("prévia da apresentação", () => {
  it("gera uma vez por versão e devolve slides e mapa", async () => {
    const s = servico()
    const p1 = await s.previa(SLUG, "e1")
    const p2 = await s.previa(SLUG, "e1")
    expect(geradas).toBe(1)
    expect(p1).toEqual(p2)
    expect(p1.disponivel).toBe(true)
    expect(p1.slides).toEqual([".app/previas/e1/slide-01.png", ".app/previas/e1/slide-02.png"])
    expect(p1.mapa?.slides[1]?.titulo).toBe("Cenário Atual · ROAS")
  })

  it("aberturas simultâneas geram a prévia uma vez só", async () => {
    const s = servico()
    const [a, b] = await Promise.all([s.previa(SLUG, "e1"), s.previa(SLUG, "e1")])
    expect(geradas).toBe(1)
    expect(a).toEqual(b)
  })

  it("sem LibreOffice responde indisponível com a mensagem", async () => {
    previaFalha = "LibreOffice não encontrado."
    const p = await servico().previa(SLUG, "e1")
    expect(p).toEqual({ disponivel: false, slides: [], mapa: null, erro: "LibreOffice não encontrado." })
  })

  it("só para entregáveis do tipo apresentação", async () => {
    entregaveis = [entregavel({ tipo: "html", arquivoRascunho: ".app/propostas/e1.html" })]
    await expect(servico().previa(SLUG, "e1")).rejects.toThrow("apresentação")
  })
})

describe("prévia da planilha", () => {
  const planilha = () => entregavel({ tipo: "planilha", titulo: "Projeção de cenários", arquivoRascunho: ".app/propostas/e1.xlsx" })

  it("gera uma vez por versão, a partir do .xlsx, e devolve o caminho da página", async () => {
    entregaveis = [planilha()]
    const s = servico()
    const p1 = await s.previaPlanilha(SLUG, "e1")
    const p2 = await s.previaPlanilha(SLUG, "e1")
    expect(p1).toEqual({ disponivel: true, caminho: ".app/previas/e1/planilha.html", erro: null })
    expect(p2).toEqual(p1)
    expect(geradasPlanilha).toEqual([path.join(raiz, "clientes", SLUG, ".app/propostas/e1.xlsx")])
  })

  it("aberturas simultâneas geram a prévia uma vez só", async () => {
    entregaveis = [planilha()]
    const s = servico()
    await Promise.all([s.previaPlanilha(SLUG, "e1"), s.previaPlanilha(SLUG, "e1")])
    expect(geradasPlanilha).toHaveLength(1)
  })

  it("vale também depois de aprovada", async () => {
    entregaveis = [{ ...planilha(), status: "aprovado" }]
    expect((await servico().previaPlanilha(SLUG, "e1")).disponivel).toBe(true)
  })

  it("sem LibreOffice responde indisponível com a mensagem e tenta de novo na próxima abertura", async () => {
    entregaveis = [planilha()]
    previaFalha = "LibreOffice não encontrado."
    const s = servico()
    expect(await s.previaPlanilha(SLUG, "e1")).toEqual({ disponivel: false, caminho: null, erro: "LibreOffice não encontrado." })
    previaFalha = null
    expect((await s.previaPlanilha(SLUG, "e1")).disponivel).toBe(true)
  })

  it("só para entregáveis do tipo planilha", async () => {
    await expect(servico().previaPlanilha(SLUG, "e1")).rejects.toThrow("planilha")
  })
})

describe("prévia do documento", () => {
  const documento = () => entregavel({ tipo: "documento", titulo: "Plano de ação", arquivoRascunho: ".app/propostas/e1.docx" })

  it("gera o PDF uma vez por versão, a partir do .docx, e devolve o caminho", async () => {
    entregaveis = [documento()]
    const s = servico()
    const p1 = await s.previaDocumento(SLUG, "e1")
    const p2 = await s.previaDocumento(SLUG, "e1")
    expect(p1).toEqual({ disponivel: true, caminho: ".app/previas/e1/documento.pdf", erro: null })
    expect(p2).toEqual(p1)
    expect(geradosDocumento).toEqual([path.join(raiz, "clientes", SLUG, ".app/propostas/e1.docx")])
  })

  it("aberturas simultâneas geram a prévia uma vez só", async () => {
    entregaveis = [documento()]
    const s = servico()
    await Promise.all([s.previaDocumento(SLUG, "e1"), s.previaDocumento(SLUG, "e1")])
    expect(geradosDocumento).toHaveLength(1)
  })

  it("sem LibreOffice responde indisponível com a mensagem e tenta de novo na próxima abertura", async () => {
    entregaveis = [documento()]
    previaFalha = "LibreOffice não encontrado."
    const s = servico()
    expect(await s.previaDocumento(SLUG, "e1")).toEqual({ disponivel: false, caminho: null, erro: "LibreOffice não encontrado." })
    previaFalha = null
    expect((await s.previaDocumento(SLUG, "e1")).disponivel).toBe(true)
  })

  it("só para entregáveis do tipo documento", async () => {
    await expect(servico().previaDocumento(SLUG, "e1")).rejects.toThrow("documento")
  })
})

describe("comentários", () => {
  it("cria com o campo atingido pela região, edita e apaga", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    const c = await s.criar(SLUG, "e1", { slide: 2, regiao: { x: 70, y: 40, w: 20, h: 20 }, texto: "  conclusão errada " })
    expect(c).toMatchObject({ id: "c1", slide: 2, campo: "conclusoes", texto: "conclusão errada", enviadoEm: null })
    await s.editar(SLUG, "e1", "c1", "conclusão 2 errada")
    expect((await s.listar(SLUG, "e1"))[0]?.texto).toBe("conclusão 2 errada")
    await s.apagar(SLUG, "e1", "c1")
    expect(await s.listar(SLUG, "e1")).toEqual([])
  })

  it("recusa texto vazio, região inválida e slide inexistente", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    await expect(s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "  " })).rejects.toThrow("comentário")
    await expect(s.criar(SLUG, "e1", { slide: 1, regiao: { x: 95, y: 0, w: 10, h: 10 }, texto: "x" })).rejects.toThrow("Região")
    await expect(s.criar(SLUG, "e1", { slide: 9, regiao: null, texto: "x" })).rejects.toThrow("Slide")
  })

  it("recusa comentar versão que não está aguardando aprovação", async () => {
    entregaveis = [entregavel({ status: "substituido" })]
    await expect(servico().criar(SLUG, "e1", { slide: 1, regiao: null, texto: "x" })).rejects.toThrow("aguardando")
  })

  it("enviar recorta regiões, pede ajuste com o texto estruturado e marca como enviados", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    await s.criar(SLUG, "e1", { slide: 2, regiao: { x: 70, y: 40, w: 20, h: 20 }, texto: "conclusão errada" })
    await s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "tira a capa" })
    expect(await s.enviar(SLUG, "e1")).toBe(2)
    expect(ajustes).toHaveLength(1)
    expect(ajustes[0]!.texto).toContain('Slide 2 · "Cenário Atual · ROAS" · região: conclusoes (recorte: clientes/teste-apresentacao/.app/comentarios/e1/c1.png)')
    expect(ajustes[0]!.texto).toContain('Slide 1 · "Capa" · slide inteiro')
    expect((await s.listar(SLUG, "e1")).every((c) => c.enviadoEm === "2026-10-08T12:00:00.000Z")).toBe(true)
    await expect(s.editar(SLUG, "e1", "c1", "x")).rejects.toThrow("enviado")
  })

  it("comentário criado durante o envio não se perde, e envios simultâneos pedem um ajuste só", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    await s.criar(SLUG, "e1", { slide: 2, regiao: { x: 70, y: 40, w: 20, h: 20 }, texto: "primeiro" })
    const resultados = await Promise.allSettled([s.enviar(SLUG, "e1"), s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "durante" }), s.enviar(SLUG, "e1")])
    expect(ajustes).toHaveLength(2)
    expect(ajustes[0]!.texto).toContain("primeiro")
    expect(ajustes[1]!.texto).toContain("durante")
    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true)
    expect((await s.listar(SLUG, "e1")).map((c) => c.texto).sort()).toEqual(["durante", "primeiro"])
  })

  it("enviar sem pendentes recusa e não pede ajuste", async () => {
    await expect(servico().enviar(SLUG, "e1")).rejects.toThrow("Nenhum comentário")
    expect(ajustes).toHaveLength(0)
  })

  it("roteiro: comentário por bloco, rotulado pelo título do slide do roteiro", async () => {
    entregaveis = [entregavel({ id: "r1", tipo: "roteiro", arquivoRascunho: ".app/propostas/r1.json", nomeFinal: "roteiro-apresentacao" })]
    await writeFile(
      path.join(raiz, "clientes", SLUG, ".app/propostas/r1.json"),
      JSON.stringify({ slides: [{ tipo: "capa", prospect: "X" }, { tipo: "grafico", titulo: "Cenário Atual", subtitulo: "**ROAS**" }] }),
    )
    const s = servico()
    await s.criar(SLUG, "r1", { slide: 2, regiao: null, texto: "trocar o gráfico" })
    await expect(s.criar(SLUG, "r1", { slide: 2, regiao: { x: 1, y: 1, w: 5, h: 5 }, texto: "x" })).rejects.toThrow("roteiro")
    await s.enviar(SLUG, "r1")
    expect(ajustes[0]!.texto).toContain('Slide 2 do roteiro · grafico "Cenário Atual · ROAS" · slide inteiro')
  })
})

describe("autoria dos comentários", () => {
  const ANA = "ana.souza@boomer.com.br"

  it("criar grava o autor no comentário", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    const c = await s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "tira a capa" }, ANA)
    expect(c.autor).toBe(ANA)
    expect((await s.listar(SLUG, "e1"))[0]!.autor).toBe(ANA)
  })

  it("sem autor o campo não aparece, e a lista antiga continua sendo lida", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    const c = await s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "tira a capa" })
    expect(c).not.toHaveProperty("autor")
    const [lido] = await s.listar(SLUG, "e1")
    expect(lido).not.toHaveProperty("autor")
    expect(lido!.texto).toBe("tira a capa")
  })

  it("enviar repassa o autor ao pedido de ajuste (null sem autor)", async () => {
    const s = servico()
    await s.previa(SLUG, "e1")
    await s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "um" }, ANA)
    await s.enviar(SLUG, "e1", ANA)
    await s.criar(SLUG, "e1", { slide: 1, regiao: null, texto: "dois" })
    await s.enviar(SLUG, "e1")
    expect(ajustes.map((a) => a.autor ?? null)).toEqual([ANA, null])
  })
})
