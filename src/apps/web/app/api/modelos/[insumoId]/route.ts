import { readFile } from "node:fs/promises"
import path from "node:path"
import { PASTA_MODELOS } from "@workspace/core/servico-planejamento"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

export async function GET(_req: Request, ctx: RouteContext<"/api/modelos/[insumoId]">) {
  try {
    await exigirUsuario()
    const { insumoId } = await ctx.params
    const { catalogo, raiz } = servidor()
    const insumo = catalogo.insumos.find((i) => i.id === insumoId)
    if (!insumo?.modelo) return json({ erro: "Este insumo não tem modelo." }, 404)
    try {
      const dados = await readFile(path.join(raiz, PASTA_MODELOS, insumo.modelo))
      return new Response(new Uint8Array(dados), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`modelo-${insumo.modelo}`)}`,
        },
      })
    } catch {
      return json({ erro: "O modelo oficial desta planilha ainda não foi colocado no projeto." }, 404)
    }
  } catch (e) {
    return respostaDeErro(e)
  }
}
