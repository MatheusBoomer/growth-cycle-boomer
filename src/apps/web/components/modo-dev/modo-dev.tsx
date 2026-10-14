"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cadeiaDeComponentes, type ComentarioDev, seletorDoElemento, textoVisivel } from "@/lib/modo-dev/nucleo"

const CHAVE_ATIVO = "modo-dev:ativo"
const LARGURA_CAIXA = 320
const ALTURA_CAIXA = 190
const EVENTOS_BLOQUEADOS = ["click", "dblclick", "auxclick", "contextmenu", "pointerdown", "pointerup", "mousedown", "mouseup", "submit"]

interface Alvo {
  el: Element | null
  cadeia: string[]
  editando: ComentarioDev | null
  /** Posição no momento em que a caixa abriu, para ela não pular se o elemento sumir. */
  rect: DOMRect | null
  /** Tirada no clique: o elemento pode sumir ou ser recriado enquanto se escreve (diálogo fechando, re-render). */
  foto: Foto | null
}

interface Foto {
  pagina: string
  seletor: string
  tag: string
  texto: string
  caixa: { x: number; y: number; largura: number; altura: number; larguraTela: number; alturaTela: number }
  png: Promise<string | null>
}

interface Destaque {
  el: Element
  cadeia: string[]
}

function lerAtivo(): boolean {
  try {
    return localStorage.getItem(CHAVE_ATIVO) === "1"
  } catch {
    return false
  }
}

function gravarAtivo(ativo: boolean) {
  try {
    localStorage.setItem(CHAVE_ATIVO, ativo ? "1" : "0")
  } catch {
    // armazenamento indisponível: o modo só não fica lembrado
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json" } })
  const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
  if (!resposta.ok) throw new Error(corpo.erro ?? `O servidor respondeu ${resposta.status}.`)
  return corpo as T
}

async function capturar(el: Element): Promise<string | null> {
  try {
    const { width, height } = el.getBoundingClientRect()
    const maiorLado = Math.max(width, height)
    if (!maiorLado) return null
    const { domToPng } = await import("modern-screenshot")
    const dataUrl = await domToPng(el, {
      scale: Math.min(1, 1600 / maiorLado),
      // Sem isto o fundo sai transparente e o texto claro do tema escuro some fora do app.
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      filter: (no) => !(no instanceof Element && no.hasAttribute("data-modo-dev")),
    })
    return dataUrl.replace(/^data:image\/png;base64,/, "")
  } catch {
    return null
  }
}

/** Elemento do comentário na tela atual; escondido (aba fechada, display:none) conta como não encontrado. */
function elementoVisivel(seletor: string): Element | null {
  try {
    const el = document.querySelector(seletor)
    if (!el) return null
    const { width, height } = el.getBoundingClientRect()
    return width || height ? el : null
  } catch {
    return null
  }
}

function destaqueDe(el: Element): Destaque {
  return { el, cadeia: cadeiaDeComponentes(el) }
}

function fotoDe(el: Element): Foto {
  const rect = el.getBoundingClientRect()
  return {
    pagina: window.location.pathname,
    seletor: seletorDoElemento(el),
    tag: el.tagName.toLowerCase(),
    texto: textoVisivel(el),
    caixa: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      largura: Math.round(rect.width),
      altura: Math.round(rect.height),
      larguraTela: window.innerWidth,
      alturaTela: window.innerHeight,
    },
    png: capturar(el),
  }
}

