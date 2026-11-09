import { describe, expect, it } from "vitest"
import { ErroNumeracaoAntiga } from "@workspace/core/erros"
import { respostaDeErro } from "./http"

describe("respostaDeErro", () => {
  it("prospect na numeração antiga das etapas vira 409 com o código, o slug e a instrução da migração", async () => {
    const r = respostaDeErro(new ErroNumeracaoAntiga("adda"))
    expect(r.status).toBe(409)
    const corpo = (await r.json()) as { erro: string; codigo: string; slug: string }
    expect(corpo.codigo).toBe("numeracao_antiga")
    expect(corpo.slug).toBe("adda")
    expect(corpo.erro).toContain("npm run migrar-etapas")
  })
})
