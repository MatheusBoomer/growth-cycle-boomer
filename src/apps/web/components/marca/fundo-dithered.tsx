"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { PARAMETROS_DITHERED, SHADER_FRAGMENTO, SHADER_VERTICE, paletaDithered, rgbNormalizado } from "@/lib/dithered"

/**
 * Fundo dithered "B sutil": ondas lentas em retícula de 4 tons, no tom laranja queimado da Boomer. Preenche o pai
 * (que precisa ser `relative isolate`). Pausa fora da tela e com a aba escondida; com movimento reduzido desenha um
 * quadro parado; sem WebGL2 não desenha nada e o brilho quente do fundo da página continua.
 */
export function FundoDithered({
  intensidade = PARAMETROS_DITHERED.intensidade,
  centroLimpo = false,
  className,
}: {
  intensidade?: number
  /** Quase limpa o centro, onde fica o texto principal. */
  centroLimpo?: boolean
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const tema = useRef<"dark" | "light">("dark")
  tema.current = resolvedTheme === "light" ? "light" : "dark"

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext("webgl2", { antialias: false, premultipliedAlpha: false }) as WebGL2RenderingContext | null
    if (!canvas || !gl) return

    const compilar = (tipo: number, fonte: string) => {
      const s = gl.createShader(tipo)!
      gl.shaderSource(s, fonte)
      gl.compileShader(s)
      return s
    }
    const programa = gl.createProgram()!
    gl.attachShader(programa, compilar(gl.VERTEX_SHADER, SHADER_VERTICE))
    gl.attachShader(programa, compilar(gl.FRAGMENT_SHADER, SHADER_FRAGMENTO))
    gl.linkProgram(programa)
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return
    gl.useProgram(programa)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const local = gl.getAttribLocation(programa, "p")
    gl.enableVertexAttribArray(local)
    gl.vertexAttribPointer(local, 2, gl.FLOAT, false, 0, 0)
    const u = (nome: string) => gl.getUniformLocation(programa, nome)

    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    const mouse = { x: -9999, y: -9999, alvo: 0, ativo: 0 }
    let visivel = true
    let quadro = 0
    const inicio = performance.now()

    const pai = canvas.parentElement
    const aoMover = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      mouse.x = (e.clientX - r.left) * dpr
      mouse.y = (r.bottom - e.clientY) * dpr
      mouse.alvo = 1
    }
    const aoSair = () => (mouse.alvo = 0)
    pai?.addEventListener("pointermove", aoMover)
    pai?.addEventListener("pointerleave", aoSair)
    const observador = new IntersectionObserver(([e]) => {
      visivel = e?.isIntersecting ?? true
      if (visivel && !reduzido) agendar()
    })
    observador.observe(canvas)
    const aoTrocarAba = () => !document.hidden && !reduzido && agendar()
    document.addEventListener("visibilitychange", aoTrocarAba)

    function desenhar(agora: number) {
      if (!canvas || !gl) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      mouse.ativo += (mouse.alvo - mouse.ativo) * 0.08
      const [c0, , c2, c3] = paletaDithered(tema.current).map(rgbNormalizado)
      gl.uniform2f(u("res"), w, h)
      gl.uniform1f(u("tt"), reduzido ? 0 : (agora - inicio) / 1000)
      gl.uniform1f(u("vel"), PARAMETROS_DITHERED.velocidade)
      gl.uniform2f(u("mouse"), mouse.x, mouse.y)
      gl.uniform1f(u("mAtivo"), mouse.ativo)
      gl.uniform1f(u("px"), PARAMETROS_DITHERED.pixel * dpr)
      gl.uniform1f(u("niveis"), PARAMETROS_DITHERED.tons)
      gl.uniform1f(u("forca"), intensidade)
      gl.uniform1f(u("limpa"), centroLimpo ? 1 : 0)
      gl.uniform3f(u("c0"), ...c0!)
      gl.uniform3f(u("c2"), ...c2!)
      gl.uniform3f(u("c3"), ...c3!)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    function laco(agora: number) {
      quadro = 0
      if (!visivel || document.hidden) return
      desenhar(agora)
      if (!reduzido) agendar()
    }
    function agendar() {
      if (quadro === 0) quadro = requestAnimationFrame(laco)
    }
    agendar()

    return () => {
      cancelAnimationFrame(quadro)
      observador.disconnect()
      document.removeEventListener("visibilitychange", aoTrocarAba)
      pai?.removeEventListener("pointermove", aoMover)
      pai?.removeEventListener("pointerleave", aoSair)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(programa)
      // Sem loseContext(): o React remonta no mesmo canvas (modo estrito, troca de props) e receberia o contexto morto.
    }
  }, [intensidade, centroLimpo])

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10 size-full", className)} />
}
