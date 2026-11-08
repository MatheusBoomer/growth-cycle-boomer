import { ErroEntrada } from "@workspace/core/erros"
import { montarListaDeModelos, type EscolhaModelo } from "@workspace/core/modelos"
import { json, lerJson, respostaDeErro, validarEtapa } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"
import { usuariosDaNuvem } from "../../../usuarios-da-nuvem"

/**
 * Grava o modelo e o esforço de um alvo (o agente principal ou um subagente) da etapa. Os dois campos são obrigatórios,
 * e nulo significa "padrão": com os dois nulos a linha é apagada. Etapa ou alvo desconhecido dá 404; modelo ou esforço
 * que não valem, 400.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/admin/modelos/[etapa]/[alvo]">) {
  try {
    const usuario = await exigirAdmin()
    usuariosDaNuvem()
    // Com repositório de usuários sempre há sessão com e-mail; o modo sem login (e-mail nulo) não chega aqui.
    if (usuario.email === null) throw new ErroEntrada("Sem e-mail na sessão, não dá para saber quem está alterando.")
    const params = await ctx.params
    const etapa = validarEtapa(params.etapa)
    const { modelo, esforco } = await lerJson<{ modelo?: unknown; esforco?: unknown }>(req)
    if (modelo !== null && typeof modelo !== "string") throw new ErroEntrada("Informe o modelo (texto) ou null para o padrão.")
    if (esforco !== null && typeof esforco !== "string") throw new ErroEntrada("Informe o esforço (texto) ou null para o padrão.")
    const { servico, modelosDisponiveis } = servidor()
    // Só um modelo escolhido precisa da lista do SDK. Sem modelo (voltar ao padrão, ou só o esforço), a lista só com os
    // apelidos basta e a gravação não espera o SDK.
    const lista = modelo === null ? montarListaDeModelos(null) : await modelosDisponiveis()
    // O esforço chega como texto livre; quem confere se é um nível válido é salvarConfigModelo (validarEscolha).
    await servico.salvarConfigModelo(etapa, params.alvo, { modelo, esforco } as EscolhaModelo, usuario.email, lista)
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