function contornoDe(rect: DOMRect) {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function etiquetaDe(rect: DOMRect) {
  return { left: Math.max(4, rect.left), top: rect.top >= 24 ? rect.top - 22 : rect.bottom + 4 }
}

function posicaoDaCaixa(rect: DOMRect | null) {
  const margem = 12
  if (!rect) return { left: 16, top: Math.max(margem, window.innerHeight - ALTURA_CAIXA - 80) }
  let left = rect.right + margem
  if (left + LARGURA_CAIXA > window.innerWidth - margem) left = rect.left - LARGURA_CAIXA - margem
  if (left < margem) left = Math.min(Math.max(margem, rect.left), window.innerWidth - LARGURA_CAIXA - margem)
  const top = Math.min(Math.max(margem, rect.top), window.innerHeight - ALTURA_CAIXA - margem)
  return { left, top }
}

function resumoDaCadeia(cadeia: string[], tag: string) {
  return cadeia.slice(0, 3).join(" ← ") || `<${tag}>`
}

export function ModoDev() {
  const pagina = usePathname()
  const camadaRef = useRef<HTMLDivElement>(null)
  const [ativo, setAtivo] = useState(lerAtivo)
  const [comentarios, setComentarios] = useState<ComentarioDev[]>([])
  const [destaque, setDestaque] = useState<Destaque | null>(null)
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const [texto, setTexto] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)
  const [todasPaginas, setTodasPaginas] = useState(false)
  const [, setQuadro] = useState(0)

  // Os listeners de documento leem o estado por refs, para não serem recriados a cada tecla.
  const ativoRef = useRef(ativo)
  const alvoRef = useRef(alvo)
  const textoRef = useRef(texto)
  const destaqueRef = useRef(destaque)
  useEffect(() => {
    ativoRef.current = ativo
    alvoRef.current = alvo
    textoRef.current = texto
    destaqueRef.current = destaque
  }, [ativo, alvo, texto, destaque])
  // Níveis: elemento sob o cursor e os filhos de onde ↑ subiu, para ↓ voltar.
  const baseRef = useRef<Element | null>(null)
  const filhosRef = useRef<Element[]>([])

  const recarregar = useCallback(async () => {
    try {
      const { comentarios } = await chamar<{ comentarios: ComentarioDev[] }>("/api/dev/comentarios")
      setComentarios(comentarios)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os comentários do modo dev.")
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar, pagina])

  const fecharCaixa = useCallback(() => {
    setAlvo(null)
    setTexto("")
  }, [])

  const definirAtivo = useCallback((valor: boolean) => {
    setAtivo(valor)
    gravarAtivo(valor)
    baseRef.current = null
    filhosRef.current = []
    setDestaque(null)
    if (!valor) {
      setAlvo(null)
      setTexto("")
    }
  }, [])

  const fixar = useCallback((el: Element) => {
    // Com texto digitado, um clique fora não troca o alvo nem perde o rascunho.
    if (alvoRef.current && textoRef.current.trim()) return
    baseRef.current = null
    filhosRef.current = []
    setDestaque(null)
    setAlvo({ el, cadeia: cadeiaDeComponentes(el), editando: null, rect: el.getBoundingClientRect(), foto: fotoDe(el) })
    setTexto("")
  }, [])

  // Atalhos: Ctrl+D liga e desliga (em qualquer lugar, inclusive campos de texto); ↑/↓ mudam o nível destacado; Esc fecha a caixa e, sem caixa, sai do modo.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault()
        definirAtivo(!ativoRef.current)
        return
      }
      const atual = destaqueRef.current?.el
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && ativoRef.current && !alvoRef.current && atual) {
        e.preventDefault()
        e.stopPropagation()
        if (e.key === "ArrowUp") {
          const pai = atual.parentElement
          if (pai && pai !== document.body && pai !== document.documentElement) {
            filhosRef.current.push(atual)
            setDestaque(destaqueDe(pai))
          }
        } else {
          const filho = filhosRef.current.pop()
          if (filho) setDestaque(destaqueDe(filho))
        }
        return
      }
      if (e.key !== "Escape") return
      if (alvoRef.current) {
        e.preventDefault()
        e.stopPropagation()
        fecharCaixa()
      } else if (ativoRef.current) {
        e.preventDefault()
        e.stopPropagation()
        definirAtivo(false)
      }
    }
    document.addEventListener("keydown", aoTeclar, true)
    return () => document.removeEventListener("keydown", aoTeclar, true)
  }, [definirAtivo, fecharCaixa])

  // Modo ativo: destaca o elemento sob o cursor e bloqueia cliques e envios do site.
  useEffect(() => {
    if (!ativo) return
    const naCamada = (alvoEvento: EventTarget | null) => alvoEvento instanceof Node && !!camadaRef.current?.contains(alvoEvento)
    const doSite = (alvoEvento: EventTarget | null): alvoEvento is Element =>
      alvoEvento instanceof Element && alvoEvento !== document.body && alvoEvento !== document.documentElement

    const aoMover = (e: PointerEvent) => {
      if (alvoRef.current) return
      if (naCamada(e.target) || !doSite(e.target)) {
        baseRef.current = null
        filhosRef.current = []
        setDestaque(null)
        return
      }
      // Mesmo elemento sob o cursor: mantém o nível escolhido com ↑/↓.
      if (e.target === baseRef.current) return
      baseRef.current = e.target
      filhosRef.current = []
      setDestaque(destaqueDe(e.target))
    }
    const bloquear = (e: Event) => {
      if (naCamada(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      // detail 0 = clique gerado por teclado (Enter num botão focado): bloqueia, mas não fixa.
      if (e.type === "click" && (e as MouseEvent).detail > 0 && doSite(e.target)) {
        fixar(destaqueRef.current?.el ?? e.target)
      }
    }

    document.addEventListener("pointermove", aoMover, true)
    for (const tipo of EVENTOS_BLOQUEADOS) document.addEventListener(tipo, bloquear, true)
    return () => {
      document.removeEventListener("pointermove", aoMover, true)
      for (const tipo of EVENTOS_BLOQUEADOS) document.removeEventListener(tipo, bloquear, true)
    }
  }, [ativo, fixar])

  // Pinos e contorno acompanham rolagem, redimensionamento e mudanças do site (nunca as da própria camada).
  useEffect(() => {
    if (!ativo) return
    let pedido = 0
    const agendar = () => {
      cancelAnimationFrame(pedido)
      pedido = requestAnimationFrame(() => setQuadro((n) => n + 1))
    }
    const observador = new MutationObserver((mudancas) => {
      if (mudancas.some((m) => !camadaRef.current?.contains(m.target))) agendar()
    })
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
    window.addEventListener("scroll", agendar, true)
    window.addEventListener("resize", agendar)
    return () => {
      cancelAnimationFrame(pedido)
      observador.disconnect()
      window.removeEventListener("scroll", agendar, true)
      window.removeEventListener("resize", agendar)
    }
  }, [ativo])

  function editar(comentario: ComentarioDev) {
    const el = comentario.pagina === pagina ? elementoVisivel(comentario.seletor) : null
    setDestaque(null)
    setAlvo({ el, cadeia: comentario.cadeia, editando: comentario, rect: el?.getBoundingClientRect() ?? null, foto: null })
    setTexto(comentario.comentario)
  }

  async function apagar(comentario: ComentarioDev) {
    try {
      await chamar(`/api/dev/comentarios/${comentario.id}`, { method: "DELETE" })
      if (alvo?.editando?.id === comentario.id) fecharCaixa()
      await recarregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar o comentário.")
    }
  }

  async function salvar() {
    if (!alvo || salvando) return
    const comentario = texto.trim()
    if (!comentario) {
      toast.error("Escreva o ajuste antes de salvar.")
      return
    }
    setSalvando(true)
    try {
      if (alvo.editando) {
        await chamar(`/api/dev/comentarios/${alvo.editando.id}`, { method: "PATCH", body: JSON.stringify({ comentario }) })
      } else if (alvo.foto) {
        const { png, ...foto } = alvo.foto
        await chamar("/api/dev/comentarios", {
          method: "POST",
          body: JSON.stringify({ ...foto, componente: alvo.cadeia[0] ?? null, cadeia: alvo.cadeia, comentario, png: await png }),
        })
      }
      fecharCaixa()
      await recarregar()
    } catch (e) {
      // O texto fica na caixa para tentar de novo.
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o comentário.")
    } finally {
      setSalvando(false)
    }
  }

  const daPagina = comentarios.filter((c) => c.pagina === pagina)
  const naLista = todasPaginas ? comentarios : daPagina
  const rectAlvo = alvo?.el?.isConnected ? alvo.el.getBoundingClientRect() : null
  const rectDestaque = destaque?.el.isConnected ? destaque.el.getBoundingClientRect() : null

  return (
    <div ref={camadaRef} data-modo-dev="" className="pointer-events-none fixed inset-0 font-sans text-xs" style={{ zIndex: 2147483647 }}>
      {ativo && destaque && rectDestaque && !alvo && (
        <>
          <div className="absolute rounded-sm border-2 border-orange-500 bg-orange-500/10" style={contornoDe(rectDestaque)} />
          <div className="absolute rounded bg-orange-500 px-1.5 py-0.5 whitespace-nowrap text-white shadow" style={etiquetaDe(rectDestaque)}>
            {resumoDaCadeia(destaque.cadeia, destaque.el.tagName.toLowerCase())} · {Math.round(rectDestaque.width)}×
            {Math.round(rectDestaque.height)} · ↑↓ nível
          </div>
        </>
      )}

      {alvo && rectAlvo && <div className="absolute rounded-sm border-2 border-sky-500 bg-sky-500/10" style={contornoDe(rectAlvo)} />}

      {ativo &&
        daPagina.map((c) => {
          const el = elementoVisivel(c.seletor)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return (
            <button
              key={c.id}
              type="button"
              title={c.comentario}
              onClick={() => editar(c)}
              className="pointer-events-auto absolute flex size-5 items-center justify-center rounded-full bg-orange-500 font-semibold text-white shadow ring-2 ring-white"
              style={{ left: r.right - 10, top: r.top - 10 }}
            >
              {c.numero}
            </button>
          )
        })}

      {alvo && (
        <div
          className="pointer-events-auto absolute flex flex-col gap-2 rounded-lg border bg-background p-3 text-foreground shadow-xl"
          style={{ ...posicaoDaCaixa(rectAlvo ?? alvo.rect), width: LARGURA_CAIXA }}
        >
          <div className="truncate text-muted-foreground">
            {alvo.editando ? `Editando #${alvo.editando.numero} · ` : ""}
            {resumoDaCadeia(alvo.cadeia, alvo.el?.tagName.toLowerCase() ?? alvo.editando?.tag ?? "?")}
          </div>
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                void salvar()
              }
            }}
            maxLength={2000}
            rows={4}
            placeholder="O que ajustar neste bloco?"
            className="w-full resize-none rounded border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">⌘/Ctrl+Enter salva · Esc cancela</span>
            <div className="flex gap-1">
              <button type="button" onClick={fecharCaixa} className="rounded px-2 py-1 hover:bg-muted">
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void salvar()}
                className="rounded bg-orange-500 px-2 py-1 font-medium text-white disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {listaAberta && (
        <div className="pointer-events-auto absolute bottom-14 left-4 flex max-h-[50vh] w-[360px] flex-col rounded-lg border bg-background text-foreground shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b p-2">
            <span className="font-medium">Comentários {todasPaginas ? "de todas as páginas" : "desta página"}</span>
            <label className="flex items-center gap-1 text-muted-foreground">
              <input type="checkbox" checked={todasPaginas} onChange={(e) => setTodasPaginas(e.target.checked)} />
              todas as páginas
            </label>
          </div>
          <ul className="overflow-y-auto">
            {naLista.length === 0 && <li className="p-3 text-muted-foreground">Nenhum comentário.</li>}
            {naLista.map((c) => {
              const naoEncontrado = c.pagina === pagina && !elementoVisivel(c.seletor)
              return (
                <li key={c.id} className="border-b p-2 last:border-b-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">#{c.numero}</span>
                    <span className="truncate text-muted-foreground">{c.componente ?? `<${c.tag}>`}</span>
                    {naoEncontrado && <span className="shrink-0 rounded bg-amber-100 px-1 text-amber-900">elemento não encontrado</span>}
                  </div>
                  {todasPaginas && <div className="truncate text-muted-foreground">{c.pagina}</div>}
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{c.comentario}</p>
                  <div className="mt-1 flex gap-3">
                    <button type="button" onClick={() => editar(c)} className="underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => void apagar(c)} className="text-red-600 underline">
                      Apagar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-4 left-4 flex gap-1">
        <button
          type="button"
          onClick={() => definirAtivo(!ativo)}
          title="Modo dev (Ctrl + D)"
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold shadow-lg ${ativo ? "bg-orange-500 text-white" : "bg-zinc-900 text-white"}`}
        >
          Dev
          {daPagina.length > 0 && <span className="rounded-full bg-white px-1.5 text-zinc-900">{daPagina.length}</span>}
        </button>
        <button
          type="button"
          onClick={() => setListaAberta((v) => !v)}
          className="rounded-full bg-zinc-900 px-3 py-1.5 font-medium text-white shadow-lg"
        >
          Lista
        </button>
      </div>
    </div>
  )
}
