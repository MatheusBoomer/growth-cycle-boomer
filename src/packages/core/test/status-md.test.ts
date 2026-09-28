import { describe, expect, it } from "vitest"
import { concluirEtapa, estadoInicial, iniciarEtapa, sinalizarPronta } from "../src/maquina-estados"
import { registrarInsumo } from "../src/insumos"
import { importarStatusMd, renderStatusMd } from "../src/status-md"
import { catalogoReal } from "./ajuda"

const EM = "2026-09-28T10:00:00.000Z"
const cat = catalogoReal()

const MD_TERMINAL = `# Status do Planejamento — Adda

| Etapa | Status | Concluída em | Observação |
|---|---|---|---|
| 00 · Criar prospect | ✅ | 2026-09-21 | |
| 01 · Preparação de contexto | ✅ | 2026-09-21 | |
| 02 · Contextualização estratégica | ✅ | 2026-09-21 | |
| 03 · Diagnóstico de performance | ✅ | 2026-09-22 | Histórico insuficiente (3/12 meses com dado) |
| 04 · Unidade econômica | ⬜ | | |
| 05 · Metas e cenários | ⬜ | | |
| 06 · Briefing e benchmark | ⬜ | | |
| 07 · Mídia paga | ⬜ | | |
| 08 · Plano de ação | ⬜ | | |
| Apresentação final | ⬜ | | |

## Próximo passo

Preciso de uma planilha (Excel) com o histórico de vendas por cliente.
`

describe("status-planejamento.md", () => {
  it("importa um prospect feito no terminal", () => {
    const e = importarStatusMd(MD_TERMINAL, cat, { slug: "adda", nome: "Adda", site: null }, EM)
    expect(e.prospect.criadoEm).toBe("2026-09-21")
    expect(e.etapas["03"]).toMatchObject({
      status: "concluida",
      origem: "terminal",
      concluidaEm: "2026-09-22",
      observacao: "Histórico insuficiente (3/12 meses com dado)",
      handoff: "Preciso de uma planilha (Excel) com o histórico de vendas por cliente.",
    })
    expect(e.etapas["04"].status).toBe("liberada")
    expect(e.etapas["05"].status).toBe("bloqueada")
  })

  it("renderiza a tabela no formato atual e o handoff da última concluída", () => {
    let e = estadoInicial({ slug: "x", nome: "Iszi", site: null }, EM)
    e = iniciarEtapa(e, "01", EM)
    for (const id of ["kickoff-transcricao", "site"]) {
      e = registrarInsumo(e, { etapa: "01", insumoId: id, status: "valido", problemas: [], avisos: [], resumo: null, arquivo: "x" }, EM)
    }
    e = sinalizarPronta(e, "01", { resumoDecisoes: "r", handoff: "Me mande a planilha X." }, cat, EM).estado
    e = concluirEtapa(e, "01", cat, EM)
    const md = renderStatusMd(e, cat)
    expect(md).toContain("# Status do Planejamento — Iszi")
    expect(md).toContain("| 00 · Criar prospect | ✅ | 2026-09-28 | |")
    expect(md).toContain("| 01 · Preparação de contexto | ✅ | 2026-09-28 |  |")
    expect(md).toContain("| 02 · Contextualização estratégica | ⬜ |  |  |")
    expect(md).toMatch(/## Próximo passo\n\nMe mande a planilha X\./)
  })

  it("ida e volta preserva etapas concluídas e handoff", () => {
    const e = importarStatusMd(MD_TERMINAL, cat, { slug: "adda", nome: "Adda", site: null }, EM)
    const de_novo = importarStatusMd(renderStatusMd(e, cat), cat, { slug: "adda", nome: "Adda", site: null }, EM)
    expect(de_novo.etapas["03"].status).toBe("concluida")
    expect(de_novo.etapas["03"].handoff).toBe(e.etapas["03"].handoff)
  })
})
