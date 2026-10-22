"use client"

import { CircleIcon, HashIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent } from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro } from "@/lib/api"
import { caixaDoArrasto, caixaDoNumero, type FormaMarca, type Marca, podeEnviar, type Ponto, ROTULO_FORMA, textoDoPedido } from "@/lib/anotacoes"
import { renderizarAnotada } from "@/lib/anotacoes-canvas"

const FERRAMENTAS: { forma: FormaMarca; icone: typeof SquareIcon; dica: string }[] = [
  { forma: "retangulo", icone: SquareIcon, dica: "Arraste sobre a imagem para marcar uma área retangular" },
  { forma: "circulo", icone: CircleIcon, dica: "Arraste sobre a imagem para marcar uma área redonda" },
  { forma: "numero", icone: HashIcon, dica: "Clique na imagem para colocar um número" },
]

/** Pedido de ajuste de gráfico ou tabela: marcações numeradas sobre a imagem, cada uma com a sua descrição. */
export function EditorAjuste({
  slug,
  entregavelId,
  titulo,
  urlImagem,
  aoEnviar,
  aoCancelar,
}: {
  slug: string
  entregavelId: string
  titulo: string
  urlImagem: string
  aoEnviar: () => void
  aoCancelar: () => void
}) {
  const [ferramenta, setFerramenta] = useState<FormaMarca>("retangulo")
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [geral, setGeral] = useState("")
  const [rascunho, setRascunho] = useState<{ inicio: Ponto; fim: Ponto } | null>(null)
  const [foco, setFoco] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const areaRef = useRef<HTMLDivElement>(null)
  const camposRef = useRef(new Map<string, HTMLTextAreaElement>())

  // A descrição da marcação recém-criada ou clicada recebe o cursor.
  useEffect(() => {
    if (foco) camposRef.current.get(foco)?.focus()
  }, [foco])

  function pontoDoEvento(e: PointerEvent): Ponto {
    const r = areaRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }

  function adicionar(forma: FormaMarca, caixa: Pick<Marca, "x" | "y" | "w" | "h">) {
    const id = crypto.randomUUID()
    setMarcas((atuais) => [...atuais, { id, forma, ...caixa, texto: "" }])
    setFoco(id)
  }

  function aoPressionar(e: PointerEvent) {
    if (ocupado || e.button !== 0) return
    e.preventDefault()
    const p = pontoDoEvento(e)
    if (ferramenta === "numero") {
      adicionar("numero", caixaDoNumero(p))
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setRascunho({ inicio: p, fim: p })
  }

  function aoMover(e: PointerEvent) {
    if (rascunho) setRascunho({ ...rascunho, fim: pontoDoEvento(e) })
  }

  function aoSoltar(e: PointerEvent) {
    if (!rascunho) return
    const caixa = caixaDoArrasto(rascunho.inicio, pontoDoEvento(e))
    setRascunho(null)
    if (caixa) adicionar(ferramenta, caixa)
  }

  const mudarTexto = (id: string, texto: string) => setMarcas((atuais) => atuais.map((m) => (m.id === id ? { ...m, texto } : m)))
  const remover = (id: string) => setMarcas((atuais) => atuais.filter((m) => m.id !== id))

  async function enviar() {
    setOcupado(true)
    try {
      const imagem = marcas.length ? await renderizarAnotada(urlImagem, marcas) : undefined
      await api.pedirAjuste(slug, entregavelId, textoDoPedido(geral, marcas), imagem)
      aoEnviar()
    } catch (erro) {
      toast.error(mensagemDeErro(erro))
    } finally {
      setOcupado(false)
    }
  }

  const caixaRascunho = rascunho ? caixaDoArrasto(rascunho.inicio, rascunho.fim) : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-sm">Marcar:</span>
        {FERRAMENTAS.map(({ forma, icone: Icone, dica }) => (
          <Button
            key={forma}
            size="sm"
            variant={ferramenta === forma ? "default" : "outline"}
            title={dica}
            aria-pressed={ferramenta === forma}
            onClick={() => setFerramenta(forma)}
          >
            <Icone /> {ROTULO_FORMA[forma]}
          </Button>
        ))}
      </div>

      <div
        ref={areaRef}
        className="relative touch-none overflow-hidden rounded-md border bg-papel select-none"
        style={{ cursor: "crosshair" }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={() => setRascunho(null)}
        aria-label={`Imagem de ${titulo} para marcar os ajustes`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app */}
        <img src={urlImagem} alt={titulo} draggable={false} className="block w-full" />
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {marcas.map((m) => (
            <Forma key={m.id} marca={m} destacada={foco === m.id} />
          ))}
          {caixaRascunho && <Forma marca={{ id: "rascunho", forma: ferramenta, texto: "", ...caixaRascunho }} destacada />}
        </svg>
        {marcas.map((m, i) => (
          <button
            key={m.id}
            type="button"
            title={`Marcação ${i + 1}: clique para descrever`}
            className={cn(
              "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-background shadow ring-2 ring-background",
              foco === m.id && "ring-offset-2",
            )}
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setFoco(m.id)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Escolha a forma e marque na imagem; cada marcação ganha um número para você dizer o que mudar ali.
      </p>

      {marcas.length > 0 && (
        <ol className="space-y-2">
          {marcas.map((m, i) => (
            <li key={m.id} className="flex items-start gap-2">
              <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-background">
                {i + 1}
              </span>
              <Textarea
                ref={(el) => {
                  if (el) camposRef.current.set(m.id, el)
                  else camposRef.current.delete(m.id)
                }}
                value={m.texto}
                onChange={(ev) => mudarTexto(m.id, ev.target.value)}
                onFocus={() => setFoco(m.id)}
                placeholder={`${ROTULO_FORMA[m.forma]} ${i + 1}: o que mudar aqui? Ex.: eixo X em meses por extenso`}
                aria-label={`O que mudar na marcação ${i + 1}`}
                className="min-h-9"
              />
              <Button size="icon-sm" variant="ghost" className="mt-1" aria-label={`Apagar marcação ${i + 1}`} onClick={() => remover(m.id)}>
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <Textarea
        value={geral}
        onChange={(ev) => setGeral(ev.target.value)}
        placeholder={marcas.length ? "Ajuste geral (opcional)" : "Ex.: trocar para barras, incluir a linha de média"}
        aria-label="Descreva o ajuste"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={enviar} disabled={!podeEnviar(geral, marcas) || ocupado}>
          {ocupado && <Spinner />} Enviar ajuste
        </Button>
        <Button size="sm" variant="ghost" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function Forma({ marca: m, destacada }: { marca: Marca; destacada: boolean }) {
  if (m.forma === "numero") return null
  const comum = {
    className: cn("fill-destructive/10 stroke-destructive", destacada && "fill-destructive/20"),
    strokeWidth: destacada ? 3 : 2,
    vectorEffect: "non-scaling-stroke" as const,
  }
  return m.forma === "retangulo" ? (
    <rect x={m.x} y={m.y} width={m.w} height={m.h} {...comum} />
  ) : (
    <ellipse cx={m.x + m.w / 2} cy={m.y + m.h / 2} rx={m.w / 2} ry={m.h / 2} {...comum} />
  )
}
