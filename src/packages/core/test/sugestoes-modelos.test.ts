import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { CAMINHO_SUGESTOES, carregarSugestoes } from "../src/sugestoes-modelos"
import { catalogoReal, RAIZ } from "./ajuda"

function raizComSugestoes(conteudo: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "sugestoes-"))
  mkdirSync(path.dirname(path.join(dir, CAMINHO_SUGESTOES)), { recursive: true })
  writeFileSync(path.join(dir, CAMINHO_SUGESTOES), JSON.stringify(conteudo))
  return dir
}

const BOA = { etapa: "06", alvo: "analista-dados", modelo: "sonnet", esforco: null, motivo: "frágil" }

describe("sugestões de modelo", () => {
  it("carrega as sugestões reais, validadas contra o catálogo", () => {
    const s = carregarSugestoes(RAIZ, catalogoReal())
    const e06 = s.find((x) => x.etapa === "06" && x.alvo === "analista-dados")
    expect(e06?.modelo).toBe("sonnet")
    expect(s.filter((x) => x.alvo === "pesquisador-benchmark").map((x) => x.etapa)).toEqual(["02", "05", "08"])
    expect(s.every((x) => x.motivo.length > 0)).toBe(true)
  })

  it("recusa sugestão de subagente que a etapa não tem", () => {
    const raiz = raizComSugestoes([{ ...BOA, etapa: "01" }])
    expect(() => carregarSugestoes(raiz, catalogoReal())).toThrow(/analista-dados/)
  })

  it("recusa etapa inexistente, esforço inválido e motivo vazio", () => {
    expect(() => carregarSugestoes(raizComSugestoes([{ ...BOA, etapa: "99" }]), catalogoReal())).toThrow(/99/)
    expect(() => carregarSugestoes(raizComSugestoes([{ ...BOA, esforco: "extremo" }]), catalogoReal())).toThrow(/extremo/)
    expect(() => carregarSugestoes(raizComSugestoes([{ ...BOA, motivo: "  " }]), catalogoReal())).toThrow(/motivo/)
  })
})

