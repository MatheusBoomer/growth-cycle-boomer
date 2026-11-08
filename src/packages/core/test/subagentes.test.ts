import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { lerDefinicaoSubagente } from "../src/executor/subagentes"
import { RAIZ } from "./ajuda"

function raizComAgente(nome: string, conteudo: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "subagente-"))
  mkdirSync(path.join(dir, ".claude/agents"), { recursive: true })
  writeFileSync(path.join(dir, ".claude/agents", `${nome}.md`), conteudo)
  return dir
}

describe("lerDefinicaoSubagente", () => {
  it("lê o analista-dados real", () => {
    const d = lerDefinicaoSubagente(RAIZ, "analista-dados")
    expect(d.tools).toEqual(["Read", "Bash", "Glob"])
    expect(d.description.length).toBeGreaterThan(0)
    expect(d.prompt.startsWith("Você é o analista de dados")).toBe(true)
    expect(d.model).toBeUndefined()
    expect(d.effort).toBeUndefined()
  })

  it("apara os espaços das ferramentas e do corpo, e aceita fim de linha do Windows", () => {
    const raiz = raizComAgente("x", "---\r\nname: x\r\ndescription: faz coisas\r\ntools:  Read ,  Glob \r\n---\r\n\r\nCorpo aqui.\r\n\r\n")
    expect(lerDefinicaoSubagente(raiz, "x")).toEqual({ description: "faz coisas", prompt: "Corpo aqui.", tools: ["Read", "Glob"] })
  })

  it("lança, com o nome do arquivo, quando falta cabeçalho, description ou tools", () => {
    expect(() => lerDefinicaoSubagente(raizComAgente("a", "só corpo"), "a")).toThrow(/a\.md/)
    expect(() => lerDefinicaoSubagente(raizComAgente("b", "---\ntools: Read\n---\ncorpo"), "b")).toThrow(/b\.md/)
    expect(() => lerDefinicaoSubagente(raizComAgente("c", "---\ndescription: d\n---\ncorpo"), "c")).toThrow(/c\.md/)
  })

  it("lança quando tools está vazio", () => {
    expect(() => lerDefinicaoSubagente(raizComAgente("d", "---\ndescription: d\ntools:\n---\ncorpo"), "d")).toThrow(/d\.md/)
    expect(() => lerDefinicaoSubagente(raizComAgente("e", "---\ndescription: d\ntools: , ,\n---\ncorpo"), "e")).toThrow(/e\.md/)
  })
})
