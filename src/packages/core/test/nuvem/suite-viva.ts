import { randomBytes } from "node:crypto"

/** Prefixo dos slugs criados pelos contratos; sozinho não basta para identificar um (ver ehSlugDeContrato). */
export const PREFIXO_CONTRATO = "contrato-"

const BYTES_DO_SLUG = 6
const FORMATO_SLUG = new RegExp(`^${PREFIXO_CONTRATO}[0-9a-f]{${BYTES_DO_SLUG * 2}}$`)

/** Slug próprio de cada caso dos contratos. */
export function novoSlug(): string {
  return `${PREFIXO_CONTRATO}${randomBytes(BYTES_DO_SLUG).toString("hex")}`
}

/** Só o formato exato de novoSlug: um prospect real "Contrato X" (contrato-x) nunca é apagado pela limpeza. */
export function ehSlugDeContrato(slug: string): boolean {
  return FORMATO_SLUG.test(slug)
}

/** A suíte viva roda só com a URL e a chave de serviço do projeto de teste. */
export function suiteVivaHabilitada(env: Record<string, string | undefined>): boolean {
  return !!env.SUPABASE_TESTE_URL && !!env.SUPABASE_TESTE_SERVICE_ROLE_KEY
}

const DOMINIO_EMAIL_CONTRATO = "@teste.invalid"
const FORMATO_EMAIL = new RegExp(`^${PREFIXO_CONTRATO}[0-9a-f]{${BYTES_DO_SLUG * 2}}${DOMINIO_EMAIL_CONTRATO.replace(".", "\\.")}$`)

/** E-mail próprio de cada caso do contrato de usuários (domínio .invalid nunca existe de verdade). */
export function novoEmail(): string {
  return `${PREFIXO_CONTRATO}${randomBytes(BYTES_DO_SLUG).toString("hex")}${DOMINIO_EMAIL_CONTRATO}`
}

/** Só o formato exato de novoEmail: a limpeza da suíte viva nunca apaga um usuário real. */
export function ehEmailDeContrato(email: string): boolean {
  return FORMATO_EMAIL.test(email)
}

/** Alvo próprio de cada caso do contrato de configuração de modelo (o Repositorio não valida alvos). */
export function novoAlvoDeContrato(): string {
  return `${PREFIXO_CONTRATO}${randomBytes(BYTES_DO_SLUG).toString("hex")}`
}

/** Só o formato exato de novoAlvoDeContrato: a limpeza da suíte viva nunca apaga uma configuração real. */
export function ehAlvoDeContrato(alvo: string): boolean {
  return FORMATO_SLUG.test(alvo)
}

/** Item próprio de cada caso do contrato de notas das skills (o Repositorio não valida o item). */
export function novoItemDeContrato(): string {
  return `${PREFIXO_CONTRATO}${randomBytes(BYTES_DO_SLUG).toString("hex")}`
}

/** Só o formato exato de novoItemDeContrato: a limpeza da suíte viva nunca apaga uma nota de item real. */
export function ehItemDeContrato(item: string): boolean {
  return FORMATO_SLUG.test(item)
}
