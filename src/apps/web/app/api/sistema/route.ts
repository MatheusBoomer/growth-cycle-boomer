import { execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)
export const dynamic = "force-dynamic"

export async function GET() {
  const claude = { instalado: false, versao: null as string | null, logado: false, metodo: null as string | null, plano: null as string | null }
  try {
    const { stdout } = await exec("claude", ["--version"], { timeout: 10_000 })
    claude.instalado = true
    claude.versao = stdout.trim()
  } catch {
    // não instalado
  }
  if (claude.instalado) {
    let saida = ""
    try {
      saida = (await exec("claude", ["auth", "status"], { timeout: 15_000 })).stdout
    } catch (e) {
      saida = (e as { stdout?: string }).stdout ?? ""
    }
    try {
      const s = JSON.parse(saida) as { loggedIn?: boolean; authMethod?: string; subscriptionType?: string }
      claude.logado = s.loggedIn === true
      claude.metodo = s.authMethod ?? null
      claude.plano = s.subscriptionType ?? null
    } catch {
      // saída inesperada: tratar como não logado
    }
  }
  let python = { ok: true, detalhe: null as string | null }
  try {
    await exec("python3", ["-c", "import openpyxl, pandas, matplotlib"], { timeout: 20_000 })
  } catch {
    python = { ok: false, detalhe: "Python 3 com openpyxl, pandas e matplotlib não foi encontrado." }
  }
  return Response.json({ claude, python })
}
