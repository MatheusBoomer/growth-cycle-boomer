import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const pasta = path.resolve(import.meta.dirname, "../../public/marca")
const ler = (nome: string) => readFileSync(path.join(pasta, nome), "utf-8")
const cores = (svg: string) => [...new Set([...svg.matchAll(/fill="(#[0-9A-F]{6})"/g)].map((m) => m[1]))]

describe("logos públicos da Boomer", () => {
  it("versão para fundo escuro: 'bo' branco e 'omer' laranja, recortada", () => {
    const svg = ler("boomer-logo-escuro.svg")
    expect(svg).toContain('viewBox="26 20 546 126"')
    expect(cores(svg)).toEqual(["#FEFEFE", "#EB610A"])
  })

  it("versão para fundo claro: 'bo' laranja e 'omer' azul-marinho, recortada", () => {
    const svg = ler("boomer-logo-claro.svg")
    expect(svg).toContain('viewBox="26 20 546 126"')
    expect(cores(svg)).toEqual(["#E9600B", "#20315E"])
  })
})
