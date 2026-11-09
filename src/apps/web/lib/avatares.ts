import { normalizarEmail } from "@workspace/core/papeis"
import { servidor } from "@/lib/servidor"

/**
 * E-mail do dono para a URL da foto do Google, só de quem tem foto. No modo disco não há usuários e o mapa
 * é vazio. Foto é enfeite: qualquer erro vira `{}` e nunca quebra a página.
 *
 * Com `donos`, devolve só as fotos de quem está na lista (e-mail sem diferença de caixa; `null` é ignorado), para
 * não mandar ao navegador o diretório de e-mails de quem não aparece na tela. Sem `donos` devolve todas, o que só
 * serve a rotas de admin.
 */
export async function avataresDosDonos(donos?: Iterable<string | null>): Promise<Record<string, string>> {
  try {
    const { usuarios } = servidor()
    if (usuarios === null) return {}
    const todas = await usuarios.avatares()
    if (donos === undefined) return Object.fromEntries(todas)
    const aceitos = new Set<string>()
    for (const d of donos) if (d !== null) aceitos.add(normalizarEmail(d))
    return Object.fromEntries([...todas].filter(([email]) => aceitos.has(normalizarEmail(email))))
  } catch (e) {
    console.error("[avatares] falha ao ler as fotos", e)
    return {}
  }
}
