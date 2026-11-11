import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readdir, readFile, stat, symlink } from "node:fs/promises"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { destinoAprovado } from "../src/entregaveis"
import { carregarFixture, caminhoNaBase, pastaDoFixture, type Fixture } from "../src/fixture"
import { condicoesConcluir } from "../src/maquina-estados"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import { ORDEM_ETAPAS, type EtapaId } from "../src/tipos"
import { catalogoReal, raizTemporaria, RAIZ } from "./ajuda"

const KIT_ESPERADO: Partial<Record<EtapaId, number>> = { "01": 2, "03": 2, "04": 1, "07": 4, "10": 1 }
const PLANO = "entrega/ativos-aprovados/plano-de-acao"
let fixture: Fixture

beforeAll(async () => {
  fixture = await carregarFixture(RAIZ, "verdeluz")
})

async function arquivosDeTexto(pasta: string): Promise<{ rel: string; texto: string }[]> {
  const itens = await readdir(pasta, { recursive: true, withFileTypes: true })
  const saida: { rel: string; texto: string }[] = []
  for (const i of itens) {
    if (!i.isFile() || !/\.(md|json|html)$/.test(i.name)) continue
    const abs = path.join(i.parentPath, i.name)
    saida.push({ rel: path.relative(pasta, abs), texto: await readFile(abs, "utf8") })
  }
  return saida
}

async function clienteNaEtapa(etapa: EtapaId) {
  const raiz = await raizTemporaria()
  await mkdir(path.join(raiz, "clientes"), { recursive: true })
  await symlink(path.join(RAIZ, "clientes/_fixtures"), path.join(raiz, "clientes/_fixtures"))
  const armazenamento = new FsArmazenamento(raiz, async () => {})
  const servico = new ServicoPlanejamento({
    armazenamento,
    catalogo: catalogoReal(),
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
  })
  const slug = await servico.criarClienteTeste("verdeluz", etapa)
  return { raiz, armazenamento, servico, slug }
}

