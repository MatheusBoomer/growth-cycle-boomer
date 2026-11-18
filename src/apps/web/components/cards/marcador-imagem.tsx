"use client"

import { CircleIcon, HashIcon, SquareIcon, XIcon } from "lucide-react"
import { useRef, useState, type PointerEvent, type ReactNode } from "react"
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
 *
 * No modal do gráfico, `envolverArea` põe a imagem marcável dentro do palco com zoom; como as marcas são em % da
 * imagem, valem em qualquer zoom. Sem `aoFechar`, o botão de concluir fica
 * com quem usa o marcador (o modal tem o seu no rodapé).
 */
export function MarcadorImagem({
  titulo,
  urlImagem,
  marcas,
  primeiroNumero,
  aoMudar,
  aoFechar,
  envolverArea,
  className,
  instrucao = "Escolha a forma e marque na imagem. Cada marcação ganha um número: escreva o que mudar em cada um na mensagem do chat (ex.: “1: eixo X em meses por extenso”).",
}: {
  titulo: string
  urlImagem: string
  marcas: Marca[]
  primeiroNumero: number
  aoMudar: (marcas: Marca[]) => void
  aoFechar?: () => void
  envolverArea?: (area: ReactNode) => ReactNode
  className?: string
  /** Texto de ajuda abaixo da imagem; o padrão fala do chat. */
  instrucao?: string
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

  const area = (
    <div
      ref={areaRef}
      className="relative shrink-0 touch-none overflow-hidden rounded-2xl border border-border bg-papel select-none"
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
          className="absolute flex size-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground ring-3 ring-papel"
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          {primeiroNumero + i}
        </span>
      ))}
    </div>
  )

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span id="marcar-rotulo" className="mr-1 text-[13px] text-muted-foreground">
          Marcar:
        </span>
        <div role="radiogroup" aria-labelledby="marcar-rotulo" className="inline-flex gap-0.5 rounded-full border border-border p-[3px]">
          {FERRAMENTAS.map(({ forma, icone: Icone, dica }) => (
            <button
              key={forma}
              type="button"
              role="radio"
              title={dica}
              aria-checked={ferramenta === forma}
              onClick={() => setFerramenta(forma)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5",
                ferramenta === forma && "bg-foreground text-background hover:text-background",
              )}
            >
              <Icone /> {ROTULO_FORMA[forma]}
            </button>
          ))}
        </div>
        {aoFechar && (
          <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={aoFechar}>
            Concluir marcação
          </Button>
        )}
      </div>

      {envolverArea ? envolverArea(area) : area}
      <p className="text-xs text-muted-foreground">{instrucao}</p>

      {marcas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {marcas.map((m, i) => (
            <li key={m.id} className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-1.5 pl-1.5 text-[12.5px]">
              <span className="grid size-[18px] place-items-center rounded-full bg-primary font-mono text-[10.5px] font-semibold text-primary-foreground">
                {primeiroNumero + i}
              </span>
              {ROTULO_FORMA[m.forma]}
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-5 rounded-full text-muted-foreground [&_svg]:size-3"
                aria-label={`Apagar marcação ${primeiroNumero + i}`}
                onClick={() => aoMudar(marcas.filter((x) => x.id !== m.id))}
              >
                <XIcon />
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
    className: cn("fill-primary/10 stroke-primary", destacada && "fill-primary/20"),
    strokeWidth: destacada ? 3 : 2,
    vectorEffect: "non-scaling-stroke" as const,
  }
  return m.forma === "retangulo" ? (
    <rect x={m.x} y={m.y} width={m.w} height={m.h} {...comum} />
  ) : (
    <ellipse cx={m.x + m.w / 2} cy={m.y + m.h / 2} rx={m.w / 2} ry={m.h / 2} {...comum} />
  )
}
