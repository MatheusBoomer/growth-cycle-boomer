import { describe, expect, it } from "vitest"
import {
  aplicarAjuste,
  classificarBiblioteca,
  sanearAjustes,
  tituloLegivel,
  type AjustesBiblioteca,
  type ArquivoBiblioteca,
} from "../src/biblioteca"
import { estadoInicial } from "../src/maquina-estados"
import type { Entregavel, Estado } from "../src/tipos"
import { catalogoReal } from "./ajuda"

const catalogo = catalogoReal()
const T = "2026-10-01T10:00:00.000Z"
const DEPOIS = "2026-10-02T10:00:00.000Z"

function arq(caminho: string, modificadoEm = T): ArquivoBiblioteca {
  return { caminho, modificadoEm }
}

function entregavel(p: Partial<Entregavel> & Pick<Entregavel, "id">): Entregavel {
  return {
    etapa: "03",
    tipo: "grafico",
    titulo: "Gráfico",
    arquivoRascunho: `.app/propostas/${p.id}.png`,
    nomeFinal: "grafico",
    status: "pendente",
    ajustePedido: null,
    criadoEm: T,
    decididoEm: null,
    ...p,
  }
}

function estadoCom(entregaveis: Entregavel[] = []): Estado {
  return { ...estadoInicial({ slug: "iszi", nome: "Iszi", site: null }, T), entregaveis }
}

function classificar(arquivos: ArquivoBiblioteca[], estado = estadoCom(), ajustes: AjustesBiblioteca = {}) {
  return classificarBiblioteca({ arquivos, estado, catalogo, ajustes })
}

describe("título legível", () => {
  it("tira extensão, prefixo de anexo e hífens, e põe a primeira letra em maiúscula", () => {
    expect(tituloLegivel("cac-mensal.png")).toBe("Cac mensal")
    expect(tituloLegivel("1728830000000-print_ads.png")).toBe("Print ads")
    expect(tituloLegivel("2025-ranking.png")).toBe("2025 ranking")
    expect(tituloLegivel("ação de mídia.png")).toBe("Ação de mídia")
    expect(tituloLegivel(".png")).toBe(".png")
  })
})

describe("aprovados", () => {
  it("pega etapa e título do entregável aprovado; sem entregável vai para sem-etapa", () => {
    const estado = estadoCom([entregavel({ id: "a1", etapa: "04", status: "aprovado", nomeFinal: "cac-mensal", titulo: "CAC mensal" })])
    const itens = classificar(
      [arq("entrega/ativos-aprovados/graficos/cac-mensal.png"), arq("entrega/ativos-aprovados/graficos/roas-mensal.png"), arq(".app/propostas/a1.png")],
      estado,
    )
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa, i.titulo])).toEqual([
      ["entrega/ativos-aprovados/graficos/cac-mensal.png", "aprovado", "04", "CAC mensal"],
      ["entrega/ativos-aprovados/graficos/roas-mensal.png", "aprovado", "sem-etapa", "Roas mensal"],
    ])
    expect(itens[0]).toMatchObject({ id: itens[0]!.caminho, nomeArquivo: "cac-mensal.png", imagens: [itens[0]!.caminho], capa: itens[0]!.caminho })
  })

  it("aceita nome com espaço e acento", () => {
    const [item] = classificar([arq("entrega/ativos-aprovados/graficos/ação de mídia.png")])
    expect(item).toMatchObject({ origem: "aprovado", titulo: "Ação de mídia", nomeArquivo: "ação de mídia.png" })
  })
})

describe("propostas", () => {
  it("pendente vira proposta, substituída vira substituido, órfã fica de fora", () => {
    const estado = estadoCom([
      entregavel({ id: "p1", etapa: "06", titulo: "Cenários" }),
      entregavel({ id: "p0", etapa: "06", status: "substituido", titulo: "Cenários antigos" }),
    ])
    const itens = classificar([arq(".app/propostas/p1.png"), arq(".app/propostas/p0.png"), arq(".app/propostas/orfa.png")], estado)
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa, i.titulo])).toEqual([
      [".app/propostas/p0.png", "substituido", "06", "Cenários antigos"],
      [".app/propostas/p1.png", "proposta", "06", "Cenários"],
    ])
  })
})

