import { describe, expect, it } from "vitest"
import {
  apresentacaoFinal,
  aprovarEntregavel,
  destinoAprovado,
  normalizarNomeFinal,
  pedirAjuste,
  entregavelVisivel,
  htmlParaAbrir,
  proporEntregavel,
  versaoAnterior,
} from "../src/entregaveis"
import { ErroEntrada, TransicaoInvalida } from "../src/erros"
import { estadoInicial } from "../src/maquina-estados"
import type { Entregavel } from "../src/tipos"

const EM = "2026-09-28T10:00:00.000Z"
const base = () => estadoInicial({ slug: "x", nome: "X", site: null }, EM)
const proposta = (nomeFinal = "investimento-total-mensal") => ({
  etapa: "03" as const,
  tipo: "grafico" as const,
  titulo: "Investimento total — mensal",
  arquivoRascunho: ".app/propostas/p1.png",
  nomeFinal,
})

describe("destino do entregável aprovado", () => {
  it("segue as pastas e nomes usados hoje no Claude Code", () => {
    expect(destinoAprovado({ tipo: "grafico", nomeFinal: "roas-global-google-meta", etapa: "03" })).toBe(
      "entrega/ativos-aprovados/graficos/roas-global-google-meta.png",
    )
    expect(destinoAprovado({ tipo: "tabela", nomeFinal: "tabela-cenarios-projecao", etapa: "06" })).toBe(
      "entrega/ativos-aprovados/graficos/tabela-cenarios-projecao.png",
    )
    expect(destinoAprovado({ tipo: "secao", nomeFinal: "macro-financeiro", etapa: "03" })).toBe(
      "entrega/ativos-aprovados/secoes/03-macro-financeiro.md",
    )
    expect(destinoAprovado({ tipo: "planilha", nomeFinal: "projecao-de-cenarios", etapa: "06" })).toBe(
      "entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx",
    )
    expect(destinoAprovado({ tipo: "documento", nomeFinal: "plano-de-acao-estrategico", etapa: "08" })).toBe(
      "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx",
    )
    expect(destinoAprovado({ tipo: "html", nomeFinal: "benchmark", etapa: "07" })).toBe(
      "entrega/ativos-aprovados/benchmark/benchmark.html",
    )
  })
})

describe("normalizarNomeFinal", () => {
  it("tira extensão e o prefixo da etapa em seções", () => {
    expect(normalizarNomeFinal("grafico", "taxa-de-quebra-mensal.png", "03")).toBe("taxa-de-quebra-mensal")
    expect(normalizarNomeFinal("secao", "03-macro-financeiro", "03")).toBe("macro-financeiro")
  })
  it.each(["Investimento Mensal", "grafico_1", "roas-v2", "analise-final", ""])("recusa %s", (nome) => {
    expect(() => normalizarNomeFinal("grafico", nome, "03")).toThrow(ErroEntrada)
  })
})

describe("ciclo do entregável", () => {
  it("nova proposta com o mesmo nome substitui a pendente", () => {
    let e = proporEntregavel(base(), proposta(), "p1", EM)
    e = proporEntregavel(e, { ...proposta(), arquivoRascunho: ".app/propostas/p2.png" }, "p2", EM)
    expect(e.entregaveis.map((x) => [x.id, x.status])).toEqual([
      ["p1", "substituido"],
      ["p2", "pendente"],
    ])
  })

  it("recusa arquivo com extensão errada para o tipo", () => {
    expect(() =>
      proporEntregavel(base(), { ...proposta(), arquivoRascunho: ".app/propostas/p1.md" }, "p1", EM),
    ).toThrow(ErroEntrada)
  })

  it("aprovar marca aprovado e aposenta a aprovação anterior do mesmo destino", () => {
    let e = proporEntregavel(base(), proposta(), "p1", EM)
    e = aprovarEntregavel(e, "p1", EM)
    e = proporEntregavel(e, { ...proposta(), arquivoRascunho: ".app/propostas/p2.png" }, "p2", EM)
    expect(e.entregaveis.find((x) => x.id === "p1")!.status).toBe("aprovado")
    e = aprovarEntregavel(e, "p2", EM)
    expect(e.entregaveis.find((x) => x.id === "p1")!.status).toBe("substituido")
    expect(e.entregaveis.find((x) => x.id === "p2")!.status).toBe("aprovado")
    expect(() => aprovarEntregavel(e, "p2", EM)).toThrow(TransicaoInvalida)
  })

  it("pedir ajuste mantém pendente e guarda o texto", () => {
    let e = proporEntregavel(base(), proposta(), "p1", EM)
    e = pedirAjuste(e, "p1", "trocar para barras", EM)
    expect(e.entregaveis[0]).toMatchObject({ status: "pendente", ajustePedido: "trocar para barras" })
    expect(() => pedirAjuste(e, "p1", "   ", EM)).toThrow(ErroEntrada)
  })

  it("com ajuste pedido não aprova; a nova versão nasce aprovável", () => {
    let e = proporEntregavel(base(), proposta(), "p1", EM)
    e = pedirAjuste(e, "p1", "trocar para barras", EM)
    expect(() => aprovarEntregavel(e, "p1", EM)).toThrow(TransicaoInvalida)
    e = proporEntregavel(e, { ...proposta(), arquivoRascunho: ".app/propostas/p2.png" }, "p2", EM)
    expect(aprovarEntregavel(e, "p2", EM).entregaveis.find((x) => x.id === "p2")!.status).toBe("aprovado")
  })
})

