import { describe, expect, it } from "vitest"
import { estadoInicial, etapaVazia } from "../src/maquina-estados"
import {
  ID_ETAPA_ARQUIVADA,
  MAPA_ETAPAS,
  classificarNumeracao,
  migrarEstado,
  migrarManifesto,
  novoIdEtapa,
  planoDeArquivos,
  type EstadoMigravel,
  type ManifestoMigravel,
} from "../src/migracao-etapas"
import type { EstadoInsumo, Entregavel, StatusEtapa } from "../src/tipos"

const EM = "2026-11-08T10:00:00.000Z"

/** Estado numa numeração qualquer: as chaves vêm do mapa, não de ORDEM_ETAPAS. */
function estadoDe(statusPorId: Record<string, StatusEtapa>, extra: Partial<EstadoMigravel> = {}): EstadoMigravel {
  const base = estadoInicial({ slug: "x", nome: "X", site: null }, EM)
  const etapas: EstadoMigravel["etapas"] = {}
  for (const [id, status] of Object.entries(statusPorId)) etapas[id] = etapaVazia(status)
  delete base.versaoEtapas
  return { ...base, etapas, ...extra }
}

const ATUAL: Record<string, StatusEtapa> = {
  "01": "concluida",
  "02": "concluida",
  "03": "concluida",
  "04": "concluida",
  "05": "concluida",
  "06": "concluida",
  "07": "concluida",
  "08": "em_andamento",
  "09": "bloqueada",
  final: "bloqueada",
}

/** Prospect de 8 etapas (07 = mídia paga, 08 = plano) em que o app antigo injetou uma "09" bloqueada, como a adda. */
const LEGADO_COM_09_INJETADA: Record<string, StatusEtapa> = {
  "01": "concluida",
  "02": "concluida",
  "03": "concluida",
  "04": "concluida",
  "05": "concluida",
  "06": "concluida",
  "07": "concluida",
  "08": "concluida",
  final: "em_andamento",
  "09": "bloqueada",
}

function entregavel(id: string, etapa: string): Entregavel {
  return {
    id,
    etapa,
    tipo: "secao",
    titulo: id,
    arquivoRascunho: `.app/propostas/${id}.md`,
    nomeFinal: `${id}.md`,
    status: "aprovado",
    ajustePedido: null,
    criadoEm: EM,
    decididoEm: EM,
  } as unknown as Entregavel
}

function insumo(insumoId: string, etapa: string): EstadoInsumo {
  return { etapa, insumoId, status: "valido", problemas: [], avisos: [], resumo: null, arquivo: null, atualizadoEm: EM } as unknown as EstadoInsumo
}

describe("mapa de etapas", () => {
  it("só 07, 08 e 09 mudam de id; o resto passa direto", () => {
    expect(ID_ETAPA_ARQUIVADA).toBe("briefing-benchmark")
    expect(MAPA_ETAPAS).toEqual({ "07": "briefing-benchmark", "08": "07", "09": "08" })
    expect(novoIdEtapa("08")).toBe("07")
    expect(novoIdEtapa("09")).toBe("08")
    expect(novoIdEtapa("07")).toBe("briefing-benchmark")
    for (const id of ["01", "06", "final"]) expect(novoIdEtapa(id)).toBe(id)
  })
})

