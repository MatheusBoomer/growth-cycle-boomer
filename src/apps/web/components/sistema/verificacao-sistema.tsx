"use client"

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

interface Sistema {
  claude: { instalado: boolean; versao: string | null; logado: boolean; metodo: string | null; plano: string | null }
  python: { ok: boolean; detalhe: string | null }
  ffmpeg: boolean
  apify: boolean
  previa: boolean
}

export function VerificacaoSistema() {
  const [sistema, setSistema] = useState<Sistema | null>(null)
  const [verificando, setVerificando] = useState(false)

  const verificar = useCallback(async () => {
    setVerificando(true)
    try {
      setSistema((await (await fetch("/api/sistema", { cache: "no-store" })).json()) as Sistema)
    } finally {
      setVerificando(false)
    }
  }, [])

  useEffect(() => {
    void verificar()
  }, [verificar])

  if (!sistema) return null
  const bloqueado = !sistema.claude.instalado || !sistema.claude.logado || !sistema.python.ok
  const cobrado = sistema.claude.logado && sistema.claude.metodo !== "claude.ai"
  const faltasBenchmark = [
    !sistema.ffmpeg && "instale o ffmpeg (brew install ffmpeg)",
    !sistema.apify && "coloque o APIFY_TOKEN no arquivo .env da raiz do projeto (modelo em .env.example)",
  ].filter(Boolean) as string[]
  const semPrevia = !sistema.previa

  return (
    <>
      <Dialog open={bloqueado}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Falta configurar esta máquina</DialogTitle>
            <DialogDescription>O agente roda pelo Claude Code instalado aqui. Resolva os itens abaixo e verifique de novo.</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {!sistema.claude.instalado && (
              <li>
                Instale o Claude Code (<a className="underline" href="https://docs.claude.com/en/docs/claude-code/setup" target="_blank" rel="noreferrer">guia de instalação</a>).
              </li>
            )}
            {sistema.claude.instalado && !sistema.claude.logado && (
              <li>
                No terminal, rode <code className="font-mono">claude auth login</code> e entre com a conta da Boomer.
              </li>
            )}
            {!sistema.python.ok && (
              <li>
                Instale o Python 3 e rode <code className="font-mono">pip3 install openpyxl pandas matplotlib</code>.
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
            <Alert>
              <AlertDescription>
                O Claude Code desta máquina está autenticado por chave de API ({sistema.claude.metodo}), não pela assinatura. O uso vai ser cobrado na API.
              </AlertDescription>
            </Alert>
          )}
          {faltasBenchmark.length > 0 && (
            <Alert>
              <AlertDescription>
                Para o benchmark de anúncios (etapa 06): {faltasBenchmark.join("; ")}. As outras etapas funcionam normalmente.
              </AlertDescription>
            </Alert>
          )}
          {semPrevia && (
            <Alert>
              <AlertDescription>
                Para ver a prévia da apresentação no app, instale LibreOffice e poppler (brew install --cask libreoffice; brew install poppler). O download do .pptx funciona normalmente.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </>
  )
}
