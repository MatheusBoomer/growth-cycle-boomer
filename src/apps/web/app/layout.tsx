import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"
import { ProvedorConta } from "@/components/marca/conta-contexto"
import { FundoBoomer } from "@/components/marca/fundo-boomer"
import { VerificacaoSistema } from "@/components/sistema/verificacao-sistema"
import { ThemeProvider } from "@/components/theme-provider"
import { usuarioDaRequisicao } from "@/lib/sessao"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = { title: "Planejamento Estratégico · Boomer" }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Modo dev de comentários: só no next dev. Em produção a condição vira false no build e o import some.
  const ModoDev =
    process.env.NODE_ENV === "development" ? (await import("@/components/modo-dev/carregador")).CarregadorModoDev : null
  // Quem entrou, para o menu da conta. No modo off é null e a barra não mostra conta; qualquer falha também.
  const email = await usuarioDaRequisicao()
    .then((u) => u?.email ?? null)
    .catch(() => null)
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}>
      <body>
        <ThemeProvider>
          <FundoBoomer />
          <ProvedorConta email={email}>{children}</ProvedorConta>
          <VerificacaoSistema />
          <Toaster />
          {ModoDev && <ModoDev />}
        </ThemeProvider>
      </body>
    </html>
  )
}
