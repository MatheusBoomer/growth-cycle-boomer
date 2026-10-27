import { describe, expect, it, vi } from "vitest"
import { destinoDoLogin, ehPaginaDeLogin, mensagemDeErroLogin, tratarNaoAutenticado } from "./login"

describe("ehPaginaDeLogin", () => {
  it("só /login e o que vem abaixo dele", () => {
    expect(ehPaginaDeLogin("/login")).toBe(true)
    expect(ehPaginaDeLogin("/login/")).toBe(true)
    expect(ehPaginaDeLogin("/")).toBe(false)
    expect(ehPaginaDeLogin("/loginx")).toBe(false)
    expect(ehPaginaDeLogin("/prospects/login")).toBe(false)
    expect(ehPaginaDeLogin(null)).toBe(false)
  })
})

describe("mensagemDeErroLogin", () => {
  it("devolve as mensagens exatas", () => {
    expect(mensagemDeErroLogin("dominio")).toBe("Use a conta Google da Boomer (@boomer.com.br ou @gestaoboomer.com).")
    expect(mensagemDeErroLogin("falha")).toBe("Não foi possível entrar agora. Tente de novo.")
  })

  it("valor desconhecido, vazio ou em lista não mostra mensagem", () => {
    expect(mensagemDeErroLogin("outro")).toBeNull()
    expect(mensagemDeErroLogin(undefined)).toBeNull()
    expect(mensagemDeErroLogin(["dominio"])).toBeNull()
  })
})

describe("destinoDoLogin", () => {
  it("leva o caminho atual (com query) em proximo, codificado uma vez", () => {
    expect(destinoDoLogin("/prospects/a", "?x=1&y=2")).toBe("/login?proximo=%2Fprospects%2Fa%3Fx%3D1%26y%3D2")
    expect(destinoDoLogin("/", "")).toBe("/login?proximo=%2F")
  })

  it("já em /login não manda para lugar nenhum (sem laço)", () => {
    expect(destinoDoLogin("/login", "?erro=falha")).toBeNull()
    expect(destinoDoLogin("/login/", "")).toBeNull()
  })
})

describe("tratarNaoAutenticado", () => {
  const local = (pathname: string, search = "") => ({ pathname, search })

  it("401 com nao_autenticado vai para /login?proximo=<caminho atual>", () => {
    const ir = vi.fn()
    expect(tratarNaoAutenticado(401, "nao_autenticado", local("/prospects/a", "?etapa=03"), ir)).toBe(true)
    expect(ir).toHaveBeenCalledExactlyOnceWith("/login?proximo=%2Fprospects%2Fa%3Fetapa%3D03")
  })

  it("outros erros não redirecionam", () => {
    const ir = vi.fn()
    expect(tratarNaoAutenticado(401, "outro", local("/"), ir)).toBe(false)
    expect(tratarNaoAutenticado(401, null, local("/"), ir)).toBe(false)
    expect(tratarNaoAutenticado(403, "nao_autenticado", local("/"), ir)).toBe(false)
    expect(tratarNaoAutenticado(500, "erro_interno", local("/"), ir)).toBe(false)
    expect(ir).not.toHaveBeenCalled()
  })

  it("já em /login não redireciona de novo", () => {
    const ir = vi.fn()
    expect(tratarNaoAutenticado(401, "nao_autenticado", local("/login"), ir)).toBe(false)
    expect(ir).not.toHaveBeenCalled()
  })
})