describe("classificarNumeracao", () => {
  it("classifica: migrada, atual e legada", () => {
    expect(classificarNumeracao({ versaoEtapas: 2, etapas: {} })).toBe("migrada")
    expect(classificarNumeracao({ etapas: { "08": {}, "09": {} } })).toBe("atual")
    expect(classificarNumeracao({ etapas: { "08": {}, final: {} } })).toBe("legada")
  })
  it("o marcador vale mais que a chave 09", () => {
    expect(classificarNumeracao({ versaoEtapas: 2, etapas: { "09": {} } })).toBe("migrada")
  })

  // O app antigo (desde 14/10) injetava uma "09" bloqueada em todo estado legado de 8 etapas que lia e gravava.
  it("legado com a 09 injetada (08 concluída, final em andamento) é legado, não atual", () => {
    expect(classificarNumeracao(estadoDe(LEGADO_COM_09_INJETADA))).toBe("legada")
  })

  it("09 bloqueada com a 08 concluída prova a chave injetada", () => {
    expect(classificarNumeracao(estadoDe({ ...ATUAL, "08": "concluida", "09": "bloqueada", final: "bloqueada" }))).toBe("legada")
  })

  it.each(["liberada", "em_andamento", "pronta", "concluida", "desatualizada"] as StatusEtapa[])(
    "09 bloqueada com a final %s prova a chave injetada",
    (final) => {
      expect(classificarNumeracao(estadoDe({ ...ATUAL, "08": "em_andamento", "09": "bloqueada", final }))).toBe("legada")
    },
  )

  it("9 etapas de verdade com a 09 bloqueada no começo ou no meio do caminho continuam atuais", () => {
    expect(classificarNumeracao(estadoDe(ATUAL))).toBe("atual")
    const tudoBloqueado = Object.fromEntries(Object.keys(ATUAL).map((id) => [id, "bloqueada" as StatusEtapa]))
    expect(classificarNumeracao(estadoDe({ ...tudoBloqueado, "01": "em_andamento" }))).toBe("atual")
    expect(classificarNumeracao(estadoDe(tudoBloqueado))).toBe("atual")
    expect(classificarNumeracao(estadoDe({ ...ATUAL, "08": "desatualizada" }))).toBe("atual")
  })

  it("9 etapas de verdade com a 09 já liberada ou concluída continuam atuais", () => {
    expect(classificarNumeracao(estadoDe({ ...ATUAL, "08": "concluida", "09": "liberada" }))).toBe("atual")
    expect(classificarNumeracao(estadoDe({ ...ATUAL, "08": "concluida", "09": "concluida", final: "em_andamento" }))).toBe("atual")
  })
})

