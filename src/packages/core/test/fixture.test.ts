import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { ErroFixture } from "../src/erros"
import { antesDe, carregarFixture, caminhoNaBase, pastaDoFixture, type Manifesto } from "../src/fixture"
import { raizTemporaria } from "./ajuda"
import { criarFixtureMinimo } from "./fixture-minimo"

let raiz: string
let pasta: string

beforeEach(async () => {
  raiz = await raizTemporaria()
  pasta = pastaDoFixture(raiz, "mini")
  await criarFixtureMinimo(pasta)
})

async function alterarManifesto(mudar: (m: Manifesto) => void): Promise<void> {
  const arquivo = path.join(pasta, "manifesto.json")
  const m = JSON.parse(await readFile(arquivo, "utf8")) as Manifesto
  mudar(m)
  await writeFile(arquivo, JSON.stringify(m))
}

describe("carregarFixture", () => {
  it("carrega o fixture mínimo", async () => {
    const f = await carregarFixture(raiz, "mini")
    expect(f.manifesto.arquivos).toHaveLength(9)
    expect(f.estadoCompleto.etapas["final"].status).toBe("concluida")
    expect(f.pasta).toBe(pasta)
  })

  it("rejeita caminho que escapa da pasta", async () => {
    await alterarManifesto((m) => m.arquivos.push({ caminho: "../fora.md", etapa: "01" }))
    await expect(carregarFixture(raiz, "mini")).rejects.toBeInstanceOf(ErroFixture)
  })

  it("rejeita caminho absoluto", async () => {
    await alterarManifesto((m) => m.arquivos.push({ caminho: "/etc/passwd", etapa: "01" }))
    await expect(carregarFixture(raiz, "mini")).rejects.toBeInstanceOf(ErroFixture)
  })

  it("rejeita arquivo do manifesto que não existe em base/", async () => {
    await alterarManifesto((m) => m.arquivos.push({ caminho: "contexto/sumiu.md", etapa: "01" }))
    await expect(carregarFixture(raiz, "mini")).rejects.toThrow(/contexto\/sumiu\.md/)
  })

  it("rejeita arquivo de base/ fora do manifesto", async () => {
    await mkdir(path.join(pasta, "base/dados"), { recursive: true })
    await writeFile(path.join(pasta, "base/dados/solto.xlsx"), "x")
    await expect(carregarFixture(raiz, "mini")).rejects.toThrow(/dados\/solto\.xlsx/)
  })

  it("rejeita kit que cita arquivo fora do manifesto", async () => {
    await alterarManifesto((m) => (m.kit["02"] = ["contexto/nao-listado.md"]))
    await expect(carregarFixture(raiz, "mini")).rejects.toThrow(/nao-listado/)
  })

  it("fixture inexistente vira ErroFixture", async () => {
    await expect(carregarFixture(raiz, "nao-existe")).rejects.toBeInstanceOf(ErroFixture)
  })

  it("id com separador de caminho vira ErroFixture", async () => {
    await expect(carregarFixture(raiz, "../mini")).rejects.toBeInstanceOf(ErroFixture)
  })

  it("estado-completo sem a forma esperada vira ErroFixture", async () => {
    await writeFile(path.join(pasta, "estado-completo.json"), "{}")
    await expect(carregarFixture(raiz, "mini")).rejects.toBeInstanceOf(ErroFixture)
  })

  it("manifesto sem kit ou sem arquivos vira ErroFixture", async () => {
    await alterarManifesto((m) => delete (m as Partial<Manifesto>).kit)
    await expect(carregarFixture(raiz, "mini")).rejects.toBeInstanceOf(ErroFixture)
    await criarFixtureMinimo(pasta)
    await alterarManifesto((m) => delete (m as Partial<Manifesto>).arquivos)
    await expect(carregarFixture(raiz, "mini")).rejects.toBeInstanceOf(ErroFixture)
  })

  it("estado-completo ilegível vira ErroFixture", async () => {
    await rm(path.join(pasta, "estado-completo.json"))
    await expect(carregarFixture(raiz, "mini")).rejects.toBeInstanceOf(ErroFixture)
  })
})

describe("antesDe", () => {
  it("00 vem antes de tudo; compara pela ordem das etapas", () => {
    expect(antesDe("00", "01")).toBe(true)
    expect(antesDe("02", "03")).toBe(true)
    expect(antesDe("03", "03")).toBe(false)
    expect(antesDe("final", "09")).toBe(false)
    expect(antesDe("09", "final")).toBe(true)
  })
})

describe("caminhoNaBase", () => {
  it("troca .app/ por app/", async () => {
    const f = await carregarFixture(raiz, "mini")
    expect(caminhoNaBase(f, ".app/propostas/p1.md")).toBe(path.join(pasta, "base/app/propostas/p1.md"))
    expect(caminhoNaBase(f, "contexto/kickoff-transcricao.md")).toBe(path.join(pasta, "base/contexto/kickoff-transcricao.md"))
  })
})
