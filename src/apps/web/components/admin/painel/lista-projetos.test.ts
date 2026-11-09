// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PainelMetricas } from "@workspace/core/metricas/painel"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

const { ListaProjetos } = await import("./lista-projetos")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Linha = PainelMetricas["porProjeto"][number]

function linha(parcial: Partial<Linha>): Linha {
  return {
    slug: "verdeluz",
    nome: "Verdeluz",
    dono: "ana.souza@boomer.com.br",
    usd: 10,
    porFase: {},
    tempoUtilSeg: 3600,
    ultimaAtividade: "2026-11-05T12:00:00.000Z",
    etapaAtual: "03",
    ativo: true,
    concluidoEm: null,
    pendencias: 0,
    teste: false,
    ...parcial,
  }
}

const ETAPAS = [
  { id: "01", rotulo: "Preparação" },
  { id: "03", rotulo: "Diagnóstico" },
  { id: "04", rotulo: "Unidade econômica" },
] as never

const PROJETOS: Linha[] = [
  linha({ slug: "verdeluz", nome: "Verdeluz", usd: 10, tempoUtilSeg: 3600, ultimaAtividade: "2026-11-05T12:00:00.000Z", etapaAtual: "03" }),
  linha({ slug: "casa-azul", nome: "Casa Azul", dono: "bia@boomer.com.br", usd: 30, tempoUtilSeg: 600, ultimaAtividade: "2026-11-07T12:00:00.000Z", etapaAtual: "04", pendencias: 2 }),
  linha({ slug: "loja-sol", nome: "Loja Sol", dono: null, usd: 0, tempoUtilSeg: 0, ultimaAtividade: null, etapaAtual: "01" }),
  linha({ slug: "antiga", nome: "Antiga", usd: 5, ativo: false, etapaAtual: null, concluidoEm: "2026-10-20T12:00:00.000Z", ultimaAtividade: "2026-10-20T12:00:00.000Z" }),
]

async function montar(projetos: Linha[] = PROJETOS, avatares: Record<string, string> = {}, filtrado = false) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => r.render(createElement(ListaProjetos, { projetos, etapas: ETAPAS, avatares, filtrado })))
  const nomes = () => [...raiz.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("a")?.textContent ?? tr.textContent)
  const clicar = (el: Element | null | undefined) => act(async () => (el as HTMLElement).click())
  const aba = (texto: string) => [...raiz.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.startsWith(texto))
  const cabecalho = (texto: string) => [...raiz.querySelectorAll<HTMLButtonElement>("th button")].find((b) => b.textContent?.trim() === texto)
  return { raiz, nomes, clicar, aba, cabecalho, desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
  push.mockClear()
})

describe("ListaProjetos: abas", () => {
  it("abas com contagem; a aba inicial é Em andamento e esconde os concluídos", async () => {
    const m = await montar()
    expect(m.aba("Em andamento")?.textContent).toContain("3")
    expect(m.aba("Concluídos")?.textContent).toContain("1")
    expect(m.aba("Todos")?.textContent).toContain("4")
    expect(m.aba("Em andamento")?.getAttribute("aria-selected")).toBe("true")
    expect(m.nomes()).not.toContain("Antiga")
    expect(m.nomes()).toHaveLength(3)
    await m.desmontar()
  })

  it("a aba Concluídos mostra só os concluídos e Todos mostra tudo", async () => {
    const m = await montar()
    await m.clicar(m.aba("Concluídos"))
    expect(m.nomes()).toEqual(["Antiga"])
    await m.clicar(m.aba("Todos"))
    expect(m.nomes()).toHaveLength(4)
    await m.desmontar()
  })

  it("projeto sem custo no período continua na lista", async () => {
    const m = await montar()
    expect(m.nomes()).toContain("Loja Sol")
    await m.desmontar()
  })

  it("sem nenhum projeto mostra uma mensagem em vez da tabela", async () => {
    const m = await montar([])
    expect(m.raiz.querySelector("table")).toBeNull()
    expect(m.raiz.textContent).toContain("Nenhum projeto ainda.")
    await m.desmontar()
  })

  it("com filtros do painel ativos e nenhum projeto, a mensagem fala dos filtros, não de 'ainda'", async () => {
    const m = await montar([], {}, true)
    expect(m.raiz.textContent).toContain("Nenhum projeto com esses filtros.")
    expect(m.raiz.textContent).not.toContain("ainda")
    await m.desmontar()
  })
})

