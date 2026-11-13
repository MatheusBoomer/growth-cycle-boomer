// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ResumoProspect } from "@workspace/core/tipos"
import { ProvedorConta } from "@/components/marca/conta-contexto"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

const { CardProspect } = await import("./card-prospect")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const prospect = { slug: "iszi", nome: "Iszi", etapaAtual: "01", rotuloEtapaAtual: "Preparação", concluidas: 0, totalEtapas: 10, pendencias: 0, teste: false, atualizadoEm: "2026-10-27T10:00:00Z" } as unknown as ResumoProspect

async function menuAberto(nuvem: boolean) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(ProvedorConta, { email: null, ambiente: { executor: nuvem ? "sdk" : "cli", nuvem }, children: createElement(CardProspect, { prospect }) }))
  })
  const gatilho = raiz.querySelector<HTMLElement>('[aria-label="Ações de Iszi"]')!
  await act(async () => {
    gatilho.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    gatilho.click()
  })
  return () => act(async () => r.unmount())
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("CardProspect: abrir pasta", () => {
  it("no modo local o menu tem 'Abrir pasta no Finder'", async () => {
    const desmontar = await menuAberto(false)
    expect(document.body.textContent).toContain("Abrir pasta no Finder")
    await desmontar()
  })

  it("na nuvem o item não aparece, e o resto do menu continua", async () => {
    const desmontar = await menuAberto(true)
    expect(document.body.textContent).not.toContain("Finder")
    expect(document.body.textContent).toContain("Excluir")
    await desmontar()
  })
})

async function renderizar(p: ResumoProspect, papel: "admin" | "usuario", fotoUrl?: string) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(ProvedorConta, { email: "ana@boomer.com", papel, children: createElement(CardProspect, { prospect: p, fotoUrl }) }))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