describe("migrarEstado", () => {
  it("recusa estado legado e estado já migrado", () => {
    const legado = estadoDe({ "01": "concluida", "08": "liberada", final: "bloqueada" })
    expect(() => migrarEstado(legado)).toThrow(/legada/)
    expect(() => migrarEstado({ ...estadoDe(ATUAL), versaoEtapas: 2 })).toThrow(/migrada/)
  })

  it("recusa o legado com a 09 injetada pelo app antigo", () => {
    const legado = estadoDe(LEGADO_COM_09_INJETADA, { entregaveis: [entregavel("midia", "07"), entregavel("plano", "08")] })
    expect(() => migrarEstado(legado)).toThrow(/legada/)
  })

  it("lista ausente (perguntas, fila) vira lista vazia em vez de quebrar", () => {
    const estado = estadoDe(ATUAL, { entregaveis: [entregavel("e8", "08")] }) as Partial<EstadoMigravel>
    delete estado.perguntas
    delete estado.filaAutomatica
    delete estado.insumos
    const novo = migrarEstado(estado as EstadoMigravel)
    expect(novo.perguntas).toEqual([])
    expect(novo.filaAutomatica).toEqual([])
    expect(novo.insumos).toEqual([])
    expect(novo.entregaveis.map((e) => e.etapa)).toEqual(["07"])
  })

  it("remapeia etapas: 08→07, 09→08, descarta a 07 antiga, mantém final", () => {
    const novo = migrarEstado(estadoDe(ATUAL))
    expect(Object.keys(novo.etapas).sort()).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "final"])
    expect(novo.etapas["07"]?.status).toBe("em_andamento")
    expect(novo.etapas["08"]?.status).toBe("bloqueada")
    expect(novo.etapas.final?.status).toBe("bloqueada")
    expect(novo.etapas["06"]?.status).toBe("concluida")
    expect(novo.versaoEtapas).toBe(2)
  })

  it("carrega o conteúdo da etapa junto com o novo id", () => {
    const estado = estadoDe(ATUAL)
    estado.etapas["08"] = { ...etapaVazia("em_andamento"), sessionId: "sessao-08", handoff: "h08" }
    estado.etapas["07"] = { ...etapaVazia("concluida"), sessionId: "sessao-07-antiga" }
    const novo = migrarEstado(estado)
    expect(novo.etapas["07"]?.sessionId).toBe("sessao-08")
    expect(novo.etapas["07"]?.handoff).toBe("h08")
  })

  it("quem estava na 07 antiga fica com a nova 07 liberada", () => {
    const novo = migrarEstado(
      estadoDe({ ...ATUAL, "07": "em_andamento", "08": "bloqueada", "09": "bloqueada" }),
    )
    expect(novo.etapas["07"]?.status).toBe("liberada")
    expect(novo.etapas["08"]?.status).toBe("bloqueada")
  })

  it("não libera a nova 07 enquanto a 06 não está concluída", () => {
    const novo = migrarEstado(
      estadoDe({ ...ATUAL, "06": "em_andamento", "07": "bloqueada", "08": "bloqueada", "09": "bloqueada" }),
    )
    expect(novo.etapas["07"]?.status).toBe("bloqueada")
  })

  it("remapeia entregáveis, insumos, fila e teste.etapaInicial; descarta os da 07 antiga", () => {
    const estado = estadoDe(ATUAL, {
      entregaveis: [entregavel("e7", "07"), entregavel("e8", "08"), entregavel("e9", "09"), entregavel("e3", "03")],
      insumos: [insumo("i7", "07"), insumo("i8", "08"), insumo("i9", "09")],
      filaAutomatica: [
        { etapa: "07", texto: "f7" },
        { etapa: "08", texto: "f8" },
        { etapa: "09", texto: "f9" },
      ],
      perguntas: [
        { id: "p7", etapa: "07", perguntas: [], status: "respondida", respostas: null, criadoEm: EM, respondidoEm: null },
        { id: "p9", etapa: "09", perguntas: [], status: "respondida", respostas: null, criadoEm: EM, respondidoEm: null },
      ],
      teste: { fixture: "verdeluz", etapaInicial: "08" },
    })
    const novo = migrarEstado(estado)
    expect(novo.entregaveis.map((e) => [e.id, e.etapa])).toEqual([["e8", "07"], ["e9", "08"], ["e3", "03"]])
    expect(novo.insumos.map((i) => [i.insumoId, i.etapa])).toEqual([["i8", "07"], ["i9", "08"]])
    expect(novo.filaAutomatica.map((f) => [f.texto, f.etapa])).toEqual([["f8", "07"], ["f9", "08"]])
    expect(novo.perguntas.map((p) => [p.id, p.etapa])).toEqual([["p9", "08"]])
    expect(novo.teste).toEqual({ fixture: "verdeluz", etapaInicial: "07" })
  })

  it.each([
    ["07", "07"],
    ["08", "07"],
    ["09", "08"],
    ["03", "03"],
    ["final", "final"],
  ])("teste.etapaInicial %s vira %s", (antes, depois) => {
    const novo = migrarEstado(estadoDe(ATUAL, { teste: { fixture: "f", etapaInicial: antes } }))
    expect(novo.teste?.etapaInicial).toBe(depois)
  })

  it("não altera o estado de entrada", () => {
    const estado = estadoDe(ATUAL, { entregaveis: [entregavel("e8", "08")] })
    const copia = structuredClone(estado)
    migrarEstado(estado)
    expect(estado).toEqual(copia)
  })

  it("é idempotente pelo marcador: migrarEstado(migrarEstado(x)) lança, classificarNumeracao diz migrada", () => {
    const uma = migrarEstado(estadoDe(ATUAL))
    expect(classificarNumeracao(uma)).toBe("migrada")
    expect(() => migrarEstado(uma)).toThrow(/migrada/)
  })
})

