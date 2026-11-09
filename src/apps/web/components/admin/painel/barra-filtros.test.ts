// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { FiltroPainel } from "@workspace/core/metricas/painel"
import type { PeriodoRapido } from "@/lib/painel-filtro"
import { BarraFiltros } from "./barra-filtros"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const FILTRO: FiltroPainel = { de: "2026-10-10", ate: "2026-11-08", donos: [], projetos: [], etapas: [], modelos: [], incluirTestes: false }
const OPCOES = {
  donos: ["ana.souza@boomer.com.br", "bia@boomer.com.br"],
  projetos: [
    { slug: "verdeluz", nome: "Verdeluz" },
    { slug: "casa-azul", nome: "Casa Azul" },
  ],
  modelos: ["claude-opus-4-8", "outros"],
}
const ETAPAS = [
  { id: "01", rotulo: "Preparação" },
  { id: "03", rotulo: "Diagnóstico" },
] as never

async function montar(parcial: { filtro?: Partial<FiltroPainel>; periodo?: PeriodoRapido | "custom" } = {}) {
  const aoMudar = vi.fn<(p: URLSearchParams) => void>()
  const aoAtualizar = vi.fn()
  const aoExportar = vi.fn()
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () =>
    r.render(
      createElement(BarraFiltros, {
        filtro: { ...FILTRO, ...parcial.filtro },
        periodo: parcial.periodo ?? "30d",
        opcoes: OPCOES,
        etapas: ETAPAS,
        aoMudar,
        aoAtualizar,
        aoExportar,
      }),
    ),
  )
  const botao = (texto: string) => [...raiz.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === texto)
  const clicar = (el: Element | null | undefined) => act(async () => (el as HTMLElement).click())
  return { raiz, aoMudar, aoAtualizar, aoExportar, botao, clicar, desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("BarraFiltros: período", () => {
  it("rótulos: 7 dias, 30 dias, 90 dias, Este ano e Personalizado (nunca 12 meses)", async () => {
    const m = await montar()
    for (const t of ["7 dias", "30 dias", "90 dias", "Este ano", "Personalizado"]) expect(m.botao(t)).toBeTruthy()
    expect(m.raiz.textContent).not.toContain("12 meses")
    await m.desmontar()
  })

  it("o período ativo fica com aria-pressed", async () => {
    const m = await montar({ periodo: "90d" })
    expect(m.botao("90 dias")?.getAttribute("aria-pressed")).toBe("true")
    expect(m.botao("7 dias")?.getAttribute("aria-pressed")).toBe("false")
    await m.desmontar()
  })

  it("clicar em '7 dias' gera periodo=7d e mantém os outros filtros", async () => {
    const m = await montar({ filtro: { modelos: ["outros"] } })
    await m.clicar(m.botao("7 dias"))
    expect(m.aoMudar).toHaveBeenCalledTimes(1)
    const p = m.aoMudar.mock.calls[0]![0]
    expect(p.get("periodo")).toBe("7d")
    expect(p.get("modelos")).toBe("outros")
    await m.desmontar()
  })

  it("clicar no período que já está ativo não muda nada", async () => {
    const m = await montar({ periodo: "30d" })
    await m.clicar(m.botao("30 dias"))
    expect(m.aoMudar).not.toHaveBeenCalled()
    await m.desmontar()
  })

  it("'Personalizado' mostra dois campos de data com o período atual e manda de/ate", async () => {
    const m = await montar()
    expect(m.raiz.querySelectorAll('input[type="date"]')).toHaveLength(0)
    await m.clicar(m.botao("Personalizado"))
    const campos = m.raiz.querySelectorAll<HTMLInputElement>('input[type="date"]')
    expect(campos).toHaveLength(2)
    expect(campos[0]!.value).toBe("2026-10-10")
    expect(campos[1]!.value).toBe("2026-11-08")
    expect(campos[0]!.getAttribute("aria-label")).toBe("Data inicial")
    expect(campos[1]!.getAttribute("aria-label")).toBe("Data final")
    const p = m.aoMudar.mock.calls.at(-1)![0]
    expect(p.get("de")).toBe("2026-10-10")
    expect(p.get("ate")).toBe("2026-11-08")
    expect(p.get("periodo")).toBeNull()
    await m.desmontar()
  })

  it("com periodo custom os campos de data já aparecem", async () => {
    const m = await montar({ periodo: "custom" })
    expect(m.raiz.querySelectorAll('input[type="date"]')).toHaveLength(2)
    await m.desmontar()
  })
})

describe("BarraFiltros: chips, limpar e ações", () => {
  it("sem filtros não há chips nem 'Limpar'", async () => {
    const m = await montar()
    expect(m.botao("Limpar")).toBeUndefined()
    expect(m.raiz.querySelector('[aria-label^="Remover filtro"]')).toBeNull()
    await m.desmontar()
  })

  it("cada filtro ativo vira um chip e o × remove só aquele", async () => {
    const m = await montar({
      filtro: { donos: ["ana.souza@boomer.com.br"], projetos: ["verdeluz", "casa-azul"], etapas: ["03"], modelos: ["outros"], incluirTestes: true },
    })
    const texto = m.raiz.textContent ?? ""
    for (const t of ["Ana Souza", "Verdeluz", "Casa Azul", "Diagnóstico", "Sem modelo registrado"]) expect(texto).toContain(t)
    await m.clicar(m.raiz.querySelector('[aria-label="Remover filtro Projeto: Verdeluz"]'))
    const p = m.aoMudar.mock.calls[0]![0]
    expect(p.get("projetos")).toBe("casa-azul")
    expect(p.get("donos")).toBe("ana.souza@boomer.com.br")
    expect(p.get("etapas")).toBe("03")
    expect(p.get("modelos")).toBe("outros")
    expect(p.get("testes")).toBe("1")
    expect(p.get("periodo")).toBe("30d")
    await m.desmontar()
  })

  it("remover o último valor de uma lista tira o parâmetro da URL", async () => {
    const m = await montar({ filtro: { etapas: ["03"] } })
    await m.clicar(m.raiz.querySelector('[aria-label="Remover filtro Etapa: Diagnóstico"]'))
    const p = m.aoMudar.mock.calls[0]![0]
    expect(p.has("etapas")).toBe(false)
    await m.desmontar()
  })

  it("'Limpar' zera os filtros e mantém o período", async () => {
    const m = await montar({ filtro: { donos: ["bia@boomer.com.br"], incluirTestes: true }, periodo: "90d" })
    await m.clicar(m.botao("Limpar"))
    expect(m.aoMudar.mock.calls[0]![0].toString()).toBe("periodo=90d")
    await m.desmontar()
  })

  it("'Incluir testes' liga e desliga o parâmetro testes", async () => {
    const m = await montar()
    const caixa = m.raiz.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(caixa.checked).toBe(false)
    expect(m.raiz.textContent).toContain("Incluir testes")
    await m.clicar(caixa)
    expect(m.aoMudar.mock.calls[0]![0].get("testes")).toBe("1")
    await m.desmontar()
    const com = await montar({ filtro: { incluirTestes: true } })
    await com.clicar(com.raiz.querySelector('input[type="checkbox"]'))
    expect(com.aoMudar.mock.calls[0]![0].has("testes")).toBe(false)
    await com.desmontar()
  })

  it("Atualizar e Exportar CSV chamam os callbacks", async () => {
    const m = await montar()
    await m.clicar(m.botao("Atualizar"))
    await m.clicar(m.botao("Exportar CSV"))
    expect(m.aoAtualizar).toHaveBeenCalledTimes(1)
    expect(m.aoExportar).toHaveBeenCalledTimes(1)
    await m.desmontar()
  })

  it("os quatro selects têm rótulo acessível", async () => {
    const m = await montar()
    for (const r of ["Analista", "Projeto", "Etapa", "Modelo"]) expect(m.raiz.querySelector(`[aria-label="${r}"]`), r).toBeTruthy()
    await m.desmontar()
  })
})
