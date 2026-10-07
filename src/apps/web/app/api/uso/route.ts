import { RegistroUso } from "@workspace/core/uso-assinatura"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"

export const dynamic = "force-dynamic"

/** Último uso da assinatura do Claude desta máquina (atualizado a cada resposta do agente). */
export async function GET() {
  try {
    return json({ uso: await new RegistroUso(servidor().raiz).ler() })
  } catch (e) {
    return respostaDeErro(e)
  }
}
