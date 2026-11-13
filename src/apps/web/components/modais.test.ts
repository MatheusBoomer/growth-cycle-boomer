import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Modais do redesign (protótipo aprovado 8-modais.html).
const UI = path.resolve(import.meta.dirname, "../../../packages/ui/src")
const base = (f: string) => readFileSync(path.join(UI, "components", f), "utf-8")
const css = readFileSync(path.join(UI, "styles/globals.css"), "utf-8")
const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")

describe("base dos modais", () => {
  it("véu do tema com desfoque, janela de 24 px que entra subindo", () => {
    for (const f of ["dialog.tsx", "alert-dialog.tsx"]) {
      const s = base(f)
      expect(s, f).toContain("bg-(--veu)")
      expect(s, f).toContain("rounded-[24px]")
      expect(s, f).toContain("entrar-modal")
      expect(s, f).not.toContain("bg-muted/50")
    }
    expect(base("sheet.tsx")).toContain("bg-(--veu)")
  })
  it("título grande, com a palavra em <em> em serifada itálica laranja", () => {
    for (const f of ["dialog.tsx", "alert-dialog.tsx", "sheet.tsx"]) expect(base(f), f).toContain("[&_em]:font-serif")
  })
  it("CSS: véu nos dois temas, animação de entrada e parada com movimento reduzido", () => {
    expect(css.match(/--veu:/g)?.length).toBe(2)
    expect(css).toMatch(/@keyframes entrar-modal/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\[data-slot\$="-content"\]/)
  })
})

describe("conteúdo de cada modal", () => {
  const casos: [string, RegExp][] = [
    ["home/dialogo-novo-prospect.tsx", /Novo <em>prospect<\/em>/],
    ["home/dialogo-cliente-teste.tsx", /Criar cliente <em>de teste<\/em>/],
    ["home/dialogo-trocar-dono.tsx", /Trocar dono de <em>/],
    ["home/dialogo-excluir-prospect.tsx", /Excluir <em>\{prospect\.nome\}\?<\/em>/],
    ["teste/dialogo-reposicionar.tsx", /Em qual etapa o <em>teste<\/em> começa<em>\?<\/em>/],
    ["trabalho/painel-etapa.tsx", /Reabrir <em>\{etapaCat\.titulo\}\?<\/em>/],
    ["cards/card-insumo.tsx", /Excluir este <em>arquivo\?<\/em>/],
    ["sistema/verificacao-sistema.tsx", /Falta configurar <em>esta máquina<\/em>/],
  ]
  for (const [f, re] of casos) it(`${f}: título do protótipo`, () => expect(ler(f)).toMatch(re))

  it("todos têm o ícone pelo tipo (ação, aviso ou perigo)", () => {
    for (const [f] of casos) expect(ler(f), f).toMatch(/<IconeModal tom="(acao|aviso|perigo)"/)
    expect(ler("admin/tabela-pessoas.tsx")).toMatch(/<IconeModal tom="acao"/)
  })
  it("escolha de etapa agrupada por fase no cliente de teste e no reposicionar", () => {
    expect(ler("home/dialogo-cliente-teste.tsx")).toContain("<EscolhaEtapa")
    expect(ler("teste/dialogo-reposicionar.tsx")).toContain("<EscolhaEtapa")
  })
  it("trocar dono: lista de pessoas com avatar no lugar do select", () => {
    const s = ler("home/dialogo-trocar-dono.tsx")
    expect(s).toContain('role="radiogroup"')
    expect(s).toContain("<AvatarPessoa")
  })
  it("tornar admin: nome em serifada com a interrogação", () => expect(ler("admin/tabela-pessoas.tsx")).toMatch(/<em>\{[^}]*nomeCurto\(alvo\.email\)[^}]*\}\?<\/em>/))
})
