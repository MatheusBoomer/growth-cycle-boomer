import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import type { ResultadoValidacao } from "./tipos"

const exec = promisify(execFile)

export type Validar = (p: { insumoId: string; arquivoAbs: string }) => Promise<ResultadoValidacao>

export function criarValidadorPython(raiz: string, python = "python3"): Validar {
  const script = path.join(raiz, "scripts", "validar_insumo.py")
  return async ({ insumoId, arquivoAbs }) => {
    try {
      const { stdout } = await exec(python, [script, "--insumo", insumoId, "--arquivo", arquivoAbs], {
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      })
      return JSON.parse(stdout) as ResultadoValidacao
    } catch {
      return {
        ok: false,
        problemas: ["Não consegui rodar a validação da planilha. Confira se o Python 3 com openpyxl está instalado."],
        avisos: [],
        resumo: null,
      }
    }
  }
}
