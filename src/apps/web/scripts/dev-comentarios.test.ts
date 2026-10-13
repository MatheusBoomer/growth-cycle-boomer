import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { criarArmazenamentoDev } from "../lib/modo-dev/armazenamento.ts"
import type { NovoComentario } from "../lib/modo-dev/nucleo.ts"

const exec = promisify(execFile)
const SCRIPT = path.resolve(import.meta.dirname, "dev-comentarios.ts")
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const novo: NovoComentario = {
  pagina: "/",
  componente: "GradeProspects",
  cadeia: ["GradeProspects"],
  seletor: "main",
  tag: "main",
  texto: "",
  caixa: { x: 0, y: 0, largura: 10, altura: 10, larguraTela: 100, alturaTela: 100 },
  comentario: "Ajustar",
}

let raiz: string

beforeEach(async () => {
  raiz = await mkdtemp(path.join(os.tmpdir(), "modo-dev-script-"))
})

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true })
})

// Roda no Node puro, como o desenvolvedor roda: pega import sem .ts ou tipo sem `type`.
async function rodar(...args: string[]): Promise<string> {
  const { stdout } = await exec(process.execPath, [SCRIPT, ...args], { env: { ...process.env, PLANEJAMENTO_ROOT: raiz } })
  return stdout
}

describe("npm run dev:comentarios", () => {
  it("sem comentários avisa que não há nenhum", async () => {
    expect(await rodar()).toBe("Nenhum comentário aberto.\n")
  })

  it("lista com o caminho absoluto do recorte", async () => {
    const pasta = path.join(raiz, ".dev-comentarios")
    const c = await criarArmazenamentoDev(pasta).criar(novo, PNG)
    const saida = await rodar()
    expect(saida).toContain("#1 · GradeProspects")
    expect(saida).toContain(`recorte: ${pasta}/capturas/${c.id}.png`)
  })

  it("--limpar com números apaga só esses e avisa os inexistentes", async () => {
    const armazenamento = criarArmazenamentoDev(path.join(raiz, ".dev-comentarios"))
    await armazenamento.criar(novo, null)
    await armazenamento.criar(novo, null)
    expect(await rodar("--limpar", "1,9")).toBe("Apagados: #1.\nNão existiam: #9.\n")
    expect((await armazenamento.listar()).map((c) => c.numero)).toEqual([2])
  })

  it("--limpar sem números apaga tudo", async () => {
    await criarArmazenamentoDev(path.join(raiz, ".dev-comentarios")).criar(novo, null)
    expect(await rodar("--limpar")).toBe("Todos os comentários foram apagados (1).\n")
    expect(await rodar("--limpar")).toBe("Nada para apagar.\n")
  })

  it("argumento inválido sai com código 1 e mensagem", async () => {
    await expect(rodar("--limpar", "x")).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("Números inválidos") })
  })
})
