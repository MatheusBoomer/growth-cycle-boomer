import { fileURLToPath } from "node:url"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

/**
 * Config opt-in da suite viva (npm run test:supabase).
 *
 * Roda SOMENTE test/nuvem/supabase.test.ts contra o projeto Supabase real e
 * compartilhado, por isso nao faz parte da execucao padrao (vitest.config.ts).
 * Raiz do projeto (onde fica o .env): so as variaveis SUPABASE_TESTE_* entram
 * nos testes.
 */
const raizDoProjeto = fileURLToPath(new URL("../../..", import.meta.url))

export default defineConfig({
  test: {
    include: ["test/nuvem/supabase.test.ts"],
    testTimeout: 20000,
    env: loadEnv("test", raizDoProjeto, "SUPABASE_TESTE_"),
  },
})
