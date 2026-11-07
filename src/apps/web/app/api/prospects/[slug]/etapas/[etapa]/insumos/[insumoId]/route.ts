import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { ErroEntrada } from "@workspace/core/erros"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/insumos/[insumoId]">) {
  try {
    const usuario = await exigirAcessoAoProspect(ctx.params)
    const { slug, etapa: bruta, insumoId } = await ctx.params
    const etapa = validarEtapa(bruta)
    const { servico } = servidor()
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const arquivo = (await req.formData()).get("arquivo")
      if (!(arquivo instanceof File)) throw new ErroEntrada("Nenhum arquivo enviado.")
      const temp = path.join(tmpdir(), `insumo-${randomUUID()}${path.extname(arquivo.name)}`)
      await writeFile(temp, new Uint8Array(await arquivo.arrayBuffer()))
      return json(await servico.receberInsumoArquivo(slug, etapa, insumoId, temp, arquivo.name, usuario.email))
    }
    const { url } = await lerJson<{ url?: string }>(req)
    return json(await servico.receberInsumoLink(slug, etapa, insumoId, url ?? "", usuario.email))
  } catch (e) {
    return respostaDeErro(e)
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/prospects/[slug]/etapas/[etapa]/insumos/[insumoId]">) {
  try {
    await exigirAcessoAoProspect(ctx.params)
    const { slug, etapa: bruta, insumoId } = await ctx.params
    await servidor().servico.removerInsumo(slug, validarEtapa(bruta), insumoId)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
