// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"
import type { RespostaEstado } from "@workspace/core/tipos"

const irParaEtapa = vi.fn()
vi.mock("./contexto-visualizador", () => ({ useVisualizador: () => ({ abrir: vi.fn(), abrirArquivo: vi.fn(), irParaEtapa }) }))
vi.mock("@/lib/confete", () => ({ celebrarEtapaConcluida: vi.fn() }))
vi.mock("@/lib/api", () => ({ api: { acaoEtapa: vi.fn(async () => ({})) }, mensagemDeErro: String, urlArquivo: String }))
const { PainelEtapa } = await import("./painel-etapa")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const dados = {
  estado: { etapas: { "04": { status: "em_andamento", sinalizada: true }, "05": { status: "bloqueada" } }, entregaveis: [], insumos: [] },
  catalogo: { etapas: [{ id: "04", numero: "04", titulo: "U", rotuloStatus: "04 · U", insumos: [] }, { id: "05", numero: "05", titulo: "S", rotuloStatus: "05 · Soluções", insumos: [] }], insumos: [] },
  condicoes: { "04": [] },
  turnoAtivo: null,
  turnoPor: null,
  modelosDisponiveis: [],
  aprovadosForaDaInterface: [],
} as unknown as RespostaEstado

describe("PainelEtapa: concluir leva à próxima etapa", () => {
  it("'Concluir etapa e ir para 05 · Soluções' conclui e abre a 05", async () => {
    const raiz = document.createElement("div")
    document.body.append(raiz)
    const r = createRoot(raiz)
    await act(async () => r.render(createElement(PainelEtapa, { slug: "x", etapa: "04", dados })))
    const botao = [...raiz.querySelectorAll("button")].find((b) => b.textContent?.includes("Concluir etapa e ir para 05 · Soluções"))!
    await act(async () => botao.click())
    expect(irParaEtapa).toHaveBeenCalledWith("05")
    await act(async () => r.unmount())
  })
})
