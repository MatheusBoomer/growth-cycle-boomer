"use client"

import { DownloadIcon, Maximize2Icon, MessageSquarePlusIcon, Minimize2Icon, SendIcon, Trash2Icon, XIcon } from "lucide-react"
import { useCallback, useEffect, useState, type PointerEvent as EventoPonteiro } from "react"
import { toast } from "sonner"
import type { Comentario, MapaPrevia, Regiao } from "@workspace/core/comentarios"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { regiaoDoArraste, type Ponto } from "@/lib/regiao"

type Previa = { disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }
type Rascunho = { slide: number; regiao: Regiao | null }

const pct = (r: Regiao) => ({ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` })

/** Apresentação em imagens de slide, com comentários por slide e por região (arrastar sobre o slide). */
export function VisualizadorApresentacao({
  slug,
  entregavel,
  telaCheia,
  aoAlternarTelaCheia,
  aoFechar,
}: {
  slug: string
  entregavel: Entregavel | null
  telaCheia: boolean
  aoAlternarTelaCheia: () => void
  aoFechar: () => void
}) {
  const id = entregavel?.id ?? null
  const [previa, setPrevia] = useState<{ id: string; dados: Previa | null } | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [texto, setTexto] = useState("")
  const [arraste, setArraste] = useState<{ slide: number; inicio: Ponto; atual: Ponto; caixa: DOMRect } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const pendentes = comentarios.filter((c) => !c.enviadoEm)
  const enviados = comentarios.filter((c) => c.enviadoEm)
  const podeComentar = entregavel?.status === "pendente"
  const dados = previa && previa.id === id ? previa.dados : undefined

  const recarregarComentarios = useCallback(async () => {
    if (!id) return
    try {
      setComentarios((await api.comentarios(slug, id)).comentarios)
    } catch {
      // sem comentários ainda
    }
  }, [slug, id])

  useEffect(() => {
    if (!id) return
    let ativo = true
    void api
      .previa(slug, id)
      .then((d) => ativo && setPrevia({ id, dados: d }))
      .catch((e) => ativo && setPrevia({ id, dados: { disponivel: false, slides: [], mapa: null, erro: mensagemDeErro(e) } }))
    void api
      .comentarios(slug, id)
      .then((r) => ativo && setComentarios(r.comentarios))
      .catch(() => ativo && setComentarios([]))
    return () => {
      ativo = false
    }
  }, [slug, id])

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || alvoDeDigitacao(document.activeElement as HTMLElement | null)) return
      if (telaCheia) aoAlternarTelaCheia()
      else aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [telaCheia, aoAlternarTelaCheia, aoFechar])

  function iniciarArraste(slide: number, ev: EventoPonteiro<HTMLDivElement>) {
    if (!podeComentar || ev.button !== 0) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const p = { x: ev.clientX, y: ev.clientY }
    setArraste({ slide, inicio: p, atual: p, caixa: ev.currentTarget.getBoundingClientRect() })
  }

  function terminarArraste() {
    if (!arraste) return
    const regiao = regiaoDoArraste(arraste.inicio, arraste.atual, arraste.caixa)
    setArraste(null)
    if (regiao) {
      setRascunho({ slide: arraste.slide, regiao })
      setTexto("")
    }
  }

  async function salvar() {
    if (!id || !rascunho || !texto.trim()) return
    setOcupado(true)
    try {
      await api.comentar(slug, id, { ...rascunho, texto })
      setRascunho(null)
      setTexto("")
      await recarregarComentarios()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  async function apagar(cid: string) {
    if (!id) return
    try {
      await api.apagarComentario(slug, id, cid)
      await recarregarComentarios()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    }
  }

  async function enviar() {
    if (!id) return
    setOcupado(true)
    try {
      const { enviados: n } = await api.enviarComentarios(slug, id)
      toast.success(n === 1 ? "1 ajuste enviado ao agente." : `${n} ajustes enviados ao agente.`)
      await recarregarComentarios()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  const numeroDe = (c: Comentario) => pendentes.indexOf(c) + 1
  const regiaoAoVivo = arraste ? regiaoDoArraste(arraste.inicio, arraste.atual, arraste.caixa) : null

  return (
    <section className="bg-background flex h-full min-h-0 flex-col" aria-label="Visualizador da apresentação">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="truncate text-sm font-medium">{entregavel?.titulo ?? "Apresentação"}</h2>
        {entregavel && (
          <Badge variant={entregavel.status === "aprovado" ? "default" : "outline"}>{ROTULO_STATUS_ENTREGAVEL[entregavel.status]}</Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {entregavel && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Baixar .pptx"
              title="Baixar .pptx"
              render={<a href={urlArquivo(slug, entregavel.arquivoRascunho, true)} download />}
              nativeButton={false}
            >
              <DownloadIcon />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={aoAlternarTelaCheia}>
            {telaCheia ? <Minimize2Icon /> : <Maximize2Icon />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
      </header>

      {!entregavel ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Apresentação indisponível</EmptyTitle>
            <EmptyDescription>Esta versão não está mais entre os entregáveis da etapa.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : dados === undefined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm">
          <Spinner />
          <span className="text-muted-foreground">Gerando a prévia dos slides…</span>
        </div>
      ) : dados === null || !dados.disponivel ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Prévia indisponível</EmptyTitle>
            <EmptyDescription>{dados?.erro ?? "Não consegui gerar a prévia."} Baixe o .pptx e abra no Google Slides.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {dados.slides.map((caminho, i) => {
              const numero = i + 1
              const doSlide = pendentes.filter((c) => c.slide === numero)
              return (
                <li key={caminho} className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span className="font-mono">{numero}</span>
                    <span className="truncate">{dados.mapa?.slides[i]?.titulo}</span>
                    {podeComentar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 px-2 text-xs"
                        onClick={() => {
                          setRascunho({ slide: numero, regiao: null })
                          setTexto("")
                        }}
                      >
                        <MessageSquarePlusIcon /> Comentar slide
                      </Button>
                    )}
                  </div>
                  <div
                    className={cn("relative select-none", podeComentar && "cursor-crosshair")}
                    onPointerDown={(ev) => iniciarArraste(numero, ev)}
                    onPointerMove={(ev) => arraste && setArraste({ ...arraste, atual: { x: ev.clientX, y: ev.clientY } })}
                    onPointerUp={terminarArraste}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
                    <img src={urlArquivo(slug, caminho)} alt={`Slide ${numero}`} draggable={false} className="w-full rounded-md border" />
                    {doSlide.map((c) =>
                      c.regiao ? (
                        <div key={c.id} className="border-primary bg-primary/10 pointer-events-none absolute rounded-sm border-2" style={pct(c.regiao)}>
                          <span className="bg-primary text-primary-foreground absolute -top-3 -left-3 flex size-6 items-center justify-center rounded-full text-xs font-medium">
                            {numeroDe(c)}
                          </span>
                        </div>
                      ) : (
                        <span
                          key={c.id}
                          className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-xs font-medium"
                        >
                          {numeroDe(c)}
                        </span>
                      ),
                    )}
                    {arraste?.slide === numero && regiaoAoVivo && (
                      <div className="border-primary pointer-events-none absolute border-2 border-dashed" style={pct(regiaoAoVivo)} />
                    )}
                    {rascunho?.slide === numero && rascunho.regiao && (
                      <div className="border-primary pointer-events-none absolute border-2 border-dashed" style={pct(rascunho.regiao)} />
                    )}
                  </div>
                  {rascunho?.slide === numero && (
                    <div className="space-y-2 rounded-md border p-2">
                      <p className="text-muted-foreground text-xs">
                        {rascunho.regiao ? "Comentário sobre a área marcada" : "Comentário sobre o slide inteiro"}
                      </p>
                      <Textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que está errado ou pode melhorar?" rows={2} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={salvar} disabled={!texto.trim() || ocupado}>
                          Adicionar comentário
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRascunho(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <aside className="flex w-72 shrink-0 flex-col border-l">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Comentários</h3>
              {pendentes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {podeComentar ? "Arraste sobre um slide para marcar uma área, ou use Comentar slide." : "Esta versão não aceita mais comentários."}
                </p>
              ) : (
                <ol className="space-y-2">
                  {pendentes.map((c) => (
                    <li key={c.id} className="rounded-md border p-2 text-sm">
                      <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
                        <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full">{numeroDe(c)}</span>
                        Slide {c.slide} · {c.regiao ? (c.campo ?? "área marcada") : "slide inteiro"}
                        <Button variant="ghost" size="icon-sm" className="ml-auto size-6" aria-label="Apagar comentário" onClick={() => apagar(c.id)}>
                          <Trash2Icon />
                        </Button>
                      </div>
                      {c.texto}
                    </li>
                  ))}
                </ol>
              )}
              {enviados.length > 0 && (
                <details className="text-muted-foreground text-xs">
                  <summary className="cursor-pointer">Enviados ao agente ({enviados.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {enviados.map((c) => (
                      <li key={c.id}>
                        Slide {c.slide}: {c.texto}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            {podeComentar && (
              <div className="border-t p-3">
                <Button className="w-full" onClick={enviar} disabled={pendentes.length === 0 || ocupado}>
                  {ocupado ? <Spinner /> : <SendIcon />} Enviar {pendentes.length || ""} {pendentes.length === 1 ? "ajuste" : "ajustes"} ao agente
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
