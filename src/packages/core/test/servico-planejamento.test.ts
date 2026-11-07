import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
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
import { NuvemArmazenamento } from "../src/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "../src/nuvem/memoria"
import { Mesa } from "../src/nuvem/mesa"
import type { UsuarioComPapel } from "../src/papeis"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import type { EventoTempoReal, ResultadoValidacao } from "../src/tipos"
import { pastaDoFixture } from "../src/fixture"
import { catalogoReal, raizTemporaria } from "./ajuda"
import { criarFixtureMinimo } from "./fixture-minimo"

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

const ADMIN: UsuarioComPapel = { email: null, papel: "admin" }

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
    const [resumo] = await servico.listarProspects(ADMIN)
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

  it("editar seção pendente grava o rascunho e a aprovação avisa a IA da edição", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "s.md", "# Texto da IA")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "secao",
      titulo: "Macro financeiro",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/s.md`,
      nome_final: "macro-financeiro",
    })
    await servico.editarEntregavel(slug, "id1", "# Texto corrigido pelo analista")
    const e = await servico.estado(slug)
    const alvo = e.entregaveis.find((x) => x.id === "id1")!
    expect(alvo.editadoEm).toBe("2026-09-28T10:00:00.000Z")
    expect(await readFile(path.join(raiz, "clientes", slug, alvo.arquivoRascunho), "utf8")).toBe("# Texto corrigido pelo analista")
    await servico.aprovarEntregavel(slug, "id1")
    expect(await readFile(path.join(raiz, "clientes", slug, "entrega/ativos-aprovados/secoes/03-macro-financeiro.md"), "utf8")).toBe(
      "# Texto corrigido pelo analista",
    )
    expect((await servico.retirarFila(slug))?.texto).toMatch(/editou o texto antes de aprovar/)
  })

  it("editar recusa entregável que não é seção, já decidido ou texto vazio", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/g.png`,
      nome_final: "investimento-total-mensal",
    })
    await expect(servico.editarEntregavel(slug, "id1", "x")).rejects.toBeInstanceOf(ErroEntrada)
    await rascunho(slug, "s.md", "# A")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "secao",
      titulo: "Macro",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/s.md`,
      nome_final: "macro-financeiro",
    })
    const secao = (await servico.estado(slug)).entregaveis.find((x) => x.tipo === "secao")!.id
    await expect(servico.editarEntregavel(slug, secao, "   ")).rejects.toBeInstanceOf(ErroEntrada)
    await servico.aprovarEntregavel(slug, secao)
    await expect(servico.editarEntregavel(slug, secao, "# B")).rejects.toBeInstanceOf(TransicaoInvalida)
  })

  it("pedir ajuste com imagem anotada grava o PNG e passa o caminho para a IA", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/g.png`,
      nome_final: "investimento-total-mensal",
    })
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    await servico.pedirAjuste(slug, "id1", "1. Eixo X: trocar para meses por extenso", png)
    const alvo = (await servico.estado(slug)).entregaveis.find((x) => x.id === "id1")!
    expect(alvo.ajustePedido).toBe("1. Eixo X: trocar para meses por extenso")
    const relativo = ".app/ajustes/id1/ajuste-1.png"
    expect(await readFile(path.join(raiz, "clientes", slug, relativo))).toEqual(Buffer.from(png))
    const mensagem = (await servico.retirarFila(slug))?.texto ?? ""
    expect(mensagem).toContain("1. Eixo X: trocar para meses por extenso")
    expect(mensagem).toContain(`clientes/${slug}/${relativo}`)
  })

  it("pedir ajuste sem imagem segue como antes, sem caminho de imagem", async () => {
    const slug = await prospectNaEtapa03()
    await rascunho(slug, "g.png")
    await servico.ferramenta(ctx03, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/g.png`,
      nome_final: "investimento-total-mensal",
    })
    await servico.pedirAjuste(slug, "id1", "trocar para barras")
    expect(existsSync(path.join(raiz, "clientes", slug, ".app/ajustes"))).toBe(false)
    expect((await servico.retirarFila(slug))?.texto).not.toContain(".app/ajustes")
  })

  describe("pedirAjustes (mensagem do chat com referências)", () => {
    async function doisGraficos() {
      const slug = await prospectNaEtapa03()
      for (const [arq, titulo, nome] of [
        ["a.png", "Investimento", "investimento-total-mensal"],
        ["b.png", "Receita", "receita-mensal"],
      ] as const) {
        await rascunho(slug, arq)
        await servico.ferramenta(ctx03, "propor_entregavel", {
          tipo: "grafico",
          titulo,
          arquivo_rascunho: `clientes/${slug}/.app/rascunhos/${arq}`,
          nome_final: nome,
        })
      }
      return slug
    }
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const retangulo = { forma: "retangulo" as const, x: 10, y: 20, w: 30, h: 40 }
    const numero = { forma: "numero" as const, x: 50, y: 60, w: 0, h: 0 }

    it("numera as marcações de forma contínua entre os gráficos e monta a mensagem do agente", async () => {
      const slug = await doisGraficos()
      const r = await servico.pedirAjustes(slug, "03", "1: eixo X em meses; 3: trocar a cor", [
        { entregavelId: "id1", marcas: [retangulo, numero], imagem: png },
        { entregavelId: "id2", marcas: [numero], imagem: png },
      ])
      expect(r.referencias).toEqual([
        { entregavelId: "id1", titulo: "Investimento", marcacoes: 2, primeiraMarcacao: 1 },
        { entregavelId: "id2", titulo: "Receita", marcacoes: 1, primeiraMarcacao: 3 },
      ])
      expect(r.textoAgente).toContain("1: eixo X em meses; 3: trocar a cor")
      expect(r.textoAgente).toContain("AJUSTE no entregável “Investimento” (investimento-total-mensal)")
      expect(r.textoAgente).toContain("proponha de novo com o mesmo nome_final")
      expect(r.textoAgente).toContain("2. Número em ponto")
      expect(r.textoAgente).toContain("3. Número em ponto")
      expect(r.textoAgente).toContain(`clientes/${slug}/.app/ajustes/id2/ajuste-1.png`)
      expect(await readFile(path.join(raiz, "clientes", slug, ".app/ajustes/id1/ajuste-1.png"))).toEqual(Buffer.from(png))
      const e = (await servico.estado(slug)).entregaveis
      expect(e.map((x) => x.ajustePedido)).toEqual(["1: eixo X em meses; 3: trocar a cor", "1: eixo X em meses; 3: trocar a cor"])
    })

    it("entregável que deixou de estar pendente derruba o envio inteiro, sem gravar nada", async () => {
      const slug = await doisGraficos()
      await servico.aprovarEntregavel(slug, "id2")
      await expect(
        servico.pedirAjustes(slug, "03", "ajustar", [
          { entregavelId: "id1", marcas: [numero], imagem: png },
          { entregavelId: "id2", marcas: [numero], imagem: png },
        ]),
      ).rejects.toBeInstanceOf(TransicaoInvalida)
      expect((await servico.estado(slug)).entregaveis.find((x) => x.id === "id1")!.ajustePedido).toBeNull()
      expect(existsSync(path.join(raiz, "clientes", slug, ".app/ajustes"))).toBe(false)
    })

    it("recusa texto em branco, entregável repetido e entregável de outra etapa", async () => {
      const slug = await doisGraficos()
      const um = [{ entregavelId: "id1", marcas: [] }]
      await expect(servico.pedirAjustes(slug, "03", "   ", um)).rejects.toThrow("Escreva o que mudar")
      await expect(servico.pedirAjustes(slug, "03", "x", [...um, ...um])).rejects.toBeInstanceOf(ErroEntrada)
      await expect(servico.pedirAjustes(slug, "04", "x", um)).rejects.toBeInstanceOf(ErroEntrada)
      expect((await servico.estado(slug)).entregaveis[0]!.ajustePedido).toBeNull()
    })

    it("sem marcações não grava imagem nem cita Read", async () => {
      const slug = await doisGraficos()
      const r = await servico.pedirAjustes(slug, "03", "trocar para barras", [{ entregavelId: "id1", marcas: [] }])
      expect(r.textoAgente).not.toContain("Read")
      expect(existsSync(path.join(raiz, "clientes", slug, ".app/ajustes"))).toBe(false)
    })
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

  it("respostaEstado leva quem está com o turno ativo (turnoPor) e vale null sem autor", async () => {
    const slug = await servico.criarProspect("Iszi", null)
    expect((await servico.respostaEstado(slug, "01", "ana.silva@boomer.com.br")).turnoPor).toBe("ana.silva@boomer.com.br")
    expect((await servico.respostaEstado(slug, "01", null)).turnoPor).toBeNull()
    expect((await servico.respostaEstado(slug, null)).turnoPor).toBeNull()
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

  describe("excluir arquivo enviado", () => {
    let lixeira: string[]

    beforeEach(() => {
      lixeira = []
      servico = new ServicoPlanejamento({
        armazenamento: new FsArmazenamento(raiz, async (p) => {
          lixeira.push(p)
        }),
        catalogo: catalogoReal(),
        barramento,
        validar: async () => proximaValidacao,
        agora: () => "2026-09-28T10:00:00.000Z",
        gerarId: () => `id${++contador}`,
      })
      servico.conectarTurnos({ aoEnfileirar: (s) => enfileirados.push(s), estaOcupado: () => ocupado })
    })

    async function comHistorico() {
      const slug = await prospectNaEtapa03()
      const temp = path.join(raiz, "upload.xlsx")
      await writeFile(temp, "x")
      await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "hist.xlsx")
      return slug
    }

    it("manda o arquivo para a lixeira e tira o registro do estado", async () => {
      const slug = await comHistorico()
      await servico.removerInsumo(slug, "03", "historico-mensal")
      expect(lixeira).toEqual([path.join(raiz, "clientes", slug, "dados/historico-mensal.xlsx")])
      const e = await servico.estado(slug)
      expect(e.insumos.find((i) => i.insumoId === "historico-mensal")).toBeUndefined()
    })

    it("registro inválido (sem arquivo na pasta) sai do estado sem mexer na lixeira", async () => {
      const slug = await prospectNaEtapa03()
      proximaValidacao = { ok: false, problemas: ["x"], avisos: [], resumo: null }
      const temp = path.join(raiz, "upload.xlsx")
      await writeFile(temp, "x")
      await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "hist.xlsx")
      await servico.removerInsumo(slug, "03", "historico-mensal")
      expect(lixeira).toEqual([])
      expect((await servico.estado(slug)).insumos.find((i) => i.insumoId === "historico-mensal")).toBeUndefined()
    })

    it("recusa com a etapa concluída, com o agente rodando, sem envio ou para link", async () => {
      const slug = await comHistorico()
      await expect(servico.removerInsumo(slug, "03", "produtos-curva-abc")).rejects.toBeInstanceOf(ErroNaoEncontrado)
      await expect(servico.removerInsumo(slug, "01", "site")).rejects.toBeInstanceOf(ErroEntrada)
      ocupado = true
      await expect(servico.removerInsumo(slug, "03", "historico-mensal")).rejects.toBeInstanceOf(ErroTurnoAtivo)
      ocupado = false
      const e = await servico.estado(slug)
      e.etapas["03"].status = "concluida"
      await writeFile(path.join(raiz, "clientes", slug, ".app/estado.json"), JSON.stringify(e))
      await expect(servico.removerInsumo(slug, "03", "historico-mensal")).rejects.toThrow(/Reabra a etapa/)
      expect(lixeira).toEqual([])
    })
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

describe("perguntas do agente", () => {
  it("fazer_perguntas deixou de existir: o agente pergunta no chat", async () => {
    const slug = await prospectNaEtapa03()
    const r = await servico.ferramenta(ctx03, "fazer_perguntas", { perguntas: [] })
    expect(r.ok).toBe(false)
    expect(r.mensagem).toContain("desconhecida")
    expect((await servico.estado(slug)).perguntas).toEqual([])
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
      servico.ajustarBiblioteca(slug, rel, { etapa: "10" })
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

describe("autoria", () => {
  const ANA = "ana.souza@boomer.com.br"

  /** Prospect na etapa 03 com um gráfico pendente; `nome` distinto cria outro prospect no mesmo serviço. */
  async function graficoPendente(nome?: string) {
    let slug: string
    if (!nome) {
      slug = await prospectNaEtapa03()
    } else {
      slug = await servico.criarProspect(nome, null)
      const e = await servico.estado(slug)
      e.etapas["01"].status = "concluida"
      e.etapas["02"].status = "concluida"
      e.etapas["03"].status = "liberada"
      await writeFile(path.join(raiz, "clientes", slug, ".app/estado.json"), JSON.stringify(e))
      await servico.iniciarEtapa(slug, "03")
    }
    await rascunho(slug, "g.png")
    await servico.ferramenta({ slug, etapa: "03" }, "propor_entregavel", {
      tipo: "grafico",
      titulo: "Investimento",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/g.png`,
      nome_final: "investimento-total-mensal",
    })
    const id = (await servico.estado(slug)).entregaveis[0]!.id
    return { slug, id }
  }

  const decidido = async (slug: string) => (await servico.estado(slug)).entregaveis[0]!

  it("criar prospect repassa o autor ao armazenamento (null sem autor) e grava o site como enviado por ele", async () => {
    const criadores: Array<string | null | undefined> = []
    class Espiao extends FsArmazenamento {
      override async criarPasta(slug: string, criadoPor?: string | null): Promise<void> {
        criadores.push(criadoPor)
        await super.criarPasta(slug, criadoPor)
      }
    }
    const svc = new ServicoPlanejamento({
      armazenamento: new Espiao(raiz, async () => {}),
      catalogo: catalogoReal(),
      barramento,
      validar: async () => proximaValidacao,
    })
    const comAutor = await svc.criarProspect("Com Autor", "https://a.com.br", ANA)
    const semAutor = await svc.criarProspect("Sem Autor", "https://b.com.br")
    expect(criadores).toEqual([ANA, null])
    expect((await svc.estado(comAutor)).insumos.find((i) => i.insumoId === "site")?.enviadoPor).toBe(ANA)
    expect((await svc.estado(semAutor)).insumos.find((i) => i.insumoId === "site")).not.toHaveProperty("enviadoPor")
  })

  it("aprovar grava decididoPor; sem autor o campo não aparece", async () => {
    const com = await graficoPendente()
    await servico.aprovarEntregavel(com.slug, com.id, ANA)
    expect((await decidido(com.slug)).decididoPor).toBe(ANA)

    const sem = await graficoPendente("Outro Prospect")
    await servico.aprovarEntregavel(sem.slug, sem.id)
    expect(await decidido(sem.slug)).not.toHaveProperty("decididoPor")
  })

  it("pedir ajuste grava decididoPor; sem autor o campo não aparece", async () => {
    const com = await graficoPendente()
    await servico.pedirAjuste(com.slug, com.id, "trocar para barras", undefined, ANA)
    expect((await decidido(com.slug)).decididoPor).toBe(ANA)

    const sem = await graficoPendente("Outro Prospect")
    await servico.pedirAjuste(sem.slug, sem.id, "trocar para barras")
    expect(await decidido(sem.slug)).not.toHaveProperty("decididoPor")
  })

  it("pedirAjustes (chat) grava decididoPor em cada entregável citado; sem autor não aparece", async () => {
    const com = await graficoPendente()
    await servico.pedirAjustes(com.slug, "03", "ajustar", [{ entregavelId: com.id, marcas: [] }], ANA)
    expect((await decidido(com.slug)).decididoPor).toBe(ANA)

    const sem = await graficoPendente("Outro Prospect")
    await servico.pedirAjustes(sem.slug, "03", "ajustar", [{ entregavelId: sem.id, marcas: [] }])
    expect(await decidido(sem.slug)).not.toHaveProperty("decididoPor")
  })

  it("insumo enviado (arquivo, válido ou não) grava enviadoPor; sem autor o campo não aparece", async () => {
    const slug = await prospectNaEtapa03()
    const temp = path.join(raiz, "upload.xlsx")
    const enviar = async (autor?: string) => {
      await writeFile(temp, "x")
      await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "hist.xlsx", autor)
      return (await servico.estado(slug)).insumos.find((i) => i.insumoId === "historico-mensal")!
    }
    expect(await enviar(ANA)).toMatchObject({ status: "valido", enviadoPor: ANA })

    proximaValidacao = { ok: false, problemas: ["ruim"], avisos: [], resumo: null }
    expect(await enviar("bia@gestaoboomer.com")).toMatchObject({ status: "invalido", enviadoPor: "bia@gestaoboomer.com" })

    proximaValidacao = { ok: true, problemas: [], avisos: [], resumo: "ok" }
    expect(await enviar()).not.toHaveProperty("enviadoPor")
  })

  it("insumo enviado (link) grava enviadoPor; sem autor o campo não aparece", async () => {
    const slug = await servico.criarProspect("Link", null)
    await servico.receberInsumoLink(slug, "01", "site", "https://a.com.br", ANA)
    expect((await servico.estado(slug)).insumos.find((i) => i.insumoId === "site")).toMatchObject({ enviadoPor: ANA })
    await servico.receberInsumoLink(slug, "01", "site", "https://b.com.br")
    expect((await servico.estado(slug)).insumos.find((i) => i.insumoId === "site")).not.toHaveProperty("enviadoPor")
  })

  describe("autor na fila automática", () => {
    const BIA = "bia.lima@boomer.com.br"
    const fila = async (slug: string) => (await servico.estado(slug)).filaAutomatica

    it("aprovar com autor enfileira o item com esse autor; sem autor a chave não aparece", async () => {
      const com = await graficoPendente()
      await servico.aprovarEntregavel(com.slug, com.id, ANA)
      expect((await fila(com.slug))[0]).toMatchObject({ etapa: "03", autor: ANA })
      expect(await servico.retirarFila(com.slug)).toMatchObject({ etapa: "03", autor: ANA })

      const sem = await graficoPendente("Outro Prospect")
      await servico.aprovarEntregavel(sem.slug, sem.id)
      expect((await fila(sem.slug))[0]).not.toHaveProperty("autor")
      expect(await servico.retirarFila(sem.slug)).toMatchObject({ etapa: "03", autor: null })
    })

    it("pedir ajuste com autor enfileira o item com esse autor", async () => {
      const { slug, id } = await graficoPendente()
      await servico.pedirAjuste(slug, id, "trocar para barras", undefined, ANA)
      expect((await fila(slug))[0]).toMatchObject({ etapa: "03", autor: ANA })
    })

    it("pedir ajuste sem autor enfileira sem a chave autor", async () => {
      const { slug, id } = await graficoPendente()
      await servico.pedirAjuste(slug, id, "trocar para barras")
      expect((await fila(slug))[0]).not.toHaveProperty("autor")
    })

    it("pedirAjustes (chat) não enfileira: o turno é do próprio analista e a fila não ganha item", async () => {
      const { slug, id } = await graficoPendente()
      await servico.pedirAjustes(slug, "03", "ajustar", [{ entregavelId: id, marcas: [] }], ANA)
      expect(await fila(slug)).toEqual([])
    })

    it("insumo enviado (arquivo) com autor enfileira o item com esse autor; sem autor a chave não aparece", async () => {
      const slug = await prospectNaEtapa03()
      const temp = path.join(raiz, "upload.xlsx")
      await writeFile(temp, "x")
      await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "hist.xlsx", ANA)
      expect((await fila(slug))[0]).toMatchObject({ etapa: "03", autor: ANA })
      await servico.retirarFila(slug)

      await writeFile(temp, "x")
      await servico.receberInsumoArquivo(slug, "03", "historico-mensal", temp, "hist.xlsx")
      expect((await fila(slug))[0]).not.toHaveProperty("autor")
    })

    it("insumo enviado (link) com autor enfileira o item com esse autor", async () => {
      const slug = await servico.criarProspect("Link", null)
      await servico.iniciarEtapa(slug, "01")
      await servico.receberInsumoLink(slug, "01", "site", "https://a.com.br", ANA)
      expect((await fila(slug))[0]).toMatchObject({ etapa: "01", autor: ANA })
    })

    it("reabrir etapa enfileira sem autor, sem a chave no JSON do estado", async () => {
      const slug = await prospectNaEtapa03()
      await servico.reabrirEtapa(slug, "02")
      const itens = await fila(slug)
      expect(itens).toHaveLength(1)
      expect(itens[0]).not.toHaveProperty("autor")
      const bruto = JSON.parse(await readFile(path.join(raiz, "clientes", slug, ".app/estado.json"), "utf8"))
      expect(bruto.filaAutomatica[0]).not.toHaveProperty("autor")
      expect(await servico.retirarFila(slug)).toMatchObject({ etapa: "03", autor: null })
    })

    it("retirarFila junta a etapa e devolve o primeiro autor não nulo", async () => {
      const slug = await prospectNaEtapa03()
      await servico.enfileirar(slug, "03", "a")
      await servico.enfileirar(slug, "03", "b", ANA)
      await servico.enfileirar(slug, "03", "c", BIA)
      expect(await servico.retirarFila(slug)).toEqual({ etapa: "03", texto: "a\n\nb\n\nc", autor: ANA })
      expect(await servico.retirarFila(slug)).toBeNull()
    })

    it("retirarFila ignora o autor de itens de outra etapa", async () => {
      const slug = await prospectNaEtapa03()
      await servico.enfileirar(slug, "03", "a")
      await servico.enfileirar(slug, "02", "b", ANA)
      expect(await servico.retirarFila(slug)).toEqual({ etapa: "03", texto: "a", autor: null })
      expect(await servico.retirarFila(slug)).toEqual({ etapa: "02", texto: "b", autor: ANA })
    })
  })

  it("estado antigo, sem os campos de autoria, continua carregando", async () => {
    const { slug } = await graficoPendente()
    const e = await servico.estado(slug)
    expect(e.entregaveis[0]).not.toHaveProperty("decididoPor")
    expect(e.insumos.every((i) => !("enviadoPor" in i))).toBe(true)
    expect(e.prospect.slug).toBe(slug)
  })
})

