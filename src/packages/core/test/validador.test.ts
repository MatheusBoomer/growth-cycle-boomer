import { writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { criarValidadorPython } from "../src/validador"
import { RAIZ } from "./ajuda"

describe("criarValidadorPython", () => {
  it("devolve o JSON do script", async () => {
    const falso = path.join(tmpdir(), `falso-${Date.now()}.xlsx`)
    await writeFile(falso, "não é excel")
    const r = await criarValidadorPython(RAIZ)({ insumoId: "clientes-historico", arquivoAbs: falso })
    expect(r.ok).toBe(false)
    expect(r.problemas[0]).toContain("Não consegui abrir")
  })

  it("Python ausente vira problema legível", async () => {
    const r = await criarValidadorPython(RAIZ, "python-que-nao-existe")({ insumoId: "x", arquivoAbs: "/x" })
    expect(r).toMatchObject({ ok: false, problemas: [expect.stringContaining("Python 3")] })
  })
})