describe("ListaProjetos: busca, ordenação e linha", () => {
  it("a busca filtra por nome sem distinguir maiúsculas e vale para a aba atual", async () => {
    const m = await montar()
    const campo = m.raiz.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(campo.getAttribute("aria-label")).toBeTruthy()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, "AZUL")
      campo.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(m.nomes()).toEqual(["Casa Azul"])
    await m.desmontar()
  })

  it("busca sem resultado diz que nenhum projeto tem esse nome", async () => {
    const m = await montar()
    const campo = m.raiz.querySelector<HTMLInputElement>('input[type="search"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, "zzz")
      campo.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(m.raiz.textContent).toContain("Nenhum projeto com esses filtros.")
    await m.desmontar()
  })

  it("a ordem inicial é a atividade mais recente, e quem não tem atividade vai para o fim", async () => {
    const m = await montar()
    expect(m.nomes()).toEqual(["Casa Azul", "Verdeluz", "Loja Sol"])
    await m.desmontar()
  })

  it("clicar no cabeçalho ordena e clicar de novo inverte, com aria-sort", async () => {
    const m = await montar()
    await m.clicar(m.cabecalho("Custo"))
    expect(m.nomes()).toEqual(["Casa Azul", "Verdeluz", "Loja Sol"])
    expect(m.cabecalho("Custo")!.closest("th")!.getAttribute("aria-sort")).toBe("descending")
    await m.clicar(m.cabecalho("Custo"))
    expect(m.nomes()).toEqual(["Loja Sol", "Verdeluz", "Casa Azul"])
    expect(m.cabecalho("Custo")!.closest("th")!.getAttribute("aria-sort")).toBe("ascending")
    await m.clicar(m.cabecalho("Projeto"))
    expect(m.nomes()).toEqual(["Casa Azul", "Loja Sol", "Verdeluz"])
    expect(m.cabecalho("Custo")!.closest("th")!.getAttribute("aria-sort")).toBe("none")
    await m.desmontar()
  })

  it("ordena a etapa pela ordem do processo", async () => {
    const m = await montar()
    await m.clicar(m.cabecalho("Etapa atual"))
    expect(m.nomes()).toEqual(["Loja Sol", "Verdeluz", "Casa Azul"])
    await m.desmontar()
  })

  it("cada linha tem o link do projeto e clicar nela navega", async () => {
    const m = await montar()
    const link = m.raiz.querySelector<HTMLAnchorElement>('a[href="/admin/projetos/verdeluz"]')
    expect(link?.textContent).toBe("Verdeluz")
    await m.clicar(link!.closest("tr"))
    expect(push).toHaveBeenCalledWith("/admin/projetos/verdeluz")
    await m.desmontar()
  })

  it("mostra a etapa pelo nome, o analista, custo, tempo e as pendências", async () => {
    const m = await montar()
    const texto = m.raiz.textContent ?? ""
    expect(texto).toContain("Diagnóstico")
    expect(texto).toContain("Unidade econômica")
    expect(texto).toContain("Ana Souza")
    expect(texto).toContain("Sem dono")
    expect(texto).toContain("US$ 30,00")
    expect(texto).toContain("1h00")
    expect(texto).toContain("2 pendências")
    await m.desmontar()
  })

  it("projeto de teste leva o selo 'teste' sem quebrar o truncamento do nome; os demais não", async () => {
    const m = await montar([linha({ slug: "t", nome: "Cliente teste muito comprido", teste: true }), linha({ slug: "real", nome: "Real" })])
    const selos = [...m.raiz.querySelectorAll('[data-slot="badge"]')].filter((b) => b.textContent === "teste")
    expect(selos).toHaveLength(1)
    const link = m.raiz.querySelector('a[href="/admin/projetos/t"]')!
    expect(link.closest("tr")!.querySelector('[data-slot="badge"]')?.textContent).toBe("teste")
    expect(m.raiz.querySelector('a[href="/admin/projetos/real"]')!.closest("tr")!.textContent).not.toContain("teste")
    expect(link.className).toContain("truncate")
    expect(link.parentElement!.className).toContain("min-w-0")
    await m.desmontar()
  })

  it("concluído aparece como 'Concluído' na coluna de etapa", async () => {
    const m = await montar()
    await m.clicar(m.aba("Concluídos"))
    expect(m.raiz.querySelector("tbody")!.textContent).toContain("Concluído")
    await m.desmontar()
  })

  it("a foto do analista vem de avatares pelo e-mail normalizado", async () => {
    const foto = "https://lh3.googleusercontent.com/a/x=s96"
    const m = await montar(
      [linha({ slug: "com-foto", nome: "Com foto", dono: "Ana.Souza@Boomer.com.br" }), linha({ slug: "sem-foto", nome: "Sem foto", dono: "bia@boomer.com.br" })],
      { "ana.souza@boomer.com.br": foto },
    )
    const linhaDe = (slug: string) => m.raiz.querySelector(`a[href="/admin/projetos/${slug}"]`)!.closest("tr")!
    expect(linhaDe("com-foto").querySelector("img")?.getAttribute("src")).toBe(foto)
    expect(linhaDe("sem-foto").querySelector("img")).toBeNull()
    expect(linhaDe("sem-foto").querySelector('[data-slot="avatar-fallback"]')?.textContent).toBe("B")
    await m.desmontar()
  })
})
