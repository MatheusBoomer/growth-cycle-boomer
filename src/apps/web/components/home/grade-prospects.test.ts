// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ResumoProspect } from "@workspace/core/tipos"
import { ProvedorConta } from "@/components/marca/conta-contexto"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
// Peças que não fazem parte do que se testa aqui (cabeçalho e diálogos têm as próprias dependências).
vi.mock("@/components/marca/barra-topo", () => ({ BarraTopo: () => null }))
vi.mock("./dialogo-novo-prospect", () => ({ DialogoNovoProspect: () => null }))
vi.mock("./dialogo-cliente-teste", () => ({ DialogoClienteTeste: () => null }))

const { GradeProspects } = await import("./grade-prospects")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function p(nome: string, dono: string | null, extra: Partial<ResumoProspect> = {}): ResumoProspect {
  return {
    slug: nome.toLowerCase().replace(/\s+/g, "-"),
    nome,
    dono,
    etapaAtual: "01",
    rotuloEtapaAtual: "01 · Preparação",
    concluidas: 0,
    totalEtapas: 8,
    pendencias: 0,
    teste: false,
    atualizadoEm: "2026-10-01T10:00:00Z",
    ...extra,
  } as unknown as ResumoProspect
}

const etapas = [
  { id: "01" as const, rotulo: "01 · Preparação" },
  { id: "03" as const, rotulo: "03 · Diagnóstico" },
]

const prospects = [
  p("Iszi", "ana@boomer.com", { etapaAtual: "03", rotuloEtapaAtual: "03 · Diagnóstico", pendencias: 1, atualizadoEm: "2026-10-05T10:00:00Z" }),
  p("Verdeluz", "bia@boomer.com", { atualizadoEm: "2026-10-09T10:00:00Z" }),
  p("Ilha", "ana@boomer.com", { atualizadoEm: "2026-10-07T10:00:00Z" }),
  p("Pronta", "bia@boomer.com", { etapaAtual: null, rotuloEtapaAtual: "Planejamento concluído", concluidas: 8 }),
]

async function montar(papel: "admin" | "usuario", lista: ResumoProspect[] = prospects) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(
      createElement(ProvedorConta, {
        email: "ana@boomer.com",
        papel,
        children: createElement(GradeProspects, { prospects: lista, etapas, avatares: {} }),
      }),
    )
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

const titulos = (raiz: HTMLElement) => [...raiz.querySelectorAll('[data-slot="card-title"]')].map((e) => e.textContent)
const botao = (raiz: HTMLElement, texto: string) => [...raiz.querySelectorAll("button")].find((b) => b.textContent?.includes(texto))

async function clicar(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    ;(el as HTMLElement).click()
  })
}

/** Abre o select pelo rótulo acessível e escolhe a opção pelo texto. */
async function escolher(raiz: HTMLElement, rotulo: string, opcao: string) {
  await clicar(raiz.querySelector(`[aria-label="${rotulo}"]`)!)
  const item = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes(opcao))!
  await clicar(item)
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("GradeProspects: seções", () => {
  it("separa Em andamento e Concluídos, cada uma com a contagem", async () => {
    const { raiz, desmontar } = await montar("usuario")
    expect(raiz.textContent).toContain("Em andamento")
    expect(raiz.querySelector("h2")?.textContent).toContain("3")
    expect(botao(raiz, "Concluídos")?.textContent).toContain("1")
    expect(titulos(raiz)).toEqual(["Verdeluz", "Ilha", "Iszi"])
    await desmontar()
  })

  it("Concluídos começa recolhida e abre ao clicar", async () => {
    const { raiz, desmontar } = await montar("usuario")
    const alternar = botao(raiz, "Concluídos")!
    expect(alternar.getAttribute("aria-expanded")).toBe("false")
    expect(titulos(raiz)).not.toContain("Pronta")
    await clicar(alternar)
    expect(alternar.getAttribute("aria-expanded")).toBe("true")
    expect(titulos(raiz)).toContain("Pronta")
    await clicar(alternar)
    expect(titulos(raiz)).not.toContain("Pronta")
    await desmontar()
  })

  it("sem nenhum prospect mostra o convite para criar o primeiro", async () => {
    const { raiz, desmontar } = await montar("usuario", [])
    expect(raiz.textContent).toContain("Nenhum Growth Cycle ainda")
    await desmontar()
  })

  it("sem nenhum concluído a seção Concluídos nem aparece", async () => {
    const { raiz, desmontar } = await montar("usuario", prospects.slice(0, 3))
    expect(botao(raiz, "Concluídos")).toBeUndefined()
    expect(raiz.textContent).not.toContain("Concluídos")
    await desmontar()
  })

  it("o botão Concluídos é um alvo de toque de 40 px, com chevron, contagem e aria-expanded", async () => {
    const { raiz, desmontar } = await montar("usuario")
    const alternar = botao(raiz, "Concluídos")!
    expect(alternar.className).toContain("min-h-10")
    expect(alternar.querySelector("svg")).not.toBeNull()
    expect(alternar.textContent).toContain("1")
    expect(alternar.hasAttribute("aria-expanded")).toBe(true)
    await desmontar()
  })

  it("seção sem itens mostra o próprio estado vazio", async () => {
    const { raiz, desmontar } = await montar("usuario", [prospects[3]!])
    expect(raiz.textContent).toContain("Nenhum prospect em andamento")
    await desmontar()
  })
})

