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
