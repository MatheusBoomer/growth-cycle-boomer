import { describe, expect, it } from "vitest"
import { TransicaoInvalida } from "../src/erros"
import { aprovarEntregavel, proporEntregavel } from "../src/entregaveis"
import { registrarInsumo } from "../src/insumos"
import {
  comEtapa,
  concluirEtapa,
  condicoesConcluir,
  estadoInicial,
  reabrirEtapa,
  reavaliarPronta,
  registrarMensagemAnalista,
  sinalizarPronta,
} from "../src/maquina-estados"
import type { Estado, EtapaId } from "../src/tipos"
import {
  ARQUIVO_VALIDACAO,
  confirmarValidacaoCliente,
  documentoDefasado,
  entregaveisAntesDaTroca,
  etapaDaConversa,
  pendenciasValidacao,
  refezTresDepoisDoPdf,
  registrarDownloadValidacao,
  registrarValidacaoGerada,
} from "../src/validacao-cliente"
import { catalogoReal } from "./ajuda"

const T0 = "2026-11-01T10:00:00.000Z"
const T1 = "2026-11-01T11:00:00.000Z"
const T2 = "2026-11-01T12:00:00.000Z"
const T3 = "2026-11-01T13:00:00.000Z"
const T4 = "2026-11-01T14:00:00.000Z"
const T5 = "2026-11-01T15:00:00.000Z"
const T6 = "2026-11-01T16:00:00.000Z"
const T7 = "2026-11-01T17:00:00.000Z"
const T9 = "2026-11-01T19:00:00.000Z"
const cat = catalogoReal()

/** Estado com a 04 em andamento. */
function base(): Estado {
  const e = estadoInicial({ slug: "x", nome: "X", site: null }, T0)
  return comEtapa(e, "04", { status: "em_andamento", iniciadaEm: T0 }, T0)
}

function insumo(e: Estado, etapa: EtapaId, insumoId: string, em: string): Estado {
  return registrarInsumo(
    e,
    { etapa, insumoId, status: "valido", problemas: [], avisos: [], resumo: null, arquivo: "x" },
    em,
  )
}

/** Propõe e aprova; `nomeFinal` igual substitui o aprovado anterior (reaprovação). */
function aprovado(e: Estado, etapa: EtapaId, id: string, titulo: string, em: string, nomeFinal = `grafico-${id}`): Estado {
  const p = proporEntregavel(
    e,
    { etapa, tipo: "grafico", titulo, arquivoRascunho: `.app/propostas/${id}.png`, nomeFinal },
    id,
    em,
  )
  return aprovarEntregavel(p, id, em)
}

