import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JanelaUso } from "../src/executor/tipos"
import { RegistroUso } from "../src/uso-assinatura"

describe("RegistroUso", () => {
  let pasta: string
  beforeEach(async () => {
    pasta = await mkdtemp(path.join(os.tmpdir(), "uso-assinatura-"))
  })
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true })
  })

  const janelas: JanelaUso[] = [{ janela: "five_hour", utilizacao: 0.12, resetsAt: null }]

  it("grava e lê o último uso", async () => {
    const registro = new RegistroUso(pasta)
    await registro.gravar(janelas, "2026-10-27T10:00:00.000Z")
    const lido = await registro.ler()
    expect(lido?.atualizadoEm).toBe("2026-10-27T10:00:00.000Z")
    expect(lido?.janelas).toEqual(janelas)
  })

  it("não lança quando a pasta de destino não pode ser criada (raiz somente leitura)", async () => {
    // A "raiz" é um arquivo: criar <raiz>/.app falha com ENOTDIR, qualquer que seja o usuário.
    const raizArquivo = path.join(pasta, "raiz-que-e-arquivo")
    await writeFile(raizArquivo, "x")
    const registro = new RegistroUso(raizArquivo)
    await expect(registro.gravar(janelas, "2026-10-27T10:00:00.000Z")).resolves.toBeUndefined()
    expect(await registro.ler()).toBeNull()
  })
})
