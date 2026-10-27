import { hostEhLocal, origemDeEscritaPermitida, requisicaoLocalPermitida } from "./seguranca"

/**
 * Regras de acesso do login com Google. Tudo aqui é puro: o proxy do Next reúne os dados da
 * requisição (inclusive se a sessão é válida, via getClaims) e pergunta o que fazer.
 */

export type ModoAutenticacao = "off" | "google"

const DOMINIOS_PADRAO = ["boomer.com.br", "gestaoboomer.com"]

/** Modo escolhido por PLANEJAMENTO_AUTH (vazio = off, comparação exata). Falha cedo com valor inválido ou sem variável do Supabase. */
export function modoDeAutenticacao(env: Record<string, string | undefined>): ModoAutenticacao {
  const valor = (env.PLANEJAMENTO_AUTH ?? "").trim()
  if (valor === "" || valor === "off") return "off"
  if (valor !== "google") throw new Error(`PLANEJAMENTO_AUTH inválido: "${valor}" (use off ou google).`)
  for (const variavel of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) {
    if (!env[variavel]) throw new Error(`PLANEJAMENTO_AUTH=google exige ${variavel} no .env da raiz.`)
  }
  return "google"
}

/** Domínios de e-mail aceitos (PLANEJAMENTO_DOMINIOS_PERMITIDOS, separados por vírgula), em minúsculas. */
export function dominiosPermitidos(valor: string | undefined): string[] {
  const lista = (valor ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d !== "")
  return lista.length > 0 ? lista : [...DOMINIOS_PADRAO]
}

/** Só o domínio exato vale: sem subdomínio, sem sufixo extra, sem outro TLD. O e-mail não é aparado. */
export function emailPermitido(email: string | null | undefined, dominios: readonly string[]): boolean {
  if (typeof email !== "string") return false
  const partes = email.toLowerCase().split("@")
  if (partes.length !== 2) return false
  const [local, dominio] = partes as [string, string]
  if (local === "" || /\s/.test(email)) return false
  return dominios.includes(dominio)
}

/** "ana.silva@x.com" vira "Ana Silva". */
export function nomeCurto(email: string): string {
  const local = email.split("@")[0] ?? ""
  const palavras = local.split(/[._-]+/).filter((p) => p !== "")
  if (palavras.length === 0) return email
  return palavras.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ")
}

/**
 * Destino depois do login: só caminho relativo que começa com uma única "/". Barra invertida e
 * caracteres de controle (tab e quebra de linha são removidos pelo navegador, o que transformaria
 * "/\t/evil.com" em "//evil.com") caem em "/".
 */
export function caminhoProximoSeguro(proximo: string | null | undefined): string {
  if (typeof proximo !== "string") return "/"
  if (!proximo.startsWith("/") || proximo.startsWith("//")) return "/"
  if (/[\\\u0000-\u001f\u007f]/.test(proximo)) return "/"
  return proximo
}

export interface EntradaAcesso {
  modo: ModoAutenticacao
  metodo: string
  /** Caminho com query, ex. "/prospects/a?x=1". */
  caminho: string
  host: string | null
  origin: string | null
  secFetchSite: string | null
  /** URL(PLANEJAMENTO_APP_URL).host, ou null. */
  hostPublico: string | null
  autenticado: boolean
}

export type DecisaoAcesso =
  | { tipo: "passar" }
  | { tipo: "login"; proximo: string }
  | { tipo: "nao_autenticado" }
  | { tipo: "recusar" }

/** Caminho sem query nem fragmento. */
function soCaminho(caminho: string): string {
  return caminho.split(/[?#]/)[0] ?? ""
}

/**
 * Rotas livres são comparadas por prefixo, então um caminho com "." ou ".." (inclusive
 * codificado) ou barra invertida poderia sair dela. Nesses casos nada é livre e vale a sessão.
 */
function caminhoAmbiguo(caminho: string): boolean {
  return /\\|%2e|%5c|%2f/i.test(caminho) || caminho.split("/").some((s) => s === "." || s === "..")
}

function ehApi(caminho: string): boolean {
  return caminho === "/api" || caminho.startsWith("/api/")
}

export function decidirAcesso(e: EntradaAcesso): DecisaoAcesso {
  const dados = { metodo: e.metodo, host: e.host, origin: e.origin, secFetchSite: e.secFetchSite }

  if (e.modo === "off") return requisicaoLocalPermitida(dados) ? { tipo: "passar" } : { tipo: "recusar" }

  const local = hostEhLocal(e.host)
  const publico = !!e.host && !!e.hostPublico && e.host.toLowerCase() === e.hostPublico.toLowerCase()
  if (!local && !publico) return { tipo: "recusar" }
  if (!origemDeEscritaPermitida(dados)) return { tipo: "recusar" }

  const caminho = soCaminho(e.caminho)
  const livre = !caminhoAmbiguo(caminho)
  if (livre && (caminho === "/login" || caminho.startsWith("/auth/"))) return { tipo: "passar" }
  if (livre && caminho.startsWith("/api/interno/")) return local ? { tipo: "passar" } : { tipo: "recusar" }

  if (e.autenticado) return { tipo: "passar" }
  if (ehApi(caminho)) return { tipo: "nao_autenticado" }
  return { tipo: "login", proximo: caminhoProximoSeguro(e.caminho) }
}
