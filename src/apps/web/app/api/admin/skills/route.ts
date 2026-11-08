import { itensDoCatalogo } from "@workspace/core/catalogo-skills"
import { textoNotasAbertas } from "@workspace/core/notas-skills"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"

export const dynamic = "force-dynamic"

/**
 * Só admin: os itens do catálogo de skills (visão geral, etapas, subagentes e regras) com a contagem de notas abertas
 * e o texto de exportação das notas abertas, agrupado por item. Funciona também no modo fs, onde não há notas.
 */
export async function GET() {
  try {
    await exigirAdmin()
    const { raiz, catalogo, servico, armazenamento } = servidor()
    const itens = itensDoCatalogo(raiz, catalogo)
    const [contagem, notas] = await Promise.all([servico.contagemNotasAbertas(), armazenamento.listarNotasSkills()])
    return json({
      itens: itens.map((i) => ({ ...i, notasAbertas: contagem[i.id] ?? 0 })),
      textoExportacao: textoNotasAbertas(notas, itens),
    })
  } catch (e) {
    return respostaDeErro(e)
  }
}
