import { fileURLToPath } from "node:url"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

/** Raiz do projeto (onde fica o .env): só as variáveis SUPABASE_TESTE_* entram nos testes. */
const raizDoProjeto = fileURLToPath(new URL("../../..", import.meta.url))

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 20000,
    env: loadEnv("test", raizDoProjeto, "SUPABASE_TESTE_"),
  },
})
