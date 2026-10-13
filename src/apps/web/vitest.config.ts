import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // Mesmo atalho "@/" do tsconfig, para testar rotas que importam lib/http.
  resolve: { alias: [{ find: /^@\//, replacement: `${path.resolve(import.meta.dirname)}/` }] },
  test: { exclude: ["node_modules/**", ".next/**"] },
})