describe("GradeProspects: filtros", () => {
  it("o analista só aparece para o admin", async () => {
    const admin = await montar("admin")
    expect(admin.raiz.querySelector('[aria-label="Analista"]')).not.toBeNull()
    await admin.desmontar()
    const comum = await montar("usuario")
    expect(comum.raiz.querySelector('[aria-label="Analista"]')).toBeNull()
    // O filtro de pendência agora vale para todos (o card laranja do bento depende dele); "Meus" continua só do admin.
    expect(botao(comum.raiz, "Com aprovação pendente")).toBeDefined()
    expect(botao(comum.raiz, "Meus")).toBeUndefined()
    expect(comum.raiz.querySelector('[aria-label="Etapa"]')).not.toBeNull()
    expect(comum.raiz.querySelector('[aria-label="Ordenar"]')).not.toBeNull()
    await comum.desmontar()
  })

  it("usuário comum não vê nome nem e-mail de nenhum dono em lugar nenhum da tela", async () => {
    const { raiz, desmontar } = await montar("usuario")
    await clicar(botao(raiz, "Concluídos")!)
    const texto = document.body.textContent ?? ""
    for (const dono of ["ana@boomer.com", "bia@boomer.com", "Ana", "Bia", "Sem dono"]) expect(texto).not.toContain(dono)
    expect(document.body.innerHTML).not.toContain("@boomer.com")
    await desmontar()
  })

  it("filtrar por analista reduz os cartões e 'Limpar filtros' restaura", async () => {
    const { raiz, desmontar } = await montar("admin")
    await escolher(raiz, "Analista", "Bia")
    expect(titulos(raiz)).toEqual(["Verdeluz"])
    // Sem nenhum resultado aparece o botão de limpar.
    const campo = raiz.querySelector<HTMLInputElement>('input[type="search"], input[aria-label="Buscar prospect"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, "zzz")
      campo.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(titulos(raiz)).toEqual([])
    expect(raiz.textContent).toContain("Nenhum prospect encontrado")
    await clicar(botao(raiz, "Limpar filtros")!)
    expect(titulos(raiz)).toEqual(["Verdeluz", "Ilha", "Iszi"])
    expect(campo.value).toBe("")
    await desmontar()
  })

  it("'Meus' mostra só os prospects de quem está logado", async () => {
    const { raiz, desmontar } = await montar("admin")
    await escolher(raiz, "Analista", "Meus")
    expect(titulos(raiz)).toEqual(["Ilha", "Iszi"])
    await desmontar()
  })

  it("filtra por etapa", async () => {
    const { raiz, desmontar } = await montar("usuario")
    await escolher(raiz, "Etapa", "03 · Diagnóstico")
    expect(titulos(raiz)).toEqual(["Iszi"])
    await desmontar()
  })

  it("'Com aprovação pendente' (admin) filtra e informa o estado por aria-pressed", async () => {
    const { raiz, desmontar } = await montar("admin")
    const alternar = botao(raiz, "Com aprovação pendente")!
    expect(alternar.getAttribute("aria-pressed")).toBe("false")
    await clicar(alternar)
    expect(alternar.getAttribute("aria-pressed")).toBe("true")
    expect(titulos(raiz)).toEqual(["Iszi"])
    await desmontar()
  })

  it("ordena por nome", async () => {
    const { raiz, desmontar } = await montar("usuario")
    await escolher(raiz, "Ordenar", "Nome")
    expect(titulos(raiz)).toEqual(["Ilha", "Iszi", "Verdeluz"])
    await desmontar()
  })
})

describe("GradeProspects: home nova", () => {
  it("título 'Seus Growth Cycles' e selo com as contagens", async () => {
    const { raiz, desmontar } = await montar("admin")
    expect(raiz.querySelector("h1")?.textContent).toBe("Seus Growth Cycles")
    expect(raiz.textContent).toContain("3 em andamento · 1 aprovação pendente")
    await desmontar()
  })

  it("quem não é admin filtra pelas pendentes no segmentado", async () => {
    const { raiz, desmontar } = await montar("usuario")
    await clicar(botao(raiz, "Com aprovação pendente")!)
    expect(titulos(raiz)).toEqual(["Iszi"])
    await clicar(botao(raiz, "Todos")!)
    expect(titulos(raiz)).toEqual(["Verdeluz", "Ilha", "Iszi"])
    await desmontar()
  })

  it("admin: 'Meus' no segmentado filtra como o select fazia", async () => {
    const { raiz, desmontar } = await montar("admin")
    await clicar(botao(raiz, "Meus")!)
    expect(titulos(raiz)).toEqual(["Ilha", "Iszi"])
    expect(botao(raiz, "Meus")!.getAttribute("aria-pressed")).toBe("true")
    await desmontar()
  })

  it("as faixas entram em sequência (classe surgir com --i) e o CSS para com movimento reduzido", async () => {
    const { raiz, desmontar } = await montar("admin")
    const faixas = [...raiz.querySelectorAll(".surgir")].map((e) => (e as HTMLElement).style.getPropertyValue("--i"))
    expect(faixas).toEqual(["0", "1", "2", "3"])
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const css = readFileSync(resolve(import.meta.dirname, "../../../../packages/ui/src/styles/globals.css"), "utf-8")
    expect(css).toMatch(/@keyframes surgir/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.surgir\s*\{[^}]*animation:\s*none/)
    await desmontar()
  })

  it("tem a faixa fraca do fundo dithered no topo, decorativa", async () => {
    const { raiz, desmontar } = await montar("usuario")
    const faixas = raiz.querySelectorAll('[data-slot="faixa-dithered"]')
    expect(faixas).toHaveLength(1)
    expect(faixas[0]!.getAttribute("aria-hidden")).toBe("true")
    await desmontar()
  })

  it("Ctrl+K (ou ⌘K) leva o cursor para a busca", async () => {
    const { raiz, desmontar } = await montar("usuario")
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })))
    const campo = raiz.querySelector('input[aria-label="Buscar prospect"]')!
    expect(document.activeElement).toBe(campo)
    expect(campo.getAttribute("aria-keyshortcuts")).toBe("Control+K Meta+K")
    await desmontar()
  })

  it("com um diálogo aberto, Ctrl+K não tira o cursor de dentro dele", async () => {
    const { raiz, desmontar } = await montar("usuario")
    const dialogo = document.createElement("div")
    dialogo.setAttribute("role", "dialog")
    const campoDoDialogo = document.createElement("input")
    dialogo.append(campoDoDialogo)
    document.body.append(dialogo)
    campoDoDialogo.focus()
    await act(async () => campoDoDialogo.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })))
    expect(document.activeElement).toBe(campoDoDialogo)
    expect(document.activeElement).not.toBe(raiz.querySelector('input[aria-label="Buscar prospect"]'))
    dialogo.remove()
    await desmontar()
  })

  it("fora do Mac o atalho aparece como Ctrl K", async () => {
    const plataforma = vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32")
    const { raiz, desmontar } = await montar("usuario")
    expect(raiz.querySelector('input[aria-label="Buscar prospect"]')!.getAttribute("placeholder")).toContain("Ctrl K")
    plataforma.mockRestore()
    await desmontar()
  })

  it("o card laranja com aprovações em vários projetos aplica o filtro de pendentes", async () => {
    const lista = [...prospects, p("Outra", "bia@boomer.com", { pendencias: 2 })]
    const { raiz, desmontar } = await montar("admin", lista)
    await clicar(raiz.querySelector("[data-slot=aprovacoes]")!)
    expect(titulos(raiz).sort()).toEqual(["Iszi", "Outra"])
    expect(botao(raiz, "Com aprovação pendente")!.getAttribute("aria-pressed")).toBe("true")
    await desmontar()
  })
})

