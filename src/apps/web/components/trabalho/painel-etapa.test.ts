import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { RespostaEstado } from "@workspace/core/tipos"

vi.mock("./contexto-visualizador", () => ({ useVisualizador: () => ({ abrir: vi.fn(), abrirArquivo: vi.fn() }) }))

const { PainelEtapa } = await import("./painel-etapa")

function dadosDe(condicoes: string[], sinalizada: boolean): RespostaEstado {
  return {
    estado: { etapas: { "04": { status: "em_andamento", sinalizada, origem: "interface" }, "05": { status: "bloqueada", origem: "interface" } }, entregaveis: [], insumos: [] },
    catalogo: {
      etapas: [
        { id: "04", numero: "04", titulo: "Unidade econômica", rotuloStatus: "04 · Unidade econômica", insumos: [] },
        { id: "05", numero: "05", titulo: "Soluções", rotuloStatus: "05 · Soluções", insumos: [] },
      ],
      insumos: [],
    },
    condicoes: { "04": condicoes },
    turnoAtivo: null,
    turnoPor: null,
    modelosDisponiveis: [],
    aprovadosForaDaInterface: [],
  } as unknown as RespostaEstado
}

const html = (condicoes: string[], sinalizada: boolean) => renderToStaticMarkup(createElement(PainelEtapa, { slug: "x", etapa: "04", dados: dadosDe(condicoes, sinalizada) }))

describe("PainelEtapa: contagens nos títulos", () => {
  it("entregáveis aprovados/total e insumos recebidos/total, em mono", () => {
    const dados = dadosDe(["Aprovar: B"], true) as unknown as { estado: Record<string, unknown>; catalogo: { etapas: { insumos: unknown[] }[]; insumos: unknown[] } }
    dados.estado.entregaveis = [
      { id: "a", etapa: "04", status: "aprovado", titulo: "A", tipo: "grafico", arquivoRascunho: "a.png", nomeFinal: "a.png" },
      { id: "b", etapa: "04", status: "pendente", titulo: "B", tipo: "grafico", arquivoRascunho: "b.png", nomeFinal: "b.png" },
    ]
    const h = renderToStaticMarkup(createElement(PainelEtapa, { slug: "x", etapa: "04", dados: dados as unknown as RespostaEstado }))
    expect(h).toMatch(/Entregáveis da etapa<span class="[^"]*font-mono[^"]*">1\/2<\/span>/)
  })
})

describe("PainelEtapa: concluir só quando tudo estiver pronto", () => {
  it("faltando aprovar algo: nem botão de concluir nem lista do que falta", () => {
    const h = html(["Aprovar: Gráfico"], true)
    expect(h).not.toContain("Concluir etapa")
    expect(h).not.toContain("O que falta")
  })

  it("só falta o agente fechar (com entregável aprovado): a linha de espera, sem botão", () => {
    const d = dadosDe(["O agente ainda não sinalizou que a etapa está completa"], false) as unknown as { estado: Record<string, unknown> }
    d.estado.entregaveis = [{ id: "a", etapa: "04", status: "aprovado", titulo: "A", tipo: "grafico", arquivoRascunho: "a.png", nomeFinal: "a.png" }]
    const h = renderToStaticMarkup(createElement(PainelEtapa, { slug: "x", etapa: "04", dados: d as unknown as RespostaEstado }))
    expect(h).toContain("Tudo aprovado · esperando o agente fechar a etapa")
    expect(h).not.toContain("Concluir etapa")
  })

  it("tudo pronto: o botão com o nome da próxima etapa", () => {
    const h = html([], true)
    expect(h).toContain("Tudo aprovado nesta etapa")
    expect(h).toContain("Concluir etapa e ir para 05 · Soluções")
  })
})