describe("anexos e insumos", () => {
  it("anexo na pasta da etapa fica na etapa; solto ou em pasta desconhecida vai para sem-etapa", () => {
    const itens = classificar([
      arq(".app/anexos/02/1728830000000-print_ads.png"),
      arq(".app/anexos/1728830000000-antigo.png"),
      arq(".app/anexos/xx/1-a.png"),
    ])
    // Dentro de sem-etapa, mesma data: desempate pelo caminho.
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa])).toEqual([
      [".app/anexos/02/1728830000000-print_ads.png", "anexo", "02"],
      [".app/anexos/1728830000000-antigo.png", "anexo", "sem-etapa"],
      [".app/anexos/xx/1-a.png", "anexo", "sem-etapa"],
    ])
    expect(itens[0]!.titulo).toBe("Print ads")
  })

  it("imagem na pasta de um insumo do catálogo fica na etapa dona do insumo", () => {
    const itens = classificar([arq("contexto/brutos/prints-campanhas/meta.jpg"), arq("contexto/brutos/prints-campanhas/relatorio.pdf")])
    expect(itens.map((i) => [i.caminho, i.origem, i.etapa])).toEqual([["contexto/brutos/prints-campanhas/meta.jpg", "insumo", "08"]])
  })
})

describe("benchmark", () => {
  it("um item por anúncio, capa primeiro, etapa 07; pasta sem imagem não gera item", () => {
    const base = "dados/benchmark-meta/insider/midia"
    const itens = classificar([
      arq(`${base}/123/video-1-quadro-1.jpg`),
      arq(`${base}/123/video-1-capa.jpg`, DEPOIS),
      arq(`${base}/456/imagem-1.jpg`),
      arq(`${base}/789/video.mp4`),
    ])
    expect(itens).toHaveLength(2)
    const anuncio = itens.find((i) => i.caminho === `${base}/123`)!
    expect(anuncio).toMatchObject({
      origem: "benchmark",
      etapa: "07",
      titulo: "insider · anúncio 123",
      nomeArquivo: "123",
      grupo: { tipo: "anuncio", marca: "insider" },
      capa: `${base}/123/video-1-capa.jpg`,
      imagens: [`${base}/123/video-1-capa.jpg`, `${base}/123/video-1-quadro-1.jpg`],
      modificadoEm: DEPOIS,
    })
    expect(itens.find((i) => i.caminho === `${base}/456`)!.capa).toBe(`${base}/456/imagem-1.jpg`)
  })
})

describe("prévia da apresentação", () => {
  const velha = entregavel({ id: "v1", tipo: "apresentacao", etapa: "final", criadoEm: T, arquivoRascunho: ".app/propostas/v1.pptx" })
  const nova = entregavel({ id: "v2", tipo: "apresentacao", etapa: "final", criadoEm: DEPOIS, arquivoRascunho: ".app/propostas/v2.pptx" })

  it("só a versão mais recente com slides, em ordem, num item só", () => {
    const itens = classificar(
      [arq(".app/previas/v1/slide-01.png"), arq(".app/previas/v2/slide-02.png"), arq(".app/previas/v2/slide-01.png")],
      estadoCom([velha, nova]),
    )
    expect(itens).toEqual([
      {
        id: ".app/previas/v2",
        caminho: ".app/previas/v2",
        origem: "previa",
        etapa: "final",
        titulo: "Apresentação, prévia (2 slides)",
        nomeArquivo: "v2",
        grupo: { tipo: "previa" },
        imagens: [".app/previas/v2/slide-01.png", ".app/previas/v2/slide-02.png"],
        capa: ".app/previas/v2/slide-01.png",
        modificadoEm: T,
      },
    ])
  })

  it("se a versão nova ainda não tem prévia, mostra a anterior", () => {
    const itens = classificar([arq(".app/previas/v1/slide-01.png")], estadoCom([velha, nova]))
    expect(itens.map((i) => [i.caminho, i.titulo])).toEqual([[".app/previas/v1", "Apresentação, prévia (1 slide)"]])
  })
})

