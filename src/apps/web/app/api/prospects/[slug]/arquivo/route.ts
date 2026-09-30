import { readFile } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"
import { politicaDeConteudoArquivo } from "@workspace/core/seguranca"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

const TIPOS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/prospects/[slug]/arquivo">) {
  try {
    const { slug } = await ctx.params
    const caminho = req.nextUrl.searchParams.get("caminho") ?? ""
    const download = req.nextUrl.searchParams.get("download") === "1"
    const abs = servidor().armazenamento.caminhoAbsoluto(slug, caminho)
    let dados: Buffer
    try {
      dados = await readFile(abs)
    } catch {
      return json({ erro: "Arquivo não encontrado." }, 404)
    }
    const headers: Record<string, string> = {
      "content-type": TIPOS[path.extname(abs).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    }
    const politica = politicaDeConteudoArquivo(path.extname(abs))
    if (politica) headers["content-security-policy"] = politica
    if (download) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}`
    return new Response(new Uint8Array(dados), { headers })
  } catch (e) {
    return respostaDeErro(e)
  }
}