describe("validação do cliente (núcleo)", () => {
  it("sem_documento_a_pendencia_e_gerar", () => {
    expect(pendenciasValidacao(base())[0]).toBe("Gerar o documento de validação do cliente")
  })

  it("fluxo_normal_nao_marca_grafico_da_03_como_desatualizado", () => {
    let e = aprovado(base(), "03", "g1", "Receita mensal", T0)
    e = insumo(e, "04", "clientes-historico", T1)
    expect(entregaveisAntesDaTroca(e)).toEqual([])
    expect(() => registrarValidacaoGerada(e, T2)).not.toThrow()
  })

  it("troca_de_insumo_depois_do_pdf_invalida_o_que_foi_aprovado_antes", () => {
    let e = aprovado(base(), "03", "g1", "Receita mensal", T0)
    e = insumo(e, "04", "clientes-historico", T1)
    e = registrarValidacaoGerada(e, T2)
    expect(entregaveisAntesDaTroca(e)).toEqual([])
    e = insumo(e, "03", "historico-mensal", T3)
    expect(entregaveisAntesDaTroca(e).map((x) => x.titulo)).toEqual(["Receita mensal"])
    expect(pendenciasValidacao(e)).toContain("Aprovar de novo, depois da troca de dados: Receita mensal")
    expect(() => registrarValidacaoGerada(e, T4)).toThrow(TransicaoInvalida)
    expect(() => registrarValidacaoGerada(e, T4)).toThrow(/Receita mensal/)
    e = aprovado(e, "03", "g1b", "Receita mensal", T4, "grafico-g1")
    expect(entregaveisAntesDaTroca(e)).toEqual([])
    expect(() => registrarValidacaoGerada(e, T5)).not.toThrow()
  })

  it("pdf_novo_zera_download_e_confirmacao_e_preserva_primeira_geracao", () => {
    let e = registrarValidacaoGerada(base(), T1)
    e = registrarDownloadValidacao(e, "a@x.com", T2)
    e = confirmarValidacaoCliente(e, "a@x.com", T3)
    expect(e.validacaoCliente?.confirmadoEm).toBe(T3)
    const nova = registrarValidacaoGerada(e, T4)
    expect(nova.validacaoCliente?.baixadoEm).toBeNull()
    expect(nova.validacaoCliente?.baixadoPor).toBeNull()
    expect(nova.validacaoCliente?.confirmadoEm).toBeNull()
    expect(nova.validacaoCliente?.confirmadoPor).toBeNull()
    expect(nova.validacaoCliente?.primeiraGeracaoEm).toBe(T1)
    expect(nova.validacaoCliente?.geradoEm).toBe(T4)
    expect(nova.validacaoCliente?.arquivo).toBe(ARQUIVO_VALIDACAO)
  })

  it("confirmar_exige_download", () => {
    const e = registrarValidacaoGerada(base(), T1)
    expect(() => confirmarValidacaoCliente(e, "a@x.com", T2)).toThrow(TransicaoInvalida)
  })

  it("confirmar_recusa_pdf_defasado", () => {
    let e = registrarValidacaoGerada(base(), T1)
    e = registrarDownloadValidacao(e, null, T2)
    e = aprovado(e, "03", "g9", "Gráfico novo", T9)
    expect(documentoDefasado(e)).toBe(true)
    expect(() => confirmarValidacaoCliente(e, null, T9)).toThrow(TransicaoInvalida)
    expect(pendenciasValidacao(e)).toContain("Gerar de novo o documento de validação: os gráficos mudaram depois dele")
  })

  it("confirmar_duas_vezes_nao_quebra", () => {
    let e = registrarValidacaoGerada(base(), T1)
    e = registrarDownloadValidacao(e, "a@x.com", T2)
    const um = confirmarValidacaoCliente(e, "a@x.com", T3)
    const dois = confirmarValidacaoCliente(um, "b@x.com", T4)
    expect(dois.validacaoCliente?.confirmadoEm).toBe(T3)
  })

  it("mensagem_do_analista_apos_confirmar_desfaz_a_confirmacao_e_mantem_o_download", () => {
    let e = registrarValidacaoGerada(base(), T1)
    e = registrarDownloadValidacao(e, "a@x.com", T2)
    e = confirmarValidacaoCliente(e, "a@x.com", T3)
    const depois = registrarMensagemAnalista(e, "04", T4)
    expect(depois.validacaoCliente?.confirmadoEm).toBeNull()
    expect(depois.validacaoCliente?.confirmadoPor).toBeNull()
    expect(depois.validacaoCliente?.baixadoEm).toBe(T2)
  })

  it("condicoesConcluir_da_04_inclui_pendencias_de_validacao_e_pendentes_vindos_da_03", () => {
    let e = base()
    e = {
      ...e,
      entregaveis: [
        {
          id: "p3",
          etapa: "03",
          etapaConversa: "04",
          tipo: "grafico",
          titulo: "Receita refeita",
          arquivoRascunho: ".app/propostas/p3.png",
          nomeFinal: "grafico-p3",
          status: "pendente",
          ajustePedido: null,
          criadoEm: T0,
          decididoEm: null,
        },
      ],
    }
    const c04 = condicoesConcluir(e, "04", cat)
    expect(c04).toContain("Aprovar: Receita refeita")
    expect(c04).toContain("Gerar o documento de validação do cliente")
    expect(condicoesConcluir(e, "03", cat)).not.toContain("Aprovar: Receita refeita")
    expect(etapaDaConversa(e.entregaveis[0]!)).toBe("04")
    expect(etapaDaConversa({ etapa: "03" })).toBe("03")
  })

  it("refezTresDepoisDoPdf verdadeiro para insumo da 03 trocado depois do PDF e falso antes", () => {
    const antes = registrarValidacaoGerada(insumo(base(), "03", "historico-mensal", T0), T2)
    expect(refezTresDepoisDoPdf(antes)).toBe(false)
    const depois = insumo(antes, "03", "historico-mensal", T3)
    expect(refezTresDepoisDoPdf(depois)).toBe(true)
    expect(refezTresDepoisDoPdf(base())).toBe(false)
  })

  it("upload invalido depois do PDF nao conta como troca de dados", () => {
    let e = aprovado(base(), "03", "g1", "Receita mensal", T0)
    e = registrarValidacaoGerada(e, T2)
    e = registrarInsumo(
      e,
      { etapa: "03", insumoId: "historico-mensal", status: "invalido", problemas: ["12 meses"], avisos: [], resumo: null, arquivo: null },
      T3,
    )
    e = registrarInsumo(
      e,
      { etapa: "04", insumoId: "clientes-historico", status: "invalido", problemas: ["x"], avisos: [], resumo: null, arquivo: null },
      T4,
    )
    expect(entregaveisAntesDaTroca(e)).toEqual([])
    expect(refezTresDepoisDoPdf(e)).toBe(false)
    expect(pendenciasValidacao(e).some((p) => p.startsWith("Aprovar de novo"))).toBe(false)
    expect(() => registrarValidacaoGerada(e, T5)).not.toThrow()
  })

  it("upload valido depois de um invalido volta a contar como troca de dados", () => {
    let e = aprovado(base(), "03", "g1", "Receita mensal", T0)
    e = registrarValidacaoGerada(e, T2)
    e = registrarInsumo(
      e,
      { etapa: "03", insumoId: "historico-mensal", status: "invalido", problemas: ["x"], avisos: [], resumo: null, arquivo: null },
      T3,
    )
    e = insumo(e, "03", "historico-mensal", T4)
    expect(refezTresDepoisDoPdf(e)).toBe(true)
    expect(entregaveisAntesDaTroca(e).map((x) => x.titulo)).toEqual(["Receita mensal"])
  })

  it("refezTresDepoisDoPdf verdadeiro para entregável aprovado da 03 depois do PDF", () => {
    const e = registrarValidacaoGerada(base(), T2)
    expect(refezTresDepoisDoPdf(aprovado(e, "03", "g1", "G", T1))).toBe(false)
    expect(refezTresDepoisDoPdf(aprovado(e, "03", "g1", "G", T3))).toBe(true)
    expect(refezTresDepoisDoPdf(aprovado(e, "04", "g1", "G", T3))).toBe(false)
  })

  it("04_reaberta_sem_validacao_antiga_exige_o_pdf", () => {
    let e = insumo(base(), "04", "clientes-historico", T1)
    e = sinalizarPronta(e, "04", { resumoDecisoes: "r", handoff: "h" }, cat, T2).estado
    e = registrarValidacaoGerada(e, T3)
    e = registrarDownloadValidacao(e, null, T4)
    e = confirmarValidacaoCliente(e, null, T5)
    e = reavaliarPronta(e, "04", cat, T5)
    e = concluirEtapa(e, "04", cat, T6)
    expect(e.etapas["04"].status).toBe("concluida")
    const semValidacao: Estado = { ...e }
    delete semValidacao.validacaoCliente
    const r = reabrirEtapa(semValidacao, "04", T7)
    expect(condicoesConcluir(r.estado, "04", cat)).toContain("Gerar o documento de validação do cliente")
  })
})
