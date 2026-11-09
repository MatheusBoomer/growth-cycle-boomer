import { describe, expect, it } from "vitest"
import type { FiltroPainel } from "@workspace/core/metricas/painel"
import { filtroDeParametros, parametrosDeFiltro } from "./painel-filtro"

// 04:30 UTC de 10/11/2026 é 01:30 do dia 10 em Brasília (UTC-3).
const AGORA = new Date("2026-11-10T04:30:00.000Z")
const q = (s: string) => new URLSearchParams(s)

describe("filtroDeParametros", () => {
  it("sem parâmetros usa os últimos 30 dias até hoje em Brasília, sem listas nem testes", () => {
    expect(filtroDeParametros(q(""), AGORA)).toEqual({
      de: "2026-10-12",
      ate: "2026-11-10",
      donos: [],
      projetos: [],
      etapas: [],
      modelos: [],
      incluirTestes: false,
    })
  })

  it("hoje vem do relógio de Brasília, não do UTC", () => {
    const f = filtroDeParametros(q(""), new Date("2026-11-10T02:30:00.000Z"))
    expect(f.ate).toBe("2026-11-09")
  })

  it("periodo=7d, 90d e ano", () => {
    expect(filtroDeParametros(q("periodo=7d"), AGORA)).toMatchObject({ de: "2026-11-04", ate: "2026-11-10" })
    expect(filtroDeParametros(q("periodo=90d"), AGORA)).toMatchObject({ de: "2026-08-13", ate: "2026-11-10" })
    expect(filtroDeParametros(q("periodo=ano"), AGORA)).toMatchObject({ de: "2026-01-01", ate: "2026-11-10" })
  })

  it("de e ate válidos formam o período personalizado, inclusive um dia só", () => {
    expect(filtroDeParametros(q("de=2026-09-01&ate=2026-09-30"), AGORA)).toMatchObject({ de: "2026-09-01", ate: "2026-09-30" })
    expect(filtroDeParametros(q("de=2026-09-05&ate=2026-09-05"), AGORA)).toMatchObject({ de: "2026-09-05", ate: "2026-09-05" })
  })

  it("datas inválidas, inexistentes, faltando uma delas ou ate antes de de caem no padrão", () => {
    const padrao = { de: "2026-10-12", ate: "2026-11-10" }
    for (const s of [
      "de=ontem&ate=hoje",
      "de=2026-02-30&ate=2026-03-10",
      "de=2026-13-01&ate=2026-13-02",
      "de=2026-09-01",
      "ate=2026-09-30",
      "de=2026-09-30&ate=2026-09-01",
      "de=2026-9-1&ate=2026-9-30",
      "de=1900-01-01&ate=2026-09-30",
    ]) {
      expect(filtroDeParametros(q(s), AGORA), s).toMatchObject(padrao)
    }
  })

  it("periodo desconhecido cai no padrão (ou nas datas, se válidas); periodo válido vence as datas", () => {
    expect(filtroDeParametros(q("periodo=semana"), AGORA)).toMatchObject({ de: "2026-10-12", ate: "2026-11-10" })
    expect(filtroDeParametros(q("periodo=semana&de=2026-09-01&ate=2026-09-30"), AGORA)).toMatchObject({ de: "2026-09-01", ate: "2026-09-30" })
    expect(filtroDeParametros(q("periodo=7d&de=2026-09-01&ate=2026-09-30"), AGORA)).toMatchObject({ de: "2026-11-04", ate: "2026-11-10" })
  })

  it("listas separadas por vírgula, aparadas, sem vazios nem repetidos; testes=1 liga incluirTestes", () => {
    const f = filtroDeParametros(q("donos=ana@boomer.com, bia@boomer.com,,ana@boomer.com&projetos=iszi&etapas=03,04&modelos=opus&testes=1"), AGORA)
    expect(f.donos).toEqual(["ana@boomer.com", "bia@boomer.com"])
    expect(f.projetos).toEqual(["iszi"])
    expect(f.etapas).toEqual(["03", "04"])
    expect(f.modelos).toEqual(["opus"])
    expect(f.incluirTestes).toBe(true)
    expect(filtroDeParametros(q("testes=0"), AGORA).incluirTestes).toBe(false)
    expect(filtroDeParametros(q("donos=,,"), AGORA).donos).toEqual([])
  })
})

describe("parametrosDeFiltro", () => {
  it("round-trip: período rápido, listas e testes voltam iguais", () => {
    const f: FiltroPainel = {
      ...filtroDeParametros(q("periodo=7d"), AGORA),
      donos: ["ana@boomer.com"],
      projetos: ["iszi", "verdeluz"],
      etapas: ["03"],
      modelos: ["claude-opus"],
      incluirTestes: true,
    }
    const params = parametrosDeFiltro(f, "7d")
    expect(params.get("periodo")).toBe("7d")
    expect(params.has("de")).toBe(false)
    expect(filtroDeParametros(new URLSearchParams(params.toString()), AGORA)).toEqual(f)
  })

  it("round-trip: período personalizado grava de e ate, sem periodo", () => {
    const f = { ...filtroDeParametros(q("de=2026-09-01&ate=2026-09-30"), AGORA), etapas: ["05"] }
    const params = parametrosDeFiltro(f, "custom")
    expect(params.get("de")).toBe("2026-09-01")
    expect(params.get("ate")).toBe("2026-09-30")
    expect(params.has("periodo")).toBe(false)
    expect(filtroDeParametros(params, AGORA)).toEqual(f)
  })

  it("filtro vazio e sem testes não grava listas nem testes", () => {
    const params = parametrosDeFiltro(filtroDeParametros(q(""), AGORA), "30d")
    expect(params.toString()).toBe("periodo=30d")
  })
})
