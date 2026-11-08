import { alvosDaEtapa } from "@workspace/core/modelos"
import { carregarSugestoes } from "@workspace/core/sugestoes-modelos"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../usuarios-da-nuvem"

export const dynamic = "force-dynamic"

/**
 * Só admin: as etapas com seus alvos, o que está gravado, as sugestões da agência, os modelos que a conta enxerga, o
 * modelo padrão e o resumo de uso de cada etapa (custo médio e modelo recente).
 */
export async function GET() {
  try {
    await exigirAdmin()
    usuariosDaNuvem()
    const { raiz, catalogo, servico, modelosDisponiveis } = servidor()
    const [config, lista, uso] = await Promise.all([
      servico.configModelos(),
      modelosDisponiveis(),
      // O resumo de uso é enfeite: se falhar, os cartões aparecem sem ele e a aba continua usável.
      servico.resumoDeUsoPorEtapa().catch((e: unknown) => {
        console.error(`Falha ao resumir o uso por etapa: ${e instanceof Error ? e.message : String(e)}`)
        return {}
      }),
    ])
    return json({
      etapas: catalogo.etapas.map((e) => ({ id: e.id, rotulo: e.rotuloStatus, alvos: alvosDaEtapa(catalogo, e.id) })),
      config,
      sugestoes: carregarSugestoes(raiz, catalogo),
      lista,
      padrao: lista.padrao,
      uso,
    })
  } catch (e) {
    return respostaDeErro(e)
  }
}
