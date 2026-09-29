/** Há APIFY_TOKEN não vazio no ambiente ou numa linha `APIFY_TOKEN=...` do .env? Nunca devolve o valor. */
export function tokenApifyConfigurado(ambiente: Record<string, string | undefined>, conteudoEnv: string | null): boolean {
  if ((ambiente.APIFY_TOKEN ?? "").trim()) return true
  if (!conteudoEnv) return false
  return conteudoEnv.split(/\r?\n/).some((linha) => {
    const m = /^\s*APIFY_TOKEN\s*=(.*)$/.exec(linha)
    return m !== null && m[1]!.trim().replace(/^["']|["']$/g, "").trim() !== ""
  })
}
