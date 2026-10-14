import { randomUUID } from "node:crypto"
import { appendFile, copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { ehImagem } from "./biblioteca"
import { ErroCaminhoForaDoProspect, ErroEntrada, ErroNaoEncontrado, ErroProspectExistente } from "./erros"
import { etapaVazia } from "./maquina-estados"
import { normalizarSlug } from "./slug"
import { ORDEM_ETAPAS, type Estado, type EtapaId, type EventoConversa } from "./tipos"

const ARQUIVO_ESTADO = ".app/estado.json"
const IGNORAR = new Set(["README.md", ".DS_Store"])

export type MoverParaLixeira = (caminhoAbsoluto: string) => Promise<void>

async function lixeiraDoSistema(caminho: string): Promise<void> {
  const { default: trash } = await import("trash")
  await trash(caminho)
}

async function existeCaminho(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

function codigoErro(e: unknown): string | undefined {
  return (e as NodeJS.ErrnoException | undefined)?.code
}

const emBarras = (p: string) => p.split(path.sep).join("/")

const PASTAS_DO_APP_VISIVEIS = [".app/propostas/", ".app/rascunhos/", ".app/anexos/"]

/** Arquivo que o analista pode abrir e mencionar no chat: tudo da pasta do prospect, menos o estado interno do app. */
export function arquivoVisivel(relativo: string): boolean {
  const nome = relativo.split("/").pop() ?? ""
  if (!nome || nome.startsWith(".") || nome.startsWith("~$")) return false
  if (relativo.startsWith(".app/")) return PASTAS_DO_APP_VISIVEIS.some((p) => relativo.startsWith(p))
  return true
}

export interface ArquivoProspect {
  caminho: string
  modificadoEm: string
}

export class FsArmazenamento {
  readonly raiz: string
  readonly pastaClientes: string
  private readonly moverParaLixeira: MoverParaLixeira

  constructor(raiz: string, moverParaLixeira: MoverParaLixeira = lixeiraDoSistema) {
    this.raiz = raiz
    this.pastaClientes = path.join(raiz, "clientes")
    this.moverParaLixeira = moverParaLixeira
  }

  /** O slug vem da URL (já decodificada): só aceita nomes que o próprio app geraria. */
  pastaProspect(slug: string): string {
    if (!slug || slug !== normalizarSlug(slug) || slug.startsWith("_")) {
      throw new ErroEntrada(`Prospect inválido: ${JSON.stringify(slug)}`)
    }
    return path.join(this.pastaClientes, slug)
  }

  async listarSlugs(): Promise<string[]> {
    const itens = await readdir(this.pastaClientes, { withFileTypes: true })
    return itens
      .filter((i) => i.isDirectory() && !i.name.startsWith("_") && !i.name.startsWith("."))
      .map((i) => i.name)
      .sort()
  }

  async existe(slug: string): Promise<boolean> {
    return existeCaminho(this.pastaProspect(slug))
  }

  async criarPasta(slug: string): Promise<void> {
    const destino = this.pastaProspect(slug)
    if (await existeCaminho(destino)) throw new ErroProspectExistente(slug)
    await cp(path.join(this.pastaClientes, "_template"), destino, {
      recursive: true,
      errorOnExist: true,
      force: false,
      filter: (origem) => path.basename(origem) !== ".DS_Store",
    })
  }

  async excluir(slug: string): Promise<void> {
    const pasta = this.pastaProspect(slug)
    if (!(await existeCaminho(pasta))) throw new ErroNaoEncontrado(`Prospect ${slug} não existe.`)
    await this.moverParaLixeira(pasta)
  }

  caminhoAbsoluto(slug: string, relativo: string): string {
    const pasta = this.pastaProspect(slug)
    const abs = path.resolve(pasta, relativo)
    const rel = path.relative(pasta, abs)
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) throw new ErroCaminhoForaDoProspect(relativo)
    return abs
  }

  /** Aceita caminho absoluto, relativo à raiz ("clientes/<slug>/...") ou relativo ao prospect. */
  relativoAoProspect(slug: string, caminho: string): string {
    const pasta = this.pastaProspect(slug)
    const prefixoRaiz = `clientes/${slug}/`
    const abs = path.isAbsolute(caminho)
      ? caminho
      : caminho.startsWith(prefixoRaiz) || caminho.startsWith("clientes/")
        ? path.join(this.raiz, caminho)
        : path.join(pasta, caminho)
    const rel = path.relative(pasta, path.resolve(abs))
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) throw new ErroCaminhoForaDoProspect(caminho)
    return emBarras(rel)
  }

  async lerEstado(slug: string): Promise<Estado | null> {
    const texto = await this.lerTexto(slug, ARQUIVO_ESTADO)
    if (!texto) return null
    const estado = JSON.parse(texto) as Estado
    // estado.json gravado antes de uma etapa nova (ex.: 05 · Soluções) não tem a chave dela
    const etapas = { ...estado.etapas }
    for (const id of ORDEM_ETAPAS) etapas[id] ??= etapaVazia("bloqueada")
    // estado.json gravado antes do card de perguntas não tem o campo
    return { ...estado, etapas, perguntas: estado.perguntas ?? [] }
  }

  gravarEstado(slug: string, estado: Estado): Promise<void> {
    return this.gravarTexto(slug, ARQUIVO_ESTADO, JSON.stringify(estado, null, 2))
  }

  async lerTexto(slug: string, rel: string): Promise<string | null> {
    try {
      return await readFile(this.caminhoAbsoluto(slug, rel), "utf8")
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return null
      throw e
    }
  }

  async gravarTexto(slug: string, rel: string, conteudo: string): Promise<void> {
    await this.gravarAtomico(this.caminhoAbsoluto(slug, rel), conteudo)
  }

  async gravarBinario(slug: string, rel: string, dados: Uint8Array): Promise<void> {
    await this.gravarAtomico(this.caminhoAbsoluto(slug, rel), dados)
  }

  private async gravarAtomico(abs: string, conteudo: string | Uint8Array): Promise<void> {
    await mkdir(path.dirname(abs), { recursive: true })
    const tmp = `${abs}.${randomUUID()}.tmp`
    await writeFile(tmp, conteudo)
    await rename(tmp, abs)
  }

  existeArquivo(slug: string, rel: string): Promise<boolean> {
    return existeCaminho(this.caminhoAbsoluto(slug, rel))
  }

  async copiar(slug: string, relOrigem: string, relDestino: string): Promise<void> {
    const origem = this.caminhoAbsoluto(slug, relOrigem)
    const destino = this.caminhoAbsoluto(slug, relDestino)
    await mkdir(path.dirname(destino), { recursive: true })
    const tmp = `${destino}.${randomUUID()}.tmp`
    await copyFile(origem, tmp)
    await rename(tmp, destino)
  }

  /** Copia e apaga (a origem costuma estar em outro disco, o tmp do sistema). */
  async moverParaDentro(slug: string, absOrigem: string, relDestino: string): Promise<void> {
    const destino = this.caminhoAbsoluto(slug, relDestino)
    await mkdir(path.dirname(destino), { recursive: true })
    await copyFile(absOrigem, destino)
    await rm(absOrigem, { force: true })
  }

  async listarArquivos(slug: string, relDir: string): Promise<string[]> {
    try {
      const itens = await readdir(this.caminhoAbsoluto(slug, relDir), { withFileTypes: true })
      return itens.filter((i) => i.isFile() && !IGNORAR.has(i.name)).map((i) => i.name).sort()
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return []
      throw e
    }
  }

  /** Arquivos visíveis do prospect (ver arquivoVisivel), mais recentes primeiro. */
  async listarArquivosDoProspect(slug: string): Promise<ArquivoProspect[]> {
    const pasta = this.pastaProspect(slug)
    let itens
    try {
      itens = await readdir(pasta, { recursive: true, withFileTypes: true })
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return []
      throw e
    }
    const arquivos: ArquivoProspect[] = []
    for (const i of itens) {
      if (!i.isFile()) continue
      const caminho = emBarras(path.relative(pasta, path.join(i.parentPath, i.name)))
      if (!arquivoVisivel(caminho)) continue
      const info = await stat(path.join(i.parentPath, i.name))
      arquivos.push({ caminho, modificadoEm: info.mtime.toISOString() })
    }
    return arquivos.sort((a, b) => (a.modificadoEm < b.modificadoEm ? 1 : a.modificadoEm > b.modificadoEm ? -1 : 0))
  }

  /** Todas as imagens do prospect, inclusive em .app/ (a biblioteca decide o que mostra). */
  async listarImagensDoProspect(slug: string): Promise<ArquivoProspect[]> {
    const pasta = this.pastaProspect(slug)
    let itens
    try {
      itens = await readdir(pasta, { recursive: true, withFileTypes: true })
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return []
      throw e
    }
    const imagens: ArquivoProspect[] = []
    for (const i of itens) {
      if (!i.isFile() || i.name.startsWith(".") || !ehImagem(i.name)) continue
      const abs = path.join(i.parentPath, i.name)
      const caminho = emBarras(path.relative(pasta, abs))
      if (caminho.startsWith(".app/rascunhos/") || caminho.startsWith(".app/comentarios/")) continue
      try {
        const info = await stat(abs)
        imagens.push({ caminho, modificadoEm: info.mtime.toISOString() })
      } catch (e) {
        if (codigoErro(e) !== "ENOENT") throw e
      }
    }
    return imagens
  }

  async listarAprovados(slug: string): Promise<string[]> {
    const pasta = this.pastaProspect(slug)
    try {
      const itens = await readdir(this.caminhoAbsoluto(slug, "entrega/ativos-aprovados"), {
        recursive: true,
        withFileTypes: true,
      })
      return itens
        .filter((i) => i.isFile() && !IGNORAR.has(i.name))
        .map((i) => emBarras(path.relative(pasta, path.join(i.parentPath, i.name))))
        .sort()
    } catch (e) {
      if (codigoErro(e) === "ENOENT") return []
      throw e
    }
  }

  async anexarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    const abs = this.caminhoAbsoluto(slug, `.app/conversas/${etapa}.jsonl`)
    await mkdir(path.dirname(abs), { recursive: true })
    await appendFile(abs, `${JSON.stringify(evento)}\n`, "utf8")
  }

  async lerConversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]> {
    const texto = await this.lerTexto(slug, `.app/conversas/${etapa}.jsonl`)
    if (!texto) return []
    return texto
      .split("\n")
      .filter(Boolean)
      .flatMap((linha) => {
        try {
          return [JSON.parse(linha) as EventoConversa]
        } catch {
          return []
        }
      })
  }
}
