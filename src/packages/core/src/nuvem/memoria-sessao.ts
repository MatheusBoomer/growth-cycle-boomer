import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ArmazemArquivos } from "./tipos"

/** Onde o Claude Code guarda a sessão: `<configDir>/projects/<cwd com tudo fora de [a-zA-Z0-9] trocado por "-">/<sessionId>.jsonl`. */
export function caminhoSessao(configDir: string, cwd: string, sessionId: string): string {
  return path.join(configDir, "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"), `${sessionId}.jsonl`)
}

/** Mantém a sessão do agente (o .jsonl local) em dia com a nuvem, para o `resume` sobreviver a um servidor novo. */
export interface MemoriaDeSessao {
  /** true se o .jsonl está no disco (e não vazio) depois de tentar restaurar. */
  restaurar(slug: string, sessionId: string): Promise<boolean>
  /** Envia o .jsonl local; ausente é ignorado. */
  salvar(slug: string, sessionId: string): Promise<void>
}

async function tamanhoLocal(arquivo: string): Promise<number | null> {
  try {
    return (await stat(arquivo)).size
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
    const local = await tamanhoLocal(arquivo)
    if (local && local > 0) return true
    const dados = await this.armazem.baixarSessao(slug, sessionId)
    if (!dados || dados.length === 0) return false
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
