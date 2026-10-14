"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@workspace/ui/components/button"
import { proximoTema } from "@/lib/tema"

/** Os dois ícones ficam no HTML e o CSS mostra o certo: nada pisca nem diverge na hidratação. */
export function AlternarTema() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Alternar tema claro/escuro (tecla D)"
      title="Alternar tema claro/escuro (tecla D)"
      onClick={() => setTheme(proximoTema(resolvedTheme))}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
