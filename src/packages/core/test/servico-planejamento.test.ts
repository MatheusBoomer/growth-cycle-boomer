import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import {
  ErroCaminhoForaDoProspect,
  ErroEntrada,
  ErroNaoEncontrado,
  ErroProspectExistente,
  ErroTurnoAtivo,
  TransicaoInvalida,
} from "../src/erros"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import type { EventoTempoReal, ResultadoValidacao } from "../src/tipos"
import { catalogoReal, raizTemporaria } from "./ajuda"

let raiz: string
let servico: ServicoPlanejamento
let barramento: Barramento
let eventos: EventoTempoReal[]
let enfileirados: string[]
let ocupado: boolean
let proximaValidacao: ResultadoValidacao
let contador: number

beforeEach(async () => {
  raiz = await raizTemporaria()
  barramento = new Barramento()
  eventos = []
  enfileirados = []
  ocupado = false
  contador = 0
  proximaValidacao = {
    ok: true,
    problemas: [],
    avisos: [],
    resumo: "12 meses (JANEIRO a DEZEMBRO)",
  }
  servico = new ServicoPlanejamento({
    armazenamento: new FsArmazenamento(raiz, async () => {}),
    catalogo: catalogoReal(),
    barramento,
    validar: async () => proximaValidacao,
    agora: () => "2026-09-28T10:00:00.000Z",
    gerarId: () => `id${++contador}`,
  })
  servico.conectarTurnos({
    aoEnfileirar: (s) => enfileirados.push(s),
    estaOcupado: () => ocupado,
  })
})

const ctx03 = { slug: "iszi-cosmeticos", etapa: "03" as const }

async function prospectNaEtapa03() {
  const slug = await servico.criarProspect(
    "Iszi Cosméticos",
    "https://iszi.com.br"
  )
  const e = await servico.estado(slug)
  // atalho de teste: marca 01 e 02 como concluídas direto no arquivo
  e.etapas["01"].status = "concluida"
  e.etapas["02"].status = "concluida"
  e.etapas["03"].status = "liberada"
  await writeFile(
    path.join(raiz, "clientes", slug, ".app/estado.json"),
    JSON.stringify(e)
  )
  await servico.iniciarEtapa(slug, "03")
  return slug
}

async function rascunho(slug: string, nome: string, conteudo = "png") {
  const dir = path.join(raiz, "clientes", slug, ".app/rascunhos")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, nome), conteudo)
}

describe("criar e excluir prospect", () => {
  it("cria pasta, estado, status, título do CLAUDE.md e registra o site", async () => {
    const slug = await servico.criarProspect(
      "  Iszi Cosméticos ",
      "https://iszi.com.br"
    )
    expect(slug).toBe("iszi-cosmeticos")
    const pasta = path.join(raiz, "clientes", slug)
    expect(await readFile(path.join(pasta, "CLAUDE.md"), "utf8")).toMatch(
      /^# Iszi Cosméticos/
    )
    expect(
      await readFile(path.join(pasta, "contexto/site-referencia.md"), "utf8")
    ).toContain("**Link:** https://iszi.com.br/")
    expect(
      await readFile(
        path.join(pasta, "contexto/status-planejamento.md"),
        "utf8"
      )
    ).toContain("| 00 · Criar prospect | ✅ |")
    const e = await servico.estado(slug)
    expect(e.insumos.find((i) => i.insumoId === "site")?.status).toBe("valido")
  })

  it.each(["", "   ", "!!!", "Template"])(
    "recusa nome inválido %j",
    async (nome) => {
      await expect(servico.criarProspect(nome, null)).rejects.toBeInstanceOf(
        ErroEntrada
      )
    }
  )

  it("recusa site sem http(s) e nome repetido", async () => {
    await expect(
      servico.criarProspect("A", "iszi.com.br")
    ).rejects.toBeInstanceOf(ErroEntrada)
    await servico.criarProspect("A", null)
    await expect(servico.criarProspect("a", null)).rejects.toBeInstanceOf(
      ErroProspectExistente
    )
  })

  it("exclusão exige confirmação exata e nenhum turno ativo", async () => {
    const slug = await servico.criarProspect("A", null)
    await expect(servico.excluirProspect(slug, "b")).rejects.toBeInstanceOf(
      ErroEntrada
    )
    ocupado = true
    await expect(servico.excluirProspect(slug, "a")).rejects.toBeInstanceOf(
      ErroTurnoAtivo
    )
    ocupado = false
    await servico.excluirProspect(slug, "a")
  })
})

