import { describe, expect, it } from "vitest"
import { ErroSemPermissao, ErroUltimoAdmin } from "../src/erros"
import { ehAdmin, normalizarEmail, podeVerProspect, type UsuarioComPapel } from "../src/papeis"

const ana: UsuarioComPapel = { email: "ana.silva@boomer.com.br", papel: "usuario" }
const admin: UsuarioComPapel = { email: "chefe@boomer.com.br", papel: "admin" }

describe("papeis", () => {
  it("normalizarEmail apara espaços e passa para minúsculas", () => {
    expect(normalizarEmail("  Ana.Silva@Boomer.com.br ")).toBe("ana.silva@boomer.com.br")
  })

  it("ehAdmin só vale para o papel admin", () => {
    expect(ehAdmin(admin)).toBe(true)
    expect(ehAdmin(ana)).toBe(false)
  })

  it("usuário vê o próprio prospect, mesmo com maiúsculas no criado_por", () => {
    expect(podeVerProspect(ana, { criadoPor: "Ana.Silva@boomer.com.br", teste: false })).toBe(true)
  })

  it("usuário não vê prospect de outra pessoa nem sem dono", () => {
    expect(podeVerProspect(ana, { criadoPor: "bia@boomer.com.br", teste: false })).toBe(false)
    expect(podeVerProspect(ana, { criadoPor: null, teste: false })).toBe(false)
  })

  it("cliente de teste é só de admin, mesmo quando o dono gravado é o usuário", () => {
    expect(podeVerProspect(ana, { criadoPor: "ana.silva@boomer.com.br", teste: true })).toBe(false)
    expect(podeVerProspect(admin, { criadoPor: null, teste: true })).toBe(true)
  })

  it("admin vê tudo", () => {
    expect(podeVerProspect(admin, { criadoPor: "x@y", teste: false })).toBe(true)
  })

  it("modo sem login (e-mail nulo, admin) vê tudo", () => {
    expect(podeVerProspect({ email: null, papel: "admin" }, { criadoPor: null, teste: false })).toBe(true)
  })

  it("usuário sem e-mail não vê nada", () => {
    expect(podeVerProspect({ email: null, papel: "usuario" }, { criadoPor: null, teste: false })).toBe(false)
    expect(podeVerProspect({ email: null, papel: "usuario" }, { criadoPor: "ana@boomer.com.br", teste: false })).toBe(false)
  })

  it("erros novos têm status, código e mensagem", () => {
    expect(new ErroSemPermissao().status).toBe(403)
    expect(new ErroSemPermissao().codigo).toBe("sem_permissao")
    expect(new ErroSemPermissao().message).toBe("Só administradores podem fazer isso.")
    expect(new ErroUltimoAdmin().status).toBe(409)
    expect(new ErroUltimoAdmin().codigo).toBe("ultimo_admin")
    expect(new ErroUltimoAdmin().message).toBe("É preciso manter pelo menos um administrador.")
  })
})
