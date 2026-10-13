// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { seletorDoElemento, textoVisivel } from "./nucleo.ts"

beforeEach(() => {
  document.body.innerHTML = ""
})

function seletorQueReencontra(el: Element): string {
  const seletor = seletorDoElemento(el)
  expect(document.querySelector(seletor)).toBe(el)
  return seletor
}

describe("seletorDoElemento", () => {
  it("para no id estável mais próximo", () => {
    document.body.innerHTML = `<main><div id="trilha"><ul><li>a</li><li>b</li></ul></div></main>`
    expect(seletorQueReencontra(document.querySelectorAll("li")[1]!)).toBe("#trilha > ul:nth-of-type(1) > li:nth-of-type(2)")
  })

  it("não usa ids gerados pelo React, Radix ou Base UI", () => {
    document.body.innerHTML = `<section><div id="_r_1_"><p>x</p></div><div id="radix-_r_2_"><p>y</p></div><div id="base-ui-_r_3_"><p>z</p></div></section>`
    const ps = document.querySelectorAll("p")
    expect(seletorQueReencontra(ps[0]!)).toBe("body > section:nth-of-type(1) > div:nth-of-type(1) > p:nth-of-type(1)")
    expect(seletorQueReencontra(ps[1]!)).not.toContain("radix")
    expect(seletorQueReencontra(ps[2]!)).not.toContain("base-ui")
  })

  it("não usa id repetido no documento", () => {
    document.body.innerHTML = `<div id="x"><p>1</p></div><div id="x"><p>2</p></div>`
    expect(seletorQueReencontra(document.querySelectorAll("p")[1]!)).not.toContain("#x")
  })

  it("usa data-slot e aria-label quando não há id", () => {
    document.body.innerHTML = `<main><div data-slot="card"><button aria-label="Fechar painel">x</button></div></main>`
    expect(seletorQueReencontra(document.querySelector("button")!)).toBe(
      'body > main:nth-of-type(1) > div[data-slot="card"] > button[aria-label="Fechar painel"]',
    )
  })

  it("data-slot repetido entre irmãos ganha a posição", () => {
    document.body.innerHTML = `<main><div data-slot="card">a</div><div data-slot="card">b</div></main>`
    expect(seletorQueReencontra(document.querySelectorAll("div")[1]!)).toBe(
      'body > main:nth-of-type(1) > div[data-slot="card"]:nth-of-type(2)',
    )
  })

  it("escapa aspas e barras no valor do atributo", () => {
    document.body.innerHTML = `<main><button aria-label='Diz "oi" \\ tchau'>x</button></main>`
    seletorQueReencontra(document.querySelector("button")!)
  })

  it("sobe no máximo 8 níveis", () => {
    document.body.innerHTML = `${"<div>".repeat(12)}<span>fundo</span>${"</div>".repeat(12)}`
    const seletor = seletorQueReencontra(document.querySelector("span")!)
    expect(seletor.split(" > ")).toHaveLength(8)
    expect(seletor.startsWith("body")).toBe(false)
  })
})

describe("textoVisivel", () => {
  it("colapsa espaços e quebras de linha", () => {
    document.body.innerHTML = `<div>  Olá\n\n   mundo  </div>`
    expect(textoVisivel(document.querySelector("div")!)).toBe("Olá mundo")
  })

  it("corta em 300 caracteres", () => {
    document.body.innerHTML = `<div>${"a".repeat(400)}</div>`
    expect(textoVisivel(document.querySelector("div")!)).toHaveLength(300)
  })
})
