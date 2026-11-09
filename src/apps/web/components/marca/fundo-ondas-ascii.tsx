"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { PALETAS, celulaOnda, dimensionarGrade, fatorDeDegrade, type TemaOndas } from "@/lib/ondas-ascii"

const FAIXAS = 8
const INTERVALO_MS = 1000 / 30
/** A partir desta faixa (de FAIXAS) o caractere ganha o halo neon do tema escuro. */
const FAIXA_BRILHO = 6
/** Abaixo disto o degradê do mask já escondeu a coluna: não vale desenhar. */
const DEGRADE_MINIMO = 0.05

/**
 * Fundo fixo de ondas em ASCII, em todas as telas. O canvas ocupa a janela inteira e o degradê de 100% (esquerda) a
 * 0% (direita) é um mask CSS, sem custo de CPU. Desenha em lotes por faixa de opacidade e cor; pausa com a aba oculta; com
 * prefers-reduced-motion pinta um único quadro.
 */
export function FundoOndasAscii() {
  const { resolvedTheme } = useTheme()
  const tema: TemaOndas = resolvedTheme === "dark" ? "escuro" : "claro"
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // A paleta entra por ref: trocar de tema não reinicia o loop.
  const paletaRef = useRef(PALETAS[tema])
  const desenharRef = useRef<(() => void) | null>(null)
  const reduzidoRef = useRef(false)
  const [disponivel, setDisponivel] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) {
      setDisponivel(false)
      return
    }
    reduzidoRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const fonteMono = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace"

    let id: number | null = null
    let ultimo = Number.NEGATIVE_INFINITY
    let t0: number | null = null
    let tempo = 0
    let grade = dimensionarGrade(0, 0)
    // Um lote por (faixa, laranja): posições em pares x,y e os caracteres, reaproveitados a cada quadro.
    const lotes = Array.from({ length: (FAIXAS + 1) * 2 }, () => ({ pos: [] as number[], chars: [] as string[] }))

    const medir = () => {
      const largura = window.innerWidth
      const altura = window.innerHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(largura * dpr))
      canvas.height = Math.max(1, Math.floor(altura * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      grade = dimensionarGrade(largura, altura)
      ctx.font = `${Math.round(grade.celulaA * 0.82)}px ${fonteMono}`
      ctx.textBaseline = "top"
    }

    const desenhar = () => {
      const { celulaL, celulaA, colunas, linhas } = grade
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      if (colunas === 0 || linhas === 0) return
      for (const l of lotes) {
        l.pos.length = 0
        l.chars.length = 0
      }
      for (let coluna = 0; coluna < colunas; coluna++) {
        if (fatorDeDegrade(coluna, colunas) < DEGRADE_MINIMO) break
        for (let linha = 0; linha < linhas; linha++) {
          const c = celulaOnda(coluna, linha, tempo, colunas, linhas)
          const faixa = Math.round(c.intensidade * FAIXAS)
          if (faixa === 0 || c.caractere === " ") continue
          const lote = lotes[faixa * 2 + (c.laranja ? 1 : 0)]!
          lote.pos.push(coluna * celulaL, linha * celulaA)
          lote.chars.push(c.caractere)
        }
      }
      const { azul, laranja, opacidadeMax, brilho } = paletaRef.current
      lotes.forEach((lote, i) => {
        if (lote.chars.length === 0) return
        const faixa = Math.floor(i / 2)
        const [r, g, b] = i % 2 === 1 ? laranja : azul
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${((faixa / FAIXAS) * opacidadeMax).toFixed(3)})`
        // Neon leve: halo na cor do caractere, só nas faixas mais fortes (o desfoque por caractere é o custo do quadro).
        ctx.shadowBlur = brilho > 0 && faixa >= FAIXA_BRILHO ? brilho : 0
        ctx.shadowColor = `rgb(${r}, ${g}, ${b})`
        lote.chars.forEach((ch, k) => ctx.fillText(ch, lote.pos[k * 2]!, lote.pos[k * 2 + 1]!))
      })
      ctx.shadowBlur = 0
    }

    const quadro = (agora: number) => {
      id = window.requestAnimationFrame(quadro)
      if (agora - ultimo < INTERVALO_MS) return
      ultimo = agora
      t0 ??= agora
      tempo = (agora - t0) / 1000
      desenhar()
    }
    const iniciar = () => {
      if (id === null && !reduzidoRef.current && !document.hidden) id = window.requestAnimationFrame(quadro)
    }
    const parar = () => {
      if (id !== null) window.cancelAnimationFrame(id)
      id = null
    }
    const aoMudarVisibilidade = () => (document.hidden ? parar() : iniciar())
    const aoRedimensionar = () => {
      medir()
      if (reduzidoRef.current) desenhar()
    }

    medir()
    desenharRef.current = desenhar
    if (reduzidoRef.current) desenhar()
    else iniciar()
    window.addEventListener("resize", aoRedimensionar)
    document.addEventListener("visibilitychange", aoMudarVisibilidade)
    return () => {
      parar()
      desenharRef.current = null
      window.removeEventListener("resize", aoRedimensionar)
      document.removeEventListener("visibilitychange", aoMudarVisibilidade)
    }
  }, [])

  useEffect(() => {
    paletaRef.current = PALETAS[tema]
    // Em reduced-motion não há loop para pegar a cor nova: redesenha o quadro estático.
    if (reduzidoRef.current) desenharRef.current?.()
  }, [tema])

  if (!disponivel) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 size-full [-webkit-mask-image:linear-gradient(to_right,#000,transparent)] [mask-image:linear-gradient(to_right,#000,transparent)]"
    />
  )
}