describe("CardProspect: analista e etapa", () => {
  const comDono = { ...prospect, dono: "ana.souza@boomer.com", concluidas: 2, totalEtapas: 8, rotuloEtapaAtual: "03 · Diagnóstico de performance", etapaAtual: "03" } as unknown as ResumoProspect

  it("admin vê o analista (nome curto e iniciais) e o nome da etapa atual", async () => {
    const { raiz, desmontar } = await renderizar(comDono, "admin")
    expect(raiz.textContent).toContain("Ana Souza")
    expect(raiz.textContent).toContain("AS")
    expect(raiz.textContent).toContain("Etapa 03")
    expect(raiz.textContent).toContain("Diagnóstico de performance")
    await desmontar()
  })

  it("admin vê 'Sem dono' quando o prospect não tem dono", async () => {
    const { raiz, desmontar } = await renderizar({ ...comDono, dono: null } as ResumoProspect, "admin")
    expect(raiz.textContent).toContain("Sem dono")
    await desmontar()
  })

  it("usuário comum não vê a linha do analista, mas vê a etapa", async () => {
    const { raiz, desmontar } = await renderizar(comDono, "usuario")
    expect(raiz.textContent).not.toContain("Ana Souza")
    expect(raiz.textContent).not.toContain("Sem dono")
    expect(raiz.textContent).toContain("Etapa 03")
    expect(raiz.textContent).toContain("Diagnóstico de performance")
    await desmontar()
  })

  it("o nome da etapa vem em serifada, separado do número", async () => {
    const { raiz, desmontar } = await renderizar(comDono, "usuario")
    expect(raiz.querySelector("em.font-serif")?.textContent).toBe("Diagnóstico de performance")
    await desmontar()
  })

  it("etapa sem número (Apresentação final) não mostra 'Etapa'", async () => {
    const { raiz, desmontar } = await renderizar({ ...comDono, etapaAtual: "final", rotuloEtapaAtual: "Apresentação final" } as unknown as ResumoProspect, "usuario")
    expect(raiz.textContent).toContain("Apresentação final")
    expect(raiz.textContent).not.toContain("Etapa")
    await desmontar()
  })

  it("só o card com aprovação pendente ganha a borda sutil correndo; todo card tem a luz do mouse", async () => {
    const com = await renderizar({ ...comDono, pendencias: 1 } as ResumoProspect, "usuario")
    expect(com.raiz.querySelector('[data-slot="card"]')!.className).toContain("borda-correndo")
    expect(com.raiz.querySelector('[data-slot="card"]')!.className).toContain("luz-mouse")
    await com.desmontar()
    const sem = await renderizar(comDono, "usuario")
    expect(sem.raiz.querySelector('[data-slot="card"]')!.className).not.toContain("borda-correndo")
    await sem.desmontar()
  })

  it("o CSS da borda e da luz existe e para com movimento reduzido", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const css = readFileSync(resolve(import.meta.dirname, "../../../../packages/ui/src/styles/globals.css"), "utf-8")
    expect(css).toMatch(/\.borda-correndo::before/)
    expect(css).toMatch(/\.luz-mouse::after/)
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.borda-correndo::before\s*\{[^}]*animation:\s*none/)
  })

  it("concluído mostra 'Concluído' no lugar do rótulo da etapa", async () => {
    const concluido = { ...comDono, etapaAtual: null, rotuloEtapaAtual: "Planejamento concluído", concluidas: 8 } as unknown as ResumoProspect
    const { raiz, desmontar } = await renderizar(concluido, "usuario")
    expect(raiz.textContent).toContain("Concluído")
    expect(raiz.textContent).not.toContain("Planejamento concluído")
    await desmontar()
  })

  it("mostra a barra de etapas, o contador e os selos de aprovação e teste", async () => {
    const { raiz, desmontar } = await renderizar({ ...comDono, pendencias: 2, teste: true } as ResumoProspect, "usuario")
    expect(raiz.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("2 de 8 etapas concluídas, etapa atual aguardando aprovação")
    expect(raiz.textContent).toContain("2 de 8 etapas")
    expect(raiz.textContent).toContain("2 aprovações pendentes")
    expect(raiz.textContent).toContain("Teste")
    await desmontar()
  })

  it("usa a foto do analista quando ela chega", async () => {
    const { raiz, desmontar } = await renderizar(comDono, "admin", "https://lh3.googleusercontent.com/a/foto")
    expect(raiz.querySelector("img")?.getAttribute("referrerpolicy")).toBe("no-referrer")
    await desmontar()
  })

  it("a data é mostrada no horário de Brasília, seja qual for o fuso de quem renderiza", async () => {
    const fusoOriginal = process.env.TZ
    process.env.TZ = "UTC"
    try {
      // 01:30 UTC de 27/10 é 22:30 de 26/10 em Brasília (UTC-3).
      const { raiz, desmontar } = await renderizar({ ...comDono, atualizadoEm: "2026-10-27T01:30:00Z" } as ResumoProspect, "usuario")
      expect(raiz.textContent).toMatch(/26\/10.{1,2}22:30/)
      await desmontar()
    } finally {
      if (fusoOriginal === undefined) delete process.env.TZ
      else process.env.TZ = fusoOriginal
    }
  })
})

describe("CardProspect: layout e acessibilidade", () => {
  const longo = { ...prospect, nome: "Café do Ponto Distribuidora de Bebidas e Mercearia Ltda", dono: "maria.eduarda.cavalcanti.de.albuquerque@boomer.com", concluidas: 1, totalEtapas: 8 } as unknown as ResumoProspect

  it("o rodapé desce até a base do cartão (mt-auto) e o cartão ocupa a célula da grade", async () => {
    const { raiz, desmontar } = await renderizar(longo, "admin")
    expect(raiz.querySelector('[data-slot="card-footer"]')?.className).toContain("mt-auto")
    expect(raiz.querySelector('[data-slot="card"]')?.className).toMatch(/\bh-full\b/)
    await desmontar()
  })

  it("nome do prospect e do dono truncados trazem o texto inteiro no title", async () => {
    const { raiz, desmontar } = await renderizar(longo, "admin")
    expect(raiz.querySelector("a")?.getAttribute("title")).toBe(longo.nome)
    const dono = [...raiz.querySelectorAll("span")].find((s) => s.className.includes("truncate") && s.textContent === "Maria Eduarda Cavalcanti De Albuquerque")
    expect(dono?.getAttribute("title")).toBe("Maria Eduarda Cavalcanti De Albuquerque")
    await desmontar()
  })

  it("o menu de ações tem área de toque de 40 px no celular", async () => {
    const { raiz, desmontar } = await renderizar(longo, "usuario")
    expect(raiz.querySelector('[aria-label^="Ações de"]')?.className).toContain("max-sm:size-10")
    await desmontar()
  })
})
