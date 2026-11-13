import type { Metadata } from "next"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { connection } from "next/server"

import "@workspace/ui/globals.css"
import { dadosNaNuvem, executorDoAmbiente } from "@workspace/core/sistema"
import { Toaster } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"
import { ProvedorConta } from "@/components/marca/conta-contexto"
import { FundoOndasAscii } from "@/components/marca/fundo-ondas-ascii"
import { VerificacaoSistema } from "@/components/sistema/verificacao-sistema"
import { ThemeProvider } from "@/components/theme-provider"
import { usuarioDaRequisicao } from "@/lib/sessao"

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
// Só para destaques: palavra de destaque dos títulos, nomes de etapa e números grandes. Nunca em texto corrido.
const fontSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" })

export const metadata: Metadata = { title: "Growth Cycle · Boomer" }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // O ambiente vem de variáveis lidas em tempo de execução (na nuvem só existem no contêiner, não no build): sem
  // isto uma página estática congelaria o valor do build.
  await connection()
  // Modo dev de comentários: só no next dev. Em produção a condição vira false no build e o import some.
  const ModoDev =
    process.env.NODE_ENV === "development" ? (await import("@/components/modo-dev/carregador")).CarregadorModoDev : null
  // Quem entrou e com que papel, para o menu da conta e para o que cada tela mostra. No modo off o e-mail é null
  // (a barra não mostra conta) e o papel é admin; qualquer falha vira "sem conta" e o papel mais restrito.
  const usuario = await usuarioDaRequisicao().catch(() => null)
  const email = usuario?.email ?? null
  const papel = usuario?.papel ?? "usuario"
  // Só o modo (nunca segredo): esconde na nuvem o que só faz sentido na máquina do analista.
  const ambiente = { executor: executorDoAmbiente(process.env), nuvem: dadosNaNuvem(process.env) }
  return (
    <html lang="pt-BR" suppressHydrationWarning className={cn("antialiased", fontSans.variable, fontMono.variable, fontSerif.variable, "font-sans")}>
      <body>
        <ThemeProvider>
          <FundoOndasAscii />
          <ProvedorConta email={email} papel={papel} ambiente={ambiente}>{children}</ProvedorConta>
          <VerificacaoSistema />
          <Toaster />
          {ModoDev && <ModoDev />}
        </ThemeProvider>
      </body>
    </html>
  )
}
