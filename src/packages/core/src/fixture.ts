import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { ErroFixture } from "./erros"
import { ORDEM_ETAPAS, type Estado, type EtapaId } from "./tipos"

/** "00" marca o que existe desde o início do cliente de teste. */
export type EtapaManifesto = "00" | EtapaId

export interface Manifesto {
  fixture: string
  prospect: { nome: string; site: string | null }
  /** Texto gravado na seção de overrides do CLAUDE.md do cliente. */
  overrides: string | null
  /** Caminho do arquivo na pasta do cliente (ex.: ".app/propostas/x.md") e a etapa a que pertence. */
  arquivos: { caminho: string; etapa: EtapaManifesto }[]
  /** Por etapa, os arquivos de `arquivos` oferecidos ao analista em kit-de-teste/NN/. */
  kit: Partial<Record<EtapaId, string[]>>
}

export interface Fixture {
  id: string
  pasta: string
  manifesto: Manifesto
  estadoCompleto: Estado
}

export function pastaDoFixture(raiz: string, id: string): string {
  return path.join(raiz, "clientes", "_fixtures", id)
}

/** No disco do fixture, o prefixo ".app/" do caminho do cliente vira "app/" (o .gitignore ignora ".app/"). */
function relativoNaBase(caminho: string): string {
  return path.join("base", caminho.startsWith(".app/") ? `app/${caminho.slice(".app/".length)}` : caminho)
}

export function caminhoNaBase(fixture: Fixture, caminho: string): string {
  return path.join(fixture.pasta, relativoNaBase(caminho))
}

export function etapaDoArquivo(fixture: Fixture, caminho: string): EtapaManifesto | null {
  return fixture.manifesto.arquivos.find((a) => a.caminho === caminho)?.etapa ?? null
}

/** Verdadeiro se um arquivo da etapa `etapa` já existe quando o cliente começa em `limite`. */
export function antesDe(etapa: EtapaManifesto, limite: EtapaId): boolean {
  if (etapa === "00") return true
  return ORDEM_ETAPAS.indexOf(etapa) < ORDEM_ETAPAS.indexOf(limite)
}

async function lerJson<T>(arquivo: string, rotulo: string): Promise<T> {
  try {
    return JSON.parse(await readFile(arquivo, "utf8")) as T
  } catch {
    throw new ErroFixture(`Fixture inválido: não consegui ler ${rotulo}.`)
  }
}

/** Confere a forma dos dois JSON antes de qualquer uso, para um fixture torto falhar aqui e não no meio de um reposicionamento. */
function validarForma(id: string, manifesto: Manifesto, estado: Estado): void {
  const invalido = (o: string) => new ErroFixture(`Fixture inválido: ${o} em clientes/_fixtures/${id}.`)
  if (typeof manifesto?.prospect?.nome !== "string") throw invalido("manifesto sem prospect.nome")
  if (!Array.isArray(manifesto.arquivos)) throw invalido("manifesto sem a lista de arquivos")
  if (typeof manifesto.kit !== "object" || manifesto.kit === null || Array.isArray(manifesto.kit)) throw invalido("manifesto sem kit")
  if (!Array.isArray(estado?.entregaveis) || !Array.isArray(estado?.insumos)) throw invalido("estado-completo sem entregáveis ou insumos")
  for (const etapa of ORDEM_ETAPAS) {
    if (typeof estado.etapas?.[etapa]?.status !== "string") throw invalido(`estado-completo sem a etapa ${etapa}`)
  }
}

function caminhoSeguro(caminho: string): boolean {
  if (!caminho || path.isAbsolute(caminho)) return false
  return !caminho.split(/[\\/]/).includes("..")
}

async function existeArquivo(abs: string): Promise<boolean> {
  try {
    return (await stat(abs)).isFile()
  } catch {
    return false
  }
}

async function arquivosDe(pasta: string): Promise<string[]> {
  const itens = await readdir(pasta, { recursive: true, withFileTypes: true })
  return itens
    .filter((i) => i.isFile() && i.name !== ".DS_Store")
    .map((i) => path.relative(pasta, path.join(i.parentPath, i.name)).split(path.sep).join("/"))
}

export async function carregarFixture(raiz: string, id: string): Promise<Fixture> {
  if (!id || id !== path.basename(id) || id.startsWith(".")) throw new ErroFixture(`Fixture inválido: ${JSON.stringify(id)}.`)
  const pasta = pastaDoFixture(raiz, id)
  const manifesto = await lerJson<Manifesto>(path.join(pasta, "manifesto.json"), `clientes/_fixtures/${id}/manifesto.json`)
  const estadoCompleto = await lerJson<Estado>(path.join(pasta, "estado-completo.json"), `clientes/_fixtures/${id}/estado-completo.json`)
  validarForma(id, manifesto, estadoCompleto)
  const fixture: Fixture = { id, pasta, manifesto, estadoCompleto }

  const listados = new Set<string>()
  for (const a of manifesto.arquivos) {
    if (!caminhoSeguro(a.caminho)) throw new ErroFixture(`Fixture inválido: caminho fora da pasta do cliente (${a.caminho}).`)
    if (a.etapa !== "00" && !ORDEM_ETAPAS.includes(a.etapa)) throw new ErroFixture(`Fixture inválido: etapa desconhecida "${a.etapa}" em ${a.caminho}.`)
    if (!(await existeArquivo(caminhoNaBase(fixture, a.caminho)))) throw new ErroFixture(`Fixture inválido: ${a.caminho} está no manifesto mas não existe em base/.`)
    listados.add(a.caminho)
  }
  const naBase = await arquivosDe(path.join(pasta, "base")).catch(() => [])
  for (const rel of naBase) {
    const caminho = rel.startsWith("app/") ? `.app/${rel.slice("app/".length)}` : rel
    if (!listados.has(caminho)) throw new ErroFixture(`Fixture inválido: ${caminho} está em base/ mas não no manifesto.`)
  }
  for (const [etapa, caminhos] of Object.entries(manifesto.kit)) {
    if (!ORDEM_ETAPAS.includes(etapa as EtapaId)) throw new ErroFixture(`Fixture inválido: kit de etapa desconhecida "${etapa}".`)
    for (const c of caminhos ?? []) {
      if (!listados.has(c)) throw new ErroFixture(`Fixture inválido: o kit da etapa ${etapa} cita ${c}, que não está no manifesto.`)
    }
  }
  return fixture
}
