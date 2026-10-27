import { defineConfig } from "vitest/config"

/**
 * Config padrao (npm test, vitest run, turbo run test).
 *
 * A suite viva do Supabase (test/nuvem/supabase.test.ts) fica FORA daqui e as
 * variaveis SUPABASE_TESTE_* nao entram no ambiente dos testes: o projeto
 * Supabase e real e compartilhado, entao a execucao padrao nunca encosta nele.
 * Para rodar a suite viva, use `npm run test:supabase` (vitest.supabase.config.ts).
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "test/nuvem/supabase.test.ts"],
    testTimeout: 20000,
  },
})
