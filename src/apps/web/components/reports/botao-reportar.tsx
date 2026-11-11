"use client"

import { MessageSquareWarningIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { useAmbiente } from "@/components/marca/conta-contexto"
import { DialogoReport } from "./dialogo-report"

/** Print da área visível da página, como data URL PNG; null se o navegador não conseguir (o diálogo abre mesmo assim). */
async function capturarTela(): Promise<string | null> {
  try {
    const { domToPng } = await import("modern-screenshot")
    return await domToPng(document.documentElement, {
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
 * na imagem. Some quando os dados não estão na nuvem (não há onde guardar o report).
 */
export function BotaoReportar() {
  const { nuvem } = useAmbiente()
  const [capturando, setCapturando] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [print, setPrint] = useState<string | null>(null)

  if (!nuvem) return null

  async function abrir() {
    setCapturando(true)
    setPrint(await capturarTela())
    setCapturando(false)
    setAberto(true)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={abrir}
        disabled={capturando}
        aria-label="Reportar bug ou melhoria"
        title="Reportar bug ou melhoria"
      >
        <MessageSquareWarningIcon aria-hidden="true" />
        <span className="max-sm:sr-only">Reportar</span>
      </Button>
      <DialogoReport aberto={aberto} aoMudarAberto={setAberto} print={print} aoRemoverPrint={() => setPrint(null)} />
    </>
  )
}
