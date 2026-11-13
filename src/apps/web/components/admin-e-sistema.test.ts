// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { AvisoAdmin, ehSemNuvem } from "./admin/aviso-admin"

// Administração e peças de sistema do redesign (protótipo aprovado 11-admin-e-sistema.html).
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  document.body.innerHTML = ""
})
const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")
const UI = (f: string) => readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src", f), "utf-8")

async function montar(el: ReturnType<typeof createElement>) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(el))
  return raiz
}

describe("aviso 'só na nuvem'", () => {
  it("reconhece as mensagens do servidor", () => {
    expect(ehSemNuvem("A administração de pessoas só existe com os dados na nuvem.")).toBe(true)
    expect(ehSemNuvem("Os reports só existem com os dados na nuvem.")).toBe(true)
    expect(ehSemNuvem("Falha de rede")).toBe(false)
  })
  it("mostra o texto certo de cada aba, não o de pessoas", async () => {
    const raiz = await montar(createElement(AvisoAdmin, { mensagem: "A administração de pessoas só existe com os dados na nuvem.", aba: "projetos" }))
    expect(raiz.textContent).toContain("Projetos e custos")
    expect(raiz.textContent).toContain("só na nuvem")
    expect(raiz.textContent).not.toContain("administração de pessoas")
  })
  it("outro erro: mensagem com 'Tentar de novo' quando há nova tentativa", async () => {
    const raiz = await montar(createElement(AvisoAdmin, { mensagem: "Falha de rede", aba: "projetos", aoTentarDeNovo: () => {} }))
    expect(raiz.textContent).toContain("Falha de rede")
    expect(raiz.textContent).toContain("Tentar de novo")
  })
  it("nenhuma tela da administração usa mais o Alert cinza", () => {
    const pasta = path.resolve(import.meta.dirname, "admin")
    const arquivos = readdirSync(pasta, { recursive: true }).map(String).filter((f) => f.endsWith(".tsx") && !f.includes("aviso-admin"))
    const comAlert = arquivos.filter((f) => /<Alert[ >]/.test(readFileSync(path.join(pasta, f), "utf-8")))
    expect(comAlert).toEqual([])
  })
})

describe("Projetos", () => {
  it("período em segmentado de pílula; filtro ativo laranja com contagem; testes numa chave", () => {
    const s = ler("admin/painel/barra-filtros.tsx")
    expect(s).not.toContain("<ToggleGroup")
    expect(s).toContain('role="switch"')
    expect(s).toMatch(/border-primary\/55/)
  })
  it("médias por etapa em cartões", () => {
    const s = ler("admin/painel/medias-por-etapa.tsx")
    expect(s).not.toContain("<Table")
    expect(s).toContain("data-media")
  })
  it("lista com valores em mono", () => expect(ler("admin/painel/lista-projetos.tsx")).toContain("font-mono"))
})

describe("paleta dos gráficos", () => {
  const css = UI("styles/globals.css")
  it("as 5 cores são laranja, azul, verde, violeta e âmbar (sem cinza)", () => {
    for (const bloco of [css.slice(css.indexOf(":root {")), css.slice(css.indexOf(".dark {"))]) {
      const c4 = /--chart-4:\s*(#[0-9a-f]{6})/i.exec(bloco)![1]!
      const c5 = /--chart-5:\s*(#[0-9a-f]{6})/i.exec(bloco)![1]!
      const sat = (h: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
        return Math.max(r!, g!, b!) - Math.min(r!, g!, b!)
      }
      expect(sat(c4), c4).toBeGreaterThan(80)
      expect(sat(c5), c5).toBeGreaterThan(80)
    }
  })
})

describe("detalhe, modelos, skills e reports", () => {
  it("detalhe: nome com destaque serifado e etapa com número em mono", () => {
    const s = ler("admin/detalhe-projeto.tsx")
    expect(s).toContain("<TituloDestacado")
    expect(s).toContain("font-mono")
  })
  it("modelos: escolha do modelo em segmentado de pílula", () => expect(ler("admin/painel-etapa-modelos.tsx")).toContain('role="radiogroup"'))
  it("fluxograma: Mermaid no tema do app (variáveis próprias, não o tema padrão)", () => {
    const s = ler("admin/fluxograma.tsx")
    expect(s).toContain('theme: "base"')
    expect(s).toContain("themeVariables")
  })
  it("reports: status num segmentado com contagem", () => {
    const s = ler("admin/reports/painel-reports.tsx")
    expect(s).toMatch(/aria-label="Status"[^>]*rounded-full/)
  })
})

describe("peças do sistema", () => {
  it("avisos com ícone em quadrado colorido por tipo", () => {
    const s = UI("components/sonner.tsx")
    expect(s).toContain("bg-sucesso-fundo")
    expect(s).toContain("bg-perigo-fundo")
  })
  it("esqueleto com brilho passando (sem pulsar)", () => {
    const s = UI("components/skeleton.tsx")
    expect(s).not.toContain("animate-pulse")
    expect(s).toContain("esqueleto")
  })
  it("uso do Claude: laranja no normal, vermelho perto do limite", () => {
    const s = ler("sistema/uso-assinatura.tsx")
    expect(s).toMatch(/ok: "bg-primary"/)
    expect(s).toMatch(/critico: "bg-destructive"/)
  })
  it("menus com cantos maiores e itens folgados", () => {
    const s = UI("components/dropdown-menu.tsx")
    expect(s).toContain("rounded-2xl")
    expect(s).toContain("rounded-[10px]")
  })
  it("páginas 404 e de erro em português, no visual do app", () => {
    const nf = readFileSync(path.resolve(import.meta.dirname, "../app/not-found.tsx"), "utf-8")
    const er = readFileSync(path.resolve(import.meta.dirname, "../app/error.tsx"), "utf-8")
    expect(nf).toMatch(/titulo="Esta página"\s+destaque="não existe"/)
    expect(nf).toContain("Voltar aos prospects")
    expect(er).toMatch(/titulo="Algo deu"\s+destaque="errado aqui"/)
    expect(er).toContain("Tentar de novo")
  })
})