describe("prospect antigo, feito no terminal", () => {
  it("importa do status-planejamento.md e reconhece insumos já na pasta", async () => {
    const pasta = path.join(raiz, "clientes", "adda")
    await mkdir(path.join(pasta, "contexto"), { recursive: true })
    await mkdir(path.join(pasta, "dados"), { recursive: true })
    await writeFile(path.join(pasta, "CLAUDE.md"), "# Adda\n")
    await writeFile(path.join(pasta, "dados/historico-mensal.xlsx"), "x")
    await writeFile(
      path.join(pasta, "contexto/status-planejamento.md"),
      "| 00 · Criar prospect | ✅ | 2026-09-21 | |\n| 01 · Preparação de contexto | ✅ | 2026-09-21 | |\n| 02 · Contextualização estratégica | ✅ | 2026-09-21 | |\n"
    )
    const [resumo] = await servico.listarProspects()
    expect(resumo).toMatchObject({
      slug: "adda",
      nome: "Adda",
      etapaAtual: "03",
      concluidas: 2,
    })
    const e = await servico.estado("adda")
    expect(e.etapas["01"].origem).toBe("terminal")
    expect(
      e.insumos.find((i) => i.insumoId === "historico-mensal")?.status
    ).toBe("valido")
  })
})

describe("ferramentas do agente", () => {
  it("propor_entregavel recusa arquivo inexistente ou fora de rascunhos", async () => {
    const slug = await prospectNaEtapa03()
    const base = {
      tipo: "grafico",
      titulo: "Investimento",
      nome_final: "investimento-total-mensal",
    }
    const semArquivo = await servico.ferramenta(ctx03, "propor_entregavel", {
      ...base,
      arquivo_rascunho: ".app/rascunhos/nao.png",
    })
    expect(semArquivo).toMatchObject({
      ok: false,
      mensagem: expect.stringContaining("não encontrado"),
    })
    const fora = await servico.ferramenta(ctx03, "propor_entregavel", {
      ...base,
      arquivo_rascunho: "../outro/x.png",
    })
    expect(fora.ok).toBe(false)
    await writeFile(path.join(raiz, "clientes", slug, "dados/g.png"), "x")
    const foraRascunho = await servico.ferramenta(ctx03, "propor_entregavel", {
      ...base,
      arquivo_rascunho: "dados/g.png",
    })
    expect(foraRascunho).toMatchObject({
      ok: false,
      mensagem: expect.stringContaining(".app/rascunhos/"),
    })
  })

  it("propor_entregavel aceita caminho absoluto ou relativo à raiz, congela a cópia e cria o card", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png", "versao-1")
    const r = await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento total — mensal",
      arquivo_rascunho: path.join(
        raiz,
        "clientes",
        slug,
        ".app/rascunhos/g.png"
      ),
      nome_final: "investimento-total-mensal",
    })
    expect(r.ok).toBe(true)
    await rascunho(slug, "g.png", "versao-2")
    const e = await servico.estado(slug)
    expect(e.entregaveis[0]).toMatchObject({
      id: "id1",
      status: "pendente",
      arquivoRascunho: ".app/propostas/id1.png",
    })
    expect(
      await readFile(
        path.join(raiz, "clientes", slug, ".app/propostas/id1.png"),
        "utf8"
      )
    ).toBe("versao-1")
    expect((await servico.conversa(slug, "03")).at(-1)).toMatchObject({
      tipo: "card_entregavel",
      entregavelId: "id1",
    })
  })

  it("aprovar copia para ativos-aprovados e enfileira a mensagem ao agente", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/g.png`,
      nome_final: "investimento-total-mensal",
    })
    await servico.aprovarEntregavel(slug, "id1")
    expect(
      existsSync(
        path.join(
          raiz,
          "clientes",
          slug,
          "entrega/ativos-aprovados/graficos/investimento-total-mensal.png"
        )
      )
    ).toBe(true)
    expect(enfileirados).toEqual([slug])
    expect((await servico.retirarFila(slug))?.texto).toContain("APROVOU")
    expect(await servico.retirarFila(slug)).toBeNull()
  })

  it("solicitar_insumo só aceita insumo da etapa", async () => {
    const slug = await prospectNaEtapa03()
    expect(
      (
        await servico.ferramenta(ctx03, "solicitar_insumo", {
          insumo_id: "clientes-historico",
        })
      ).ok
    ).toBe(false)
    expect(
      (
        await servico.ferramenta(ctx03, "solicitar_insumo", {
          insumo_id: "historico-mensal",
        })
      ).ok
    ).toBe(true)
    expect((await servico.conversa(slug, "03")).at(-1)).toMatchObject({
      tipo: "card_insumo",
      insumoId: "historico-mensal",
    })
  })

  it("sinalizar lista o que falta; concluir grava o arquivo de decisões e libera a 04", async () => {
    const slug = await prospectNaEtapa03()
    const sinal = {
      resumo_decisoes: "- ROAS médio 7,68x",
      handoff_proxima: "Me manda a planilha de clientes.",
    }
    const antes = await servico.ferramenta(
      ctx03,
      "sinalizar_etapa_pronta",
      sinal
    )
    expect(antes.mensagem).toContain("Histórico mensal")
    const temp = path.join(raiz, "upload.xlsx")
    await writeFile(temp, "x")
    await servico.receberInsumoArquivo(
      slug,
      "03",
      "historico-mensal",
      temp,
      "Histórico.xlsx"
    )
    expect((await servico.estado(slug)).etapas["03"].status).toBe("pronta")
    await servico.concluirEtapa(slug, "03")
    const decisoes = await readFile(
      path.join(
        raiz,
        "clientes",
        slug,
        "contexto/decisoes/03-diagnostico-performance.md"
      ),
      "utf8"
    )
    expect(decisoes).toContain("- ROAS médio 7,68x")
    expect((await servico.estado(slug)).etapas["04"].status).toBe("liberada")
  })

  it("ferramenta desconhecida e entrada sem campo obrigatório viram erro para o agente", async () => {
    await prospectNaEtapa03()
    expect((await servico.ferramenta(ctx03, "xyz", {})).ok).toBe(false)
    expect(
      (
        await servico.ferramenta(ctx03, "propor_entregavel", {
          tipo: "grafico",
        })
      ).mensagem
    ).toContain("titulo")
  })
})

describe("arquivos aprovados fora da interface", () => {
  it("lista o que está em ativos-aprovados sem aprovação pela interface (terminal ou escrito direto)", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento",
      arquivo_rascunho: ".app/rascunhos/g.png",
      nome_final: "investimento-total-mensal",
    })
    await servico.aprovarEntregavel(slug, "id1")
    const pasta = path.join(raiz, "clientes", slug, "entrega/ativos-aprovados")
    await writeFile(path.join(pasta, "graficos/feito-no-terminal.png"), "x")
    await writeFile(path.join(pasta, "secoes/03-macro-financeiro.md"), "x")
    const r = await servico.respostaEstado(slug, null)
    expect(r.aprovadosForaDaInterface).toEqual([
      "entrega/ativos-aprovados/graficos/feito-no-terminal.png",
      "entrega/ativos-aprovados/secoes/03-macro-financeiro.md",
    ])
  })
})

describe("insumos", () => {
  it("formato errado é recusado sem chamar o validador", async () => {
    const slug = await prospectNaEtapa03()
    const temp = path.join(raiz, "upload.csv")
    await writeFile(temp, "x")
    const r = await servico.receberInsumoArquivo(
      slug,
      "03",
      "historico-mensal",
      temp,
      "hist.csv"
    )
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain(".xlsx")
    expect(existsSync(temp)).toBe(false)
  })

  it("planilha inválida fica registrada com os problemas e não vai para dados/", async () => {
    const slug = await prospectNaEtapa03()
    proximaValidacao = {
      ok: false,
      problemas: ["Esperados 12 meses, encontrados 10."],
      avisos: [],
      resumo: null,
    }
    const temp = path.join(raiz, "upload.xlsx")
    await writeFile(temp, "x")
    await servico.receberInsumoArquivo(
      slug,
      "03",
      "historico-mensal",
      temp,
      "hist.xlsx"
    )
    const e = await servico.estado(slug)
    expect(
      e.insumos.find((i) => i.insumoId === "historico-mensal")
    ).toMatchObject({ status: "invalido" })
    expect(
      existsSync(
        path.join(raiz, "clientes", slug, "dados/historico-mensal.xlsx")
      )
    ).toBe(false)
  })
})

describe("robustez", () => {
  it("duas mutações simultâneas não perdem atualização", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "a.png")
    await rascunho(slug, "b.png")
    await Promise.all([
      servico.ferramenta(ctx03, "propor_entregavel", {
        tipo: "grafico",
        titulo: "A",
        arquivo_rascunho: ".app/rascunhos/a.png",
        nome_final: "grafico-a",
      }),
      servico.ferramenta(ctx03, "propor_entregavel", {
        tipo: "grafico",
        titulo: "B",
        arquivo_rascunho: ".app/rascunhos/b.png",
        nome_final: "grafico-b",
      }),
      servico.enfileirar(slug, "03", "mensagem"),
    ])
    const e = await servico.estado(slug)
    expect(e.entregaveis.map((x) => x.titulo).sort()).toEqual(["A", "B"])
    expect(e.filaAutomatica).toHaveLength(1)
  })

  it("turno sem fim e sem processo ativo aparece como interrompido", async () => {
    const slug = await prospectNaEtapa03()
    await servico.registrarConversa(slug, "03", {
      tipo: "turno_inicio",
      em: "t",
    })
    await servico.registrarConversa(slug, "03", {
      tipo: "texto_agente",
      texto: "Começando…",
      em: "t",
    })
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.at(-1)).toMatchObject({
      tipo: "turno_fim",
      status: "interrompido",
    })
    expect(
      (await servico.conversa(slug, "03")).filter((e) => e.tipo === "turno_fim")
    ).toHaveLength(1)
  })

  it("publica estado a cada gravação", async () => {
    const slug = await servico.criarProspect("A", null)
    barramento.assinar(slug, (ev) => eventos.push(ev))
    await servico.iniciarEtapa(slug, "01")
    expect(eventos.map((e) => e.tipo)).toContain("estado")
    expect(eventos.map((e) => e.tipo)).toContain("conversa")
  })
})

describe("card de perguntas", () => {
  const perguntas = [
    {
      enunciado: "Qual cenário usar como meta?",
      multipla: false,
      opcoes: [
        { rotulo: "Pessimista" },
        { rotulo: "Realista" },
        { rotulo: "Otimista" },
      ],
    },
    {
      enunciado: "Quais canais priorizar?",
      multipla: true,
      opcoes: [{ rotulo: "Meta Ads" }, { rotulo: "Google Ads" }],
    },
  ]
  const respostas = [
    { selecionadas: ["Realista"], outra: null },
    {
      selecionadas: ["Meta Ads", "Google Ads"],
      outra: "testar TikTok só no Q4",
    },
  ]

  async function comPerguntas() {
    const slug = await prospectNaEtapa03()
    const r = await servico.ferramenta(ctx03, "fazer_perguntas", { perguntas })
    expect(r.ok).toBe(true)
    const id = (await servico.estado(slug)).perguntas.at(-1)!.id
    return { slug, id, r }
  }

  it("fazer_perguntas cria o conjunto pendente, o card e pede para encerrar", async () => {
    const { slug, id, r } = await comPerguntas()
    expect(r.mensagem).toContain("Encerre sua resposta")
    const e = await servico.estado(slug)
    expect(e.perguntas).toHaveLength(1)
    expect(e.perguntas[0]).toMatchObject({
      id,
      etapa: "03",
      status: "pendente",
    })
    expect(
      (await servico.conversa(slug, "03")).some(
        (ev) => ev.tipo === "card_perguntas" && ev.conjuntoId === id
      )
    ).toBe(true)
  })

  it("fazer_perguntas inválida volta como erro para o agente, sem criar card", async () => {
    const slug = await prospectNaEtapa03()
    const r = await servico.ferramenta(ctx03, "fazer_perguntas", {
      perguntas: [],
    })
    expect(r.ok).toBe(false)
    expect(r.mensagem).toContain("1 a 4")
    expect((await servico.estado(slug)).perguntas).toEqual([])
  })

  it("responder marca respondida e enfileira as respostas formatadas", async () => {
    const { slug, id } = await comPerguntas()
    await servico.responderPerguntas(slug, id, respostas)
    expect((await servico.estado(slug)).perguntas[0]?.status).toBe("respondida")
    expect(enfileirados).toEqual([slug])
    const texto = (await servico.retirarFila(slug))?.texto ?? ""
    expect(texto.split("\n")[0]).toContain("RESPONDEU")
    expect(texto).toContain("1. Qual cenário usar como meta? → Realista")
    expect(texto).toContain(
      '2. Quais canais priorizar? → Meta Ads; Google Ads; Outra: "testar TikTok só no Q4"'
    )
    await expect(
      servico.responderPerguntas(slug, id, respostas)
    ).rejects.toBeInstanceOf(TransicaoInvalida)
  })

  it("Outra com várias linhas continua na linha numerada da resposta", async () => {
    const { slug, id } = await comPerguntas()
    await servico.responderPerguntas(slug, id, [
      { selecionadas: ["Realista"], outra: null },
      {
        selecionadas: [],
        outra: "testar TikTok\n\n2. no Q4\r\n  e depois revisar",
      },
    ])
    const texto = (await servico.retirarFila(slug))?.texto ?? ""
    expect(texto).toContain(
      '2. Quais canais priorizar? → Outra: "testar TikTok 2. no Q4 e depois revisar"'
    )
    expect(texto.split("\n")).toHaveLength(4)
  })

  it("pergunta nova substitui a pendente; a antiga não aceita resposta", async () => {
    const { slug, id } = await comPerguntas()
    await servico.ferramenta(ctx03, "fazer_perguntas", { perguntas })
    expect((await servico.estado(slug)).perguntas.map((c) => c.status)).toEqual(
      ["sem_resposta", "pendente"]
    )
    await expect(
      servico.responderPerguntas(slug, id, respostas)
    ).rejects.toBeInstanceOf(TransicaoInvalida)
    expect(enfileirados).toEqual([])
  })

  it("resposta inválida, conjunto inexistente e etapa fechada são recusados sem enfileirar", async () => {
    const { slug, id } = await comPerguntas()
    await expect(
      servico.responderPerguntas(slug, id, [respostas[0]])
    ).rejects.toBeInstanceOf(ErroEntrada)
    await expect(
      servico.responderPerguntas(slug, "nao-existe", respostas)
    ).rejects.toBeInstanceOf(ErroNaoEncontrado)
    const e = await servico.estado(slug)
    e.etapas["03"].status = "concluida"
    await writeFile(
      path.join(raiz, "clientes", slug, ".app/estado.json"),
      JSON.stringify(e)
    )
    await expect(
      servico.responderPerguntas(slug, id, respostas)
    ).rejects.toBeInstanceOf(TransicaoInvalida)
    expect(enfileirados).toEqual([])
  })
})

describe("biblioteca", () => {
  async function imagem(slug: string, rel: string) {
    const abs = path.join(raiz, "clientes", slug, rel)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, "png")
  }

  it("anexo vai para a pasta da etapa, aparece na biblioteca e avisa as telas abertas", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    barramento.assinar(slug, (ev) => eventos.push(ev))
    const caminho = await servico.salvarAnexo(
      slug,
      "02",
      "Print Ads.png",
      new Uint8Array([1])
    )
    expect(caminho).toMatch(
      /^clientes\/iszi-cosmeticos\/\.app\/anexos\/02\/\d+-Print_Ads\.png$/
    )
    expect(eventos).toContainEqual({ tipo: "estado" })
    const anexo = (await servico.listarBiblioteca(slug)).find(
      (i) => i.origem === "anexo"
    )
    expect(anexo).toMatchObject({ etapa: "02", titulo: "Print Ads" })
  })

  it("ajusta etapa e título; título vazio volta ao automático; avisa as telas", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    const rel = "entrega/ativos-aprovados/graficos/cac-mensal.png"
    await imagem(slug, rel)
    barramento.assinar(slug, (ev) => eventos.push(ev))

    let item = await servico.ajustarBiblioteca(slug, rel, {
      etapa: "04",
      titulo: "CAC mensal (12 meses)",
    })
    expect(item).toMatchObject({
      caminho: rel,
      etapa: "04",
      titulo: "CAC mensal (12 meses)",
    })
    expect(eventos).toContainEqual({ tipo: "estado" })
    const salvo = JSON.parse(
      await readFile(
        path.join(raiz, "clientes", slug, ".app/biblioteca.json"),
        "utf8"
      )
    )
    expect(salvo).toEqual({
      [rel]: { etapa: "04", titulo: "CAC mensal (12 meses)" },
    })

    item = await servico.ajustarBiblioteca(slug, rel, { titulo: "  " })
    expect(item).toMatchObject({ etapa: "04", titulo: "Cac mensal" })
  })

  it("recusa etapa inválida, título não texto, caminho fora do prospect e arquivo que não é imagem da biblioteca", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    const rel = "entrega/ativos-aprovados/graficos/cac.png"
    await imagem(slug, rel)
    await expect(
      servico.ajustarBiblioteca(slug, rel, { etapa: "09" })
    ).rejects.toBeInstanceOf(ErroEntrada)
    await expect(
      servico.ajustarBiblioteca(slug, rel, { titulo: 5 })
    ).rejects.toBeInstanceOf(ErroEntrada)
    await expect(
      servico.ajustarBiblioteca(slug, "../outro/x.png", { etapa: "03" })
    ).rejects.toBeInstanceOf(ErroCaminhoForaDoProspect)
    await expect(
      servico.ajustarBiblioteca(slug, "CLAUDE.md", { etapa: "03" })
    ).rejects.toBeInstanceOf(ErroNaoEncontrado)
    await expect(
      servico.ajustarBiblioteca(
        slug,
        "entrega/ativos-aprovados/graficos/nao-existe.png",
        { etapa: "03" }
      )
    ).rejects.toBeInstanceOf(ErroNaoEncontrado)
    expect(
      existsSync(path.join(raiz, "clientes", slug, ".app/biblioteca.json"))
    ).toBe(false)
  })

  it("biblioteca.json corrompido é lido como vazio e reescrito no próximo ajuste; ajuste de arquivo apagado sai", async () => {
    const slug = await servico.criarProspect("Iszi Cosméticos", null)
    const rel = "entrega/ativos-aprovados/graficos/cac.png"
    await imagem(slug, rel)
    const arquivoAjustes = path.join(
      raiz,
      "clientes",
      slug,
      ".app/biblioteca.json"
    )
    await writeFile(arquivoAjustes, "{oops")
    expect((await servico.listarBiblioteca(slug)).map((i) => i.etapa)).toEqual([
      "sem-etapa",
    ])

    await writeFile(
      arquivoAjustes,
      JSON.stringify({
        "entrega/ativos-aprovados/graficos/apagado.png": { etapa: "02" },
      })
    )
    await servico.ajustarBiblioteca(slug, rel, { etapa: "03" })
    expect(JSON.parse(await readFile(arquivoAjustes, "utf8"))).toEqual({
      [rel]: { etapa: "03" },
    })
  })
})
