import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { migrarFixture, migrarProspect } from "../scripts/migrar-etapas"
import { carregarCatalogo } from "../src/catalogo"
import { carregarFixture } from "../src/fixture"
import { estadoInicial, etapaVazia } from "../src/maquina-estados"
import type { EstadoMigravel, ManifestoMigravel } from "../src/migracao-etapas"
import type { Entregavel, StatusEtapa } from "../src/tipos"

const EM = "2026-11-08T10:00:00.000Z"
const RAIZ_REPO = path.resolve(import.meta.dirname, "../../../..")
const catalogo = carregarCatalogo(RAIZ_REPO)

let tmp: string
beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), "migrar-etapas-"))
})
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

const STATUS_ATUAL: Record<string, StatusEtapa> = {
  "01": "concluida",
  "02": "concluida",
  "03": "concluida",
  "04": "concluida",
  "05": "concluida",
  "06": "concluida",
  "07": "concluida",
  "08": "bloqueada",
  "09": "bloqueada",
  final: "bloqueada",
}

function entregavel(id: string, etapa: string): Entregavel {
  return { id, etapa, tipo: "secao", titulo: id, arquivoRascunho: `.app/propostas/${id}.md`, nomeFinal: id, status: "aprovado", ajustePedido: null, criadoEm: EM, decididoEm: EM } as unknown as Entregavel
}

/** Estado na numeração de 9 etapas (com "09" e sem o marcador), como os prospects de hoje. */
function estadoAtual(nome = "Prospect Teste"): EstadoMigravel {
  const base = estadoInicial({ slug: "x", nome, site: null }, EM)
  delete base.versaoEtapas
  const etapas: EstadoMigravel["etapas"] = {}
  for (const [id, status] of Object.entries(STATUS_ATUAL)) etapas[id] = etapaVazia(status)
  etapas["06"] = { ...etapas["06"]!, concluidaEm: EM, handoff: "Falta a verba por plataforma." }
  return {
    ...base,
    etapas,
    entregaveis: [entregavel("e7", "07"), entregavel("e8", "08")],
  } as EstadoMigravel
}

async function escrever(pasta: string, arquivos: Record<string, string>): Promise<void> {
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    await mkdir(path.dirname(path.join(pasta, rel)), { recursive: true })
    await writeFile(path.join(pasta, rel), conteudo)
  }
}

/** Todos os arquivos da pasta com o conteúdo, para comparar antes e depois. */
async function fotografia(pasta: string): Promise<Record<string, string>> {
  const itens = await readdir(pasta, { recursive: true, withFileTypes: true })
  const foto: Record<string, string> = {}
  for (const i of itens.filter((x) => x.isFile())) {
    const abs = path.join(i.parentPath, i.name)
    foto[path.relative(pasta, abs).split(path.sep).join("/")] = await readFile(abs, "utf8")
  }
  return foto
}

const lerTexto = (pasta: string, rel: string) => readFile(path.join(pasta, rel), "utf8")

const ARQUIVOS_ANTIGOS: Record<string, string> = {
  "contexto/decisoes/06-metas.md": "decisoes 06",
  "contexto/decisoes/07-briefing.md": "decisoes 07 antiga",
  "contexto/decisoes/08-midia.md": "decisoes 08 antiga",
  "contexto/decisoes/09-plano.md": "decisoes 09 antiga",
  "contexto/decisoes/10-apresentacao.md": "decisoes 10 antiga",
  "entrega/ativos-aprovados/secoes/08-midia-paga.md": "secao 08 antiga",
  "entrega/ativos-aprovados/benchmark/anuncios.html": "benchmark",
  ".app/conversas/06.jsonl": "conversa 06",
  ".app/conversas/07.jsonl": "conversa 07 antiga",
  ".app/conversas/08.jsonl": "conversa 08 antiga",
  ".app/conversas/09.jsonl": "conversa 09 antiga",
  ".app/anexos/07/1-briefing.docx": "anexo 07 antiga",
  ".app/anexos/08/2-midia.pdf": "anexo 08 antiga",
  ".app/anexos/09/3-plano.xlsx": "anexo 09 antiga",
  "dados/historico.xlsx": "dados",
}

async function criarProspect(nome: string, arquivos = ARQUIVOS_ANTIGOS, estado: unknown = estadoAtual()): Promise<string> {
  const pasta = path.join(tmp, "clientes", nome)
  await escrever(pasta, { ...arquivos, ".app/estado.json": JSON.stringify(estado, null, 2), "contexto/status-planejamento.md": "status antigo" })
  return pasta
}

