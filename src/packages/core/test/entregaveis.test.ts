import { describe, expect, it } from "vitest"
import {
  aprovarEntregavel,
  destinoAprovado,
  normalizarNomeFinal,
  pedirAjuste,
  proporEntregavel,
} from "../src/entregaveis"
import { ErroEntrada, TransicaoInvalida } from "../src/erros"
import { estadoInicial } from "../src/maquina-estados"

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
    expect(destinoAprovado({ tipo: "tabela", nomeFinal: "tabela-cenarios-projecao", etapa: "05" })).toBe(
      "entrega/ativos-aprovados/graficos/tabela-cenarios-projecao.png",
    )
    expect(destinoAprovado({ tipo: "secao", nomeFinal: "macro-financeiro", etapa: "03" })).toBe(
      "entrega/ativos-aprovados/secoes/03-macro-financeiro.md",
    )
    expect(destinoAprovado({ tipo: "planilha", nomeFinal: "projecao-de-cenarios", etapa: "05" })).toBe(
      "entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx",
    )
    expect(destinoAprovado({ tipo: "documento", nomeFinal: "plano-de-acao-estrategico", etapa: "08" })).toBe(
      "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx",
    )
    expect(destinoAprovado({ tipo: "html", nomeFinal: "benchmark", etapa: "06" })).toBe(
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
})
