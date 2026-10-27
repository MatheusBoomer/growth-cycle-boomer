import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoriaArmazem } from "../../src/nuvem/memoria"
import { caminhoSessao, MemoriaSessao } from "../../src/nuvem/memoria-sessao"
import { raizTemporaria } from "../ajuda"

const SLUG = "acme"
const SESSAO = "s1"
const bytes = (t: string) => new Uint8Array(Buffer.from(t))

describe("caminhoSessao", () => {
  it('caminho da sessão troca todo caractere fora de [a-zA-Z0-9] por "-"', () => {
    expect(caminhoSessao("/c", "/Users/m/Projetos Boomer/x-v2", "s1")).toBe(
      "/c/projects/-Users-m-Projetos-Boomer-x-v2/s1.jsonl",
    )
  })
})

describe("MemoriaSessao", () => {
  let configDir: string
  let cwd: string
  let armazem: MemoriaArmazem
  let memoria: MemoriaSessao
  let baixadas: number

  beforeEach(async () => {
    const base = await raizTemporaria()
    configDir = path.join(base, "claude")
    cwd = path.join(base, "projeto com espaço")
    armazem = new MemoriaArmazem()
    baixadas = 0
    const original = armazem.baixarSessao.bind(armazem)
    armazem.baixarSessao = async (slug, id) => {
      baixadas++
      return original(slug, id)
    }
    memoria = new MemoriaSessao({ armazem, configDir, cwd })
  })

  const arquivo = () => caminhoSessao(configDir, cwd, SESSAO)
  const gravarLocal = async (t: string) => {
    await mkdir(path.dirname(arquivo()), { recursive: true })
    await writeFile(arquivo(), t)
  }

  it("salvar e restaurar devolvem o mesmo conteúdo", async () => {
    await gravarLocal('{"a":1}\n')
    await memoria.salvar(SLUG, SESSAO)
    await writeFile(arquivo(), "")
    expect(await memoria.restaurar(SLUG, SESSAO)).toBe(true)
    expect(await readFile(arquivo(), "utf8")).toBe('{"a":1}\n')
  })

  it("salvar sem arquivo local é ignorado", async () => {
    await memoria.salvar(SLUG, SESSAO)
    expect(await armazem.baixarSessao(SLUG, SESSAO)).toBeNull()
  })

  it("restaurar sem nada na nuvem e sem arquivo local → false", async () => {
    expect(await memoria.restaurar(SLUG, SESSAO)).toBe(false)
  })

  it("arquivo local presente e igual à nuvem → true sem baixar", async () => {
    await armazem.enviarSessao(SLUG, SESSAO, bytes("x\n"))
    await gravarLocal("x\n")
    expect(await memoria.restaurar(SLUG, SESSAO)).toBe(true)
    expect(baixadas).toBe(0)
  })

  it("arquivo de sessão vazio cai na retomada", async () => {
    await armazem.enviarSessao(SLUG, SESSAO, new Uint8Array(0))
    expect(await memoria.restaurar(SLUG, SESSAO)).toBe(false)
  })

  it("arquivo local vazio é substituído pelo da nuvem", async () => {
    await armazem.enviarSessao(SLUG, SESSAO, bytes("conteudo\n"))
    await gravarLocal("")
    expect(await memoria.restaurar(SLUG, SESSAO)).toBe(true)
    expect(await readFile(arquivo(), "utf8")).toBe("conteudo\n")
  })
})
