import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { itensDoCatalogo, lerItemDoCatalogo } from "../src/catalogo-skills"
import { catalogoReal, RAIZ } from "./ajuda"

describe("catálogo de skills", () => {
  it("lista 16 itens: 1 de processo, 10 de etapas, 2 de subagentes e 3 de regras, nessa ordem", () => {
    const itens = itensDoCatalogo(RAIZ, catalogoReal())
    expect(itens).toHaveLength(16)
    expect(itens.map((i) => i.id)).toEqual([
      "visao-geral",
      "etapa:01",
      "etapa:02",
      "etapa:03",
      "etapa:04",
      "etapa:05",
      "etapa:06",
      "etapa:07",
      "etapa:08",
      "etapa:09",
      "etapa:final",
      "subagente:analista-dados",
      "subagente:pesquisador-benchmark",
      "regra:padrao-visual",
      "regra:regras-de-validacao",
      "regra:repertorio-solucoes",
    ])
    const grupos = itens.map((i) => i.grupo)
    expect(grupos.filter((g) => g === "Processo")).toHaveLength(1)
    expect(grupos.filter((g) => g === "Etapas")).toHaveLength(10)
    expect(grupos.filter((g) => g === "Subagentes")).toHaveLength(2)
    expect(grupos.filter((g) => g === "Regras compartilhadas")).toHaveLength(3)
  })

  it("usa os títulos e resumos definidos", () => {
    const c = catalogoReal()
    const itens = itensDoCatalogo(RAIZ, c)
    const por = (id: string) => itens.find((i) => i.id === id)!
    expect(por("visao-geral").titulo).toBe("Visão geral do processo")
    expect(por("etapa:03").titulo).toBe(c.etapas.find((e) => e.id === "03")!.rotuloStatus)
    expect(por("etapa:03").resumo).toBe(c.etapas.find((e) => e.id === "03")!.descricao)
    expect(por("subagente:analista-dados").titulo).toBe("analista-dados")
    expect(por("subagente:analista-dados").resumo).toMatch(/KPIs/)
    expect(por("regra:padrao-visual").titulo).toBe("Padrão visual")
    expect(por("regra:regras-de-validacao").titulo).toBe("Regras de validação")
    expect(por("regra:repertorio-solucoes").titulo).toBe("Repertório de soluções")
  })

  it("marca temFluxo só onde a tabela tem caminho de fluxo", () => {
    const itens = itensDoCatalogo(RAIZ, catalogoReal())
    for (const i of itens) {
      expect(i.temFluxo).toBe(i.grupo !== "Regras compartilhadas")
    }
  })

  it("lê o texto de uma etapa pelo SKILL.md da pasta do catálogo", () => {
    const item = lerItemDoCatalogo(RAIZ, catalogoReal(), "etapa:03")
    expect(item?.texto).toContain("Skill 03")
  })

  it("lê o texto de um subagente e de uma regra", () => {
    const sub = lerItemDoCatalogo(RAIZ, catalogoReal(), "subagente:analista-dados")
    expect(sub?.texto).toContain("analista de dados")
    const regra = lerItemDoCatalogo(RAIZ, catalogoReal(), "regra:padrao-visual")
    expect(regra?.texto).toBeTruthy()
  })

  it("regra não tem fluxo", () => {
    const item = lerItemDoCatalogo(RAIZ, catalogoReal(), "regra:padrao-visual")
    expect(item?.fluxo).toBeNull()
    expect(item?.temFluxo).toBe(false)
  })

  it("a visão geral não tem texto de skill", () => {
    const item = lerItemDoCatalogo(RAIZ, catalogoReal(), "visao-geral")
    expect(item?.texto).toBeNull()
    expect(item?.temFluxo).toBe(true)
  })

  it("id fora da lista dá null e não lê nenhum arquivo", () => {
    const ler = vi.fn(() => "conteúdo")
    for (const id of ["../../.env", "etapa:99", "etapa:03/../../x", "", "regra:../x", "etapa:03 "]) {
      expect(lerItemDoCatalogo(RAIZ, catalogoReal(), id, ler)).toBeNull()
    }
    expect(ler).not.toHaveBeenCalled()
  })

  it("arquivo de fluxo ausente vira fluxo: null com temFluxo: true", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "catalogo-skills-"))
    const pasta = path.join(raiz, ".claude/skills/03-diagnostico-performance")
    await mkdir(pasta, { recursive: true })
    await writeFile(path.join(pasta, "SKILL.md"), "# Skill 03 de teste\n")
    const item = lerItemDoCatalogo(raiz, catalogoReal(), "etapa:03")
    expect(item?.texto).toContain("Skill 03")
    expect(item?.fluxo).toBeNull()
    expect(item?.temFluxo).toBe(true)
  })

  it("arquivos ausentes viram null sem lançar, e o subagente cai para o nome do id", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "catalogo-skills-vazio-"))
    expect(() => itensDoCatalogo(raiz, catalogoReal())).not.toThrow()
    const sub = lerItemDoCatalogo(raiz, catalogoReal(), "subagente:analista-dados")
    expect(sub?.texto).toBeNull()
    expect(sub?.titulo).toBe("analista-dados")
  })

  it("etapa sem skill dá texto null", () => {
    const c = structuredClone(catalogoReal())
    c.etapas.find((e) => e.id === "03")!.skill = null
    const ler = vi.fn(() => null)
    const item = lerItemDoCatalogo(RAIZ, c, "etapa:03", ler)
    expect(item?.texto).toBeNull()
    expect(item?.fluxo).toBeNull()
    expect(item?.temFluxo).toBe(false)
  })

  it("catalogo-skills-tipos.ts não importa node:", () => {
    const fonte = readFileSync(path.join(RAIZ, "src/packages/core/src/catalogo-skills-tipos.ts"), "utf8")
    expect(fonte).not.toMatch(/from\s+["']node:/)
    expect(fonte).not.toMatch(/require\(\s*["']node:/)
  })
})

describe("fluxogramas do catálogo", () => {
  const CLASSDEFS = [
    "classDef checkpoint fill:#fff1e6,stroke:#e8803a,color:#7a3d0c",
    "classDef subagente fill:#e8f0fd,stroke:#1f4fa8,color:#173a7a",
    "classDef entrega fill:#e6f6ec,stroke:#16743b,color:#0f4f28",
  ]
  const comFluxo = () => itensDoCatalogo(RAIZ, catalogoReal()).filter((i) => i.temFluxo)

  it("há 13 itens com fluxo", () => {
    expect(comFluxo()).toHaveLength(13)
  })

  it("todo item com fluxo tem o arquivo existente e não vazio", () => {
    for (const i of comFluxo()) {
      const fluxo = lerItemDoCatalogo(RAIZ, catalogoReal(), i.id)?.fluxo
      expect(fluxo, i.id).toBeTruthy()
      expect(fluxo!.trim().length, i.id).toBeGreaterThan(0)
    }
  })

  it("todo fluxo começa com flowchart TD e traz as três classDef da legenda", () => {
    for (const i of comFluxo()) {
      const fluxo = lerItemDoCatalogo(RAIZ, catalogoReal(), i.id)?.fluxo ?? ""
      const primeira = fluxo.split("\n").find((l) => l.trim() !== "")
      expect(primeira?.trim(), i.id).toBe("flowchart TD")
      for (const c of CLASSDEFS) expect(fluxo, `${i.id}: ${c}`).toContain(c)
    }
  })
})