describe("planoDeArquivos", () => {
  const CAMINHOS = [
    ".app/conversas/07.jsonl",
    ".app/conversas/08.jsonl",
    ".app/conversas/09.jsonl",
    ".app/conversas/final.jsonl",
    "contexto/decisoes/07-briefing-e-benchmark.md",
    "contexto/decisoes/08-midia-paga.md",
    "contexto/decisoes/09-plano-de-acao.md",
    "contexto/decisoes/10-apresentacao-final.md",
    "entrega/ativos-aprovados/secoes/07-briefing.md",
    "entrega/ativos-aprovados/secoes/07-benchmark.md",
    "entrega/ativos-aprovados/secoes/08-midia-paga.md",
    "entrega/ativos-aprovados/benchmark/benchmark.html",
    "entrega/ativos-aprovados/graficos/roas-global.png",
  ]

  it("arquiva a 07 antiga antes das renomeações", () => {
    const plano = planoDeArquivos(CAMINHOS)
    const pares = Object.fromEntries(plano.map((m) => [m.de, m.para]))
    expect(pares).toEqual({
      ".app/conversas/07.jsonl": "entrega/arquivo-etapa-07/conversas/07.jsonl",
      ".app/conversas/08.jsonl": ".app/conversas/07.jsonl",
      ".app/conversas/09.jsonl": ".app/conversas/08.jsonl",
      "contexto/decisoes/07-briefing-e-benchmark.md": "entrega/arquivo-etapa-07/decisoes/07-briefing-e-benchmark.md",
      "contexto/decisoes/08-midia-paga.md": "contexto/decisoes/07-midia-paga.md",
      "contexto/decisoes/09-plano-de-acao.md": "contexto/decisoes/08-plano-de-acao.md",
      "contexto/decisoes/10-apresentacao-final.md": "contexto/decisoes/09-apresentacao-final.md",
      "entrega/ativos-aprovados/secoes/07-briefing.md": "entrega/arquivo-etapa-07/secoes/07-briefing.md",
      "entrega/ativos-aprovados/secoes/07-benchmark.md": "entrega/arquivo-etapa-07/secoes/07-benchmark.md",
      "entrega/ativos-aprovados/secoes/08-midia-paga.md": "entrega/ativos-aprovados/secoes/07-midia-paga.md",
      "entrega/ativos-aprovados/benchmark/benchmark.html": "entrega/arquivo-etapa-07/benchmark/benchmark.html",
    })
    expect(plano).toHaveLength(11)
  })

  it("ordena: todo arquivamento antes de qualquer renomeação, e renomeações em ordem crescente", () => {
    const plano = planoDeArquivos([...CAMINHOS].reverse())
    const indiceDe = (de: string) => plano.findIndex((m) => m.de === de)
    const arquivamentos = plano.filter((m) => m.para.startsWith("entrega/arquivo-etapa-07/"))
    const renomeacoes = plano.filter((m) => !m.para.startsWith("entrega/arquivo-etapa-07/"))
    expect(arquivamentos).toHaveLength(5)
    const ultimoArquivamento = Math.max(...arquivamentos.map((m) => indiceDe(m.de)))
    const primeiraRenomeacao = Math.min(...renomeacoes.map((m) => indiceDe(m.de)))
    expect(ultimoArquivamento).toBeLessThan(primeiraRenomeacao)
    expect(indiceDe(".app/conversas/08.jsonl")).toBeLessThan(indiceDe(".app/conversas/09.jsonl"))
    expect(indiceDe("contexto/decisoes/09-plano-de-acao.md")).toBeLessThan(indiceDe("contexto/decisoes/10-apresentacao-final.md"))
  })

  it("é executável em sequência: nenhum destino repete outro nem pisa num arquivo ainda não movido", () => {
    const plano = planoDeArquivos(CAMINHOS)
    const destinos = plano.map((m) => m.para)
    expect(new Set(destinos).size).toBe(destinos.length)
    const existentes = new Set(CAMINHOS)
    for (const m of plano) {
      expect(existentes.has(m.para)).toBe(false)
      existentes.delete(m.de)
      existentes.add(m.para)
    }
  })

  it("não mexe no que não pertence a nenhuma etapa renumerada", () => {
    expect(planoDeArquivos(["contexto/decisoes/06-metas.md", "entrega/ativos-aprovados/graficos/roas-global.png", "CLAUDE.md"])).toEqual([])
  })

  it("trata os anexos do chat (.app/anexos/<etapa>/): arquiva os da 07 antiga e renumera 08 e 09, na ordem", () => {
    const plano = planoDeArquivos([
      ".app/anexos/09/3-plano.xlsx",
      ".app/anexos/08/2-midia.pdf",
      ".app/anexos/07/1-briefing.docx",
      ".app/anexos/06/0-metas.xlsx",
      ".app/anexos/final/4-deck.pptx",
    ])
    expect(plano).toEqual([
      { de: ".app/anexos/07/1-briefing.docx", para: "entrega/arquivo-etapa-07/anexos/1-briefing.docx" },
      { de: ".app/anexos/08/2-midia.pdf", para: ".app/anexos/07/2-midia.pdf" },
      { de: ".app/anexos/09/3-plano.xlsx", para: ".app/anexos/08/3-plano.xlsx" },
    ])
  })

  it("trata kit-de-teste/NN/ e conversas de cliente de teste", () => {
    const plano = planoDeArquivos([
      "kit-de-teste/06/dados.csv",
      "kit-de-teste/07/briefing.docx",
      "kit-de-teste/08/midia/plano.xlsx",
      "kit-de-teste/09/acao.md",
      ".app/conversas/07.jsonl",
      ".app/conversas/08.jsonl",
    ])
    const dePara = (fatia: typeof plano) => Object.fromEntries(fatia.map((m) => [m.de, m.para]))
    expect(plano).toHaveLength(5)
    expect(dePara(plano.slice(0, 2))).toEqual({
      "kit-de-teste/07/briefing.docx": "entrega/arquivo-etapa-07/kit-de-teste/briefing.docx",
      ".app/conversas/07.jsonl": "entrega/arquivo-etapa-07/conversas/07.jsonl",
    })
    expect(dePara(plano.slice(2, 4))).toEqual({
      "kit-de-teste/08/midia/plano.xlsx": "kit-de-teste/07/midia/plano.xlsx",
      ".app/conversas/08.jsonl": ".app/conversas/07.jsonl",
    })
    expect(plano[4]).toEqual({ de: "kit-de-teste/09/acao.md", para: "kit-de-teste/08/acao.md" })
  })
})

