"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { ehPaginaDeLogin } from "@/lib/login"

interface Sistema {
  claude: { instalado: boolean; versao: string | null; logado: boolean; metodo: string | null; plano: string | null }
  python: { ok: boolean; detalhe: string | null }
  ffmpeg: boolean
  apify: boolean
  previa: boolean
  /** Ausentes numa resposta antiga: valem como modo local (cli). */
  executor?: "sdk" | "cli" | "demo"
  chaveApi?: boolean
  nuvem?: boolean
}

export function VerificacaoSistema() {
  // Em /login ninguém entrou ainda: a API responderia 401 e a tela não precisa do estado desta máquina.
  const noLogin = ehPaginaDeLogin(usePathname())
  const [sistema, setSistema] = useState<Sistema | null>(null)
  const [verificando, setVerificando] = useState(false)

  const verificar = useCallback(async () => {
    setVerificando(true)
    try {
      const resposta = await fetch("/api/sistema", { cache: "no-store" })
      // Resposta que não é de sucesso (401 sem sessão, 403, 500) não diz nada sobre esta máquina: não vira "sistema com problema".
      if (resposta.ok) setSistema((await resposta.json()) as Sistema)
    } catch {
      // sem resposta: segue sem aviso
    } finally {
      setVerificando(false)
    }
  }, [])

  useEffect(() => {
    if (!noLogin) void verificar()
  }, [noLogin, verificar])

  if (noLogin || !sistema) return null
  const nuvem = sistema.nuvem === true
  const comChaveDaApi = sistema.executor === "sdk"
  const semChave = comChaveDaApi && sistema.chaveApi !== true
  // No executor sdk não há Claude Code a instalar: só a chave da API e o Python do servidor contam.
  const bloqueado = comChaveDaApi ? semChave || !sistema.python.ok : !sistema.claude.instalado || !sistema.claude.logado || !sistema.python.ok
  const cobrado = !comChaveDaApi && sistema.claude.logado && sistema.claude.metodo !== "claude.ai"
  const faltasBenchmark = [
    !sistema.ffmpeg && (nuvem ? "o ffmpeg precisa ser configurado no servidor" : "instale o ffmpeg (brew install ffmpeg)"),
    !sistema.apify &&
      (nuvem ? "o APIFY_TOKEN precisa ser configurado no servidor" : "coloque o APIFY_TOKEN no arquivo .env da raiz do projeto (modelo em .env.example)"),
  ].filter(Boolean) as string[]
  const semPrevia = !sistema.previa

  return (
    <>
      <Dialog open={bloqueado}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Falta configurar esta máquina</DialogTitle>
            <DialogDescription>
              {comChaveDaApi
                ? "O agente roda pela API da Anthropic, a partir do servidor. Resolva os itens abaixo e verifique de novo."
                : "O agente roda pelo Claude Code instalado aqui. Resolva os itens abaixo e verifique de novo."}
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {semChave && <li>Falta a chave da API do agente (ANTHROPIC_API_KEY).</li>}
            {!comChaveDaApi && !sistema.claude.instalado && (
              <li>
                Instale o Claude Code (<a className="underline" href="https://docs.claude.com/en/docs/claude-code/setup" target="_blank" rel="noreferrer">guia de instalação</a>).
              </li>
            )}
            {!comChaveDaApi && sistema.claude.instalado && !sistema.claude.logado && (
              <li>
                No terminal, rode <code className="font-mono">claude auth login</code> e entre com a conta da Boomer.
              </li>
            )}
            {!sistema.python.ok && (
              <li>
                {nuvem ? (
                  "O Python 3 com openpyxl, pandas e matplotlib precisa estar disponível no servidor."
                ) : (
                  <>
                    Instale o Python 3 e rode <code className="font-mono">pip3 install openpyxl pandas matplotlib</code>.
                  </>
                )}
              </li>
            )}
          </ol>
          <DialogFooter>
            <Button onClick={verificar} disabled={verificando}>
              Verificar de novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {(cobrado || faltasBenchmark.length > 0 || semPrevia) && (
        <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
          {cobrado && (
            <Alert className="bg-popover text-popover-foreground shadow-(--sombra-card)">
              <AlertDescription>
                O Claude Code desta máquina está autenticado por chave de API ({sistema.claude.metodo}), não pela assinatura. O uso vai ser cobrado na API.
              </AlertDescription>
            </Alert>
          )}
          {faltasBenchmark.length > 0 && (
            <Alert className="bg-popover text-popover-foreground shadow-(--sombra-card)">
              <AlertDescription>
                Para o benchmark de anúncios (etapa 07): {faltasBenchmark.join("; ")}. As outras etapas funcionam normalmente.
              </AlertDescription>
            </Alert>
          )}
          {semPrevia && (
            <Alert className="bg-popover text-popover-foreground shadow-(--sombra-card)">
              <AlertDescription>
                {nuvem
                  ? "A prévia da apresentação no app precisa de LibreOffice e poppler configurados no servidor. O download do .pptx funciona normalmente."
                  : "Para ver a prévia da apresentação no app, instale LibreOffice e poppler (brew install --cask libreoffice; brew install poppler). O download do .pptx funciona normalmente."}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </>
  )
}
