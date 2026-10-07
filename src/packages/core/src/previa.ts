import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import type { Regiao } from "./comentarios"

const exec = promisify(execFile)

export interface Previa {
  gerar(pptxAbs: string, pastaAbs: string): Promise<{ slides: number } | { erro: string }>
  recortar(slideAbs: string, regiao: Regiao, saidaAbs: string): Promise<void>
}

function mensagem(e: unknown): string {
  const stderr = (e as { stderr?: string }).stderr ?? ""
  const linha = stderr.split("\n").find((l) => l.startsWith("ERRO:"))
  return linha ? linha.replace(/^ERRO:\s*/, "") : "Não consegui gerar a prévia da apresentação."
}

/** Chama scripts/previa_apresentacao.py (LibreOffice + poppler). */
export function criarPreviaPython(raiz: string, python = "python3"): Previa {
  const script = path.join(raiz, "scripts", "previa_apresentacao.py")
  return {
    async gerar(pptxAbs, pastaAbs) {
      try {
        const { stdout } = await exec(python, [script, "gerar", "--pptx", pptxAbs, "--saida", pastaAbs], { timeout: 400_000 })
        return JSON.parse(stdout) as { slides: number }
      } catch (e) {
        return { erro: mensagem(e) }
      }
    },
    async recortar(slideAbs, r, saidaAbs) {
      await exec(python, [script, "recortar", "--slide", slideAbs, "--regiao", `${r.x},${r.y},${r.w},${r.h}`, "--saida", saidaAbs], {
        timeout: 60_000,
      })
    },
  }
}