describe("migrarProspect", () => {
  it("em dry-run não muda nada e lista os movimentos do plano", async () => {
    const pasta = await criarProspect("p1")
    const antes = await fotografia(pasta)
    const r = await migrarProspect(pasta, catalogo, { aplicar: false, pastaBackup: null })
    expect(await fotografia(pasta)).toEqual(antes)
    expect(r.slug).toBe("p1")
    expect(r.resultado).toBe("migrado")
    expect(r.movimentos).toContainEqual({ de: ".app/conversas/08.jsonl", para: ".app/conversas/07.jsonl" })
    expect(r.movimentos).toContainEqual({ de: ".app/conversas/07.jsonl", para: "entrega/arquivo-etapa-07/conversas/07.jsonl" })
    expect(r.movimentos).toContainEqual({ de: "contexto/decisoes/10-apresentacao.md", para: "contexto/decisoes/09-apresentacao.md" })
  })

  it("com aplicar move os arquivos, grava o estado com o marcador e regenera o status", async () => {
    const pasta = await criarProspect("p1")
    const r = await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: null })
    expect(r.resultado).toBe("migrado")

    // A 07 antiga vai para o arquivo; 08→07, 09→08, 10→09; 06 e dados ficam onde estão.
    expect(await lerTexto(pasta, "entrega/arquivo-etapa-07/conversas/07.jsonl")).toBe("conversa 07 antiga")
    expect(await lerTexto(pasta, ".app/conversas/07.jsonl")).toBe("conversa 08 antiga")
    expect(await lerTexto(pasta, ".app/conversas/08.jsonl")).toBe("conversa 09 antiga")
    expect(await lerTexto(pasta, ".app/conversas/06.jsonl")).toBe("conversa 06")
    expect(await lerTexto(pasta, "entrega/arquivo-etapa-07/decisoes/07-briefing.md")).toBe("decisoes 07 antiga")
    expect(await lerTexto(pasta, "contexto/decisoes/07-midia.md")).toBe("decisoes 08 antiga")
    expect(await lerTexto(pasta, "contexto/decisoes/08-plano.md")).toBe("decisoes 09 antiga")
    expect(await lerTexto(pasta, "contexto/decisoes/09-apresentacao.md")).toBe("decisoes 10 antiga")
    expect(await lerTexto(pasta, "entrega/ativos-aprovados/secoes/07-midia-paga.md")).toBe("secao 08 antiga")
    expect(await lerTexto(pasta, "entrega/arquivo-etapa-07/benchmark/anuncios.html")).toBe("benchmark")
    expect(await lerTexto(pasta, "dados/historico.xlsx")).toBe("dados")
    expect(await lerTexto(pasta, "entrega/arquivo-etapa-07/anexos/1-briefing.docx")).toBe("anexo 07 antiga")
    expect(await lerTexto(pasta, ".app/anexos/07/2-midia.pdf")).toBe("anexo 08 antiga")
    expect(await lerTexto(pasta, ".app/anexos/08/3-plano.xlsx")).toBe("anexo 09 antiga")
    const depois = await fotografia(pasta)
    expect(Object.keys(depois).filter((c) => c.startsWith(".app/anexos/")).sort()).toEqual([".app/anexos/07/2-midia.pdf", ".app/anexos/08/3-plano.xlsx"])
    expect(Object.keys(depois)).not.toContain("contexto/decisoes/10-apresentacao.md")
    expect(Object.keys(depois)).not.toContain("entrega/ativos-aprovados/secoes/08-midia-paga.md")
    expect(Object.keys(depois).filter((c) => c.startsWith("entrega/ativos-aprovados/benchmark/"))).toEqual([])

    const estado = JSON.parse(await lerTexto(pasta, ".app/estado.json")) as EstadoMigravel
    expect(estado.versaoEtapas).toBe(2)
    expect(Object.keys(estado.etapas).sort()).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "final"])
    expect(estado.etapas["07"]!.status).toBe("liberada")
    expect(estado.entregaveis.map((e) => [e.id, e.etapa])).toEqual([["e8", "07"]])

    const status = await lerTexto(pasta, "contexto/status-planejamento.md")
    expect(status).toContain("# Status do Planejamento: Prospect Teste")
    expect(status).toContain("07 · Mídia paga")
    expect(status).toContain("08 · Plano de ação")
    expect(status).not.toContain("status antigo")
    expect(status).toContain("Falta a verba por plataforma.")
  })

  it("rodar de novo devolve pulado-ja-migrado sem tocar em nada", async () => {
    const pasta = await criarProspect("p1")
    await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: null })
    const antes = await fotografia(pasta)
    const r = await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: null })
    expect(r.resultado).toBe("pulado-ja-migrado")
    expect(r.movimentos).toEqual([])
    expect(await fotografia(pasta)).toEqual(antes)
  })

  it("estado legado (sem a chave 09 nem o marcador) é pulado e fica idêntico", async () => {
    const legado = estadoAtual()
    delete legado.etapas["09"]
    const pasta = await criarProspect("legado", ARQUIVOS_ANTIGOS, legado)
    const antes = await fotografia(pasta)
    const r = await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: path.join(tmp, "backup") })
    expect(r.resultado).toBe("pulado-legado")
    expect(await fotografia(pasta)).toEqual(antes)
    expect(await readdir(tmp)).not.toContain("backup")
  })

  it("legado com a 09 injetada pelo app antigo (como a adda salva depois de 14/10) é pulado e fica idêntico", async () => {
    const legado = estadoAtual()
    for (const id of ["01", "02", "03", "04", "05", "06", "07", "08"]) legado.etapas[id] = etapaVazia("concluida")
    legado.etapas.final = etapaVazia("em_andamento")
    legado.etapas["09"] = etapaVazia("bloqueada")
    const pasta = await criarProspect("adda-like", ARQUIVOS_ANTIGOS, legado)
    const antes = await fotografia(pasta)
    const seco = await migrarProspect(pasta, catalogo, { aplicar: false, pastaBackup: null })
    expect(seco.resultado).toBe("pulado-legado")
    const r = await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: path.join(tmp, "backup") })
    expect(r.resultado).toBe("pulado-legado")
    expect(r.movimentos).toEqual([])
    expect(await fotografia(pasta)).toEqual(antes)
    expect(await readdir(tmp)).not.toContain("backup")
  })

  it("estado sem forma de estado também é tratado como legado", async () => {
    const pasta = await criarProspect("estranho", ARQUIVOS_ANTIGOS, { qualquer: "coisa" })
    const r = await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: null })
    expect(r.resultado).toBe("pulado-legado")
  })

  it("prospect sem .app/estado.json é pulado", async () => {
    const pasta = path.join(tmp, "clientes", "sem-estado")
    await escrever(pasta, { "contexto/decisoes/08-midia.md": "x" })
    const r = await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: null })
    expect(r.resultado).toBe("pulado-sem-estado")
    expect(await fotografia(pasta)).toEqual({ "contexto/decisoes/08-midia.md": "x" })
  })

  it("com pastaBackup copia o prospect inteiro, como estava, antes de mexer", async () => {
    const pasta = await criarProspect("p1")
    const antes = await fotografia(pasta)
    const backup = path.join(tmp, ".backup", "2026-11-08")
    await migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: backup })
    expect(await fotografia(path.join(backup, "p1"))).toEqual(antes)
    expect(await fotografia(pasta)).not.toEqual(antes)
  })

  it("destino já existente aborta o prospect inteiro, sem migração parcial", async () => {
    const pasta = await criarProspect("p1", { ...ARQUIVOS_ANTIGOS, "entrega/arquivo-etapa-07/conversas/07.jsonl": "já estava aqui" })
    const antes = await fotografia(pasta)
    await expect(migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: null })).rejects.toThrow(/sobrescrever.*entrega\/arquivo-etapa-07\/conversas\/07\.jsonl/)
    expect(await fotografia(pasta)).toEqual(antes)
  })

  it("o dry-run também acusa o conflito", async () => {
    const pasta = await criarProspect("p1", { ...ARQUIVOS_ANTIGOS, "entrega/arquivo-etapa-07/conversas/07.jsonl": "já estava aqui" })
    await expect(migrarProspect(pasta, catalogo, { aplicar: false, pastaBackup: null })).rejects.toThrow(/sobrescrever/)
  })

  it("falha de E/S no meio desfaz o que já foi movido e não grava o estado", async () => {
    // O destino kit-de-teste/09/a.txt é uma pasta vazia: o rename falha só na última fase, depois de várias moves feitas.
    const pasta = await criarProspect("p1", { ...ARQUIVOS_ANTIGOS, "kit-de-teste/10/a.txt": "kit 10" })
    await mkdir(path.join(pasta, "kit-de-teste/09/a.txt"), { recursive: true })
    const antes = await fotografia(pasta)
    await expect(migrarProspect(pasta, catalogo, { aplicar: true, pastaBackup: null })).rejects.toThrow()
    expect(await fotografia(pasta)).toEqual(antes)
    expect(await readdir(path.join(pasta, "entrega"), { recursive: true })).not.toContain("arquivo-etapa-07")
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------

function manifestoAntigo(): ManifestoMigravel {
  return {
    fixture: "antigo",
    prospect: { nome: "Antigo", site: null },
    overrides: null,
    arquivos: [
      { caminho: "contexto/kickoff.md", etapa: "01" },
      { caminho: "contexto/brutos/prints-campanhas/print-01.png", etapa: "07" },
      { caminho: "contexto/decisoes/07-briefing.md", etapa: "07" },
      { caminho: ".app/propostas/p7.md", etapa: "07" },
      { caminho: "contexto/decisoes/08-midia.md", etapa: "08" },
      { caminho: "entrega/ativos-aprovados/secoes/08-midia-paga.md", etapa: "08" },
      { caminho: ".app/conversas/08.jsonl", etapa: "08" },
      { caminho: ".app/propostas/p8.md", etapa: "08" },
      { caminho: "contexto/decisoes/09-plano.md", etapa: "09" },
      { caminho: "entrega/apresentacao-final.pptx", etapa: "final" },
    ],
    kit: {
      "01": ["contexto/kickoff.md"],
      "07": ["contexto/brutos/prints-campanhas/print-01.png"],
      "08": ["contexto/decisoes/08-midia.md", ".app/conversas/08.jsonl"],
    },
  }
}

/** Arquivos de base/ no disco do fixture: ".app/" vira "app/". */
const BASE_ANTIGA: Record<string, string> = {
  "base/contexto/kickoff.md": "kickoff",
  "base/contexto/brutos/prints-campanhas/print-01.png": "print",
  "base/contexto/decisoes/07-briefing.md": "decisoes 07 antiga",
  "base/app/propostas/p7.md": "proposta 07",
  "base/contexto/decisoes/08-midia.md": "decisoes 08 antiga",
  "base/entrega/ativos-aprovados/secoes/08-midia-paga.md": "secao 08 antiga",
  "base/app/conversas/08.jsonl": "conversa 08 antiga",
  "base/app/propostas/p8.md": "proposta 08",
  "base/contexto/decisoes/09-plano.md": "decisoes 09 antiga",
  "base/entrega/apresentacao-final.pptx": "pptx",
}

async function criarFixtureAntigo(): Promise<{ raiz: string; pasta: string }> {
  const raiz = path.join(tmp, "repo")
  const pasta = path.join(raiz, "clientes", "_fixtures", "antigo")
  const estado = estadoAtual("Antigo")
  estado.entregaveis = [entregavel("p7", "07"), entregavel("p8", "08")]
  await escrever(pasta, {
    ...BASE_ANTIGA,
    "estado-completo.json": JSON.stringify(estado, null, 2),
    "manifesto.json": JSON.stringify(manifestoAntigo(), null, 2),
    "roteiros/01.md": "roteiro 01",
    "roteiros/07.md": "roteiro 07 antigo",
    "roteiros/08.md": "roteiro 08 antigo",
    "roteiros/09.md": "roteiro 09 antigo",
    "roteiros/final.md": "roteiro final",
  })
  return { raiz, pasta }
}

describe("migrarFixture", () => {
  it("em dry-run não muda nada e relata o que mover e o que remover", async () => {
    const { pasta } = await criarFixtureAntigo()
    const antes = await fotografia(pasta)
    const r = await migrarFixture(pasta, { aplicar: false, pastaBackup: null })
    expect(await fotografia(pasta)).toEqual(antes)
    expect(r.slug).toBe("_fixtures/antigo")
    expect(r.resultado).toBe("migrado")
    expect(r.movimentos).toContainEqual({ de: "base/app/conversas/08.jsonl", para: "base/app/conversas/07.jsonl" })
    expect(r.movimentos).toContainEqual({ de: "roteiros/09.md", para: "roteiros/08.md" })
    expect(r.removidos).toContain("roteiros/07.md")
    expect(r.removidos).toContain("base/app/propostas/p7.md")
  })

  it("com aplicar renumera roteiros e base/, remove a 07 antiga e deixa um fixture que carrega", async () => {
    const { raiz, pasta } = await criarFixtureAntigo()
    const r = await migrarFixture(pasta, { aplicar: true, pastaBackup: null })
    expect(r.resultado).toBe("migrado")

    expect(await lerTexto(pasta, "roteiros/07.md")).toBe("roteiro 08 antigo")
    expect(await lerTexto(pasta, "roteiros/08.md")).toBe("roteiro 09 antigo")
    expect(await lerTexto(pasta, "roteiros/01.md")).toBe("roteiro 01")
    expect(await lerTexto(pasta, "roteiros/final.md")).toBe("roteiro final")

    expect(await lerTexto(pasta, "base/app/conversas/07.jsonl")).toBe("conversa 08 antiga")
    expect(await lerTexto(pasta, "base/contexto/decisoes/07-midia.md")).toBe("decisoes 08 antiga")
    expect(await lerTexto(pasta, "base/contexto/decisoes/08-plano.md")).toBe("decisoes 09 antiga")
    expect(await lerTexto(pasta, "base/entrega/ativos-aprovados/secoes/07-midia-paga.md")).toBe("secao 08 antiga")
    expect(await lerTexto(pasta, "base/app/propostas/p8.md")).toBe("proposta 08")

    const depois = Object.keys(await fotografia(pasta)).sort()
    expect(depois).toEqual(
      [
        "base/app/conversas/07.jsonl",
        "base/app/propostas/p8.md",
        "base/contexto/decisoes/07-midia.md",
        "base/contexto/decisoes/08-plano.md",
        "base/contexto/kickoff.md",
        "base/entrega/ativos-aprovados/secoes/07-midia-paga.md",
        "base/entrega/apresentacao-final.pptx",
        "estado-completo.json",
        "manifesto.json",
        "roteiros/01.md",
        "roteiros/07.md",
        "roteiros/08.md",
        "roteiros/final.md",
      ].sort(),
    )

    const manifesto = JSON.parse(await lerTexto(pasta, "manifesto.json")) as ManifestoMigravel
    expect(manifesto.arquivos).toContainEqual({ caminho: ".app/conversas/07.jsonl", etapa: "07" })
    expect(manifesto.arquivos).toContainEqual({ caminho: "contexto/decisoes/08-plano.md", etapa: "08" })
    expect(manifesto.arquivos.map((a) => a.caminho)).not.toContain(".app/propostas/p7.md")
    expect(manifesto.kit).toEqual({ "01": ["contexto/kickoff.md"], "07": ["contexto/decisoes/07-midia.md", ".app/conversas/07.jsonl"] })

    const estado = JSON.parse(await lerTexto(pasta, "estado-completo.json")) as EstadoMigravel
    expect(estado.versaoEtapas).toBe(2)
    expect(estado.entregaveis.map((e) => [e.id, e.etapa])).toEqual([["p8", "07"]])

    // O leitor oficial do fixture aceita o resultado: manifesto, base/ e estado batem entre si. A migração não cria a
    // etapa 10 (nasceu depois dela); o fixture a ganha na montagem, aqui acrescentada à mão.
    await writeFile(path.join(pasta, "estado-completo.json"), JSON.stringify({ ...estado, etapas: { ...estado.etapas, "10": etapaVazia("concluida") } }))
    const fixture = await carregarFixture(raiz, "antigo")
    expect(fixture.manifesto.arquivos).toHaveLength(manifesto.arquivos.length)
    // A pasta temporária de remoções não sobra.
    expect(depois.some((c) => c.includes("migrar-etapas-removidos"))).toBe(false)
  })

  it("rodar de novo devolve pulado-ja-migrado sem tocar em nada", async () => {
    const { pasta } = await criarFixtureAntigo()
    await migrarFixture(pasta, { aplicar: true, pastaBackup: null })
    const antes = await fotografia(pasta)
    const r = await migrarFixture(pasta, { aplicar: true, pastaBackup: null })
    expect(r.resultado).toBe("pulado-ja-migrado")
    expect(await fotografia(pasta)).toEqual(antes)
  })

  it("um conflito de destino aborta sem migração parcial", async () => {
    const { pasta } = await criarFixtureAntigo()
    await escrever(pasta, { ".migrar-etapas-removidos/roteiros/07.md": "sobra de outra execução" })
    const antes = await fotografia(pasta)
    await expect(migrarFixture(pasta, { aplicar: true, pastaBackup: null })).rejects.toThrow(/sobrescrever/)
    expect(await fotografia(pasta)).toEqual(antes)
  })

  it("fixture legado (sem a chave 09) é pulado", async () => {
    const { pasta } = await criarFixtureAntigo()
    const estado = JSON.parse(await lerTexto(pasta, "estado-completo.json")) as EstadoMigravel
    delete estado.etapas["09"]
    await writeFile(path.join(pasta, "estado-completo.json"), JSON.stringify(estado))
    const antes = await fotografia(pasta)
    const r = await migrarFixture(pasta, { aplicar: true, pastaBackup: null })
    expect(r.resultado).toBe("pulado-legado")
    expect(await fotografia(pasta)).toEqual(antes)
  })
})
