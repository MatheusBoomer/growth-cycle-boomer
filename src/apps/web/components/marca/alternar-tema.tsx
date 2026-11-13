"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@workspace/ui/components/button"
import { proximoTema } from "@/lib/tema"
import { aplicarTemaJa, trocarTemaComCirculo } from "@/lib/transicao-tema"

/** Os dois ícones ficam no HTML e o CSS mostra o certo: nada pisca nem diverge na hidratação. */
export function AlternarTema() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Alternar tema claro/escuro (tecla D)"
      title="Alternar tema claro/escuro (tecla D)"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const novo = proximoTema(resolvedTheme)
        trocarTemaComCirculo({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, () => aplicarTemaJa(novo, setTheme))
      }}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
