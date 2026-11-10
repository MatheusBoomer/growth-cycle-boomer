"use client"

import { MessageSquareIcon, PanelRightOpenIcon, SendIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Comentario } from "@workspace/core/comentarios"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { compararRoteiros, resumoDoSlide, type SlideComparado, type SlideRemovido, type SlideRoteiro } from "@/lib/roteiro"
import { ModalRoteiro } from "./modal-roteiro"
import { DiferencasDoSlide, EtiquetaMudanca } from "./mudancas-roteiro"

type ItemDaLista = { tipo: "slide"; s: SlideComparado } | { tipo: "removido"; r: SlideRemovido }

/**
 * Roteiro da apresentação, um bloco por slide: tipo, título, miniaturas e conclusões.
 * Com `caminhoAnterior` (versão anterior do roteiro), lista só o que mudou, com "Ver roteiro completo" para ver tudo.
 * "Ver slide a slide" abre o roteiro inteiro em tamanho grande.
 * Com `podeComentar`, cada slide ganha "Comentar" e os comentários vão juntos ao agente.
 */
export function PreviaRoteiro({
  slug,
  caminho,
  caminhoAnterior,
  entregavelId,
  podeComentar = false,
}: {
  slug: string
  caminho: string
  caminhoAnterior?: string
  entregavelId?: string
  podeComentar?: boolean
}) {
  const url = urlArquivo(slug, caminho)
  const [carregado, setCarregado] = useState<{ url: string; slides: SlideRoteiro[] | null } | null>(null)
  const [comentarios, setComentarios] = useState<{ id: string; lista: Comentario[] } | null>(null)
  const [abertoEm, setAbertoEm] = useState<number | null>(null)
  const [texto, setTexto] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [modal, setModal] = useState<number | null>(null)
  const [verTudo, setVerTudo] = useState(false)
  const urlAnterior = caminhoAnterior ? urlArquivo(slug, caminhoAnterior) : null
  const [anterior, setAnterior] = useState<{ url: string; slides: SlideRoteiro[] | null } | null>(null)
  const slides = carregado?.url === url ? carregado.slides : undefined
  const slidesAnteriores = urlAnterior && anterior?.url === urlAnterior ? anterior.slides : null
  const comparacao = useMemo(() => (slides && slidesAnteriores ? compararRoteiros(slidesAnteriores, slides) : null), [slides, slidesAnteriores])
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
    if (!urlAnterior) return
    let ativo = true
    void fetch(urlAnterior, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { slides?: SlideRoteiro[] } | null) => ativo && setAnterior({ url: urlAnterior, slides: Array.isArray(j?.slides) ? j.slides : null }))
      .catch(() => ativo && setAnterior({ url: urlAnterior, slides: null }))
    return () => {
      ativo = false
    }
  }, [urlAnterior])

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

  // Carregando também a versão anterior, para a lista já nascer só com o que mudou.
  if (slides === undefined || (urlAnterior && anterior?.url !== urlAnterior)) return <Skeleton className="h-40 w-full" />
  if (slides === null) return <p className="text-destructive text-sm">Não consegui ler o roteiro.</p>

  const base: SlideComparado[] = comparacao?.slides ?? slides.map((slide, i) => ({ slide, numero: i + 1, status: "igual", diferencas: [] }))
  const removidos = comparacao?.removidos ?? []
  const soMudancas = comparacao !== null && !verTudo
  const itens: ItemDaLista[] = [
    ...removidos.filter((r) => r.depoisDoNumero === 0).map((r): ItemDaLista => ({ tipo: "removido", r })),
    ...base.flatMap((s): ItemDaLista[] => [
      ...(soMudancas && s.status === "igual" ? [] : [{ tipo: "slide" as const, s }]),
      ...removidos.filter((r) => r.depoisDoNumero === s.numero).map((r): ItemDaLista => ({ tipo: "removido", r })),
    ]),
  ]

  // Com o roteiro comparado, o modal abre direto no primeiro slide que mudou.
  const primeiroDoModal = Math.max(0, comparacao ? comparacao.slides.findIndex((s) => s.status !== "igual") : 0)

  const blocoComentarios = (numero: number) =>
    comentaveis ? (
      <div className="space-y-1">
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
    ) : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {comparacao && (
          <p className="text-muted-foreground mr-auto text-xs">
            {comparacao.resumo.alterados + comparacao.resumo.novos + comparacao.resumo.removidos + comparacao.resumo.movidos === 0
              ? "Nenhum slide mudou em relação à versão anterior."
              : [
                  ["alterado", "alterados", comparacao.resumo.alterados],
                  ["novo", "novos", comparacao.resumo.novos],
                  ["removido", "removidos", comparacao.resumo.removidos],
                  ["movido", "movidos", comparacao.resumo.movidos],
                ]
                  .filter(([, , n]) => (n as number) > 0)
                  .map(([um, varios, n]) => `${n} ${n === 1 ? um : varios}`)
                  .join(" · ")}
          </p>
        )}
        {comparacao && (
          <Button size="sm" variant="ghost" onClick={() => setVerTudo(!verTudo)}>
            {verTudo ? "Ver só o que mudou" : "Ver roteiro completo"}
          </Button>
        )}
        <Button size="sm" variant="outline" className={comparacao ? "" : "ml-auto"} onClick={() => setModal(primeiroDoModal)}>
          <PanelRightOpenIcon /> Ver slide a slide
        </Button>
      </div>
      <ol className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
        {itens.map((item) => {
          if (item.tipo === "removido") {
            const r = resumoDoSlide(item.r.slide)
            return (
              <li key={`r-${item.r.numeroAnterior}`} className="rounded-md border border-dashed p-2 text-sm opacity-80">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs">{item.r.numeroAnterior}</span>
                  <EtiquetaMudanca status="removido" />
                  <span className="text-muted-foreground truncate line-through">{r.titulo}</span>
                </div>
                <p className="text-muted-foreground mt-1 ml-8 text-xs">Estava no slide {item.r.numeroAnterior} da versão anterior e saiu do roteiro.</p>
              </li>
            )
          }
          const { slide: s, numero, status, diferencas } = item.s
          const r = resumoDoSlide(s)
          return (
            <li key={numero} className={`rounded-md border p-2 text-sm ${s.pendencia ? "border-aviso/60 bg-aviso-fundo" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-6 shrink-0 text-right font-mono text-xs">{numero}</span>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {s.tipo}
                </Badge>
                {status !== "igual" && <EtiquetaMudanca status={status} />}
                <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => setModal(numero - 1)} title="Abrir este slide em tamanho grande">
                  {r.titulo}
                </button>
              </div>
              {s.pendencia ? (
                <p className="mt-1 ml-8 text-xs text-aviso">Pendência: {s.pendencia}</p>
              ) : (
                <div className="mt-1 ml-8 flex gap-2">
                  {r.imagens.map((img) => (
                    <button key={img} type="button" onClick={() => setModal(numero - 1)} className="shrink-0" title="Abrir em tamanho grande">
                      {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
                      <img src={urlArquivo(slug, img)} alt="" className="h-14 w-auto rounded border bg-papel" />
                    </button>
                  ))}
                  {status === "alterado" ? (
                    <div className="min-w-0 flex-1">
                      <DiferencasDoSlide diferencas={diferencas} />
                    </div>
                  ) : (
                    r.linhas.length > 0 && (
                      <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
                        {r.linhas.map((l, j) => (
                          <li key={j}>{l}</li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              )}
              {typeof s.fonte === "string" && <p className="text-muted-foreground mt-1 ml-8 font-mono text-[10px]">fonte: {s.fonte}</p>}
              {modal === null && <div className="ml-8">{blocoComentarios(numero)}</div>}
            </li>
          )
        })}
      </ol>
      {comentaveis && pendentes.length > 0 && (
        <Button size="sm" onClick={enviar} disabled={ocupado}>
          <SendIcon /> Enviar {pendentes.length} {pendentes.length === 1 ? "ajuste" : "ajustes"} ao agente
        </Button>
      )}
      <ModalRoteiro slug={slug} slides={slides} comparacao={comparacao} indice={modal} aoMudarIndice={setModal} comentarios={comentaveis ? blocoComentarios : undefined} />
    </div>
  )
}