describe("migrarManifesto", () => {
  it("mapeia etapas e kit e descarta a 07 antiga", () => {
    const manifesto: ManifestoMigravel = {
      fixture: "verdeluz",
      prospect: { nome: "Verde Luz", site: null },
      overrides: null,
      arquivos: [
        { caminho: "a.md", etapa: "00" },
        { caminho: "b.md", etapa: "06" },
        { caminho: "c.md", etapa: "07" },
        { caminho: "d.md", etapa: "08" },
        { caminho: "e.md", etapa: "09" },
        { caminho: "f.md", etapa: "final" },
      ],
      kit: { "06": ["b.md"], "07": ["c.md"], "08": ["d.md"], "09": ["e.md"] },
    }
    const novo = migrarManifesto(manifesto)
    expect(novo.arquivos).toEqual([
      { caminho: "a.md", etapa: "00" },
      { caminho: "b.md", etapa: "06" },
      { caminho: "d.md", etapa: "07" },
      { caminho: "e.md", etapa: "08" },
      { caminho: "f.md", etapa: "final" },
    ])
    expect(novo.kit).toEqual({ "06": ["b.md"], "07": ["d.md"], "08": ["e.md"] })
    expect(novo.fixture).toBe("verdeluz")
    expect(manifesto.arquivos).toHaveLength(6)
  })
})