describe("o que fica de fora", () => {
  it("rascunhos, recortes de comentário, não imagens e imagens soltas fora das origens", () => {
    const itens = classificar([
      arq(".app/rascunhos/x.png"),
      arq(".app/rascunhos/_work/y.png"),
      arq(".app/comentarios/c1/recorte.png"),
      arq("contexto/notas.md"),
      arq("dados/grafico-solto.png"),
      arq("entrega/ativos-aprovados/graficos/vetor.svg"),
    ])
    expect(itens).toEqual([])
  })
})

describe("ajustes e ordem", () => {
  it("ajuste sobrescreve etapa (inclusive para sem-etapa) e título; ajuste de caminho inexistente é ignorado", () => {
    const estado = estadoCom([entregavel({ id: "a1", etapa: "04", status: "aprovado", nomeFinal: "cac", titulo: "CAC" })])
    const itens = classificar(
      [arq("entrega/ativos-aprovados/graficos/cac.png"), arq("entrega/ativos-aprovados/graficos/roas.png")],
      estado,
      {
        "entrega/ativos-aprovados/graficos/cac.png": { etapa: "sem-etapa" },
        "entrega/ativos-aprovados/graficos/roas.png": { etapa: "03", titulo: "ROAS por mês" },
        "entrega/ativos-aprovados/graficos/apagado.png": { etapa: "02" },
      },
    )
    expect(itens.map((i) => [i.caminho, i.etapa, i.titulo])).toEqual([
      ["entrega/ativos-aprovados/graficos/roas.png", "03", "ROAS por mês"],
      ["entrega/ativos-aprovados/graficos/cac.png", "sem-etapa", "CAC"],
    ])
  })

  it("ordena por etapa (final antes de sem-etapa) e, dentro da etapa, do mais novo para o mais velho", () => {
    const itens = classificar(
      [
        arq("entrega/ativos-aprovados/graficos/solto.png"),
        arq(".app/anexos/final/1-capa.png"),
        arq(".app/anexos/03/1-velho.png", T),
        arq(".app/anexos/03/2-novo.png", DEPOIS),
      ],
    )
    expect(itens.map((i) => i.caminho)).toEqual([
      ".app/anexos/03/2-novo.png",
      ".app/anexos/03/1-velho.png",
      ".app/anexos/final/1-capa.png",
      "entrega/ativos-aprovados/graficos/solto.png",
    ])
  })
})

describe("aplicarAjuste", () => {
  it("grava etapa e título, título vazio volta ao automático, ajuste vazio sai do arquivo", () => {
    let a = aplicarAjuste({}, "x.png", { etapa: "03", titulo: "  CAC  " })
    expect(a).toEqual({ "x.png": { etapa: "03", titulo: "CAC" } })
    a = aplicarAjuste(a, "x.png", { titulo: "" })
    expect(a).toEqual({ "x.png": { etapa: "03" } })
    a = aplicarAjuste({ "y.png": { titulo: "Y" } }, "y.png", { titulo: "   " })
    expect(a).toEqual({})
  })
})

describe("sanearAjustes", () => {
  it("formato errado vira vazio e entradas inválidas são descartadas", () => {
    expect(sanearAjustes(null)).toEqual({})
    expect(sanearAjustes([1, 2])).toEqual({})
    expect(sanearAjustes("oi")).toEqual({})
    expect(
      sanearAjustes({
        "a.png": { etapa: "03", titulo: " A " },
        "b.png": { etapa: "99", titulo: 5 },
        "c.png": null,
        "d.png": { etapa: "sem-etapa" },
      }),
    ).toEqual({ "a.png": { etapa: "03", titulo: "A" }, "d.png": { etapa: "sem-etapa" } })
  })
})
