// Migra em disco a numeração das etapas (07 antiga arquivada, 08→07, 09→08, 10→09) de todos os prospects e fixtures de clientes/.
// Dry-run por padrão: só imprime o relatório. Em src/:
//   npm run migrar-etapas
//   npm run migrar-etapas -- --clientes ../clientes --aplicar [--sem-backup]
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { normalizarEstado } from "../src/armazenamento"
import { carregarCatalogo } from "../src/catalogo"
import {
  MAPA_ETAPAS,
  classificarNumeracao,
  migrarEstado,
  migrarManifesto,
  novoIdEtapa,
  planoDeArquivos,
  type EstadoMigravel,
  type ManifestoMigravel,
  type MovimentoArquivo,
} from "../src/migracao-etapas"
import { renderStatusMd } from "../src/status-md"
import type { Catalogo, Estado } from "../src/tipos"

export type ResultadoMigracao = "migrado" | "pulado-legado" | "pulado-ja-migrado" | "pulado-sem-estado"

export interface RelatorioMigracao {
  slug: string
  resultado: ResultadoMigracao
  movimentos: MovimentoArquivo[]
  /** Só em fixtures: arquivos da etapa 07 antiga, que o fixture não guarda mais (um prospect real os arquiva em entrega/arquivo-etapa-07/). */
  removidos: string[]
}

export interface OpcoesMigracao {
  aplicar: boolean
  /** Pasta que recebe a cópia da pasta inteira (em `<pastaBackup>/<slug>`) antes de qualquer mudança; null não faz backup. Só vale com `aplicar`. */
  pastaBackup: string | null
}

const PASTA_ARQUIVO = "entrega/arquivo-etapa-07/"
/** Onde o fixture guarda, durante a migração, o que vai ser removido: assim tudo se desfaz se algo falhar no meio. */
const PASTA_REMOVIDOS = ".migrar-etapas-removidos"
const ESTADO_PROSPECT = ".app/estado.json"
const STATUS_PROSPECT = "contexto/status-planejamento.md"

const emBarras = (p: string) => p.split(path.sep).join("/")

async function existe(abs: string): Promise<boolean> {
  return stat(abs).then(
    () => true,
    () => false,
  )
}

async function listarArquivos(pasta: string): Promise<string[]> {
  const itens = await readdir(pasta, { recursive: true, withFileTypes: true })
  return itens.filter((i) => i.isFile()).map((i) => emBarras(path.relative(pasta, path.join(i.parentPath, i.name))))
}

async function lerJson<T>(abs: string): Promise<T> {
  return JSON.parse(await readFile(abs, "utf8")) as T
}

/** Estado que não é um objeto com `etapas` não tem como ser classificado: vale como legado. */
function classificar(estado: unknown) {
  const etapas = (estado as { etapas?: unknown } | null)?.etapas
  if (typeof etapas !== "object" || etapas === null) return "legada" as const
  return classificarNumeracao(estado as EstadoMigravel)
}

/**
 * Simula os movimentos na ordem em que vão acontecer: cada origem precisa existir e cada destino precisa estar livre naquele ponto
 * (um destino liberado por um movimento anterior vale). Qualquer problema aborta antes de mover o primeiro arquivo.
 */
function validarMovimentos(slug: string, arquivos: string[], movimentos: MovimentoArquivo[]): void {
  const presentes = new Set(arquivos)
  for (const { de, para } of movimentos) {
    if (!presentes.has(de)) throw new Error(`${slug}: ${de} não existe. Nada foi alterado.`)
    if (presentes.has(para)) throw new Error(`${slug}: ${de} iria sobrescrever ${para}, que já existe. Nada foi alterado.`)
    presentes.delete(de)
    presentes.add(para)
  }
}

async function fazerBackup(pasta: string, slug: string, pastaBackup: string): Promise<void> {
  const destino = path.join(pastaBackup, slug)
  if (await existe(destino)) throw new Error(`${slug}: o backup ${destino} já existe. Nada foi alterado.`)
  await cp(pasta, destino, { recursive: true, errorOnExist: true, force: false })
}

