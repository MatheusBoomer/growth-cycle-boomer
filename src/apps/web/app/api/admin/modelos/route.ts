import { alvosDaEtapa } from "@workspace/core/modelos"
import { carregarSugestoes } from "@workspace/core/sugestoes-modelos"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../usuarios-da-nuvem"

export const dynamic = "force-dynamic"

/** Só admin: as etapas com seus alvos, o que está gravado, as sugestões da agência e os modelos que a conta enxerga. */
export async function GET() {
  try {
    await exigirAdmin()
    usuariosDaNuvem()
    const { raiz, catalogo, servico, modelosDisponiveis } = servidor()
    const [config, lista] = await Promise.all([servico.configModelos(), modelosDisponiveis()])
    return json({
      etapas: catalogo.etapas.map((e) => ({ id: e.id, rotulo: e.rotuloStatus, alvos: alvosDaEtapa(catalogo, e.id) })),
      config,
      sugestoes: carregarSugestoes(raiz, catalogo),
      lista,
    })
  } catch (e) {
    return respostaDeErro(e)
  }
}