describe("dono e visibilidade dos prospects (dados na nuvem)", () => {
  const ANA: UsuarioComPapel = { email: "ana.souza@boomer.com.br", papel: "usuario" }
  const BIA: UsuarioComPapel = { email: "bia@gestaoboomer.com", papel: "usuario" }
  const ADM: UsuarioComPapel = { email: "admin@boomer.com.br", papel: "admin" }
  let repositorio: MemoriaRepositorio
  let nuvem: ServicoPlanejamento

  beforeEach(async () => {
    await criarFixtureMinimo(pastaDoFixture(raiz, "mini"))
    repositorio = new MemoriaRepositorio()
    const armazem = new MemoriaArmazem()
    const mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem, esperar: async () => {} })
    nuvem = new ServicoPlanejamento({
      armazenamento: new NuvemArmazenamento({ raiz, repositorio, armazem, mesa, atrasoAgendamentoMs: 0 }),
      catalogo: catalogoReal(),
      barramento: new Barramento(),
      validar: async () => proximaValidacao,
      agora: () => "2026-09-28T10:00:00.000Z",
    })
    nuvem.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => false })
  })

  it("um usuário comum lista só os prospects dele, com o dono preenchido", async () => {
    await nuvem.criarProspect("Da Ana", null, ANA.email)
    await nuvem.criarProspect("Da Bia", null, BIA.email)
    await nuvem.criarProspect("Sem Dono", null)
    const lista = await nuvem.listarProspects(ANA)
    expect(lista.map((p) => [p.slug, p.dono])).toEqual([["da-ana", "ana.souza@boomer.com.br"]])
  })

  it("compara o dono sem diferenciar maiúsculas de minúsculas", async () => {
    await nuvem.criarProspect("Da Ana", null, "Ana.Souza@Boomer.com.br")
    expect((await nuvem.listarProspects(ANA)).map((p) => p.slug)).toEqual(["da-ana"])
  })

  it("o admin recebe todos, inclusive sem dono, e usa um único listarDonos", async () => {
    await nuvem.criarProspect("Da Ana", null, ANA.email)
    await nuvem.criarProspect("Da Bia", null, BIA.email)
    await nuvem.criarProspect("Sem Dono", null)
    const espiao = vi.spyOn(repositorio, "listarDonos")
    const lista = await nuvem.listarProspects(ADM)
    expect(lista.map((p) => p.slug).sort()).toEqual(["da-ana", "da-bia", "sem-dono"])
    expect(lista.find((p) => p.slug === "sem-dono")?.dono).toBeNull()
    expect(espiao).toHaveBeenCalledTimes(1)
  })

  it("o cliente de teste não aparece para um usuário comum, nem para o dono dele", async () => {
    await nuvem.criarClienteTeste("mini", "01", ANA.email)
    await nuvem.criarProspect("Da Ana", null, ANA.email)
    expect((await nuvem.listarProspects(ANA)).map((p) => p.slug)).toEqual(["da-ana"])
    expect((await nuvem.listarProspects(ADM)).map((p) => p.slug).sort()).toEqual(["cliente-teste", "da-ana"])
    expect(await nuvem.prospectVisivel(ANA, "cliente-teste")).toBe(false)
    expect(await nuvem.prospectVisivel(ADM, "cliente-teste")).toBe(true)
  })

  it("prospectVisivel: true para o próprio; false para alheio, sem dono, inexistente e excluído (sem lançar)", async () => {
    await nuvem.criarProspect("Da Ana", null, ANA.email)
    await nuvem.criarProspect("Sem Dono", null)
    await nuvem.criarProspect("Excluida", null, ANA.email)
    await nuvem.excluirProspect("excluida", "excluida")

    expect(await nuvem.prospectVisivel(ANA, "da-ana")).toBe(true)
    expect(await nuvem.prospectVisivel(BIA, "da-ana")).toBe(false)
    expect(await nuvem.prospectVisivel(ANA, "sem-dono")).toBe(false)
    expect(await nuvem.prospectVisivel(ANA, "nao-existe")).toBe(false)
    expect(await nuvem.prospectVisivel(ANA, "excluida")).toBe(false)
  })

  it("prospectVisivel para admin só confere se o prospect existe", async () => {
    await nuvem.criarProspect("Sem Dono", null)
    await nuvem.criarProspect("Excluida", null)
    await nuvem.excluirProspect("excluida", "excluida")
    expect(await nuvem.prospectVisivel(ADM, "sem-dono")).toBe(true)
    expect(await nuvem.prospectVisivel(ADM, "nao-existe")).toBe(false)
    expect(await nuvem.prospectVisivel(ADM, "excluida")).toBe(false)
  })

  it("trocarDono normaliza o e-mail e passa a prospect para o novo dono", async () => {
    await nuvem.criarProspect("Da Ana", null, ANA.email)
    await nuvem.trocarDono("da-ana", "  Bia@GestaoBoomer.com ")
    expect(repositorio.criadoPor("da-ana")).toBe("bia@gestaoboomer.com")
    expect(await nuvem.prospectVisivel(ANA, "da-ana")).toBe(false)
    expect(await nuvem.prospectVisivel(BIA, "da-ana")).toBe(true)
  })

  it("trocarDono de um prospect inexistente lança ErroNaoEncontrado", async () => {
    await expect(nuvem.trocarDono("nao-existe", "bia@gestaoboomer.com")).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })
})

describe("dono com os dados em disco", () => {
  it("listarProspects de admin traz todos, com dono null", async () => {
    await servico.criarProspect("Um", null)
    await servico.criarProspect("Dois", null, "ana.souza@boomer.com.br")
    const lista = await servico.listarProspects(ADMIN)
    expect(lista.map((p) => [p.slug, p.dono])).toEqual([
      ["dois", null],
      ["um", null],
    ])
  })

  it("trocar o dono só existe na nuvem", async () => {
    await servico.criarProspect("Um", null)
    await expect(servico.trocarDono("um", "ana@boomer.com.br")).rejects.toBeInstanceOf(ErroEntrada)
  })

  it("usuário comum não vê nada em disco (sem dono gravado)", async () => {
    await servico.criarProspect("Um", null)
    const ana: UsuarioComPapel = { email: "ana@boomer.com.br", papel: "usuario" }
    expect(await servico.listarProspects(ana)).toEqual([])
    expect(await servico.prospectVisivel(ana, "um")).toBe(false)
    expect(await servico.prospectVisivel(ADMIN, "um")).toBe(true)
  })
})
