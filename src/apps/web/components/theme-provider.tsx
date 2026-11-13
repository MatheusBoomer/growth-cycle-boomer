"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { CONFIG_TEMA } from "@/lib/tema"
import { alternarTemaJa, trocarTemaComCirculo } from "@/lib/transicao-tema"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={CONFIG_TEMA.defaultTheme}
      enableSystem={CONFIG_TEMA.enableSystem}
      themes={[...CONFIG_TEMA.themes]}
      storageKey={CONFIG_TEMA.storageKey}
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  const { setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      // Pelo teclado não há botão de origem: o círculo sai do centro da janela.
      trocarTemaComCirculo({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, () => alternarTemaJa(setTheme))
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [setTheme])

  return null
}

export { ThemeProvider }
