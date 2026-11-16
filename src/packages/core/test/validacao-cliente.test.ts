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
  pendenciaDoAgente,
  pendenciasValidacao,
  registrarDownloadValidacao,
  registrarValidacaoGerada,
  tresRefeitaPelaQuatro,
  ultimaMudancaDoDocumento,
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
    expect(pendenciasValidacao(base())).toEqual(["Gerar o documento de validação do cliente"])
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
    expect(pendenciasValidacao(e).some((p) => p.startsWith("Aprovar de novo"))).toBe(false)
    expect(() => registrarValidacaoGerada(e, T5)).not.toThrow()
  })

  it("troca valida seguida de upload invalido continua listando o grafico desatualizado", () => {
    let e = aprovado(base(), "03", "g1", "Receita mensal", T0)
    e = registrarValidacaoGerada(e, T2)
    e = insumo(e, "03", "historico-mensal", T3)
    e = registrarInsumo(
      e,
      { etapa: "03", insumoId: "historico-mensal", status: "invalido", problemas: ["x"], avisos: [], resumo: null, arquivo: null },
      T4,
    )
    expect(entregaveisAntesDaTroca(e).map((x) => x.titulo)).toEqual(["Receita mensal"])
    expect(pendenciasValidacao(e)).toContain("Aprovar de novo, depois da troca de dados: Receita mensal")
    expect(() => registrarValidacaoGerada(e, T5)).toThrow(TransicaoInvalida)
  })

  it("registro antigo sem ultimoValidoEm so conta como troca quando esta valido", () => {
    let e = aprovado(base(), "03", "g1", "Receita mensal", T0)
    e = registrarValidacaoGerada(e, T2)
    const legado = (status: "valido" | "invalido") => ({
      ...e,
      insumos: [{ etapa: "03" as const, insumoId: "historico-mensal", status, problemas: [], avisos: [], resumo: null, arquivo: null, atualizadoEm: T3 }],
    })
    expect(entregaveisAntesDaTroca(legado("valido")).map((x) => x.titulo)).toEqual(["Receita mensal"])
    expect(entregaveisAntesDaTroca(legado("invalido"))).toEqual([])
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
    expect(entregaveisAntesDaTroca(e).map((x) => x.titulo)).toEqual(["Receita mensal"])
  })

  describe("tresRefeitaPelaQuatro (não depende do PDF)", () => {
    /** 03 concluída em T1 e 04 em andamento, sem documento de validação. */
    function tresConcluida(concluidaEm: string | null = T1): Estado {
      return comEtapa(base(), "03", { status: "concluida", concluidaEm }, T1)
    }

    /** Peça da 03 proposta e aprovada na conversa da 04 (etapa_origem "03"). */
    function aprovadoPelaQuatro(e: Estado, id: string, em: string): Estado {
      const p = proporEntregavel(
        e,
        { etapa: "03", etapaConversa: "04", tipo: "grafico", titulo: "Receita refeita", arquivoRascunho: `.app/propostas/${id}.png`, nomeFinal: `grafico-${id}` },
        id,
        em,
      )
      return aprovarEntregavel(p, id, em)
    }

    it("nenhum gatilho: falso", () => {
      expect(tresRefeitaPelaQuatro(tresConcluida())).toBe(false)
      // insumo e peça da 03 de antes da conclusão da 03 não contam
      expect(tresRefeitaPelaQuatro(insumo(tresConcluida(), "03", "historico-mensal", T0))).toBe(false)
      expect(tresRefeitaPelaQuatro(aprovado(tresConcluida(), "03", "g0", "G", T0))).toBe(false)
    })

    it("insumo da 03 válido depois da conclusão da 03, antes de qualquer PDF: verdadeiro", () => {
      const e = insumo(tresConcluida(), "03", "historico-mensal", T2)
      expect(e.validacaoCliente).toBeUndefined()
      expect(tresRefeitaPelaQuatro(e)).toBe(true)
      // insumo da 04 não é refazer a 03
      expect(tresRefeitaPelaQuatro(insumo(tresConcluida(), "04", "clientes-historico", T2))).toBe(false)
    })

    it("peça da 03 aprovada pela 04 depois da conclusão da 03, antes de qualquer PDF: verdadeiro", () => {
      expect(tresRefeitaPelaQuatro(aprovadoPelaQuatro(tresConcluida(), "p1", T2))).toBe(true)
      // aprovada antes da conclusão, ou peça da 04, ou ainda pendente: falso
      expect(tresRefeitaPelaQuatro(aprovadoPelaQuatro(tresConcluida(T3), "p1", T2))).toBe(false)
      expect(tresRefeitaPelaQuatro(aprovado(tresConcluida(), "04", "g4", "G", T2))).toBe(false)
      const pendente = proporEntregavel(
        tresConcluida(),
        { etapa: "03", etapaConversa: "04", tipo: "grafico", titulo: "R", arquivoRascunho: ".app/propostas/p2.png", nomeFinal: "r" },
        "p2",
        T2,
      )
      expect(tresRefeitaPelaQuatro(pendente)).toBe(false)
    })

    it("upload inválido não conta; válido seguido de inválido continua contando", () => {
      const invalido = (e: Estado, em: string) =>
        registrarInsumo(
          e,
          { etapa: "03", insumoId: "historico-mensal", status: "invalido", problemas: ["x"], avisos: [], resumo: null, arquivo: null },
          em,
        )
      expect(tresRefeitaPelaQuatro(invalido(tresConcluida(), T2))).toBe(false)
      expect(tresRefeitaPelaQuatro(invalido(insumo(tresConcluida(), "03", "historico-mensal", T2), T3))).toBe(true)
    })

    it("03 que não está concluída: falso, mesmo com insumo novo", () => {
      const aberta = comEtapa(insumo(tresConcluida(), "03", "historico-mensal", T2), "03", { status: "em_andamento", concluidaEm: null }, T3)
      expect(tresRefeitaPelaQuatro(aberta)).toBe(false)
    })

    it("03 concluída sem data (importada do terminal): qualquer troca ou peça refeita conta", () => {
      expect(tresRefeitaPelaQuatro(tresConcluida(null))).toBe(false)
      expect(tresRefeitaPelaQuatro(insumo(tresConcluida(null), "03", "historico-mensal", T2))).toBe(true)
      expect(tresRefeitaPelaQuatro(aprovadoPelaQuatro(tresConcluida(null), "p1", T2))).toBe(true)
    })
  })

  describe("ultimaMudancaDoDocumento", () => {
    it("sem aprovado nem insumo do documento: null", () => {
      expect(ultimaMudancaDoDocumento(base())).toBeNull()
    })

    it("a mais recente entre aprovações de gráfico, tabela ou seção e trocas válidas de insumo de 03 e 04", () => {
      let e = aprovado(base(), "03", "g1", "G", T1)
      e = insumo(e, "04", "clientes-historico", T2)
      expect(ultimaMudancaDoDocumento(e)).toBe(T2)
      e = aprovado(e, "04", "g2", "G2", T3)
      expect(ultimaMudancaDoDocumento(e)).toBe(T3)
    })

    it("ignora etapa fora do documento, tipo fora do documento, pendente e upload inválido", () => {
      let e = aprovado(base(), "03", "g1", "G", T1)
      e = aprovado(e, "05", "g5", "G5", T5)
      const planilha = proporEntregavel(e, { etapa: "04", tipo: "planilha", titulo: "P", arquivoRascunho: ".app/propostas/p.xlsx", nomeFinal: "p" }, "p", T5)
      e = aprovarEntregavel(planilha, "p", T5)
      e = proporEntregavel(e, { etapa: "04", tipo: "grafico", titulo: "Pend", arquivoRascunho: ".app/propostas/q.png", nomeFinal: "q" }, "q", T6)
      e = registrarInsumo(
        e,
        { etapa: "03", insumoId: "historico-mensal", status: "invalido", problemas: ["x"], avisos: [], resumo: null, arquivo: null },
        T7,
      )
      e = insumo(e, "05", "outro", T9)
      expect(ultimaMudancaDoDocumento(e)).toBe(T1)
    })
  })

  it("pendenciaDoAgente separa o que o agente faz do que o analista faz", () => {
    for (const p of [
      "Gerar o documento de validação do cliente",
      "Gerar de novo o documento de validação: os gráficos mudaram depois dele",
      "Aprovar de novo, depois da troca de dados: Receita mensal",
    ]) {
      expect(pendenciaDoAgente(p)).toBe(true)
    }
    for (const p of ["Baixar o documento de validação", "Confirmar que o cliente validou os dados", "Aprovar: Receita refeita", "Enviar: Histórico mensal"]) {
      expect(pendenciaDoAgente(p)).toBe(false)
    }
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