describe("GradeProspects: celular", () => {
  const busca = (raiz: HTMLElement) => raiz.querySelector('input[aria-label="Buscar prospect"]')!

  it("a barra de filtros é uma grade de 2 colunas no celular e uma linha corrida de sm para cima", async () => {
    const { raiz, desmontar } = await montar("admin")
    const barra = raiz.querySelector('[role="search"]')!
    expect(barra.className).toContain("grid-cols-2")
    expect(barra.className).toContain("sm:flex")
    expect(busca(raiz).className).toContain("col-span-2")
    await desmontar()
  })

  it("busca, selects e botão de pendentes têm 40 px de altura no celular", async () => {
    const { raiz, desmontar } = await montar("admin")
    expect(busca(raiz).className).toContain("h-10")
    for (const rotulo of ["Analista", "Etapa", "Ordenar"]) expect(raiz.querySelector(`[aria-label="${rotulo}"]`)!.className).toContain("data-[size=default]:h-10")
    expect(botao(raiz, "Com aprovação pendente")!.className).toContain("h-10")
    await desmontar()
  })

  it("os botões do cabeçalho quebram de linha em vez de estourar a largura", async () => {
    const { raiz, desmontar } = await montar("admin")
    const grupo = raiz.querySelector("header > div:last-child")!
    expect(grupo.className).toContain("flex-wrap")
    await desmontar()
  })
})

describe("GradeProspects: escala", () => {
  it("200 prospects com nomes longos renderizam sem erro", async () => {
    const muitos = Array.from({ length: 200 }, (_, i) =>
      p(`Prospect com um nome muito, muito comprido para caber no cartão número ${i}`, `dono${i % 4}@boomer.com`, { slug: `p-${i}`, etapaAtual: i % 5 === 0 ? null : "01" }),
    )
    const { raiz, desmontar } = await montar("admin", muitos)
    expect(titulos(raiz)).toHaveLength(160)
    expect(raiz.querySelector('[data-slot="card-title"]')?.className).toContain("truncate")
    await desmontar()
  })
})
