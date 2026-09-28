import { describe, expect, it } from "vitest"
import { etapaDoCatalogo } from "../src/catalogo"
import { TransicaoInvalida } from "../src/erros"
import { registrarInsumo } from "../src/insumos"
import {
  concluirEtapa,
  condicoesConcluir,
  confirmarValida,
  estadoInicial,
  iniciarEtapa,
  reabrirEtapa,
  registrarMensagemAnalista,
  revisarEtapa,
  sinalizarPronta,
} from "../src/maquina-estados"
import { ORDEM_ETAPAS, type Estado, type EtapaId } from "../src/tipos"
import { catalogoReal } from "./ajuda"

const EM = "2026-09-28T10:00:00.000Z"
const cat = catalogoReal()
const novo = () => estadoInicial({ slug: "x", nome: "X", site: null }, EM)

function comInsumosObrigatorios(e: Estado, etapa: EtapaId): Estado {
  let r = e
  for (const ref of etapaDoCatalogo(cat, etapa).insumos.filter((i) => i.obrigatorio)) {
    r = registrarInsumo(
      r,
      { etapa, insumoId: ref.id, status: "valido", problemas: [], avisos: [], resumo: null, arquivo: "x" },
      EM,
    )
  }
  return r
}

/** Leva a etapa até concluída; se ela já está em andamento (ex.: reaberta), não inicia de novo. */
function concluir(e: Estado, etapa: EtapaId): Estado {
  let r = e.etapas[etapa].status === "liberada" ? iniciarEtapa(e, etapa, EM) : e
  r = comInsumosObrigatorios(r, etapa)
  r = sinalizarPronta(r, etapa, { resumoDecisoes: `decisões ${etapa}`, handoff: `handoff ${etapa}` }, cat, EM).estado
  return concluirEtapa(r, etapa, cat, EM)
}

function concluirAte(ate: EtapaId): Estado {
  let e = novo()
  for (const id of ORDEM_ETAPAS) {
    e = concluir(e, id)
    if (id === ate) break
  }
  return e
}

describe("máquina de estados", () => {
  it("começa com a 01 liberada e o resto bloqueado", () => {
    const e = novo()
    expect(e.etapas["01"].status).toBe("liberada")
    for (const id of ORDEM_ETAPAS.slice(1)) expect(e.etapas[id].status).toBe("bloqueada")
  })

  it("só inicia etapa liberada", () => {
    expect(() => iniciarEtapa(novo(), "02", EM)).toThrow(TransicaoInvalida)
    expect(iniciarEtapa(novo(), "01", EM).etapas["01"].status).toBe("em_andamento")
  })

  it("sinalizar sem os insumos obrigatórios mantém em andamento e lista o que falta", () => {
    const e = iniciarEtapa(novo(), "01", EM)
    const r = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM)
    expect(r.estado.etapas["01"].status).toBe("em_andamento")
    expect(r.faltando).toContain("Enviar: Transcrição do kickoff")
    expect(r.faltando).not.toContain("O agente ainda não sinalizou que a etapa está completa")
  })

  it("sinalizar com tudo pronto leva a pronta", () => {
    const e = comInsumosObrigatorios(iniciarEtapa(novo(), "01", EM), "01")
    const r = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM)
    expect(r.faltando).toEqual([])
    expect(r.estado.etapas["01"].status).toBe("pronta")
  })

  it("entregável pendente bloqueia a conclusão", () => {
    let e = comInsumosObrigatorios(iniciarEtapa(novo(), "01", EM), "01")
    e = {
      ...e,
      entregaveis: [
        {
          id: "a",
          etapa: "01",
          tipo: "secao",
          titulo: "Transcrição limpa",
          arquivoRascunho: ".app/propostas/a.md",
          nomeFinal: "transcricao",
          status: "pendente",
          ajustePedido: null,
          criadoEm: EM,
          decididoEm: null,
        },
      ],
    }
    const r = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM)
    expect(r.faltando).toEqual(["Aprovar: Transcrição limpa"])
    expect(r.estado.etapas["01"].status).toBe("em_andamento")
  })

  it("mensagem do analista depois de pronta volta para em andamento e zera o sinal", () => {
    const e = comInsumosObrigatorios(iniciarEtapa(novo(), "01", EM), "01")
    const pronta = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "h" }, cat, EM).estado
    const depois = registrarMensagemAnalista(pronta, "01", EM)
    expect(depois.etapas["01"].status).toBe("em_andamento")
    expect(depois.etapas["01"].sinalizada).toBe(false)
    expect(condicoesConcluir(depois, "01", cat)).toContain("O agente ainda não sinalizou que a etapa está completa")
  })

  it("concluir libera a próxima; concluir fora de pronta falha", () => {
    expect(() => concluirEtapa(iniciarEtapa(novo(), "01", EM), "01", cat, EM)).toThrow(TransicaoInvalida)
    const e = concluir(novo(), "01")
    expect(e.etapas["01"].status).toBe("concluida")
    expect(e.etapas["01"].concluidaEm).toBe(EM)
    expect(e.etapas["02"].status).toBe("liberada")
  })

  it("reabrir marca as posteriores concluídas como desatualizadas e avisa as em andamento", () => {
    let e = concluirAte("03")
    e = iniciarEtapa(e, "04", EM)
    const r = reabrirEtapa(e, "02", EM)
    expect(r.estado.etapas["02"].status).toBe("em_andamento")
    expect(r.estado.etapas["03"].status).toBe("desatualizada")
    expect(r.estado.etapas["04"].status).toBe("em_andamento")
    expect(r.afetadasEmAndamento).toEqual(["04"])
  })

  it("reabrir bloqueia de novo uma etapa seguinte que só estava liberada", () => {
    const e = concluirAte("03")
    expect(e.etapas["04"].status).toBe("liberada")
    const r = reabrirEtapa(e, "03", EM)
    expect(r.estado.etapas["04"].status).toBe("bloqueada")
  })

  it("confirmar e revisar resolvem a desatualizada", () => {
    const e = reabrirEtapa(concluirAte("03"), "02", EM).estado
    expect(confirmarValida(e, "03", EM).etapas["03"].status).toBe("concluida")
    expect(revisarEtapa(e, "03", EM).etapas["03"].status).toBe("em_andamento")
    expect(() => confirmarValida(e, "02", EM)).toThrow(TransicaoInvalida)
  })

  it("a apresentação final só libera sem nenhuma etapa desatualizada", () => {
    let e = concluirAte("08")
    expect(e.etapas.final.status).toBe("liberada")
    e = reabrirEtapa(e, "03", EM).estado
    expect(e.etapas.final.status).toBe("bloqueada")
    e = concluir(e, "03")
    expect(e.etapas.final.status).toBe("bloqueada")
    for (const id of ["04", "05", "06", "07", "08"] as const) e = confirmarValida(e, id, EM)
    expect(e.etapas.final.status).toBe("liberada")
  })
})
