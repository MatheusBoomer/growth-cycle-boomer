import { describe, expect, it } from "vitest"
import type { ProjetoComMetricas } from "@/lib/api"
import { filtrarPorNome, ordenarPorAtividade } from "./painel-projetos"

const projeto = (nome: string, ultimaAtividade: string | null): ProjetoComMetricas =>
  ({ slug: nome.toLowerCase(), nome, metricas: { ultimaAtividade } }) as ProjetoComMetricas

describe("ordenarPorAtividade", () => {
  it("mais recente primeiro, sem atividade no fim", () => {
    const lista = [projeto("Zeta", null), projeto("Antiga", "2026-11-01T10:00:00Z"), projeto("Alfa", null), projeto("Recente", "2026-11-06T10:00:00Z")]
    expect(ordenarPorAtividade(lista).map((p) => p.nome)).toEqual(["Recente", "Antiga", "Alfa", "Zeta"])
  })

  it("não altera a lista original", () => {
    const lista = [projeto("A", "2026-11-01T10:00:00Z"), projeto("B", "2026-11-02T10:00:00Z")]
    ordenarPorAtividade(lista)
    expect(lista.map((p) => p.nome)).toEqual(["A", "B"])
  })
})

describe("filtrarPorNome", () => {
  it("busca sem distinguir maiúsculas e ignora espaços nas pontas", () => {
    const lista = [projeto("Verdeluz", null), projeto("Casa Azul", null)]
    expect(filtrarPorNome(lista, "  VERDE ").map((p) => p.nome)).toEqual(["Verdeluz"])
    expect(filtrarPorNome(lista, "")).toHaveLength(2)
  })
})
