import { normalizarEmail } from "@workspace/core/papeis"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../usuarios-da-nuvem"

export const dynamic = "force-dynamic"

/** Quem já entrou no app, com o papel e quantos prospects ativos cada um criou (ou recebeu como dono). */
export async function GET() {
  try {
    await exigirAdmin()
    const usuarios = usuariosDaNuvem()
    const [pessoas, donos] = await Promise.all([usuarios.listar(), servidor().armazenamento.listarDonos()])
    const projetosPorEmail = new Map<string, number>()
    for (const dono of donos.values()) {
      if (dono === null) continue
      const chave = normalizarEmail(dono)
      projetosPorEmail.set(chave, (projetosPorEmail.get(chave) ?? 0) + 1)
    }
    return json({
      pessoas: pessoas.map((p) => ({ ...p, projetos: projetosPorEmail.get(normalizarEmail(p.email)) ?? 0 })),
      admins: pessoas.filter((p) => p.papel === "admin").length,
    })
  } catch (e) {
    return respostaDeErro(e)
  }
}
