import { describe, expect, it } from "vitest"
import { rotuloDoPeriodo, seloDaAba, type ResumoAdmin } from "./resumo-admin"

const RESUMO: ResumoAdmin = { pessoas: 6, admins: 2, etapas: 9, notasAbertas: 5, reportsAbertos: 3 }
const sem = new URLSearchParams()

describe("seloDaAba", () => {
  it("cada aba ganha o seu selo de contexto, como no protótipo", () => {
    expect(seloDaAba("/admin/pessoas", RESUMO, sem)).toBe("6 pessoas · 2 admins")
    expect(seloDaAba("/admin/projetos", RESUMO, sem)).toBe("Últimos 30 dias")
    expect(seloDaAba("/admin/modelos", RESUMO, sem)).toBe("9 etapas")
    expect(seloDaAba("/admin/skills", RESUMO, sem)).toBe("5 notas abertas")
    expect(seloDaAba("/admin/reports", RESUMO, sem)).toBe("3 abertos")
  })

  it("singular e zero", () => {
    const um: ResumoAdmin = { pessoas: 1, admins: 1, etapas: 1, notasAbertas: 1, reportsAbertos: 1 }
    expect(seloDaAba("/admin/pessoas", um, sem)).toBe("1 pessoa · 1 admin")
    expect(seloDaAba("/admin/skills", um, sem)).toBe("1 nota aberta")
    expect(seloDaAba("/admin/reports", um, sem)).toBe("1 aberto")
    const zero: ResumoAdmin = { ...um, notasAbertas: 0, reportsAbertos: 0 }
    expect(seloDaAba("/admin/skills", zero, sem)).toBe("Nenhuma nota aberta")
    expect(seloDaAba("/admin/reports", zero, sem)).toBe("Nenhum aberto")
  })

  it("dado que não veio (sem nuvem ou falha) não vira selo; o período não depende do resumo", () => {
    const vazio: ResumoAdmin = { pessoas: null, admins: null, etapas: 9, notasAbertas: null, reportsAbertos: null }
    expect(seloDaAba("/admin/pessoas", vazio, sem)).toBeNull()
    expect(seloDaAba("/admin/skills", vazio, sem)).toBeNull()
    expect(seloDaAba("/admin/reports", vazio, sem)).toBeNull()
    expect(seloDaAba("/admin/reports", null, sem)).toBeNull()
    expect(seloDaAba("/admin/projetos", null, new URLSearchParams("periodo=7d"))).toBe("Últimos 7 dias")
  })

  it("sub-rota usa a aba mãe; rota desconhecida não tem selo", () => {
    expect(seloDaAba("/admin/projetos/verdeluz", RESUMO, sem)).toBeNull()
    expect(seloDaAba("/admin", RESUMO, sem)).toBeNull()
  })
})

describe("rotuloDoPeriodo", () => {
  it("períodos rápidos, personalizado e padrão", () => {
    expect(rotuloDoPeriodo(new URLSearchParams("periodo=90d"))).toBe("Últimos 90 dias")
    expect(rotuloDoPeriodo(new URLSearchParams("periodo=ano"))).toBe("Este ano")
    expect(rotuloDoPeriodo(new URLSearchParams("de=2026-10-01&ate=2026-10-31"))).toBe("01/10/2026 a 31/10/2026")
    expect(rotuloDoPeriodo(new URLSearchParams("de=2026-10-31&ate=2026-10-01"))).toBe("Últimos 30 dias")
    expect(rotuloDoPeriodo(new URLSearchParams("periodo=xyz"))).toBe("Últimos 30 dias")
  })
})
