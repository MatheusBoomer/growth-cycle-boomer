"use client"

import { PaperclipIcon, SendIcon, SquareIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import type { EtapaId } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { api, mensagemDeErro } from "@/lib/api"

export function Compositor({
  slug,
  etapa,
  desabilitado,
  motivo,
  ativoAqui,
}: {
  slug: string
  etapa: EtapaId
  desabilitado: boolean
  motivo: string | null
  ativoAqui: boolean
}) {
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [anexando, setAnexando] = useState(false)
  const entradaArquivo = useRef<HTMLInputElement>(null)

  async function enviar() {
    const limpo = texto.trim()
    if (!limpo) return
    setEnviando(true)
    try {
      await api.enviarMensagem(slug, etapa, limpo)
      setTexto("")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  async function anexar(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setAnexando(true)
    try {
      for (const arquivo of Array.from(arquivos)) {
        const { caminho } = await api.enviarAnexo(slug, etapa, arquivo)
        setTexto((t) => `${t}${t ? "\n" : ""}[Anexo: ${caminho}]`)
      }
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setAnexando(false)
      if (entradaArquivo.current) entradaArquivo.current.value = ""
    }
  }

  return (
    <div className="border-t p-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {motivo && <p className="text-muted-foreground text-xs">{motivo}</p>}
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (!desabilitado && !enviando) void enviar()
            }
          }}
          placeholder="Escreva para o agente… (Enter envia, Shift+Enter quebra linha)"
          disabled={desabilitado}
          rows={3}
          aria-label="Mensagem para o agente"
        />
        <div className="flex items-center gap-2">
          <input ref={entradaArquivo} type="file" multiple hidden onChange={(e) => void anexar(e.target.files)} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Anexar arquivo"
            disabled={desabilitado || anexando}
            onClick={() => entradaArquivo.current?.click()}
          >
            {anexando ? <Spinner /> : <PaperclipIcon />}
          </Button>
          {ativoAqui ? (
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => api.acaoEtapa(slug, etapa, "parar").catch((e) => toast.error(mensagemDeErro(e)))}
            >
              <SquareIcon /> Parar
            </Button>
          ) : (
            <Button className="ml-auto" onClick={() => void enviar()} disabled={desabilitado || enviando || !texto.trim()}>
              {enviando ? <Spinner /> : <SendIcon />} Enviar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
