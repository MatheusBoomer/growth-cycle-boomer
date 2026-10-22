// Comemoração ao concluir uma etapa: aviso e confete em canvas, sem dependência. Só roda no navegador.
import { toast } from "sonner"

const CORES_PADRAO = ["#eb610a", "#f47a2a", "#fbbf24", "#34d399", "#60a5fa", "#f472b6"]
const DURACAO_MS = 2600
const GRAVIDADE = 0.18

interface Particula {
  x: number
  y: number
  vx: number
  vy: number
  tamanho: number
  giro: number
  velocidadeGiro: number
  cor: string
  redonda: boolean
}

function coresDoTema(): string[] {
  const estilo = getComputedStyle(document.documentElement)
  const doTema = ["--primary", "--primario-claro"].map((v) => estilo.getPropertyValue(v).trim()).filter(Boolean)
  return [...doTema, ...CORES_PADRAO.slice(2)]
}

/** Dois jatos de confete saindo dos cantos de baixo; some sozinho e respeita "reduzir movimento". */
export function dispararConfete(): void {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "2147483000" })
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  ctx.scale(dpr, dpr)
  document.body.appendChild(canvas)

  const cores = coresDoTema()
  const particulas: Particula[] = Array.from({ length: 160 }, (_, i) => {
    const daEsquerda = i % 2 === 0
    const angulo = (daEsquerda ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7
    const forca = 11 + Math.random() * 9
    return {
      x: daEsquerda ? 0 : window.innerWidth,
      y: window.innerHeight,
      vx: Math.cos(angulo) * forca,
      vy: Math.sin(angulo) * forca,
      tamanho: 6 + Math.random() * 6,
      giro: Math.random() * Math.PI * 2,
      velocidadeGiro: (Math.random() - 0.5) * 0.4,
      cor: cores[Math.floor(Math.random() * cores.length)]!,
      redonda: Math.random() < 0.3,
    }
  })

  const inicio = performance.now()
  function quadro(agora: number) {
    const decorrido = agora - inicio
    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight)
    const opacidade = Math.min(1, (DURACAO_MS - decorrido) / 700)
    for (const p of particulas) {
      p.vy += GRAVIDADE
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.giro += p.velocidadeGiro
      ctx!.save()
      ctx!.globalAlpha = Math.max(0, opacidade)
      ctx!.translate(p.x, p.y)
      ctx!.rotate(p.giro)
      ctx!.fillStyle = p.cor
      if (p.redonda) {
        ctx!.beginPath()
        ctx!.arc(0, 0, p.tamanho / 2, 0, Math.PI * 2)
        ctx!.fill()
      } else {
        ctx!.fillRect(-p.tamanho / 2, -p.tamanho / 4, p.tamanho, p.tamanho / 2)
      }
      ctx!.restore()
    }
    if (decorrido < DURACAO_MS) requestAnimationFrame(quadro)
    else canvas.remove()
  }
  requestAnimationFrame(quadro)
}

/** Aviso e confete de quando o analista conclui uma etapa; `proxima` diz se há etapa liberada depois dela. */
export function celebrarEtapaConcluida(proxima: boolean): void {
  toast.success("Etapa concluída!", { description: proxima ? "A próxima foi liberada." : "Todas as etapas de conteúdo foram concluídas." })
  dispararConfete()
}
