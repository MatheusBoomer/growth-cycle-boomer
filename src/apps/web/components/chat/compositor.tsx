"use client"

import { ArrowUpIcon, AtSignIcon, FileIcon, PanelRightOpenIcon, PaperclipIcon, PlusIcon, SquareIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { EtapaId } from "@workspace/core/tipos"
import { AttachmentGroup } from "@workspace/ui/components/attachment"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { api, mensagemDeErro, type AjusteMensagem } from "@/lib/api"
import { renderizarAnotada } from "@/lib/anotacoes-canvas"
import { separadorAntes } from "@/lib/citacao"
import { textoParaPreencher, chaveDoTrecho } from "@/lib/ensaio"
import { consultaDeMencao, textoParaAgente } from "@/lib/mencoes"
import { descartarSuperadas, numerar } from "@/lib/referencias"
import { faixaDeMarcacoes, numerosDaEtiqueta } from "@/lib/anotacoes"
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
  ensaio = false,
  semTurno = false,
}: {
  slug: string
  etapa: EtapaId
  /** Entregáveis da etapa que aguardam aprovação: referência a um que saiu daqui é de uma versão superada. */
  pendentes: string[]
  desabilitado: boolean
  motivo: string | null
  ativoAqui: boolean
  /** Cliente de teste em modo ensaiado: a caixa vem preenchida com o texto do trecho gravado. */
  ensaio?: boolean
  /** Nenhum turno ativo em nenhuma etapa do prospect. */
  semTurno?: boolean
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

  // Ensaio: com a caixa vazia e sem turno, busca o trecho que vem agora e preenche o texto gravado. A memória do que já
  // foi preenchido zera quando um turno começa, então a caixa que o analista esvaziou não se enche de novo até o próximo trecho.
  const textoAtual = useRef(texto)
  textoAtual.current = texto
  const preenchido = useRef<string | null>(null)
  useEffect(() => {
    if (!semTurno) preenchido.current = null
  }, [semTurno])
  const livre = ensaio && semTurno && !desabilitado
  useEffect(() => {
    if (!livre) return
    let cancelado = false
    api
      .gatilhoEnsaio(slug, etapa)
      .then((gatilho) => {
        if (cancelado) return
        const novo = textoParaPreencher({ ensaio: true, semTurno: true, textoAtual: textoAtual.current, etapa, gatilho, jaPreenchido: preenchido.current })
        if (novo === null) return
        preenchido.current = chaveDoTrecho(etapa, novo)
        setTexto(novo)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [livre, slug, etapa])

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

  /** Põe um "@" no fim e abre a lista de arquivos, como se a pessoa tivesse digitado. */
  function abrirMencao() {
    const novo = texto === "" || texto.endsWith(" ") || texto.endsWith("\n") ? `${texto}@` : `${texto} @`
    setTexto(novo)
    atualizarConsulta(novo, novo.length)
    requestAnimationFrame(() => campo.current?.focus())
  }

  // Com referência de ajuste, a mensagem em branco fica bloqueada: a conversa é o ponto.
  const podeEnviar = !desabilitado && !enviando && !subindo && (texto.trim() !== "" || (!comReferencia && prontos.length > 0))

  return (
    <div className="group/compositor px-4 pb-3">
      <div
        className={cn(
          "border-input bg-popover/90 mx-auto flex max-w-3xl flex-col gap-1.5 rounded-[18px] border p-1.5 shadow-[0_12px_32px_-20px_rgb(0_0_0/0.45)] backdrop-blur-xl transition-[box-shadow,border-color]",
          "focus-within:border-primary/50 focus-within:ring-primary/15 focus-within:ring-4",
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
        {motivo && <p className="text-muted-foreground px-2 pt-1 text-xs">{motivo}</p>}
        {comReferencia && (
          <AttachmentGroup>
            {ref.referencias.map((r, i) => (
              <EtiquetaAnexo
                key={r.entregavelId}
                nome={r.titulo}
                icone={iconeDoTipo(r.tipo)}
                detalhe={faixaDeMarcacoes(numeracao[i]!.primeira, numeracao[i]!.quantidade) || "ajuste pedido"}
                numeros={numerosDaEtiqueta(numeracao[i]!.primeira, numeracao[i]!.quantidade)}
                aoRemover={() => ref.remover(r.entregavelId)}
                aoAbrir={r.urlImagem ? () => ref.iniciarMarcacao(r.entregavelId) : undefined}
              />
            ))}
          </AttachmentGroup>
        )}
        {comReferencia && texto.trim() === "" && (
          <p className="text-muted-foreground px-2 text-xs">Escreva o que mudar para enviar. Para marcações, cite o número: “1: eixo X em meses por extenso”.</p>
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
        <div className="relative flex items-end gap-1.5">
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
          <input ref={entradaArquivo} type="file" multiple hidden onChange={(e) => void anexar(e.target.files)} />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Anexar ou mencionar"
              disabled={desabilitado}
              className="text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground grid size-8 shrink-0 place-items-center rounded-[10px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <PlusIcon aria-hidden="true" className="size-4.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-72">
              <DropdownMenuItem onClick={() => entradaArquivo.current?.click()}>
                <PaperclipIcon aria-hidden="true" /> Anexar arquivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={abrirMencao}>
                <AtSignIcon aria-hidden="true" /> Mencionar arquivo do prospect
                <DropdownMenuShortcut>@</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            placeholder="Responda ao agente…"
            disabled={desabilitado}
            rows={1}
            aria-label="Mensagem para o agente"
            // Dentro da pílula do compositor: sem borda nem fundo próprios (o brilho do foco fica na pílula).
            className="max-h-50 min-h-8 flex-1 resize-none border-0 bg-transparent px-1 py-[5px] text-[15px] leading-[22px] shadow-none focus-visible:ring-0 md:text-[15px] dark:bg-transparent"
          />
          {ativoAqui ? (
            <Button
              variant="outline"
              aria-label="Parar"
              title="Parar o agente"
              className="size-8 shrink-0 rounded-full p-0"
              onClick={() => api.acaoEtapa(slug, etapa, "parar").catch((e) => toast.error(mensagemDeErro(e)))}
            >
              <SquareIcon className="size-3.5" />
            </Button>
          ) : (
            <Button
              aria-label="Enviar"
              title="Enviar (Enter)"
              className="bg-foreground text-background size-8 shrink-0 rounded-full p-0 shadow-none ring-0 hover:brightness-100 hover:opacity-90"
              onClick={() => void enviar()}
              disabled={!podeEnviar}
            >
              {enviando ? <Spinner /> : <ArrowUpIcon />}
            </Button>
          )}
        </div>
      </div>
      {/* Dicas de teclado só com a caixa em foco: fora dela não ocupam o texto de exemplo. */}
      <p
        aria-hidden="true"
        className="text-muted-foreground mx-auto mt-1 flex h-4 max-w-3xl gap-3 overflow-hidden px-2 text-[11px] opacity-0 transition-opacity group-focus-within/compositor:opacity-100 max-sm:hidden"
      >
        <span>Enter envia</span>
        <span>Shift+Enter quebra linha</span>
        <span>@ menciona arquivo</span>
        <span>Arraste ou cole para anexar</span>
      </p>
    </div>
  )
}
