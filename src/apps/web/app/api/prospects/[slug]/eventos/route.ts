import type { EventoTempoReal } from "@workspace/core/tipos"
import { respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAcessoAoProspect } from "@/lib/sessao"

export const dynamic = "force-dynamic"

export async function GET(req: Request, ctx: RouteContext<"/api/prospects/[slug]/eventos">) {
  // Antes de abrir o fluxo: sem usuário verificado nada é assinado nem transmitido.
  try {
    await exigirAcessoAoProspect(ctx.params)
  } catch (e) {
    return respostaDeErro(e)
  }
  const { slug } = await ctx.params
  const { barramento } = servidor()
  const codificador = new TextEncoder()
  let encerrar = () => {}
  const fluxo = new ReadableStream<Uint8Array>({
    start(controle) {
      const escrever = (texto: string) => {
        try {
          controle.enqueue(codificador.encode(texto))
        } catch {
          encerrar()
        }
      }
      escrever(": conectado\n\n")
      const desinscrever = barramento.assinar(slug, (ev: EventoTempoReal) => escrever(`data: ${JSON.stringify(ev)}\n\n`))
      const batimento = setInterval(() => escrever(": ping\n\n"), 15_000)
      encerrar = () => {
        desinscrever()
        clearInterval(batimento)
      }
      req.signal.addEventListener("abort", () => {
        encerrar()
        try {
          controle.close()
        } catch {
          // já fechado
        }
      })
    },
    cancel() {
      encerrar()
    },
  })
  return new Response(fluxo, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  })
}