describe("fixture real da Verdeluz", () => {
  it("carrega (manifesto, estado e arquivos coerentes)", () => {
    expect(fixture.manifesto.fixture).toBe("verdeluz")
    expect(fixture.manifesto.overrides).toContain("site-simulado")
    expect(fixture.manifesto.prospect.nome).toBe("Verdeluz Teste")
  })

  it("todo entregável aprovado aponta para o destino aprovado que existe no manifesto", () => {
    const caminhos = new Set(fixture.manifesto.arquivos.map((a) => a.caminho))
    expect(fixture.estadoCompleto.entregaveis.length).toBeGreaterThanOrEqual(38)
    for (const e of fixture.estadoCompleto.entregaveis) {
      expect(e.status).toBe("aprovado")
      expect(caminhos.has(destinoAprovado(e)), destinoAprovado(e)).toBe(true)
      expect(caminhos.has(e.arquivoRascunho), e.arquivoRascunho).toBe(true)
    }
  })

  it.each(ORDEM_ETAPAS)("reposicionar na etapa %s gera estado válido, dossiê sem arquivo faltando e kit completo", async (etapa) => {
    const { raiz, armazenamento, servico, slug } = await clienteNaEtapa(etapa)
    const estado = await servico.estado(slug)
    const posicao = ORDEM_ETAPAS.indexOf(etapa)
    for (const id of ORDEM_ETAPAS) {
      const i = ORDEM_ETAPAS.indexOf(id)
      expect(estado.etapas[id].status).toBe(i < posicao ? "concluida" : i === posicao ? "liberada" : "bloqueada")
    }
    expect(estado.teste).toEqual({ fixture: "verdeluz", etapaInicial: etapa })

    const faltando = condicoesConcluir({ ...estado, etapas: { ...estado.etapas, [etapa]: { ...estado.etapas[etapa], status: "pronta" } } }, etapa, catalogoReal())
    expect(faltando.filter((f) => f.startsWith("Aprovar:")), "nenhum entregável pendente").toEqual([])
    expect(faltando.every((f) => f.startsWith("Enviar:") || f.startsWith("O agente ainda não sinalizou"))).toBe(true)

    const dossie = await servico.dossie(slug, etapa)
    for (const m of dossie.matchAll(/`clientes\/[^/`]+\/([^`]+)`/g)) {
      expect(existsSync(path.join(raiz, "clientes", slug, m[1]!)), m[1]).toBe(true)
    }
    if (posicao > 0) {
      const anterior = catalogoReal().etapas[posicao - 1]!
      expect(dossie).toContain(`#### ${anterior.rotuloStatus}`)
      expect(dossie).toContain((estado.etapas[anterior.id].resumoDecisoes ?? "").slice(0, 60))
    }
    expect(dossie, "o aviso do site simulado chega ao agente").toContain("site-simulado")

    const resposta = await servico.respostaEstado(slug, null)
    expect(resposta.aprovadosForaDaInterface).toEqual([])

    const kit = await servico.kitDaEtapa(slug)
    expect(kit.teste && kit.arquivos.length).toBe(KIT_ESPERADO[etapa] ?? 0)
    expect(kit.teste && kit.roteiro).toMatch(/^# .*roteiro do cliente de teste/)
    for (const a of kit.teste ? kit.arquivos : []) expect(await armazenamento.existeArquivo(slug, a)).toBe(true)
  })

  it("cada arquivo de kit de dados passa pelo validador de insumo", () => {
    const insumos: [string, string][] = [
      ["historico-mensal", "dados/historico-mensal.xlsx"],
      ["produtos-curva-abc", "dados/produtos-curva-abc.xlsx"],
      ["clientes-historico", "dados/clientes-historico.xlsx"],
    ]
    for (const [id, rel] of insumos) {
      const saida = execFileSync("python3", [path.join(RAIZ, "scripts/validar_insumo.py"), "--insumo", id, "--arquivo", caminhoNaBase(fixture, rel)], { encoding: "utf8" })
      const r = JSON.parse(saida) as { ok: boolean; problemas: string[] }
      expect(r.ok, `${id}: ${r.problemas.join("; ")}`).toBe(true)
    }
  }, 60_000) // três processos Python sobre planilhas grandes: com a suíte inteira em paralelo passa dos 20 s padrão

  it("nenhum texto do fixture contém CPF, e-mail, telefone ou cartão", async () => {
    const padroes: [string, RegExp][] = [
      ["CPF", /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/],
      ["e-mail", /[\w.+-]+@[\w-]+\.[\w.-]+/],
      ["telefone", /\(?\b\d{2}\)?\s?9?\d{4}[-\s]\d{4}\b/],
      ["cartão", /\b(?:\d{4}[ -]){3}\d{4}\b/],
    ]
    for (const { rel, texto } of await arquivosDeTexto(fixture.pasta)) {
      for (const [tipo, p] of padroes) expect(p.test(texto), `${tipo} em ${rel}`).toBe(false)
    }
  })

  it("os textos do fixture não têm travessão fora de intervalo numérico", async () => {
    const proibido = /(?<!\d)\s*—|—\s*(?!\d)/
    for (const { rel, texto } of await arquivosDeTexto(fixture.pasta)) {
      if (rel.endsWith("manifesto.json") || rel.endsWith("estado-completo.json") || rel.endsWith("roteiro-apresentacao.json") || /\.md$/.test(rel)) {
        const linha = texto.split("\n").findIndex((l) => proibido.test(l))
        expect(linha, `${rel}:${linha + 1}`).toBe(-1)
      }
    }
  })

  it("todo kit tem roteiro, e todas as etapas têm roteiro", async () => {
    for (const id of ORDEM_ETAPAS) {
      const texto = await readFile(path.join(fixture.pasta, "roteiros", `${id}.md`), "utf8")
      expect(texto).toContain("## O que enviar")
      expect(texto).toContain("## O que responder ao agente")
    }
  })

  it("o fixture não passa de 25 MB de conteúdo único (o git guarda cópias idênticas uma vez)", async () => {
    const itens = await readdir(fixture.pasta, { recursive: true, withFileTypes: true })
    const vistos = new Map<string, number>()
    for (const i of itens) {
      if (!i.isFile()) continue
      const abs = path.join(i.parentPath, i.name)
      vistos.set(createHash("sha1").update(await readFile(abs)).digest("hex"), (await stat(abs)).size)
    }
    const total = [...vistos.values()].reduce((a, b) => a + b, 0)
    expect(total / 1024 / 1024).toBeLessThan(25)
  })

  it("o plano de ação da 08 sai em documento e planilha, ambos aprovados", () => {
    const xlsx = "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.xlsx"
    expect(fixture.manifesto.arquivos).toContainEqual({ caminho: xlsx, etapa: "08" })
    const planilhas = fixture.estadoCompleto.entregaveis.filter((e) => e.tipo === "planilha" && e.etapa === "08")
    expect(planilhas).toHaveLength(1)
    expect(planilhas[0]).toMatchObject({ status: "aprovado", nomeFinal: "plano-de-acao-estrategico", titulo: "Plano de ação estratégico (planilha)" })
    expect(destinoAprovado(planilhas[0]!)).toBe(xlsx)
    expect(fixture.estadoCompleto.entregaveis.filter((e) => e.tipo === "documento" && e.etapa === "08")).toHaveLength(1)
  })

  it("a etapa 10 traz a transcrição da apresentação, o plano final e a revisão no manifesto", () => {
    for (const caminho of [
      "contexto/brutos/apresentacao-transcricao-bruta.docx",
      "contexto/decisoes/10-revisao-pos-apresentacao.md",
      "entrega/ativos-aprovados/secoes/10-revisao-pos-apresentacao.md",
      `${PLANO}/plano-de-acao-final.docx`,
      `${PLANO}/plano-de-acao-final.xlsx`,
      `${PLANO}/plano-de-acao-final.json`,
      `${PLANO}/revisao-plano.json`,
      ".app/propostas/plano-de-acao-final.json",
      ".app/propostas/revisao-plano.json",
    ]) {
      expect(fixture.manifesto.arquivos, caminho).toContainEqual({ caminho, etapa: "10" })
    }
    for (const caminho of [`${PLANO}/plano-de-acao-estrategico.json`, ".app/propostas/plano-de-acao-estrategico.json"]) {
      expect(fixture.manifesto.arquivos, caminho).toContainEqual({ caminho, etapa: "08" })
    }
    expect(fixture.manifesto.kit["10"]).toEqual(["contexto/brutos/apresentacao-transcricao-bruta.docx"])
    expect(fixture.estadoCompleto.insumos).toContainEqual(
      expect.objectContaining({ etapa: "10", insumoId: "apresentacao-transcricao", arquivo: "contexto/brutos/apresentacao-transcricao-bruta.docx", status: "valido" }),
    )
  })

  it("o estado tem a etapa 10 concluída com seção, documento e planilha aprovados", () => {
    const dez = fixture.estadoCompleto.entregaveis.filter((e) => e.etapa === "10")
    expect(dez.map((e) => [e.tipo, e.nomeFinal, e.status]).sort()).toEqual([
      ["documento", "plano-de-acao-final", "aprovado"],
      ["planilha", "plano-de-acao-final", "aprovado"],
      ["secao", "revisao-pos-apresentacao", "aprovado"],
    ])
    const etapa = fixture.estadoCompleto.etapas["10"]
    expect(etapa.status).toBe("concluida")
    expect(etapa.resumoDecisoes).toContain("Conflito 1")
    expect(etapa.resumoDecisoes).toContain("Ponto em aberto 1")
  })

  it("o plano da 08 aprovado em JSON é o plano v2 do fixture, byte a byte", async () => {
    const aprovado = await readFile(caminhoNaBase(fixture, `${PLANO}/plano-de-acao-estrategico.json`))
    expect(aprovado.equals(await readFile(path.join(RAIZ, "scripts/fixture_verdeluz/plano-de-acao.json")))).toBe(true)
    expect((await readFile(caminhoNaBase(fixture, ".app/propostas/plano-de-acao-estrategico.json"))).equals(aprovado)).toBe(true)
  })

  it("a revisão passa no validador em modo final contra a transcrição e os dois planos", () => {
    const saida = execFileSync("python3", [
      path.join(RAIZ, "scripts/validar_revisao.py"),
      "--revisao", caminhoNaBase(fixture, `${PLANO}/revisao-plano.json`),
      "--transcricao", caminhoNaBase(fixture, "contexto/brutos/apresentacao-transcricao-bruta.docx"),
      "--plano-08", caminhoNaBase(fixture, `${PLANO}/plano-de-acao-estrategico.json`),
      "--plano-final", caminhoNaBase(fixture, `${PLANO}/plano-de-acao-final.json`),
    ], { encoding: "utf8" })
    expect(saida).toMatch(/^OK: 3 complementos, 2 conflitos, 2 pontos em aberto, 2 compromissos\./m)
  })

  it("o deck e o plano de ação levam a marca FICTÍCIO", () => {
    const script = [
      "import html, sys, zipfile",
      "z = zipfile.ZipFile(sys.argv[1])",
      "# o openpyxl grava o texto da planilha como entidade (&#205;), por isso o unescape",
      "print(sum(html.unescape(z.read(n).decode('utf-8', 'ignore')).count('FICTÍCIO') for n in z.namelist() if n.endswith('.xml')))",
    ].join("\n")
    const plano = "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico"
    const final = "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-final"
    for (const rel of ["entrega/apresentacao-final.pptx", `${plano}.docx`, `${plano}.xlsx`, `${final}.docx`, `${final}.xlsx`]) {
      const n = Number(execFileSync("python3", ["-c", script, caminhoNaBase(fixture, rel)], { encoding: "utf8" }).trim())
      expect(n, rel).toBeGreaterThan(0)
    }
  })

  it("o roteiro da etapa 06 diz o mesmo que o fixture sobre P7 nos cenários", async () => {
    const roteiro = await readFile(path.join(fixture.pasta, "roteiros/06.md"), "utf8")
    expect(roteiro).toContain("P7.S1")
    expect(roteiro).not.toContain("P6 e P7 ficam fora dos cenários")
  })

  it("a receita captada citada no resumo da etapa 03 bate com a soma do histórico mensal", () => {
    const script = [
      "import sys, openpyxl",
      "ws = openpyxl.load_workbook(sys.argv[1], data_only=True).worksheets[0]",
      "cab = {str(c.value).strip(): i for i, c in enumerate(ws[2]) if c.value}",
      "print(round(sum(r[cab['RECEITA BRUTA (Ecommerce)']] for r in ws.iter_rows(min_row=3, max_row=14, values_only=True))))",
    ].join("\n")
    const soma = Number(execFileSync("python3", ["-c", script, caminhoNaBase(fixture, "dados/historico-mensal.xlsx")], { encoding: "utf8" }).trim())
    const formatado = soma.toLocaleString("pt-BR")
    expect(fixture.estadoCompleto.etapas["03"].resumoDecisoes).toContain(formatado)
    expect(pastaDoFixture(RAIZ, "verdeluz")).toBe(fixture.pasta)
  })
})
