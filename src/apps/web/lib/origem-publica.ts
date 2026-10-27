import { hostEhLocal } from "@workspace/core/seguranca"

/** Host (com porta opcional) sem nada além de nome e porta: barra, "@", "?" e afins nunca passam. */
const HOST_BEM_FORMADO = /^(?:[a-z0-9.-]+|\[[0-9a-f:]+\])(?::\d{1,5})?$/i

function primeiro(valor: string | null): string | null {
  const parte = valor?.split(",")[0]?.trim()
  return parte ? parte : null
}

function urlPublica(env: Record<string, string | undefined>): URL | null {
  const valor = (env.PLANEJAMENTO_APP_URL ?? "").trim()
  if (valor === "") return null
  try {
    const url = new URL(valor)
    return url.protocol === "http:" || url.protocol === "https:" ? url : null
  } catch {
    return null
  }
}

/** Origem de PLANEJAMENTO_APP_URL (o endereço público, base do `redirectTo` do login), ou null se ausente ou inválida. */
export function origemPublica(env: Record<string, string | undefined>): string | null {
  return urlPublica(env)?.origin ?? null
}

/**
 * Origem para montar redirecionamentos das rotas de login. Atrás do balanceador da Railway o app enxerga o
 * endereço interno, então vale x-forwarded-host/x-forwarded-proto, mas só quando o host encaminhado é local
 * ou é exatamente o de PLANEJAMENTO_APP_URL. Qualquer outro valor (cabeçalho forjado) cai na origem pública,
 * e sem ela no endereço local, para o redirecionamento nunca virar open redirect. Não usa `request.nextUrl`,
 * que troca 127.0.0.1 por localhost e mandaria o analista para uma origem sem os cookies.
 *
 * @param protocoloDaRequisicao protocolo da URL da requisição ("http:" ou "https:"), usado em host local sem x-forwarded-proto.
 */
export function origemDoRedirecionamento(headers: Headers, env: Record<string, string | undefined>, protocoloDaRequisicao: string): string {
  const publica = urlPublica(env)
  const candidato = primeiro(headers.get("x-forwarded-host")) ?? primeiro(headers.get("host"))
  const encaminhado = primeiro(headers.get("x-forwarded-proto"))?.toLowerCase()
  const protocoloEncaminhado = encaminhado === "http" || encaminhado === "https" ? `${encaminhado}:` : null

  if (candidato && HOST_BEM_FORMADO.test(candidato)) {
    if (hostEhLocal(candidato)) {
      return `${protocoloEncaminhado ?? (protocoloDaRequisicao === "https:" ? "https:" : "http:")}//${candidato}`
    }
    if (publica && candidato.toLowerCase() === publica.host.toLowerCase()) {
      return `${protocoloEncaminhado ?? publica.protocol}//${publica.host}`
    }
  }
  if (publica) return publica.origin
  return `http://127.0.0.1:${(env.PORT ?? "").trim() || 3000}`
}
