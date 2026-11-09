// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { AvatarPessoa, corDoAvatar, iniciais } from "./avatar-pessoa"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function montar(props: Parameters<typeof AvatarPessoa>[0]) {
  const raiz = document.createElement("div")
  document.body.append(raiz)
  const r = createRoot(raiz)
  await act(async () => {
    r.render(createElement(AvatarPessoa, props))
  })
  return { raiz, desmontar: () => act(async () => r.unmount()) }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("iniciais", () => {
  it("duas letras: a primeira de cada uma das duas primeiras palavras", () => {
    expect(iniciais("Ana Souza")).toBe("AS")
    expect(iniciais("ana maria souza")).toBe("AM")
  })

  it("com uma palavra só devolve uma letra", () => {
    expect(iniciais("matheus")).toBe("M")
  })

  it("ignora espaços sobrando e nome vazio", () => {
    expect(iniciais("  bia   lima ")).toBe("BL")
    expect(iniciais("   ")).toBe("?")
  })
})

describe("corDoAvatar", () => {
  it("é determinística e não liga para caixa nem espaços do e-mail", () => {
    expect(corDoAvatar("Ana@X.com")).toBe(corDoAvatar("ana@x.com"))
    expect(corDoAvatar(" ana@x.com ")).toBe(corDoAvatar("ana@x.com"))
    expect(corDoAvatar("ana@x.com")).toBe(corDoAvatar("ana@x.com"))
  })

  it("usa só a paleta fixa de 6 cores e espalha e-mails diferentes", () => {
    const cores = new Set(Array.from({ length: 60 }, (_, i) => corDoAvatar(`pessoa${i}@boomer.com`)))
    expect(cores.size).toBeGreaterThan(1)
    expect(cores.size).toBeLessThanOrEqual(6)
  })

  it("sem e-mail usa o cinza neutro, fora da paleta", () => {
    const cores = new Set(Array.from({ length: 60 }, (_, i) => corDoAvatar(`pessoa${i}@boomer.com`)))
    expect(cores.has(corDoAvatar(null))).toBe(false)
    expect(corDoAvatar(null)).toContain("bg-muted")
  })
})

describe("AvatarPessoa", () => {
  it("sem foto mostra as iniciais e nenhuma imagem", async () => {
    const { raiz, desmontar } = await montar({ email: "ana@x.com", nome: "Ana Souza" })
    expect(raiz.textContent).toBe("AS")
    expect(raiz.querySelector("img")).toBeNull()
    await desmontar()
  })

  it("sem e-mail mostra '?' em cinza neutro", async () => {
    const { raiz, desmontar } = await montar({ email: null, nome: "Sem dono" })
    expect(raiz.textContent).toBe("?")
    await desmontar()
  })

  it("com foto renderiza a imagem decorativa sem enviar o referrer", async () => {
    const { raiz, desmontar } = await montar({ email: "ana@x.com", nome: "Ana Souza", fotoUrl: "https://lh3.googleusercontent.com/a/foto" })
    const img = raiz.querySelector("img")!
    expect(img).not.toBeNull()
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer")
    expect(img.getAttribute("alt")).toBe("")
    expect(img.getAttribute("src")).toBe("https://lh3.googleusercontent.com/a/foto")
    await desmontar()
  })

  it("quando a imagem falha de carregar volta às iniciais", async () => {
    const { raiz, desmontar } = await montar({ email: "ana@x.com", nome: "Ana Souza", fotoUrl: "https://lh3.googleusercontent.com/a/quebrada" })
    const img = raiz.querySelector("img")!
    await act(async () => {
      img.dispatchEvent(new Event("error"))
    })
    expect(raiz.querySelector("img")).toBeNull()
    expect(raiz.textContent).toBe("AS")
    await desmontar()
  })
})
