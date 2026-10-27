import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // Mesmo atalho "@/" do tsconfig, para testar rotas que importam lib/http.
  resolve: { alias: [{ find: /^@\//, replacement: `${path.resolve(import.meta.dirname)}/` }] },
  // O tsconfig do Next usa jsx "preserve"; para os testes que renderizam componentes o JSX precisa ser compilado.
  oxc: { jsx: { runtime: "automatic" } },
  test: { exclude: ["node_modules/**", ".next/**"] },
})
