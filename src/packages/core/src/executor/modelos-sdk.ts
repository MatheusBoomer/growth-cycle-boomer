import { query, type Options } from "@anthropic-ai/claude-agent-sdk"
import type { NivelEsforco } from "../modelos"

/** O que o app usa de `ModelInfo` do SDK. */
export interface InfoModeloSdk {
  value: string
  resolvedModel?: string
  displayName: string
  description: string
  supportsEffort?: boolean
  supportedEffortLevels?: NivelEsforco[]
}

/** Só o que `consultarModelosSdk` usa do `query` do SDK (permite trocá-lo nos testes). */
export type ConsultaModelosSdk = (entrada: {
  prompt: AsyncIterable<never>
  options: Options
}) => { supportedModels(): Promise<InfoModeloSdk[]> }

const LIMITE_PADRAO_MS = 20_000

/**
 * Pergunta ao SDK quais modelos a conta enxerga. Abre uma sessão sem mandar nenhuma mensagem
 * (o prompt é um gerador que só espera o abort), lê `supportedModels()` e encerra a sessão
 * em qualquer caso, inclusive no tempo limite.
 */
export async function consultarModelosSdk(
  env: Record<string, string | undefined>,
  consulta: ConsultaModelosSdk = query as unknown as ConsultaModelosSdk,
  limiteMs: number = LIMITE_PADRAO_MS,
): Promise<InfoModeloSdk[]> {
  const controle = new AbortController()
  const semMensagens = async function* (): AsyncGenerator<never> {
    await new Promise<void>((resolve) => controle.signal.addEventListener("abort", () => resolve(), { once: true }))
  }
  let relogio: ReturnType<typeof setTimeout> | undefined
  try {
    const sessao = consulta({ prompt: semMensagens(), options: { abortController: controle, env } })
    const tempoEsgotado = new Promise<never>((_, rejeitar) => {
      relogio = setTimeout(
        () => rejeitar(new Error(`A consulta de modelos passou do tempo limite (${limiteMs} ms).`)),
        limiteMs,
      )
    })
    return await Promise.race([sessao.supportedModels(), tempoEsgotado])
  } finally {
    clearTimeout(relogio)
    controle.abort()
  }
}
