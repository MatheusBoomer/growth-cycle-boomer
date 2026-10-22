"use client"

import { FileIcon, PaperclipIcon, PanelRightOpenIcon, SendIcon, SquareIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { EtapaId } from "@workspace/core/tipos"
import { AttachmentGroup } from "@workspace/ui/components/attachment"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { api, mensagemDeErro, type AjusteMensagem } from "@/lib/api"
import { renderizarAnotada } from "@/lib/anotacoes-canvas"
import { separadorAntes } from "@/lib/citacao"
import { consultaDeMencao, textoParaAgente } from "@/lib/mencoes"
import { descartarSuperadas, numerar } from "@/lib/referencias"
import { faixaDeMarcacoes } from "@/lib/anotacoes"
import { useReferencias } from "./contexto-referencias"
import { EtiquetaAnexo, iconeDoTipo } from "./etiqueta-anexo"

const MAX_SUGESTOES = 8

interface AnexoCompositor {
  id: number
  nome: string
  caminho: string | null
  estado: "uploading" | "done" | "error"
  erro: string | null
}

export function Compositor({
  slug,
  etapa,
  pendentes,
  desabilitado,
  motivo,
  ativoAqui,
}: {
  slug: string
  etapa: EtapaId
  /** Entregáveis da etapa que aguardam aprovação: referência a um que saiu daqui é de uma versão superada. */
  pendentes: string[]
  desabilitado: boolean
  motivo: string | null
  ativoAqui: boolean
}) {
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [anexos, setAnexos] = useState<AnexoCompositor[]>([])
  const proximoAnexo = useRef(0)
  const [arrastando, setArrastando] = useState(false)
  const subindo = anexos.some((a) => a.estado === "uploading")
  const prontos = anexos.filter((a) => a.estado === "done" && a.caminho).map((a) => a.caminho!)
  const entradaArquivo = useRef<HTMLInputElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const { registrarCompositor, abrirArquivo } = useVisualizador()
  // Shift pressionado com a lista do @ aberta = modo consulta: o arquivo abre na lateral em vez de ser mencionado.
  const [shift, setShift] = useState(false)
  const [arquivos, setArquivos] = useState<string[] | null>(null)
  const [consulta, setConsulta] = useState<{ inicio: number; termo: string } | null>(null)
  const [destaque, setDestaque] = useState(0)
  const ref = useReferencias(etapa)
  const numeracao = numerar(ref.referencias)
  const comReferencia = ref.referencias.length > 0
  const chavePendentes = pendentes.join("|")
  const totalReferencias = ref.referencias.length

  // Nova versão do agente: as marcações antigas eram da imagem anterior. O texto digitado fica como está.
  useEffect(() => {
    const r = descartarSuperadas(ref.referencias, chavePendentes ? chavePendentes.split("|") : [])
    if (r.descartadas === 0) return
    ref.substituir(r.lista)
    toast.info("A versão mudou; as marcações antigas foram descartadas")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage só à lista de pendentes e às referências
  }, [chavePendentes, ref.referencias])

  // Uma referência nova leva o foco para a caixa de mensagem.
  const anterior = useRef(0)
  useEffect(() => {
    if (totalReferencias > anterior.current) campo.current?.focus()
    anterior.current = totalReferencias
  }, [totalReferencias])

  // Referência não enviada se perde ao recarregar: o navegador avisa antes de sair.
  useEffect(() => {
    if (!comReferencia) return
    const avisar = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener("beforeunload", avisar)
    return () => window.removeEventListener("beforeunload", avisar)
  }, [comReferencia])

  // O botão "Mencionar no chat" (cards e visualizador) insere a menção na posição do cursor.
  useEffect(() => {
    registrarCompositor((trecho) => {
      const el = campo.current
      setTexto((atual) => {
        const pos = el && document.activeElement === el ? el.selectionStart : atual.length
        const antes = atual.slice(0, pos)
        const separador = separadorAntes(antes, trecho)
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
    if (!limpo && (comReferencia || prontos.length === 0)) return
    setEnviando(true)
    try {
      const ajustes: AjusteMensagem[] = await Promise.all(
        ref.referencias.map(async (r, i) => ({
          entregavelId: r.entregavelId,
          marcas: r.marcas.map(({ forma, x, y, w, h }) => ({ forma, x, y, w, h })),
          imagem: r.urlImagem && r.marcas.length > 0 ? await renderizarAnotada(r.urlImagem, r.marcas, numeracao[i]!.primeira) : undefined,
        })),
      )
      await api.enviarMensagem(slug, etapa, textoParaAgente(limpo, slug, prontos), ajustes.length > 0 ? ajustes : undefined)
      setTexto("")
      setAnexos([])
      ref.limpar()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  async function anexar(lista: FileList | File[] | null) {
    const arquivos = lista ? Array.from(lista) : []
    if (entradaArquivo.current) entradaArquivo.current.value = ""
    await Promise.all(
      arquivos.map(async (arquivo) => {
        const id = ++proximoAnexo.current
        setAnexos((a) => [...a, { id, nome: arquivo.name, caminho: null, estado: "uploading", erro: null }])
        try {
          const { caminho } = await api.enviarAnexo(slug, etapa, arquivo)
          setAnexos((a) => a.map((x) => (x.id === id ? { ...x, caminho, estado: "done" } : x)))
        } catch (e) {
          setAnexos((a) => a.map((x) => (x.id === id ? { ...x, estado: "error", erro: mensagemDeErro(e) } : x)))
        }
      }),
    )
  }

  // Com referência de ajuste, a mensagem em branco fica bloqueada: a conversa é o ponto.
  const podeEnviar = !desabilitado && !enviando && !subindo && (texto.trim() !== "" || (!comReferencia && prontos.length > 0))

  return (
    <div className="border-t p-3">
      <div
        className={cn(
          "mx-auto flex max-w-3xl flex-col gap-2 rounded-lg transition-shadow",
          arrastando && "ring-primary/50 ring-2 ring-offset-4 ring-offset-background",
        )}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          if (!desabilitado) setArrastando(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false)
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          setArrastando(false)
          if (!desabilitado) void anexar(e.dataTransfer.files)
        }}
      >
        {motivo && <p className="text-muted-foreground text-xs">{motivo}</p>}
        {comReferencia && (
          <AttachmentGroup>
            {ref.referencias.map((r, i) => (
              <EtiquetaAnexo
                key={r.entregavelId}
                nome={r.titulo}
                icone={iconeDoTipo(r.tipo)}
                detalhe={faixaDeMarcacoes(numeracao[i]!.primeira, numeracao[i]!.quantidade) || "ajuste pedido"}
                aoRemover={() => ref.remover(r.entregavelId)}
                aoAbrir={r.urlImagem ? () => ref.iniciarMarcacao(r.entregavelId) : undefined}
              />
            ))}
          </AttachmentGroup>
        )}
        {comReferencia && texto.trim() === "" && (
          <p className="text-muted-foreground text-xs">Escreva o que mudar para enviar. Para marcações, cite o número: “1: eixo X em meses por extenso”.</p>
        )}
        {anexos.length > 0 && (
          <AttachmentGroup>
            {anexos.map((a) => (
              <EtiquetaAnexo
                key={a.id}
                nome={a.nome}
                estado={a.estado}
                erro={a.erro}
                aoRemover={() => setAnexos((lista) => lista.filter((x) => x.id !== a.id))}
              />
            ))}
          </AttachmentGroup>
        )}
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
                      i === destaque && (shift ? "bg-primary/15 text-link-acao" : "bg-muted"),
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
                  <span className="text-link-acao font-medium">Abrir na lateral para consultar · solte o Shift para mencionar</span>
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
          onPaste={(e) => {
            const arquivos = Array.from(e.clipboardData.files)
            // Colar de planilha/Word traz texto e uma imagem: com texto, deixa a colagem normal acontecer.
            if (arquivos.length === 0 || desabilitado || e.clipboardData.getData("text/plain") !== "") return
            e.preventDefault()
            void anexar(arquivos)
          }}
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
              if (podeEnviar) void enviar()
            }
          }}
          placeholder="Escreva para o agente… (@ menciona um arquivo, arraste ou cole para anexar, Enter envia)"
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
            disabled={desabilitado}
            onClick={() => entradaArquivo.current?.click()}
          >
            <PaperclipIcon />
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
            <Button className="ml-auto" onClick={() => void enviar()} disabled={!podeEnviar}>
              {enviando ? <Spinner /> : <SendIcon />} Enviar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
