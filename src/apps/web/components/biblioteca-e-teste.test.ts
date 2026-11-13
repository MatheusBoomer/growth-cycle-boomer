import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Biblioteca e cliente de teste do redesign (protótipo aprovado 10-biblioteca-e-teste.html).
const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")

describe("biblioteca", () => {
  const s = ler("biblioteca/biblioteca.tsx")
  it("título com destaque serifado e total de imagens", () => {
    expect(s).toMatch(/Biblioteca <em[^>]*>do prospect<\/em>/)
    expect(s).toMatch(/imagens?/)
  })
  it("filtro por etapa em segmentado de pílula com contagem em mono", () => {
    expect(s).toContain('aria-label="Filtrar por etapa"')
    expect(s).toMatch(/rounded-full[^"]*border/)
    expect(s).toContain("font-mono")
  })
  it("grupo com número em mono e nome com destaque serifado", () => expect(s).toContain("<TituloDestacado"))
  it("vazios no padrão novo e 'Limpar filtros' na busca sem resultado", () => {
    expect(s).not.toContain("<Empty>")
    expect(s).toContain("Limpar filtros")
  })
  it("cartão: imagem em moldura de papel, sobe ao passar o mouse com borda laranja", () => {
    const c = ler("biblioteca/card-imagem.tsx")
    expect(c).toContain("rounded-[18px]")
    expect(c).toContain("hover:-translate-y-0.5")
    expect(c).toContain("hover:border-primary/50")
  })
  it("imagem ampliada: setas e contador em vidro escuro, ações embaixo com Mencionar em laranja", () => {
    const a = ler("biblioteca/imagem-ampliada.tsx")
    expect(a).toContain(`variant="midia"`)
    expect(a).not.toContain("<select")
    expect(a).toContain("TituloDestacado")
  })
})

describe("cliente de teste", () => {
  it("faixa listrada em âmbar com o selo e a etapa de início", () => {
    const s = ler("teste/faixa-teste.tsx")
    expect(s).toContain("repeating-linear-gradient")
    expect(s).toContain("bg-aviso-fundo")
    expect(s).toMatch(/Começou n/)
  })
  it("kit no modal com ícone e título com destaque", () => expect(ler("teste/faixa-teste.tsx")).toMatch(/Kit <em>da etapa<\/em>/))
  it("kit em cartão: 'Kit desta etapa', arquivos em linhas e roteiro com fio âmbar", () => {
    const s = ler("teste/painel-kit.tsx")
    expect(s).toMatch(/Kit <em[^>]*>desta etapa<\/em>/)
    expect(s).toContain("border-l-2")
    expect(s).not.toContain("<Card>")
  })
  it("início da etapa: a coluna da direita só ocupa espaço quando tem conteúdo", () => {
    expect(ler("trabalho/etapa-liberada.tsx")).toContain("has-[>[data-lateral]>*]")
  })
})
