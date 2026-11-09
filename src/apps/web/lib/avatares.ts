import { servidor } from "@/lib/servidor"

/**
 * E-mail do dono para a URL da foto do Google, só de quem tem foto. No modo disco não há usuários e o mapa
 * é vazio. Foto é enfeite: qualquer erro vira `{}` e nunca quebra a página.
 */
export async function avataresDosDonos(): Promise<Record<string, string>> {
  try {
    const { usuarios } = servidor()
    if (usuarios === null) return {}
    return Object.fromEntries(await usuarios.avatares())
  } catch (e) {
    console.error("[avatares] falha ao ler as fotos", e)
    return {}
  }
}
