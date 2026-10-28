/** Há APIFY_TOKEN não vazio no ambiente ou numa linha `APIFY_TOKEN=...` do .env? Nunca devolve o valor. */
export function tokenApifyConfigurado(ambiente: Record<string, string | undefined>, conteudoEnv: string | null): boolean {
  if ((ambiente.APIFY_TOKEN ?? "").trim()) return true
  if (!conteudoEnv) return false
  return conteudoEnv.split(/\r?\n/).some((linha) => {
    const m = /^\s*APIFY_TOKEN\s*=(.*)$/.exec(linha)
    return m !== null && m[1]!.trim().replace(/^["']|["']$/g, "").trim() !== ""
  })
}

/** Quem executa o agente: "demo" (respostas de mentira), "sdk" (Agent SDK com chave de API) ou "cli" (Claude Code com a assinatura). */
export type ExecutorDoAmbiente = "sdk" | "cli" | "demo"

/** Executor escolhido por PLANEJAMENTO_EXECUTOR: `demo`, `sdk` (espaços aparados), senão `cli`. Maiúsculas não valem. */
export function executorDoAmbiente(env: Record<string, string | undefined>): ExecutorDoAmbiente {
  const valor = (env.PLANEJAMENTO_EXECUTOR ?? "").trim()
  return valor === "demo" || valor === "sdk" ? valor : "cli"
}

/** Há ANTHROPIC_API_KEY não vazia no ambiente? Nunca devolve o valor. */
export function chaveApiConfigurada(env: Record<string, string | undefined>): boolean {
  return (env.ANTHROPIC_API_KEY ?? "").trim() !== ""
}

/** Os dados moram na nuvem (PLANEJAMENTO_DADOS=supabase)? Na nuvem não há Finder nem pasta local para abrir. */
export function dadosNaNuvem(env: Record<string, string | undefined>): boolean {
  return (env.PLANEJAMENTO_DADOS ?? "").trim() === "supabase"
}
