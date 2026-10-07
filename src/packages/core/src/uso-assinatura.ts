import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { JanelaUso } from "./executor/tipos"

export interface UsoAssinatura {
  janelas: JanelaUso[]
  atualizadoEm: string
}

/**
 * Último uso da assinatura do Claude informado pelo próprio Claude a cada resposta do agente.
 * Vale para a máquina (a assinatura logada aqui), não para um prospect: fica em <raiz>/.app/.
 */
export class RegistroUso {
  private readonly arquivo: string

  constructor(raiz: string) {
    this.arquivo = path.join(raiz, ".app", "uso-assinatura.json")
  }

  async ler(): Promise<UsoAssinatura | null> {
    try {
      return JSON.parse(await readFile(this.arquivo, "utf-8")) as UsoAssinatura
    } catch {
      return null
    }
  }

  async gravar(janelas: JanelaUso[], em: string): Promise<void> {
    await mkdir(path.dirname(this.arquivo), { recursive: true })
    await writeFile(this.arquivo, JSON.stringify({ janelas, atualizadoEm: em } satisfies UsoAssinatura, null, 2))
  }
}
