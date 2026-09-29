/**
 * O app só existe em 127.0.0.1, mas o navegador do analista visita outros sites: um POST
 * "simples" (text/plain) de qualquer página chegaria às rotas e, pelo agente, rodaria código.
 * Regras: Host precisa ser local (contra DNS rebinding) e métodos que mudam estado só da
 * própria origem, ou sem Origin nenhum (servidor MCP e ferramentas locais em Node).
 */
const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "[::1]"])

export interface DadosRequisicao {
  metodo: string
  host: string | null
  origin: string | null
  secFetchSite: string | null
}

function nomeDoHost(host: string): string {
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]!
}

export function requisicaoLocalPermitida(r: DadosRequisicao): boolean {
  if (!r.host || !HOSTS_LOCAIS.has(nomeDoHost(r.host).toLowerCase())) return false
  if (r.metodo === "GET" || r.metodo === "HEAD" || r.metodo === "OPTIONS") return true
  if (r.secFetchSite && r.secFetchSite !== "same-origin" && r.secFetchSite !== "none") return false
  if (r.origin) {
    try {
      return new URL(r.origin).host === r.host
    } catch {
      return false
    }
  }
  return true
}
