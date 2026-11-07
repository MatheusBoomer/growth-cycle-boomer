import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import type { NextRequest } from "next/server"
import { politicaDeConteudoArquivo } from "@workspace/core/seguranca"
import { json, respostaDeErro } from "@/lib/http"
import { nomeDeDownload } from "@/lib/nome-download"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

const TIPOS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

const IMAGENS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"])
// Imagens revalidam pela data de modificação: a grade da biblioteca não baixa tudo de novo a cada abertura,
// e um gráfico sobrescrito (mesmo nome, nova aprovação) chega na hora.
const CACHE_IMAGEM = "private, max-age=0, must-revalidate"

export async function GET(req: NextRequest, ctx: RouteContext<"/api/prospects/[slug]/arquivo">) {
  try {
    await exigirAcessoAoProspect(ctx.params)
    const { slug } = await ctx.params
    const caminho = req.nextUrl.searchParams.get("caminho") ?? ""
    const download = req.nextUrl.searchParams.get("download") === "1"
    const abs = servidor().armazenamento.caminhoAbsoluto(slug, caminho)
    const ext = path.extname(abs).toLowerCase()
    const imagem = IMAGENS.has(ext) && !download
    let dados: Buffer
    let modificadoEm: Date
    try {
      const info = await stat(abs)
      modificadoEm = new Date(Math.floor(info.mtimeMs / 1000) * 1000)
      if (imagem) {
        const desde = Date.parse(req.headers.get("if-modified-since") ?? "")
        if (!Number.isNaN(desde) && desde >= modificadoEm.getTime()) {
          return new Response(null, { status: 304, headers: { "cache-control": CACHE_IMAGEM, "last-modified": modificadoEm.toUTCString() } })
        }
      }
      dados = await readFile(abs)
    } catch {
      return json({ erro: "Arquivo não encontrado." }, 404)
    }
    const headers: Record<string, string> = {
      "content-type": TIPOS[ext] ?? "application/octet-stream",
      "cache-control": imagem ? CACHE_IMAGEM : "no-store",
    }
    if (imagem) headers["last-modified"] = modificadoEm.toUTCString()
    const politica = politicaDeConteudoArquivo(path.extname(abs))
    if (politica) headers["content-security-policy"] = politica
    if (download) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(nomeDeDownload(req.nextUrl.searchParams.get("nome"), abs))}`
    return new Response(new Uint8Array(dados), { headers })
  } catch (e) {
    return respostaDeErro(e)
  }
}
