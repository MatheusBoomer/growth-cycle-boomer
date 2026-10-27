import type { loadEnvConfig as LoadEnvConfig } from "@next/env"
import { vi } from "vitest"

// lib/ambiente carrega o .env da raiz do repositório ao ser importado. Nos testes isso traria as chaves de
// verdade do analista para o processo e mudaria o resultado conforme a máquina, então o @next/env é sempre
// falso aqui. Quem testa a carga (ambiente.test, proxy.test) define o que o falso escreve no process.env.
// A mesma função falsa sobrevive a vi.resetModules, para o teste contar as chamadas entre importações.
const loadEnvConfig = vi.hoisted(() => vi.fn<typeof LoadEnvConfig>(() => ({ combinedEnv: {}, parsedEnv: undefined, loadedEnvFiles: [] })))
vi.mock("@next/env", () => ({ loadEnvConfig }))
