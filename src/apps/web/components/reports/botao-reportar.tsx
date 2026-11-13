"use client"

import { MessageSquareWarningIcon } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useAmbiente } from "@/components/marca/conta-contexto"
import { DialogoReport } from "./dialogo-report"

/** A biblioteca do print é pesada: começa a carregar quando o mouse chega no botão, para o clique não esperar por ela. */
let captura: Promise<typeof import("modern-screenshot")> | null = null
function carregarCaptura() {
  captura ??= import("modern-screenshot")
  return captura
}

/** Espera o navegador pintar a tela (o botão já em "Capturando…") antes de travar a página tirando o print. */
const depoisDePintar = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Print da área visível da página, como data URL PNG; null se o navegador não conseguir (o diálogo abre mesmo assim). */
async function capturarTela(): Promise<string | null> {
  try {
    const { domToPng } = await carregarCaptura()
    return await domToPng(document.documentElement, {
      // O próprio botão (com o giro de "capturando") não entra no print.
      filter: (no) => !(no instanceof Element && no.hasAttribute("data-reportar")),
      width: window.innerWidth,
      height: window.innerHeight,
      scale: Math.min(1, 1600 / window.innerWidth),
      // Sem isto o fundo sai transparente e o texto claro do tema escuro some.
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      // Página rolada no documento: sem isto a foto sairia do topo, não do que estava na tela.
      style: window.scrollX || window.scrollY ? { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` } : undefined,
    })
  } catch {
    return null
  }
}

/**
 * Botão da barra do topo para reportar bug ou melhoria. Tira o print ANTES de abrir o diálogo, para o diálogo não sair
 * na imagem. Aparece sempre; sem a nuvem (app local) o diálogo avisa que o report só fica guardado no app publicado.
 */
export function BotaoReportar() {
  const { nuvem } = useAmbiente()
  const [capturando, setCapturando] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [print, setPrint] = useState<string | null>(null)

  // Trava por ref: dois cliques seguidos chegam antes do estado novo e tirariam dois prints.
  const ocupado = useRef(false)

  async function abrir() {
    if (ocupado.current) return
    ocupado.current = true
    setCapturando(true)
    navigator.vibrate?.(12)
    await depoisDePintar()
    setPrint(await capturarTela())
    setCapturando(false)
    setAberto(true)
    ocupado.current = false
  }

  return (
    <>
      {/* Violeta: a cor de "feedback" fica fora do laranja das ações (protótipo 12, opção A). */}
      <Button
        variant="ghost"
        size="sm"
        data-reportar
        className={cn(
          // Item da ilha da barra do topo: sem borda nem fundo próprios, o violeta fica no texto e no hover.
          "text-selo-opus h-7.5 rounded-full px-2.5 transition-[translate,scale,background-color,box-shadow] hover:bg-selo-opus-fundo hover:text-selo-opus active:scale-95 aria-expanded:bg-selo-opus-fundo",
          // Enquanto tira o print: anel violeta pulsando e cursor de espera, sem apagar o botão como se estivesse desligado.
          capturando && "animate-pulse cursor-wait bg-selo-opus/20 ring-3 ring-selo-opus/25 motion-reduce:animate-none",
        )}
        onClick={abrir}
        onPointerEnter={() => void carregarCaptura()}
        onFocus={() => void carregarCaptura()}
        aria-busy={capturando}
        aria-disabled={capturando}
        aria-label={capturando ? "Capturando a tela para o report" : "Reportar bug ou melhoria"}
        title="Reportar bug ou melhoria"
      >
        {capturando ? <Spinner aria-hidden="true" /> : <MessageSquareWarningIcon aria-hidden="true" />}
        <span className="max-sm:sr-only">{capturando ? "Capturando…" : "Reportar"}</span>
      </Button>
      <DialogoReport aberto={aberto} aoMudarAberto={setAberto} print={print} aoRemoverPrint={() => setPrint(null)} semNuvem={!nuvem} />
    </>
  )
}
