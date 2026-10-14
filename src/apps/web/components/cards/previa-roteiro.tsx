"use client"

import { MessageSquareIcon, SendIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { Comentario } from "@workspace/core/comentarios"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { useVisualizador } from "@/components/trabalho/contexto-visualizador"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { resumoDoSlide, type SlideRoteiro } from "@/lib/roteiro"

/**
 * Roteiro da apresentação, um bloco por slide: tipo, título, miniaturas e conclusões.
 * Com `podeComentar`, cada slide ganha "Comentar" e os comentários vão juntos ao agente.
 */
export function PreviaRoteiro({
  slug,
  caminho,
  entregavelId,
  podeComentar = false,
}: {
  slug: string
  caminho: string
  entregavelId?: string
  podeComentar?: boolean
}) {
  const url = urlArquivo(slug, caminho)
  const [carregado, setCarregado] = useState<{ url: string; slides: SlideRoteiro[] | null } | null>(null)
  const [comentarios, setComentarios] = useState<{ id: string; lista: Comentario[] } | null>(null)
  const [abertoEm, setAbertoEm] = useState<number | null>(null)
  const [texto, setTexto] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const { abrirArquivo } = useVisualizador()
  const slides = carregado?.url === url ? carregado.slides : undefined
  const comentaveis = podeComentar && entregavelId ? entregavelId : null
  const pendentes = comentarios && comentarios.id === comentaveis ? comentarios.lista.filter((c) => !c.enviadoEm) : []

  useEffect(() => {
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { slides?: SlideRoteiro[] } | null) => ativo && setCarregado({ url, slides: Array.isArray(j?.slides) ? j.slides : null }))
      .catch(() => ativo && setCarregado({ url, slides: null }))
    return () => {
      ativo = false
    }
  }, [url])

  useEffect(() => {
    if (!comentaveis) return
    let ativo = true
    void api
      .comentarios(slug, comentaveis)
      .then((r) => ativo && setComentarios({ id: comentaveis, lista: r.comentarios }))
      .catch(() => ativo && setComentarios({ id: comentaveis, lista: [] }))
    return () => {
      ativo = false
    }
  }, [slug, comentaveis])

  async function recarregar(id: string) {
    setComentarios({ id, lista: (await api.comentarios(slug, id)).comentarios })
  }

  async function executar(acao: (id: string) => Promise<unknown>) {
    if (!comentaveis) return
    setOcupado(true)
    try {
      await acao(comentaveis)
      await recarregar(comentaveis)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  const comentar = (slide: number) =>
    executar(async (id) => {
      await api.comentar(slug, id, { slide, regiao: null, texto })
      setAbertoEm(null)
      setTexto("")
    })
  const apagar = (cid: string) => executar((id) => api.apagarComentario(slug, id, cid))
  const enviar = () =>
    executar(async (id) => {
      const { enviados } = await api.enviarComentarios(slug, id)
      toast.success(enviados === 1 ? "1 ajuste enviado ao agente." : `${enviados} ajustes enviados ao agente.`)
    })

  if (slides === undefined) return <Skeleton className="h-40 w-full" />
  if (slides === null) return <p className="text-destructive text-sm">Não consegui ler o roteiro.</p>
  return (
    <div className="space-y-2">
      <ol className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {slides.map((s, i) => {
          const r = resumoDoSlide(s)
          const numero = i + 1
          return (
            <li key={i} className={`rounded-md border p-2 text-sm ${s.pendencia ? "border-aviso/60 bg-aviso-fundo" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs">{numero}</span>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {s.tipo}
                </Badge>
                <span className="truncate font-medium">{r.titulo}</span>
              </div>
              {s.pendencia ? (
                <p className="mt-1 ml-8 text-xs text-aviso">Pendência: {s.pendencia}</p>
              ) : (
                <div className="mt-1 ml-8 flex gap-2">
                  {r.imagens.map((img) => (
                    <button key={img} type="button" onClick={() => abrirArquivo(img)} className="shrink-0" title={img}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
                      <img src={urlArquivo(slug, img)} alt="" className="h-14 w-auto rounded border bg-papel" />
                    </button>
                  ))}
                  {r.linhas.length > 0 && (
                    <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
                      {r.linhas.map((l, j) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {typeof s.fonte === "string" && <p className="text-muted-foreground mt-1 ml-8 font-mono text-[10px]">fonte: {s.fonte}</p>}
              {comentaveis && (
                <div className="mt-1 ml-8 space-y-1">
                  {pendentes
                    .filter((c) => c.slide === numero)
                    .map((c) => (
                      <p key={c.id} className="text-link-acao flex items-center gap-1 text-xs">
                        <MessageSquareIcon className="size-3 shrink-0" /> {c.texto}
                        <button type="button" className="text-muted-foreground ml-1 hover:underline" onClick={() => apagar(c.id)} disabled={ocupado}>
                          apagar
                        </button>
                      </p>
                    ))}
                  {abertoEm === numero ? (
                    <div className="flex items-start gap-2">
                      <Textarea autoFocus rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que mudar neste slide?" />
                      <div className="flex flex-col gap-1">
                        <Button size="sm" onClick={() => comentar(numero)} disabled={!texto.trim() || ocupado}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAbertoEm(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-muted-foreground text-xs hover:underline"
                      onClick={() => {
                        setAbertoEm(numero)
                        setTexto("")
                      }}
                    >
                      Comentar
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {comentaveis && pendentes.length > 0 && (
        <Button size="sm" onClick={enviar} disabled={ocupado}>
          <SendIcon /> Enviar {pendentes.length} {pendentes.length === 1 ? "ajuste" : "ajustes"} ao agente
        </Button>
      )}
    </div>
  )
}
