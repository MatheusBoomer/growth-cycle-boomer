/**
 * Nomes exatos e prefixos de variável de ambiente que o subprocesso do agente pode ver.
 * O agente roda comandos de shell: nada de SUPABASE_*, URL do app, banco ou segredo de nuvem.
 */
const NOMES_PERMITIDOS = new Set([
  "PATH",
  "HOME",
  "LANG",
  "TZ",
  "TMPDIR",
  "VIRTUAL_ENV",
  "SSL_CERT_FILE",
  "NO_PROXY",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "no_proxy",
  "http_proxy",
  "https_proxy",
])

const PREFIXOS_PERMITIDOS = ["LC_", "PYTHON", "CLAUDE_", "ANTHROPIC_", "APIFY_", "FIRECRAWL_"]

function permitida(nome: string): boolean {
  return NOMES_PERMITIDOS.has(nome) || PREFIXOS_PERMITIDOS.some((p) => nome.startsWith(p))
}

type Ambiente = Record<string, string | undefined>

/** Cópia do ambiente só com a lista de permissão; valores indefinidos não viram chave. O original não é alterado. */
export function ambienteDoAgente(env: Ambiente): Ambiente {
  const reduzido: Ambiente = {}
  for (const [nome, valor] of Object.entries(env)) {
    if (valor !== undefined && permitida(nome)) reduzido[nome] = valor
  }
  return reduzido
}