const html = (id: string, over: Partial<Entregavel> = {}): Entregavel => ({
  id,
  etapa: "07",
  tipo: "html",
  titulo: "Benchmark",
  arquivoRascunho: `.app/propostas/${id}.html`,
  nomeFinal: "benchmark",
  status: "pendente",
  ajustePedido: null,
  criadoEm: `2026-09-29T10:00:0${id.slice(-1)}.000Z`,
  decididoEm: null,
  ...over,
})

describe("entregável visível no visualizador", () => {
  it("mostra a versão não substituída mais recente", () => {
    const lista = [html("e1", { status: "substituido" }), html("e2", { status: "aprovado" }), html("e3")]
    expect(entregavelVisivel(lista, "07", "benchmark")?.id).toBe("e3")
  })
  it("mostra o aprovado quando não há pendente", () => {
    const lista = [html("e1", { status: "substituido" }), html("e2", { status: "aprovado" })]
    expect(entregavelVisivel(lista, "07", "benchmark")?.id).toBe("e2")
  })
  it("ignora a seção de texto com o mesmo nome final do HTML", () => {
    const lista = [html("e1"), html("e2", { tipo: "secao", arquivoRascunho: ".app/propostas/e2.md" })]
    expect(entregavelVisivel(lista, "07", "benchmark")?.id).toBe("e1")
  })
  it("com tipos [secao], acha a seção de texto do mesmo nome final, não o HTML", () => {
    const lista = [html("e1"), html("e2", { tipo: "secao", arquivoRascunho: ".app/propostas/e2.md" })]
    expect(entregavelVisivel(lista, "07", "benchmark", ["secao"])?.id).toBe("e2")
  })
  it("devolve null quando o entregável sumiu ou é de outra etapa", () => {
    expect(entregavelVisivel([html("e1", { status: "substituido" })], "07", "benchmark")).toBeNull()
    expect(entregavelVisivel([html("e1")], "06", "benchmark")).toBeNull()
    expect(entregavelVisivel([], "07", "outro")).toBeNull()
  })
})

describe("abertura automática do visualizador", () => {
  it("não abre na primeira carga", () => {
    expect(htmlParaAbrir(null, [html("e1")], "07")).toBeNull()
  })
  it("abre quando chega um HTML pendente novo da etapa aberta", () => {
    expect(htmlParaAbrir([], [html("e1")], "07")).toBe("benchmark")
  })
  it("ignora HTML já conhecido, de outra etapa, aprovado ou outro tipo", () => {
    expect(htmlParaAbrir([html("e1")], [html("e1")], "07")).toBeNull()
    expect(htmlParaAbrir([], [html("e1")], "06")).toBeNull()
    expect(htmlParaAbrir([], [html("e1", { status: "aprovado" })], "07")).toBeNull()
    expect(htmlParaAbrir([], [html("e1", { tipo: "secao", arquivoRascunho: ".app/propostas/e1.md" })], "07")).toBeNull()
  })
})

