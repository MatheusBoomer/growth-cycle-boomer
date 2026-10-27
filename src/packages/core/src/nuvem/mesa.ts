import { createHash, randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { ErroSincronizacao } from "../erros"
import type { ArmazemArquivos } from "./tipos"

export interface ResumoSincronizacao {
  enviados: number
  baixados: number
  removidosNaNuvem: number
  removidosNoDisco: number
}

/** Hash por caminho (relativo à pasta do prospect, com "/"). */
type Hashes = Record<string, string>

/** Espera entre tentativas: uma por tentativa que falhou. */
const ESPERAS_MS = [500, 1000, 2000]

/**
 * Caminhos que ficam fora da sincronização: lixo do sistema, temporários e
 * dados que vivem no banco. Recebe o caminho relativo à pasta do prospect, com "/".
 */
export function ignorarNaSincronizacao(caminho: string): boolean {
  const segmentos = caminho.split("/").filter((s) => s.length > 0)
  const nome = segmentos[segmentos.length - 1] ?? ""
  if (segmentos.includes("__pycache__")) return true
  if (nome === ".DS_Store" || nome.startsWith("~$") || nome.endsWith(".tmp")) return true
  if (caminho.startsWith(".app/previas/") || caminho.startsWith(".app/conversas/")) return true
  if (caminho === ".app/estado.json") return true
  return /^\.app\/comentarios\/[^/]+\.json$/.test(caminho)
}

function sha256(dados: Uint8Array): string {
  return createHash("sha256").update(dados).digest("hex")
}

function codigo(e: unknown): string | undefined {
  return (e as NodeJS.ErrnoException | null)?.code
}

/**
 * Cópia de trabalho dos arquivos de cada prospect em `<pastaClientes>/<slug>/`,
 * sincronizada com a nuvem em três vias: a base (o que estava igual dos dois
 * lados na última sincronização, em `<pastaClientes>/.mesa/<slug>.json`), o
 * disco e o manifesto. O disco vence quando os dois lados mudaram, e a nuvem
 * nunca sobrescreve um arquivo local diferente da base.
 */
export class Mesa {
  private readonly pastaClientes: string
  private readonly armazem: ArmazemArquivos
  private readonly esperar: (ms: number) => Promise<void>
  private readonly filas = new Map<string, Promise<unknown>>()

  constructor(d: { pastaClientes: string; armazem: ArmazemArquivos; esperar?: (ms: number) => Promise<void> }) {
    this.pastaClientes = d.pastaClientes
    this.armazem = d.armazem
    this.esperar = d.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  /** ErroSincronizacao depois de 3 tentativas, citando o arquivo que falhou. */
  sincronizar(slug: string): Promise<ResumoSincronizacao> {
    return this.exclusivo(slug, () => this.comTentativas(slug))
  }

  /** Apaga a base do prospect; a próxima sincronização será tratada como a primeira. */
  esquecer(slug: string): Promise<void> {
    return this.exclusivo(slug, () => rm(this.arquivoBase(slug), { force: true }))
  }

  /** Uma operação por prospect de cada vez; uma que falhou não trava a próxima. */
  private exclusivo<T>(slug: string, fn: () => Promise<T>): Promise<T> {
    const anterior = this.filas.get(slug) ?? Promise.resolve()
    const atual = anterior.then(fn, fn)
    this.filas.set(
      slug,
      atual.catch(() => {}),
    )
    return atual
  }

  private async comTentativas(slug: string): Promise<ResumoSincronizacao> {
    let ultimo: ErroSincronizacao | null = null
    for (const espera of ESPERAS_MS) {
      try {
        return await this.passada(slug)
      } catch (e) {
        ultimo = e as ErroSincronizacao
        await this.esperar(espera)
      }
    }
    const erro = new ErroSincronizacao(
      `Não consegui sincronizar os arquivos de "${slug}" depois de ${ESPERAS_MS.length} tentativas.`,
      ultimo?.caminho ?? null,
    )
    erro.cause = ultimo
    throw erro
  }

  /** Uma passada completa. Só regrava a base se tudo deu certo. */
  private async passada(slug: string): Promise<ResumoSincronizacao> {
    const resumo: ResumoSincronizacao = { enviados: 0, baixados: 0, removidosNaNuvem: 0, removidosNoDisco: 0 }
    let caminhoAtual: string | null = null
    try {
      const pasta = this.pastaProspect(slug)
      const disco = await this.hashesDoDisco(pasta)
      // Sem a pasta do prospect não há o que comparar com a base: tratar como a
      // primeira sincronização, para não tirar tudo do manifesto.
      const base = disco ? await this.lerBase(slug) : {}
      const local = disco ?? {}
      const nuvem: Hashes = {}
      for (const e of await this.armazem.listarManifesto(slug)) {
        if (!ignorarNaSincronizacao(e.caminho)) nuvem[e.caminho] = e.sha256
      }

      const novaBase: Hashes = {}
      const caminhos = [...new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(nuvem)])].sort()
      for (const caminho of caminhos) {
        caminhoAtual = caminho
        const b = base[caminho]
        const d = local[caminho]
        const n = nuvem[caminho]

        if (d !== undefined && d === n) {
          novaBase[caminho] = d
        } else if (d !== undefined && d !== b) {
          // Disco mudou ou é novo: envia, mesmo que a nuvem também tenha mudado.
          const dados = await readFile(this.absoluto(pasta, caminho))
          const entrada = await this.armazem.enviar(slug, caminho, dados)
          novaBase[caminho] = entrada.sha256
          resumo.enviados++
        } else if (d !== undefined) {
          // Disco igual à base e nuvem diferente.
          if (n === undefined) {
            if (await this.apagarSeIgual(pasta, caminho, d)) resumo.removidosNoDisco++
          } else if (await this.baixar(slug, pasta, caminho, n, d)) {
            novaBase[caminho] = n
            resumo.baixados++
          }
        } else if (n !== undefined) {
          if (b === n) {
            // Apagado no disco, nuvem igual à base.
            await this.armazem.remover(slug, caminho)
            resumo.removidosNaNuvem++
          } else if (await this.baixar(slug, pasta, caminho, n, undefined)) {
            // Novo na nuvem, ou apagado no disco mas mudado na nuvem: não perde a versão da nuvem.
            novaBase[caminho] = n
            resumo.baixados++
          }
        }
        // Ausente dos dois lados: some da base.
      }
      caminhoAtual = null
      await this.gravarBase(slug, novaBase)
      return resumo
    } catch (e) {
      if (e instanceof ErroSincronizacao && e.caminho) throw e
      const motivo = e instanceof Error ? e.message : String(e)
      throw new ErroSincronizacao(`Falha ao sincronizar "${slug}": ${motivo}`, caminhoAtual)
    }
  }

  /**
   * Baixa e grava de forma atômica, só se o arquivo local ainda tem o hash
   * esperado (`undefined` = ausente). Devolve false se o disco mudou no meio.
   */
  private async baixar(
    slug: string,
    pasta: string,
    caminho: string,
    sha: string,
    esperadoNoDisco: string | undefined,
  ): Promise<boolean> {
    const dados = await this.armazem.baixar(slug, sha)
    if (sha256(dados) !== sha) {
      throw new ErroSincronizacao(`O conteúdo baixado não confere com o manifesto.`, caminho)
    }
    const destino = this.absoluto(pasta, caminho)
    if ((await this.hashDoArquivo(destino)) !== esperadoNoDisco) return false
    await mkdir(path.dirname(destino), { recursive: true })
    const tmp = `${destino}.${randomUUID()}.tmp`
    try {
      await writeFile(tmp, dados)
      await rename(tmp, destino)
    } catch (e) {
      await rm(tmp, { force: true })
      throw e
    }
    return true
  }

  /** Apaga o arquivo local só se ele ainda tem o hash esperado. Nunca apaga pastas. */
  private async apagarSeIgual(pasta: string, caminho: string, esperado: string): Promise<boolean> {
    const destino = this.absoluto(pasta, caminho)
    if ((await this.hashDoArquivo(destino)) !== esperado) return false
    await rm(destino, { force: true })
    return true
  }

  private async hashDoArquivo(abs: string): Promise<string | undefined> {
    try {
      return sha256(await readFile(abs))
    } catch (e) {
      if (codigo(e) === "ENOENT") return undefined
      throw e
    }
  }

  /** Null se a pasta do prospect não existe. */
  private async hashesDoDisco(pasta: string): Promise<Hashes | null> {
    const hashes: Hashes = {}
    const visitar = async (relativo: string): Promise<boolean> => {
      let entradas
      try {
        entradas = await readdir(relativo ? this.absoluto(pasta, relativo) : pasta, { withFileTypes: true })
      } catch (e) {
        if (codigo(e) === "ENOENT") return false
        throw e
      }
      for (const entrada of entradas) {
        const caminho = relativo ? `${relativo}/${entrada.name}` : entrada.name
        if (entrada.isDirectory()) {
          if (!ignorarNaSincronizacao(`${caminho}/`)) await visitar(caminho)
        } else if (entrada.isFile() && !ignorarNaSincronizacao(caminho)) {
          const hash = await this.hashDoArquivo(this.absoluto(pasta, caminho))
          if (hash !== undefined) hashes[caminho] = hash
        }
      }
      return true
    }
    return (await visitar("")) ? hashes : null
  }

  private async lerBase(slug: string): Promise<Hashes> {
    let texto: string
    try {
      texto = await readFile(this.arquivoBase(slug), "utf8")
    } catch (e) {
      if (codigo(e) === "ENOENT") return {}
      throw e
    }
    return JSON.parse(texto) as Hashes
  }

  private async gravarBase(slug: string, base: Hashes): Promise<void> {
    const destino = this.arquivoBase(slug)
    await mkdir(path.dirname(destino), { recursive: true })
    const tmp = `${destino}.${randomUUID()}.tmp`
    await writeFile(tmp, JSON.stringify(base, null, 2))
    await rename(tmp, destino)
  }

  private pastaProspect(slug: string): string {
    return path.join(this.pastaClientes, slug)
  }

  private arquivoBase(slug: string): string {
    return path.join(this.pastaClientes, ".mesa", `${slug}.json`)
  }

  /** Recusa caminho que sairia da pasta do prospect (manifesto corrompido). */
  private absoluto(pasta: string, caminho: string): string {
    const segmentos = caminho.split("/")
    if (caminho.startsWith("/") || segmentos.some((s) => s === ".." || s === "." || s === "" || s.includes("\\"))) {
      throw new ErroSincronizacao("Caminho inválido no manifesto.", caminho)
    }
    return path.join(pasta, ...segmentos)
  }
}
