import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import type { Regiao } from "./comentarios"

const exec = promisify(execFile)

export interface Previa {
  gerar(pptxAbs: string, pastaAbs: string): Promise<{ slides: number } | { erro: string }>
  /** Converte a planilha em `<pasta>/planilha.html` (todas as abas, fórmulas calculadas). */
  gerarPlanilha(xlsxAbs: string, pastaAbs: string, titulo: string): Promise<{ abas: number } | { erro: string }>
  /** Converte o documento Word em `<pasta>/documento.pdf`. */
  gerarDocumento(docxAbs: string, pastaAbs: string): Promise<{ pdf: string } | { erro: string }>
  recortar(slideAbs: string, regiao: Regiao, saidaAbs: string): Promise<void>
}

function mensagem(e: unknown, padrao = "Não consegui gerar a prévia da apresentação."): string {
  const stderr = (e as { stderr?: string }).stderr ?? ""
  const linha = stderr.split("\n").find((l) => l.startsWith("ERRO:"))
  return linha ? linha.replace(/^ERRO:\s*/, "") : padrao
}

/** Chama scripts/previa_apresentacao.py (LibreOffice + poppler). */
export function criarPreviaPython(raiz: string, python = "python3"): Previa {
  const script = path.join(raiz, "scripts", "previa_apresentacao.py")
  const scriptPlanilha = path.join(raiz, "scripts", "previa_planilha.py")
  const scriptDocumento = path.join(raiz, "scripts", "previa_documento.py")
  return {
    async gerar(pptxAbs, pastaAbs) {
      try {
        const { stdout } = await exec(python, [script, "gerar", "--pptx", pptxAbs, "--saida", pastaAbs], { timeout: 400_000 })
        return JSON.parse(stdout) as { slides: number }
      } catch (e) {
        return { erro: mensagem(e) }
      }
    },
    async gerarPlanilha(xlsxAbs, pastaAbs, titulo) {
      try {
        const { stdout } = await exec(python, [scriptPlanilha, "gerar", "--xlsx", xlsxAbs, "--saida", pastaAbs, "--titulo", titulo], {
          timeout: 150_000,
        })
        return JSON.parse(stdout) as { abas: number }
      } catch (e) {
        return { erro: mensagem(e, "Não consegui gerar a prévia da planilha.") }
      }
    },
    async gerarDocumento(docxAbs, pastaAbs) {
      try {
        const { stdout } = await exec(python, [scriptDocumento, "gerar", "--docx", docxAbs, "--saida", pastaAbs], { timeout: 150_000 })
        return JSON.parse(stdout) as { pdf: string }
      } catch (e) {
        return { erro: mensagem(e, "Não consegui gerar a prévia do documento.") }
      }
    },
    async recortar(slideAbs, r, saidaAbs) {
      await exec(python, [script, "recortar", "--slide", slideAbs, "--regiao", `${r.x},${r.y},${r.w},${r.h}`, "--saida", saidaAbs], {
        timeout: 60_000,
      })
    },
  }
}
