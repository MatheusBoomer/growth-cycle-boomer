import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { ErroFixture } from "../src/erros"
import { carregarFixture, pastaDoFixture, type Fixture, type Manifesto } from "../src/fixture"
import { estadoInicial } from "../src/maquina-estados"
import { aplicarOverrides, lerKit, reposicionarNoFixture } from "../src/servico-teste"
import type { Estado, EtapaId } from "../src/tipos"
import { raizTemporaria } from "./ajuda"
import { criarFixtureMinimo } from "./fixture-minimo"

const SLUG = "cliente-teste"
const AGORA = "2026-10-22T10:00:00.000Z"

let raiz: string
let arm: FsArmazenamento
let fixture: Fixture
let atual: Estado

beforeEach(async () => {
  raiz = await raizTemporaria()
  arm = new FsArmazenamento(raiz, async () => {})
  await criarFixtureMinimo(pastaDoFixture(raiz, "mini"))
  fixture = await carregarFixture(raiz, "mini")
  await arm.criarPasta(SLUG)
  atual = {
    ...estadoInicial({ slug: SLUG, nome: "Cliente Teste", site: "https://teste.example" }, AGORA),
    teste: { fixture: "mini", etapaInicial: "01" },
  }
})

const existe = (rel: string) => arm.existeArquivo(SLUG, rel)

async function listar(): Promise<string[]> {
  const pasta = arm.pastaProspect(SLUG)
  const itens = await readdir(pasta, { recursive: true, withFileTypes: true })
  return itens
    .filter((i) => i.isFile())
    .map((i) => path.relative(pasta, path.join(i.parentPath, i.name)))
    .sort()
}

async function acrescentarAoFixture(caminho: string, etapa: string, conteudo: string, kit?: EtapaId): Promise<void> {
  const pasta = pastaDoFixture(raiz, "mini")
  const rel = caminho.startsWith(".app/") ? `app/${caminho.slice(5)}` : caminho
  await mkdir(path.dirname(path.join(pasta, "base", rel)), { recursive: true })
  await writeFile(path.join(pasta, "base", rel), conteudo)
  const arquivoManifesto = path.join(pasta, "manifesto.json")
  const m = JSON.parse(await readFile(arquivoManifesto, "utf8")) as Manifesto
  m.arquivos.push({ caminho, etapa: etapa as Manifesto["arquivos"][number]["etapa"] })
  if (kit) m.kit[kit] = [...(m.kit[kit] ?? []), caminho]
  await writeFile(arquivoManifesto, JSON.stringify(m))
  fixture = await carregarFixture(raiz, "mini")
}

