import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { EtapaId, RespostaEstado } from "@workspace/core/tipos"
import { ProvedorConta } from "@/components/marca/conta-contexto"
import { ChatEtapa } from "./chat-etapa"

const AVISO = "Ana Silva está com o agente rodando nesta etapa."

function dadosDe(turnoAtivo: EtapaId | null, turnoPor: string | null): RespostaEstado {
  return {
    estado: { etapas: { "01": { status: "em_andamento", origem: "interface" } }, entregaveis: [] },
    catalogo: { etapas: [{ id: "02", rotuloStatus: "Etapa 2" }], insumos: [] },
    condicoes: { "01": [] },
    turnoAtivo,
    turnoPor,
    modelosDisponiveis: [],
    aprovadosForaDaInterface: [],
  } as unknown as RespostaEstado
}

function desenhar(email: string | null, dados: RespostaEstado) {
  return renderToStaticMarkup(
    createElement(ProvedorConta, { email, children: createElement(ChatEtapa, { slug: "iszi", etapa: "01", dados, eventos: [], delta: "" }) }),
  )
}

const campoDesabilitado = (html: string) => /<textarea[^>]*\sdisabled=""/.test(html)

describe("aviso de turno de outro analista", () => {
  it("turno de outra pessoa: mostra o aviso com o nome e desabilita o envio", () => {
    const html = desenhar("bia.lima@boomer.com.br", dadosDe("01", "ana.silva@boomer.com.br"))
    expect(html).toContain(AVISO)
    expect(campoDesabilitado(html)).toBe(true)
  })

  it("turno de outra pessoa em outra etapa: o aviso da etapa não aparece, o envio segue desabilitado", () => {
    const html = desenhar("bia.lima@boomer.com.br", dadosDe("02", "ana.silva@boomer.com.br"))
    expect(html).not.toContain(AVISO)
    expect(campoDesabilitado(html)).toBe(true)
  })

  it("turno do próprio usuário: nenhum aviso", () => {
    const html = desenhar("ana.silva@boomer.com.br", dadosDe("01", "ana.silva@boomer.com.br"))
    expect(html).not.toContain("está com o agente rodando")
  })

  it("turnoPor null (modo off ou turno da fila): nenhum aviso", () => {
    expect(desenhar(null, dadosDe("01", null))).not.toContain("está com o agente rodando")
    expect(desenhar("bia.lima@boomer.com.br", dadosDe("01", null))).not.toContain("está com o agente rodando")
  })

  it("sem turno ativo: nenhum aviso e o envio fica liberado", () => {
    const html = desenhar("bia.lima@boomer.com.br", dadosDe(null, null))
    expect(html).not.toContain("está com o agente rodando")
    expect(campoDesabilitado(html)).toBe(false)
  })
})

describe("chat: bordas e compositor", () => {
  it("desfoque nas bordas de cima e de baixo da rolagem", () => {
    const h = desenhar(null, dadosDe(null, null))
    expect(h.match(/data-slot="desfoque-chat"/g)).toHaveLength(2)
  })

  it("compositor em pílula flutuante de uma linha com brilho laranja no foco", () => {
    const h = desenhar(null, dadosDe(null, null))
    expect(h).toContain("focus-within:ring-4")
    expect(h).toContain("rounded-[18px]")
    expect(h).toMatch(/<textarea[^>]*rows="1"/)
  })
})

describe("resposta ao vivo", () => {
  it("o texto que chega ao vivo já vem sem bolha, como a resposta final (não pula no fim do turno)", () => {
    const h = renderToStaticMarkup(
      createElement(ProvedorConta, { email: null, children: createElement(ChatEtapa, { slug: "iszi", etapa: "01", dados: dadosDe("01", null), eventos: [], delta: "Calculando o LTV" }) }),
    )
    expect(h).toContain("Calculando o LTV")
    expect(h).not.toContain('data-slot="bubble-content"')
    // Mesmo tamanho da resposta final (15 px): a letra não muda quando o turno termina.
    expect(h).toMatch(/<div class="[^"]*text-\[15px\][^"]*">.*Calculando o LTV/s)
  })
})