/** Move os arquivos e grava os textos como uma unidade: se algo falhar no meio, desfaz o que já fez e repassa o erro. */
async function aplicar(pasta: string, movimentos: MovimentoArquivo[], gravacoes: { caminho: string; conteudo: string }[]): Promise<void> {
  const feitos: MovimentoArquivo[] = []
  const pastasCriadas: string[] = []
  const originais: { abs: string; conteudo: string | null }[] = []
  try {
    for (const { de, para } of movimentos) {
      const criada = await mkdir(path.dirname(path.join(pasta, para)), { recursive: true })
      if (criada) pastasCriadas.push(criada)
      await rename(path.join(pasta, de), path.join(pasta, para))
      feitos.push({ de, para })
    }
    for (const { caminho, conteudo } of gravacoes) {
      const abs = path.join(pasta, caminho)
      originais.push({ abs, conteudo: (await existe(abs)) ? await readFile(abs, "utf8") : null })
      await mkdir(path.dirname(abs), { recursive: true })
      await writeFile(abs, conteudo)
    }
  } catch (erro) {
    for (const { abs, conteudo } of originais.reverse()) {
      if (conteudo === null) await rm(abs, { force: true })
      else await writeFile(abs, conteudo)
    }
    for (const { de, para } of feitos.reverse()) await rename(path.join(pasta, para), path.join(pasta, de))
    // Só as pastas que este movimento criou, já vazias porque os arquivos voltaram.
    for (const criada of pastasCriadas) await rm(criada, { recursive: true, force: true })
    throw erro
  }
}

/**
 * Migra a pasta de um prospect (com `.app/estado.json`) para a numeração de 9 etapas; só mexe em estado "atual" (ver classificarNumeracao).
 * Lê o estado.json cru, sem passar pelo FsArmazenamento: o app recusa abrir um estado "atual" (ErroNumeracaoAntiga), e é este script que o resolve.
 */
export async function migrarProspect(pasta: string, catalogo: Catalogo, opcoes: OpcoesMigracao): Promise<RelatorioMigracao> {
  const slug = path.basename(pasta)
  const relatorio = (resultado: ResultadoMigracao, movimentos: MovimentoArquivo[] = []): RelatorioMigracao => ({ slug, resultado, movimentos, removidos: [] })
  const arquivoEstado = path.join(pasta, ESTADO_PROSPECT)
  if (!(await existe(arquivoEstado))) return relatorio("pulado-sem-estado")
  const estado = await lerJson<EstadoMigravel>(arquivoEstado)
  const classe = classificar(estado)
  if (classe === "legada") return relatorio("pulado-legado")
  if (classe === "migrada") return relatorio("pulado-ja-migrado")

  const arquivos = await listarArquivos(pasta)
  const movimentos = planoDeArquivos(arquivos)
  validarMovimentos(slug, arquivos, movimentos)
  const migrado = migrarEstado(estado)
  // O estado migrado ainda não tem a etapa 10 (o app a completa na leitura); o status.md lista todas as etapas do catálogo.
  const statusMd = renderStatusMd(normalizarEstado(migrado as unknown as Estado), catalogo)
  if (!opcoes.aplicar) return relatorio("migrado", movimentos)

  if (opcoes.pastaBackup) await fazerBackup(pasta, slug, opcoes.pastaBackup)
  await aplicar(pasta, movimentos, [
    { caminho: ESTADO_PROSPECT, conteudo: JSON.stringify(migrado, null, 2) },
    { caminho: STATUS_PROSPECT, conteudo: statusMd },
  ])
  return relatorio("migrado", movimentos)
}

const noDisco = (caminhoDoCliente: string) => `base/${caminhoDoCliente.startsWith(".app/") ? `app/${caminhoDoCliente.slice(".app/".length)}` : caminhoDoCliente}`
const doCliente = (caminhoNaBase: string) => (caminhoNaBase.startsWith("app/") ? `.app/${caminhoNaBase.slice("app/".length)}` : caminhoNaBase)

