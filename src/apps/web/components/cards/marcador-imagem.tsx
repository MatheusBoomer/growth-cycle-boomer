"use client"

import { CircleIcon, HashIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { useRef, useState, type PointerEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { caixaDoArrasto, caixaDoNumero, type FormaMarca, type Marca, type Ponto, ROTULO_FORMA } from "@/lib/anotacoes"

const FERRAMENTAS: { forma: FormaMarca; icone: typeof SquareIcon; dica: string }[] = [
  { forma: "retangulo", icone: SquareIcon, dica: "Arraste sobre a imagem para marcar uma área retangular" },
  { forma: "circulo", icone: CircleIcon, dica: "Arraste sobre a imagem para marcar uma área redonda" },
  { forma: "numero", icone: HashIcon, dica: "Clique na imagem para colocar um número" },
]

/**
 * Marcações numeradas sobre a imagem de um gráfico ou tabela, para o pedido de ajuste. O que mudar em cada
 * número o analista escreve na mensagem do chat; aqui só se marca. `primeiroNumero` mantém a numeração
 * contínua com as outras referências da mesma mensagem.
 */
export function MarcadorImagem({
  titulo,
  urlImagem,
  marcas,
  primeiroNumero,
  aoMudar,
  aoFechar,
}: {
  titulo: string
  urlImagem: string
  marcas: Marca[]
  primeiroNumero: number
  aoMudar: (marcas: Marca[]) => void
  aoFechar: () => void
}) {
  const [ferramenta, setFerramenta] = useState<FormaMarca>("retangulo")
  const [rascunho, setRascunho] = useState<{ inicio: Ponto; fim: Ponto } | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  function pontoDoEvento(e: PointerEvent): Ponto {
    const r = areaRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }

  function adicionar(forma: FormaMarca, caixa: Pick<Marca, "x" | "y" | "w" | "h">) {
    aoMudar([...marcas, { id: crypto.randomUUID(), forma, ...caixa }])
  }

  function aoPressionar(e: PointerEvent) {
    if (e.button !== 0) return
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
        <Button size="sm" variant="ghost" className="ml-auto" onClick={aoFechar}>
          Concluir marcação
        </Button>
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
            <Forma key={m.id} marca={m} destacada={false} />
          ))}
          {caixaRascunho && <Forma marca={{ id: "rascunho", forma: ferramenta, ...caixaRascunho }} destacada />}
        </svg>
        {marcas.map((m, i) => (
          <span
            key={m.id}
            className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-background shadow ring-2 ring-background"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            {primeiroNumero + i}
          </span>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Escolha a forma e marque na imagem. Cada marcação ganha um número: escreva o que mudar em cada um na mensagem do chat (ex.: “1: eixo X em meses por extenso”).
      </p>

      {marcas.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {marcas.map((m, i) => (
            <li key={m.id} className="bg-muted flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-2.5 text-xs">
              {primeiroNumero + i} · {ROTULO_FORMA[m.forma]}
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-5"
                aria-label={`Apagar marcação ${primeiroNumero + i}`}
                onClick={() => aoMudar(marcas.filter((x) => x.id !== m.id))}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
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
