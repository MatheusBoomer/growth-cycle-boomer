import { describe, expect, it } from "vitest"
import type { EtapaCatalogo, Estado } from "@workspace/core/tipos"
import { fasesDaTrilha } from "./trilha"

const etapa = (id: string, fase: string | undefined, numero = id): EtapaCatalogo => ({ id, numero, titulo: `T${id}`, fase }) as unknown as EtapaCatalogo
const estadoCom = (s: Record<string, string>) => ({ etapas: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { status: v }])) }) as unknown as Estado

describe("fasesDaTrilha", () => {
  const etapas = [etapa("01", "Contexto"), etapa("02", "Contexto"), etapa("03", "Diagnóstico"), etapa("04", "Diagnóstico"), etapa("05", "Soluções e metas")]
  const estado = estadoCom({ "01": "concluida", "02": "concluida", "03": "concluida", "04": "em_andamento", "05": "bloqueada" })

  it("agrupa na ordem do catálogo e conta as feitas", () => {
    const f = fasesDaTrilha(etapas, estado)
    expect(f.map((x) => [x.fase, x.etapas.map((e) => e.id), x.feitas])).toEqual([
      ["Contexto", ["01", "02"], 2],
      ["Diagnóstico", ["03", "04"], 1],
      ["Soluções e metas", ["05"], 0],
    ])
  })

  it("situação: feita, atual ou nada", () => expect(fasesDaTrilha(etapas, estado).map((x) => x.situacao)).toEqual(["feita", "atual", ""]))

  it("etapa sem fase vai para 'Outras', no fim", () => {
    const f = fasesDaTrilha([etapa("x", undefined), ...etapas], estadoCom({ x: "bloqueada", ...Object.fromEntries(etapas.map((e) => [e.id, "bloqueada"])) }))
    expect(f.at(-1)).toMatchObject({ fase: "Outras", etapas: [{ id: "x" }] })
  })
})