/** Migra um fixture (`estado-completo.json`, `manifesto.json`, `roteiros/NN.md` e `base/`, onde `.app/` vira `app/`) para a numeração de 9 etapas. */
export async function migrarFixture(pasta: string, opcoes: OpcoesMigracao): Promise<RelatorioMigracao> {
  const slug = `_fixtures/${path.basename(pasta)}`
  const relatorio = (resultado: ResultadoMigracao, movimentos: MovimentoArquivo[] = [], removidos: string[] = []): RelatorioMigracao => ({ slug, resultado, movimentos, removidos })
  const arquivoEstado = path.join(pasta, "estado-completo.json")
  if (!(await existe(arquivoEstado))) return relatorio("pulado-sem-estado")
  const estado = await lerJson<EstadoMigravel>(arquivoEstado)
  const classe = classificar(estado)
  if (classe === "legada") return relatorio("pulado-legado")
  if (classe === "migrada") return relatorio("pulado-ja-migrado")

  const manifesto = await lerJson<ManifestoMigravel>(path.join(pasta, "manifesto.json"))
  const arquivos = await listarArquivos(pasta)
  const base = arquivos.filter((a) => a.startsWith("base/")).map((a) => doCliente(a.slice("base/".length)))
  const plano = planoDeArquivos(base)

  // O que era da 07 antiga (pelo caminho ou pela etapa no manifesto) sai do fixture; o resto segue o plano.
  const removidosDoCliente = new Set([
    ...plano.filter((m) => m.para.startsWith(PASTA_ARQUIVO)).map((m) => m.de),
    ...manifesto.arquivos.filter((a) => a.etapa === "07").map((a) => a.caminho),
  ])
  const removidos = [...removidosDoCliente].map(noDisco).sort()
  const renomeados = plano.filter((m) => !removidosDoCliente.has(m.de)).map((m) => ({ de: noDisco(m.de), para: noDisco(m.para) }))
  const mapaDeCaminhos = new Map(plano.map((m) => [m.de, m.para]))

  // Roteiros "NN.md": a 07 antiga é removida, depois 08→07 e 09→08 (nessa ordem, para o destino já estar livre).
  const roteiros = Object.keys(MAPA_ETAPAS).sort().filter((id) => arquivos.includes(`roteiros/${id}.md`))
  for (const id of roteiros) {
    if (id === "07") removidos.push(`roteiros/${id}.md`)
    else renomeados.push({ de: `roteiros/${id}.md`, para: `roteiros/${novoIdEtapa(id)}.md` })
  }
  const paraRemover = removidos.map((de) => ({ de, para: `${PASTA_REMOVIDOS}/${de}` }))
  const movimentos = [...paraRemover, ...renomeados]
  validarMovimentos(slug, arquivos, movimentos)

  const remapeia = (caminho: string) => mapaDeCaminhos.get(caminho) ?? caminho
  const mantido = (caminho: string) => !removidosDoCliente.has(caminho)
  const manifestoMigrado = migrarManifesto(manifesto)
  manifestoMigrado.arquivos = manifestoMigrado.arquivos.filter((a) => mantido(a.caminho)).map((a) => ({ ...a, caminho: remapeia(a.caminho) }))
  manifestoMigrado.kit = Object.fromEntries(Object.entries(manifestoMigrado.kit).map(([etapa, caminhos]) => [etapa, caminhos.filter(mantido).map(remapeia)]))
  const migrado = migrarEstado(estado)
  if (!opcoes.aplicar) return relatorio("migrado", renomeados, removidos)

  if (opcoes.pastaBackup) await fazerBackup(pasta, slug, opcoes.pastaBackup)
  await aplicar(pasta, movimentos, [
    { caminho: "estado-completo.json", conteudo: JSON.stringify(migrado, null, 2) },
    { caminho: "manifesto.json", conteudo: JSON.stringify(manifestoMigrado, null, 2) },
  ])
  await rm(path.join(pasta, PASTA_REMOVIDOS), { recursive: true, force: true })
  return relatorio("migrado", renomeados, removidos)
}

