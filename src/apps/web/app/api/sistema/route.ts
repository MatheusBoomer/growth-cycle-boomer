import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { chaveApiConfigurada, dadosNaNuvem, executorDoAmbiente } from "@workspace/core/sistema"
import { respostaDeErro } from "@/lib/http"
import { exigirAdmin } from "@/lib/sessao"

const exec = promisify(execFile)
export const dynamic = "force-dynamic"

interface EstadoClaude {
  instalado: boolean
  versao: string | null
  logado: boolean
  metodo: string | null
  plano: string | null
}

/** Claude Code instalado e logado nesta máquina (executor cli). */
async function verificarClaude(): Promise<EstadoClaude> {
  const claude: EstadoClaude = { instalado: false, versao: null, logado: false, metodo: null, plano: null }
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
  return claude
}

export async function GET() {
  try {
    await exigirAdmin()
  } catch (e) {
    return respostaDeErro(e)
  }
  const executor = executorDoAmbiente(process.env)
  // Com o Agent SDK (nuvem) não há Claude Code nem assinatura: o que vale é a chave da API.
  const claude = executor === "sdk" ? { instalado: false, versao: null, logado: false, metodo: null, plano: null } : await verificarClaude()
  let python = { ok: true, detalhe: null as string | null }
  try {
    await exec("python3", ["-c", "import openpyxl, pandas, matplotlib"], { timeout: 20_000 })
  } catch {
    python = { ok: false, detalhe: "Python 3 com openpyxl, pandas e matplotlib não foi encontrado." }
  }
  const soffice = await (async () => {
    // O caminho do aplicativo só existe no macOS; no contêiner Linux vale apenas o soffice do PATH.
    const comandos = process.platform === "darwin" ? ["soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"] : ["soffice"]
    for (const cmd of comandos) {
      try {
        await exec(cmd, ["--version"], { timeout: 20_000 })
        return true
      } catch {
        // tenta o próximo
      }
    }
    return false
  })()
  let poppler = true
  try {
    await exec("pdftoppm", ["-v"], { timeout: 10_000 })
  } catch {
    poppler = false
  }
  return Response.json({
    claude,
    python,
    previa: soffice && poppler,
    executor,
    chaveApi: chaveApiConfigurada(process.env),
    nuvem: dadosNaNuvem(process.env),
  })
}