describe("reposicionarNoFixture", () => {
  it("etapa 03: copia só 00, 01 e 02; kit 03 vai para kit-de-teste/03", async () => {
    const novo = await reposicionarNoFixture(arm, fixture, atual, "03", AGORA)
    expect(await existe("contexto/kickoff-transcricao.md")).toBe(true)
    expect(await existe("contexto/contextualizacao-estrategica.md")).toBe(true)
    expect(await existe("contexto/site-referencia.md")).toBe(true)
    expect(await existe(".app/propostas/p1.md")).toBe(true)
    expect(await existe("dados/historico-mensal.xlsx")).toBe(false)
    expect(await existe("kit-de-teste/03/historico-mensal.xlsx")).toBe(true)
    expect(await existe("kit-de-teste/03/roteiro.md")).toBe(true)
    expect(await existe("kit-de-teste/01/roteiro.md")).toBe(false)
    expect(novo.etapas["02"].status).toBe("concluida")
    expect(novo.etapas["03"].status).toBe("liberada")
    expect(novo.etapas["04"].status).toBe("bloqueada")
    expect(novo.etapas["01"].resumoDecisoes).toBe("Resumo da etapa 01")
    expect(novo.etapas["01"].sessionId).toBeNull()
    expect(novo.entregaveis.map((e) => e.id)).toEqual(["e1", "e2"])
    expect(novo.insumos.map((i) => i.insumoId).sort()).toEqual(["kickoff-transcricao", "site"])
    expect(novo.teste).toEqual({ fixture: "mini", etapaInicial: "03" })
    expect(novo.prospect).toEqual(atual.prospect)
    expect(novo.perguntas).toEqual([])
    expect(novo.filaAutomatica).toEqual([])
  })

  it("etapa 01: só o 00 e os kits; nenhuma etapa concluída, entregável ou insumo da 01", async () => {
    const novo = await reposicionarNoFixture(arm, fixture, atual, "01", AGORA)
    expect(await existe("contexto/site-referencia.md")).toBe(true)
    expect(await existe("contexto/kickoff-transcricao.md")).toBe(false)
    expect(await existe("contexto/brutos/kickoff-transcricao-bruta.md")).toBe(false)
    expect(await existe("kit-de-teste/01/kickoff-transcricao-bruta.md")).toBe(true)
    expect(await existe("kit-de-teste/01/roteiro.md")).toBe(true)
    expect(await existe("kit-de-teste/02/roteiro.md")).toBe(true)
    expect(await existe("kit-de-teste/03/historico-mensal.xlsx")).toBe(true)
    expect(novo.etapas["01"].status).toBe("liberada")
    expect(novo.etapas["02"].status).toBe("bloqueada")
    expect(novo.entregaveis).toEqual([])
    expect(novo.insumos.map((i) => i.insumoId)).toEqual(["site"])
  })

  it("etapa final: 01 a 08 concluídas, final liberada, sem kit de arquivos", async () => {
    const novo = await reposicionarNoFixture(arm, fixture, atual, "final", AGORA)
    expect(novo.etapas["08"].status).toBe("concluida")
    expect(novo.etapas["final"].status).toBe("liberada")
    expect(novo.insumos.map((i) => i.insumoId).sort()).toEqual(["historico-mensal", "kickoff-transcricao", "site"])
    expect(await existe("dados/historico-mensal.xlsx")).toBe(true)
    expect(await existe("kit-de-teste/final/roteiro.md")).toBe(false)
  })

  it("escolher 03 e depois 01 não deixa nada da 03", async () => {
    await reposicionarNoFixture(arm, fixture, atual, "03", AGORA)
    await arm.gravarTexto(SLUG, ".app/conversas/03.jsonl", "{}\n")
    await arm.gravarTexto(SLUG, "dados/solto.xlsx", "x")
    await arm.gravarTexto(SLUG, "entrega/ativos-aprovados/graficos/novo.png", "x")
    await reposicionarNoFixture(arm, fixture, atual, "01", AGORA)
    expect(await existe("contexto/kickoff-transcricao.md")).toBe(false)
    expect(await existe(".app/conversas/03.jsonl")).toBe(false)
    expect(await existe("dados/solto.xlsx")).toBe(false)
    expect(await existe("entrega/ativos-aprovados/graficos/novo.png")).toBe(false)
    expect(await existe(".app/propostas/p1.md")).toBe(false)
  })

  it("repetir a mesma etapa devolve o mesmo estado e a mesma lista de arquivos", async () => {
    const primeiro = await reposicionarNoFixture(arm, fixture, atual, "03", AGORA)
    const arquivos1 = await listar()
    await arm.gravarTexto(SLUG, "contexto/lixo.md", "x")
    const segundo = await reposicionarNoFixture(arm, fixture, primeiro, "03", AGORA)
    expect(segundo).toEqual(primeiro)
    expect(await listar()).toEqual(arquivos1)
  })

  it("mantém o CLAUDE.md do cliente", async () => {
    await arm.gravarTexto(SLUG, "CLAUDE.md", "# Meu cliente\n\nmarca\n")
    await reposicionarNoFixture(arm, fixture, atual, "03", AGORA)
    expect(await arm.lerTexto(SLUG, "CLAUDE.md")).toBe("# Meu cliente\n\nmarca\n")
  })

  it("restaura os README do modelo em contexto/, dados/ e entrega/", async () => {
    await reposicionarNoFixture(arm, fixture, atual, "03", AGORA)
    expect(await existe("contexto/brutos/README.md")).toBe(true)
    expect(await existe("contexto/decisoes/README.md")).toBe(true)
    expect(await existe("dados/README.md")).toBe(true)
  })

  it("kits com arquivo de mesmo nome em etapas diferentes e nome com espaço e acento ficam cada um na pasta da sua etapa", async () => {
    await acrescentarAoFixture("contexto/brutos/relatório de vendas.md", "01", "da etapa 1", "01")
    await acrescentarAoFixture("contexto/brutos/outro/relatório de vendas.md", "02", "da etapa 2", "02")
    await reposicionarNoFixture(arm, fixture, atual, "01", AGORA)
    expect(await arm.lerTexto(SLUG, "kit-de-teste/01/relatório de vendas.md")).toBe("da etapa 1")
    expect(await arm.lerTexto(SLUG, "kit-de-teste/02/relatório de vendas.md")).toBe("da etapa 2")
  })

  it("dois arquivos de kit com o mesmo nome na mesma etapa viram ErroFixture", async () => {
    await acrescentarAoFixture("contexto/brutos/a/igual.md", "01", "a", "01")
    await acrescentarAoFixture("contexto/brutos/b/igual.md", "01", "b", "01")
    await expect(reposicionarNoFixture(arm, fixture, atual, "01", AGORA)).rejects.toBeInstanceOf(ErroFixture)
  })
})

describe("aplicarOverrides", () => {
  const claude = "# X\n\n## Overrides específicos deste prospect\n\nEsta seção normalmente fica vazia.\n"

  it("troca o corpo da seção", () => {
    expect(aplicarOverrides(claude, "O site é simulado.")).toBe(
      "# X\n\n## Overrides específicos deste prospect\n\nO site é simulado.\n",
    )
  })

  it("preserva a seção seguinte", () => {
    expect(aplicarOverrides(`${claude}\n## Outra\n\nfim\n`, "Novo.")).toBe(
      "# X\n\n## Overrides específicos deste prospect\n\nNovo.\n\n## Outra\n\nfim\n",
    )
  })

  it("sem texto, ou sem a seção, devolve inalterado", () => {
    expect(aplicarOverrides(claude, null)).toBe(claude)
    expect(aplicarOverrides("# X\n", "Novo.")).toBe("# X\n")
  })
})

describe("lerKit", () => {
  it("devolve os arquivos do kit (sem o roteiro) e o roteiro", async () => {
    await reposicionarNoFixture(arm, fixture, atual, "01", AGORA)
    const kit = await lerKit(arm, SLUG, "03")
    expect(kit.arquivos).toEqual(["kit-de-teste/03/historico-mensal.xlsx"])
    expect(kit.roteiro).toBe("Roteiro da etapa 03")
  })

  it("etapa sem kit devolve vazio e roteiro nulo", async () => {
    await reposicionarNoFixture(arm, fixture, atual, "01", AGORA)
    expect(await lerKit(arm, SLUG, "04")).toEqual({ arquivos: [], roteiro: null })
  })
})
