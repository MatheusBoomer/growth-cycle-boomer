import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { extrairOverrides, montarDossie } from "../src/dossie"
import { RAIZ } from "./ajuda"

describe("dossiê", () => {
  it("ignora a seção de overrides padrão do template", () => {
    const template = readFileSync(path.join(RAIZ, "clientes/_template/CLAUDE.md"), "utf8")
    expect(extrairOverrides(template)).toBeNull()
    expect(extrairOverrides(null)).toBeNull()
  })

  it("extrai um override real", () => {
    const md = "# Adda\n\n## Overrides específicos deste prospect\n\n- Mês 1 é outubro/2026.\n\n## Outra\n\nx"
    expect(extrairOverrides(md)).toBe("- Mês 1 é outubro/2026.")
  })

  it("monta o dossiê com decisões, overrides, contexto e aprovados", () => {
    const texto = montarDossie({
      nome: "Adda",
      slug: "adda",
      site: "https://addabr.com/",
      anteriores: [
        { rotulo: "01 · Preparação de contexto", origem: "app", resumo: "Transcrição limpa.", desatualizada: false },
        { rotulo: "02 · Contextualização estratégica", origem: "terminal", resumo: null, desatualizada: true },
      ],
      aprovados: ["entrega/ativos-aprovados/secoes/02-contexto.md"],
      overrides: "- Mês 1 é outubro/2026.",
      contextoPersistido: ["contexto/kickoff-transcricao.md"],
      insumosRecebidos: [{ nome: "Histórico mensal", arquivo: "dados/historico-mensal.xlsx" }],
    })
    expect(texto).toContain("Transcrição limpa.")
    expect(texto).toContain("Etapa feita no terminal")
    expect(texto).toContain("desatualizada")
    expect(texto).toContain("- Mês 1 é outubro/2026.")
    expect(texto).toContain("`clientes/adda/contexto/kickoff-transcricao.md`")
    expect(texto).toContain("`clientes/adda/entrega/ativos-aprovados/secoes/02-contexto.md`")
    expect(texto).toContain("`clientes/adda/dados/historico-mensal.xlsx`")
  })
})