describe("entregáveis da apresentação final", () => {
  it("roteiro vai para ativos-aprovados/apresentacao", () => {
    expect(destinoAprovado({ tipo: "roteiro", nomeFinal: "roteiro-apresentacao", etapa: "final" })).toBe(
      "entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json",
    )
  })
  it("apresentação aprovada vai sempre para entrega/apresentacao-final.pptx", () => {
    expect(destinoAprovado({ tipo: "apresentacao", nomeFinal: "qualquer", etapa: "final" })).toBe("entrega/apresentacao-final.pptx")
  })
  it("proposta exige a extensão do tipo", () => {
    const base = estadoInicial({ slug: "x", nome: "X", site: null }, EM)
    expect(() =>
      proporEntregavel(base, { etapa: "final", tipo: "apresentacao", titulo: "Deck", arquivoRascunho: ".app/propostas/a.pdf", nomeFinal: "deck" }, "a1", EM),
    ).toThrow(".pptx")
    expect(() =>
      proporEntregavel(base, { etapa: "final", tipo: "roteiro", titulo: "Roteiro", arquivoRascunho: ".app/propostas/r.json", nomeFinal: "roteiro-apresentacao" }, "r1", EM),
    ).not.toThrow()
  })
})

describe("visualizador também mostra a apresentação", () => {
  const ap = (id: string, over: Partial<Entregavel> = {}): Entregavel => ({
    ...html(id),
    etapa: "final",
    tipo: "apresentacao",
    arquivoRascunho: `.app/propostas/${id}.pptx`,
    nomeFinal: "apresentacao-final",
    ...over,
  })
  it("entregavelVisivel aceita apresentação", () => {
    expect(entregavelVisivel([ap("a1")], "final", "apresentacao-final")?.id).toBe("a1")
  })
  it("apresentação nova abre o visualizador sozinha", () => {
    expect(htmlParaAbrir([], [ap("a1")], "final")).toBe("apresentacao-final")
  })
})

describe("apresentação final pronta para baixar", () => {
  const ap = (id: string, over: Partial<Entregavel> = {}): Entregavel => ({
    ...html(id),
    etapa: "final",
    tipo: "apresentacao",
    arquivoRascunho: `.app/propostas/${id}.pptx`,
    nomeFinal: "apresentacao-final",
    status: "aprovado",
    ...over,
  })
  it("a aprovada mais recente, com o caminho do arquivo final", () => {
    const lista = [ap("a1", { status: "substituido" }), ap("a2"), html("h1", { status: "aprovado" })]
    expect(apresentacaoFinal(lista)).toEqual({ entregavel: lista[1], caminho: "entrega/apresentacao-final.pptx" })
  })
  it("nada enquanto só houver versão aguardando aprovação", () => {
    expect(apresentacaoFinal([ap("a1", { status: "pendente" })])).toBeNull()
  })
})

describe("versaoAnterior", () => {
  const e = (id: string, criadoEm: string, nomeFinal = "roteiro-apresentacao", status: Entregavel["status"] = "substituido"): Entregavel => ({
    id,
    etapa: "03",
    tipo: "roteiro",
    titulo: "Roteiro",
    arquivoRascunho: `.app/propostas/${id}.json`,
    nomeFinal,
    status,
    ajustePedido: null,
    criadoEm,
    decididoEm: null,
  })
  it("é a versão imediatamente anterior do mesmo nome, de qualquer status", () => {
    const lista = [e("a", "2026-09-28T10:00:00Z"), e("b", "2026-09-28T11:00:00Z", "roteiro-apresentacao", "aprovado"), e("c", "2026-09-28T12:00:00Z", "roteiro-apresentacao", "pendente")]
    expect(versaoAnterior(lista, lista[2]!)?.id).toBe("b")
    expect(versaoAnterior(lista, lista[1]!)?.id).toBe("a")
  })
  it("primeira versão não tem anterior, e outro nome final não conta", () => {
    const lista = [e("a", "2026-09-28T10:00:00Z", "outro"), e("b", "2026-09-28T11:00:00Z")]
    expect(versaoAnterior(lista, lista[1]!)).toBeNull()
  })
})
