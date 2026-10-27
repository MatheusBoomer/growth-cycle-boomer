import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ArmazemArquivos } from "./tipos"

/** Onde o Claude Code guarda a sessão: `<configDir>/projects/<cwd com tudo fora de [a-zA-Z0-9] trocado por "-">/<sessionId>.jsonl`. */
export function caminhoSessao(configDir: string, cwd: string, sessionId: string): string {
  return path.join(configDir, "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"), `${sessionId}.jsonl`)
}

/** Mantém a sessão do agente (o .jsonl local) em dia com a nuvem, para o `resume` sobreviver a um servidor novo. */
export interface MemoriaDeSessao {
  /** true se o .jsonl está no disco e é válido (ver sessaoValida) depois de tentar restaurar. */
  restaurar(slug: string, sessionId: string): Promise<boolean>
  /** Envia o .jsonl local; ausente é ignorado. */
  salvar(slug: string, sessionId: string): Promise<void>
}

/**
 * Sessão que o `resume` aceita: pelo menos uma linha não vazia e toda linha não
 * vazia é JSON, menos talvez a última (um processo interrompido no meio da
 * escrita deixa a última linha truncada).
 */
export function sessaoValida(dados: Uint8Array): boolean {
  const linhas = Buffer.from(dados)
    .toString("utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
  if (linhas.length === 0) return false
  return linhas.slice(0, -1).every((linha) => {
    try {
      JSON.parse(linha)
      return true
    } catch {
      return false
    }
  })
}

async function lerLocal(arquivo: string): Promise<Uint8Array | null> {
  try {
    return await readFile(arquivo)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
    throw e
  }
}

export class MemoriaSessao implements MemoriaDeSessao {
  private readonly armazem: ArmazemArquivos
  private readonly configDir: string
  private readonly cwd: string

  constructor(d: { armazem: ArmazemArquivos; configDir: string; cwd: string }) {
    this.armazem = d.armazem
    this.configDir = d.configDir
    this.cwd = d.cwd
  }

  async restaurar(slug: string, sessionId: string): Promise<boolean> {
    const arquivo = caminhoSessao(this.configDir, this.cwd, sessionId)
    // Local válido basta, sem consultar a nuvem; ausente, vazio ou corrompido tenta a nuvem.
    const local = await lerLocal(arquivo)
    if (local && sessaoValida(local)) return true
    const dados = await this.armazem.baixarSessao(slug, sessionId)
    if (!dados || !sessaoValida(dados)) return false
    await mkdir(path.dirname(arquivo), { recursive: true })
    await writeFile(arquivo, dados)
    return true
  }

  async salvar(slug: string, sessionId: string): Promise<void> {
    const arquivo = caminhoSessao(this.configDir, this.cwd, sessionId)
    let dados: Buffer
    try {
      dados = await readFile(arquivo)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return
      throw e
    }
    if (dados.length === 0) return
    await this.armazem.enviarSessao(slug, sessionId, new Uint8Array(dados))
  }
}
