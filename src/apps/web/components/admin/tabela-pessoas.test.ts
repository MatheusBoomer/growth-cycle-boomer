import { describe, expect, it } from "vitest"
import type { PessoaComProjetos } from "@/lib/api"
import { aposTrocarPapel, rotuloAcao } from "./tabela-pessoas"

const pessoa = (papel: "admin" | "usuario", email = "ana@boomer.com"): PessoaComProjetos => ({
  email,
  papel,
  primeiroAcesso: "2026-11-01T10:00:00Z",
  ultimoAcesso: "2026-11-07T10:00:00Z",
  projetos: 0,
})

describe("rotuloAcao", () => {
  it("usuário comum: Tornar admin, habilitado", () => {
    const r = rotuloAcao(pessoa("usuario"), { admins: 1, euMesmo: false })
    expect(r.texto).toBe("Tornar admin")
    expect(r.desabilitado).toBe(false)
    expect(r.motivo).toBeNull()
  })

  it("admin com outro admin: Retirar admin, habilitado", () => {
    const r = rotuloAcao(pessoa("admin"), { admins: 2, euMesmo: false })
    expect(r.texto).toBe("Retirar admin")
    expect(r.desabilitado).toBe(false)
    expect(r.confirmacao).not.toContain("Você vai perder o acesso à administração.")
  })

  it("a própria linha avisa que vai perder o acesso", () => {
    const r = rotuloAcao(pessoa("admin"), { admins: 2, euMesmo: true })
    expect(r.confirmacao).toContain("Você vai perder o acesso à administração.")
  })

  it("único admin: desabilitado, com o motivo", () => {
    const r = rotuloAcao(pessoa("admin"), { admins: 1, euMesmo: true })
    expect(r.desabilitado).toBe(true)
    expect(r.motivo).toBe("É preciso manter pelo menos um administrador.")
  })
})

describe("aposTrocarPapel", () => {
  it("rebaixar a si mesmo recarrega a página inicial inteira", () => {
    expect(aposTrocarPapel(pessoa("admin"), { euMesmo: true })).toBe("recarregar-inicio")
  })

  it("rebaixar outra pessoa ou promover alguém só recarrega a lista", () => {
    expect(aposTrocarPapel(pessoa("admin"), { euMesmo: false })).toBe("recarregar-lista")
    expect(aposTrocarPapel(pessoa("usuario"), { euMesmo: false })).toBe("recarregar-lista")
  })
})
