import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { NEUTRO, PALETA } from "../components/marca/avatar-pessoa"

// Lê os tokens dos dois temas direto do CSS, para o teste quebrar se alguém mudar uma cor sem olhar o contraste.
const CSS = readFileSync(path.resolve(import.meta.dirname, "../../../packages/ui/src/styles/globals.css"), "utf-8")

type Cor = { r: number; g: number; b: number; a: number }

function bloco(seletor: ":root" | ".dark"): Record<string, string> {
  const inicio = CSS.search(new RegExp(`^${seletor.replace(".", "\\.")} \\{`, "m"))
  if (inicio < 0) throw new Error(`bloco ${seletor} não encontrado`)
  const corpo = CSS.slice(inicio, CSS.indexOf("}", inicio))
  return Object.fromEntries([...corpo.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
}

function cor(valor: string): Cor {
  const hex = valor.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const rgb = valor.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/)
  if (rgb) return { r: +rgb[1]!, g: +rgb[2]!, b: +rgb[3]!, a: rgb[4] === undefined ? 1 : +rgb[4] }
  throw new Error(`cor em formato não suportado pelo teste: ${valor}`)
}

/** Compõe uma cor (possivelmente translúcida) sobre um fundo opaco. */
function sobre(frente: Cor, fundo: Cor): Cor {
  const mistura = (f: number, b: number) => f * frente.a + b * (1 - frente.a)
  return { r: mistura(frente.r, fundo.r), g: mistura(frente.g, fundo.g), b: mistura(frente.b, fundo.b), a: 1 }
}

function luminancia({ r, g, b }: Cor): number {
  const canal = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function contraste(a: Cor, b: Cor): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro! + 0.05) / (escuro! + 0.05)
}

for (const [nome, seletor] of [["escuro", ".dark"], ["claro", ":root"]] as const) {
  describe(`contraste do tema ${nome}`, () => {
    const t = { ...bloco(":root"), ...(seletor === ".dark" ? bloco(".dark") : {}) }
    const c = (token: string) => {
      const valor = t[token]
      if (!valor) throw new Error(`token ${token} ausente no tema ${nome}`)
      return cor(valor)
    }
    const fundo = c("--background")
    const card = sobre(c("--card"), fundo)
    const pares: [string, string, Cor, Cor, number][] = [
      ["--foreground", "fundo", c("--foreground"), fundo, 4.5],
      ["--muted-foreground", "fundo", c("--muted-foreground"), fundo, 4.5],
      ["--foreground", "card", c("--foreground"), card, 4.5],
      ["--muted-foreground", "card", c("--muted-foreground"), card, 4.5],
      ["--texto-forte", "card", c("--texto-forte"), card, 4.5],
      ["--popover-foreground", "popover", c("--popover-foreground"), c("--popover"), 4.5],
      ["--muted-foreground", "popover", c("--muted-foreground"), c("--popover"), 4.5],
      ["--sucesso", "chip de sucesso", c("--sucesso"), sobre(c("--sucesso-fundo"), card), 4.5],
      ["--aviso", "chip de aviso", c("--aviso"), sobre(c("--aviso-fundo"), card), 4.5],
      // Pior caso: o chip em cima do fundo da página (card translúcido sobre os halos), não só sobre o card branco.
      ["--aviso", "chip de aviso sobre o fundo da página", c("--aviso"), sobre(c("--aviso-fundo"), fundo), 4.5],
      ["--sucesso", "chip de sucesso sobre o fundo da página", c("--sucesso"), sobre(c("--sucesso-fundo"), fundo), 4.5],
      ["--destructive", "chip de perigo", c("--destructive"), sobre(c("--perigo-fundo"), card), 4.5],
      ["--link-acao", "card", c("--link-acao"), card, 4.5],
      ["--primary-foreground", "--primary (exceção do botão)", c("--primary-foreground"), c("--primary"), 3],
    ]
    // Cada par do avatar vem das classes reais (`bg-X[/N] text-Y`), então trocar a classe sem olhar o contraste quebra o teste.
    const corDaClasse = (classe: string, prefixo: "bg" | "text"): Cor => {
      const [, token, opacidade] = classe.match(new RegExp(`^${prefixo}-([\\w-]+?)(?:/(\\d+))?$`)) ?? []
      if (!token) throw new Error(`classe ${classe} fora do formato esperado`)
      const base = c(`--${token}`)
      return opacidade === undefined ? base : { ...base, a: base.a * (+opacidade / 100) }
    }
    for (const par of [...PALETA, NEUTRO]) {
      const [fundoClasse, textoClasse] = par.split(" ") as [string, string]
      pares.push([`avatar ${par}`, "o card (iniciais)", corDaClasse(textoClasse, "text"), sobre(corDaClasse(fundoClasse, "bg"), card), 4.5])
    }
    for (const [texto, sobreQue, frente, base, minimo] of pares) {
      it(`${texto} sobre ${sobreQue} ≥ ${minimo}:1`, () => {
        expect(contraste(frente, base)).toBeGreaterThanOrEqual(minimo)
      })
    }
  })
}
