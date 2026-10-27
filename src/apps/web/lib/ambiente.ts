import path from "node:path"
import { loadEnvConfig } from "@next/env"

/**
 * Carga do .env da raiz do repositório. O Next só lê o .env da pasta do app (src/apps/web, que não tem um), e o
 * proxy, a sessão e as rotas de login leem PLANEJAMENTO_AUTH, SUPABASE_* e PLANEJAMENTO_APP_URL em toda
 * requisição. Por isso este módulo carrega o ambiente ao ser importado, e quem lê essas variáveis o importa
 * primeiro: a primeira requisição depois de subir já decide com o login do .env, e não no modo off.
 */

// Um só carregamento por processo, mesmo que o Next empacote este módulo mais de uma vez (proxy, rotas,
// instrumentation): cada pacote tem a própria cópia do módulo, mas o globalThis é um só.
const registro = globalThis as unknown as { __planejamentoAmbiente?: true }

/** Raiz do projeto de planejamento: PLANEJAMENTO_ROOT, ou três níveis acima de src/apps/web (onde o Next roda). */
export function raizDoProjeto(env: Record<string, string | undefined> = process.env): string {
  return env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")
}

/** Carrega o .env da raiz em process.env (sem sobrescrever o que o processo já tem). Idempotente. */
export function carregarAmbiente(): void {
  if (registro.__planejamentoAmbiente) return
  loadEnvConfig(raizDoProjeto(), process.env.NODE_ENV !== "production", undefined, true)
  registro.__planejamentoAmbiente = true
}

carregarAmbiente()