function imprimir(r: RelatorioMigracao, aplicado: boolean): void {
  const verbo = aplicado ? "migrado" : "migraria"
  const rotulo: Record<ResultadoMigracao, string> = {
    migrado: verbo,
    "pulado-legado": "pulado (estado legado: sem a etapa 09, ou com a 09 que o app antigo injetou)",
    "pulado-ja-migrado": "pulado (já migrado)",
    "pulado-sem-estado": "pulado (sem .app/estado.json)",
  }
  console.log(`${r.slug}: ${rotulo[r.resultado]}`)
  if (r.resultado !== "migrado") return
  for (const m of r.movimentos) console.log(`    ${m.de} -> ${m.para}`)
  for (const f of r.removidos) console.log(`    ${f} (removido)`)
  if (r.movimentos.length + r.removidos.length === 0) console.log("    (nenhum arquivo muda de lugar)")
}

async function pastasDe(pasta: string): Promise<string[]> {
  const itens = await readdir(pasta, { withFileTypes: true })
  return itens
    .filter((i) => i.isDirectory() && !i.name.startsWith("."))
    .map((i) => i.name)
    .sort()
}

async function principal(): Promise<void> {
  const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(import.meta.dirname, "../../../..")
  const argumentos = process.argv.slice(2)
  let clientes = "../clientes"
  let aplicarMudancas = false
  let semBackup = false
  for (let i = 0; i < argumentos.length; i++) {
    const a = argumentos[i]
    if (a === "--aplicar") aplicarMudancas = true
    else if (a === "--sem-backup") semBackup = true
    else if (a === "--clientes") {
      const valor = argumentos[++i]
      if (!valor || valor.startsWith("--")) throw new Error("--clientes precisa de um valor")
      clientes = valor
    } else throw new Error(`Argumento desconhecido: ${a}. Use --clientes <pasta>, --aplicar e --sem-backup.`)
  }
  const pastaClientes = path.resolve(clientes)
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-")
  const opcoes: OpcoesMigracao = {
    aplicar: aplicarMudancas,
    pastaBackup: aplicarMudancas && !semBackup ? path.join(pastaClientes, "..", ".backup-migracao-etapas", carimbo) : null,
  }
  const catalogo = carregarCatalogo(raiz)
  console.log(`${aplicarMudancas ? "Aplicando em" : "Dry-run (nada será alterado) em"} ${pastaClientes}`)
  if (aplicarMudancas) console.log("Pare o app antes de migrar e guarde o backup até conferir o resultado.")
  if (opcoes.pastaBackup) console.log(`Backup em ${opcoes.pastaBackup}`)

  const erros: string[] = []
  const tentar = async (executar: () => Promise<RelatorioMigracao>, nome: string) => {
    try {
      imprimir(await executar(), aplicarMudancas)
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro)
      erros.push(`${nome}: ${mensagem}`)
      console.log(`${nome}: ERRO, nada foi alterado neste prospect. ${mensagem}`)
    }
  }
  for (const nome of await pastasDe(pastaClientes)) {
    if (nome === "_template") continue
    if (nome === "_fixtures") {
      for (const id of await pastasDe(path.join(pastaClientes, nome))) {
        await tentar(() => migrarFixture(path.join(pastaClientes, nome, id), opcoes), `_fixtures/${id}`)
      }
      continue
    }
    await tentar(() => migrarProspect(path.join(pastaClientes, nome), catalogo, opcoes), nome)
  }
  if (!aplicarMudancas) console.log("\nDry-run: use --aplicar para migrar de fato (com backup, salvo --sem-backup).")
  if (erros.length > 0) {
    console.error(`\n${erros.length} prospect(s) com erro.`)
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal()
