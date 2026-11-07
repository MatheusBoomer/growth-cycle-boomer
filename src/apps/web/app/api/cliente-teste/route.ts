import { ErroEntrada } from "@workspace/core/erros"
import { ORDEM_ETAPAS, type EtapaId } from "@workspace/core/tipos"
import { json, lerJson, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

/** Modelo de onde o cliente de teste é montado (clientes/_fixtures/<id>/, que vai junto na imagem da nuvem). */
const FIXTURE = "verdeluz"

/** Cria o cliente de teste já posicionado no início da etapa escolhida. Só existe um por vez (409 se já existir). */
export async function POST(req: Request) {
  try {
    const usuario = await exigirUsuario()
    const { etapa } = await lerJson<{ etapa?: unknown }>(req)
    if (typeof etapa !== "string" || !(ORDEM_ETAPAS as readonly string[]).includes(etapa)) {
      throw new ErroEntrada("Escolha a etapa em que o teste começa.")
    }
    const slug = await servidor().servico.criarClienteTeste(FIXTURE, etapa as EtapaId, usuario.email)
    return json({ slug }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
