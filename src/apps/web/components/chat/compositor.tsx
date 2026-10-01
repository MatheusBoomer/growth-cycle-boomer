"use client"

import { FileIcon, PaperclipIcon, PanelRightOpenIcon, SendIcon, SquareIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { EtapaId } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { api, mensagemDeErro } from "@/lib/api"
import { consultaDeMencao, textoParaAgente } from "@/lib/mencoes"

const MAX_SUGESTOES = 8

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
  const campo = useRef<HTMLTextAreaElement>(null)
  const { registrarCompositor, abrirArquivo } = useVisualizador()
  // Shift pressionado com a lista do @ aberta = modo consulta: o arquivo abre na lateral em vez de ser mencionado.
  const [shift, setShift] = useState(false)
  const [arquivos, setArquivos] = useState<string[] | null>(null)
  const [consulta, setConsulta] = useState<{ inicio: number; termo: string } | null>(null)
  const [destaque, setDestaque] = useState(0)

  // O botão "Mencionar no chat" (cards e visualizador) insere a menção na posição do cursor.
  useEffect(() => {
    registrarCompositor((trecho) => {
      const el = campo.current
      setTexto((atual) => {
        const pos = el && document.activeElement === el ? el.selectionStart : atual.length
        const antes = atual.slice(0, pos)
        const separador = antes && !/\s$/.test(antes) ? " " : ""
        return `${antes}${separador}${trecho}${atual.slice(pos)}`
      })
      el?.focus()
    })
    return () => registrarCompositor(null)
  }, [registrarCompositor])

  const sugestoes =
    consulta && arquivos
      ? arquivos.filter((c) => c.toLowerCase().includes(consulta.termo.toLowerCase())).slice(0, MAX_SUGESTOES)
      : []
  const listaAberta = consulta !== null && sugestoes.length > 0

  useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => setShift(ev.shiftKey)
    const soltar = () => setShift(false)
    window.addEventListener("keydown", aoTeclar)
    window.addEventListener("keyup", aoTeclar)
    window.addEventListener("blur", soltar)
    return () => {
      window.removeEventListener("keydown", aoTeclar)
      window.removeEventListener("keyup", aoTeclar)
      window.removeEventListener("blur", soltar)
    }
  }, [])

  /** Abre o arquivo na janela embaixo do painel sem mencionar; a lista e o que foi digitado continuam. */
  function consultar(caminho: string) {
    abrirArquivo(caminho)
    campo.current?.focus()
  }

  function atualizarConsulta(valor: string, cursor: number) {
    const c = consultaDeMencao(valor, cursor)
    setConsulta(c)
    setDestaque(0)
    if (c && arquivos === null) {
      setArquivos([])
      api
        .listarArquivos(slug)
        .then((r) => setArquivos(r.arquivos.map((a) => a.caminho)))
        .catch(() => setArquivos(null))
    }
  }

  function escolher(caminho: string) {
    if (!consulta) return
    const el = campo.current
    const fim = el ? el.selectionStart : consulta.inicio + 1 + consulta.termo.length
    const novo = `${texto.slice(0, consulta.inicio)}@${caminho} ${texto.slice(fim)}`
    const cursor = consulta.inicio + caminho.length + 2
    setTexto(novo)
    setConsulta(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(cursor, cursor)
    })
  }

  async function enviar() {
    const limpo = texto.trim()
    if (!limpo) return
    setEnviando(true)
    try {
      await api.enviarMensagem(slug, etapa, textoParaAgente(limpo, slug))
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
        <div className="relative">
          {listaAberta && (
            <ul
              role="listbox"
              aria-label={shift ? "Arquivos para abrir na lateral" : "Arquivos para mencionar"}
              data-modo={shift ? "consulta" : "mencao"}
              className={cn(
                "bg-popover text-popover-foreground absolute bottom-full left-0 z-20 mb-1 max-h-72 w-full overflow-y-auto rounded-md border p-1 shadow-md",
                shift && "border-primary ring-primary/30 ring-2",
              )}
            >
              {sugestoes.map((c, i) => (
                <li key={c} role="option" aria-selected={i === destaque}>
                  <button
                    type="button"
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      if (ev.shiftKey) consultar(c)
                      else escolher(c)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm",
                      i === destaque && (shift ? "bg-primary/15 text-primary" : "bg-muted"),
                    )}
                  >
                    {shift ? (
                      <PanelRightOpenIcon className="text-primary size-3.5 shrink-0" />
                    ) : (
                      <FileIcon className="text-muted-foreground size-3.5 shrink-0" />
                    )}
                    <span className="truncate font-medium">{c.split("/").pop()}</span>
                    <span className="text-muted-foreground ml-auto truncate text-xs">{c.split("/").slice(0, -1).join("/")}</span>
                  </button>
                </li>
              ))}
              <li role="presentation" className="text-muted-foreground mt-1 border-t px-2 pt-1 pb-0.5 text-[11px]">
                {shift ? (
                  <span className="text-primary font-medium">Abrir na lateral para consultar · solte o Shift para mencionar</span>
                ) : (
                  "Enter menciona · segure Shift para abrir na lateral"
                )}
              </li>
            </ul>
          )}
        <Textarea
          ref={campo}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            atualizarConsulta(e.target.value, e.target.selectionStart)
          }}
          onBlur={() => setConsulta(null)}
          onKeyDown={(e) => {
            if (listaAberta) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                const passo = e.key === "ArrowDown" ? 1 : -1
                setDestaque((d) => (d + passo + sugestoes.length) % sugestoes.length)
                return
              }
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault()
                consultar(sugestoes[destaque]!)
                return
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault()
                escolher(sugestoes[destaque]!)
                return
              }
              if (e.key === "Escape") {
                e.preventDefault()
                setConsulta(null)
                return
              }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (!desabilitado && !enviando) void enviar()
            }
          }}
          placeholder="Escreva para o agente… (@ menciona um arquivo, Enter envia, Shift+Enter quebra linha)"
          disabled={desabilitado}
          rows={3}
          aria-label="Mensagem para o agente"
        />
        </div>
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
