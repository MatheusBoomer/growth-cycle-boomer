import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"
import { VerificacaoSistema } from "@/components/sistema/verificacao-sistema"
import { ThemeProvider } from "@/components/theme-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = { title: "Planejamento Estratégico · Boomer" }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}>
      <body>
        <ThemeProvider>
          {children}
          <VerificacaoSistema />
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
