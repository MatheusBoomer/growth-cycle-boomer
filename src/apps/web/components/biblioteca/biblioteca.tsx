"use client"

import { HistoryIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ORDEM_BIBLIOTECA, type AjusteBiblioteca, type ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Catalogo } from "@workspace/core/tipos"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import {
  agruparPorEtapa,
  agruparPorMarca,
  contarPorEtapa,
  FILTROS_INICIAIS,
  filtrarItens,
  ordemDeExibicao,
  ORIGENS_FILTRO,
  ROTULO_FILTRO_ORIGEM,
  rotuloEtapa,
  type FiltroEtapa,
  type FiltrosBiblioteca,
} from "@/lib/biblioteca"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { CardImagem } from "./card-imagem"
import { ImagemAmpliada } from "./imagem-ampliada"

const PILULAS: FiltroEtapa[] = ["todas", ...ORDEM_BIBLIOTECA]

export function Biblioteca({
  slug,
  catalogo,
  itens,
  erro,
  aoAjustar,
  aoMencionar,
  aoFechar,
}: {
  slug: string
  catalogo: Catalogo
  itens: ItemBiblioteca[] | null
  erro: string | null
  aoAjustar: (caminho: string, mudanca: AjusteBiblioteca) => void
  aoMencionar: (caminho: string) => void
  aoFechar: () => void
}) {
  const [filtros, setFiltros] = useState<FiltrosBiblioteca>(FILTROS_INICIAIS)
  const [aberto, setAberto] = useState<{ id: string; indice: number } | null>(null)
  const contagem = useMemo(() => contarPorEtapa(itens ?? [], filtros), [itens, filtros])
  const visiveis = useMemo(() => ordemDeExibicao(filtrarItens(itens ?? [], filtros)), [itens, filtros])
  const indicePorId = useMemo(() => new Map(visiveis.map((i, n) => [i.id, n])), [visiveis])

  // O item aberto é rastreado por id: reordenar (etapa otimista, recarga por SSE) não troca a imagem do diálogo.
  // Se o id saiu da lista (ex.: movido para fora da etapa filtrada), vale o item que agora ocupa o mesmo índice
  // (fluxo de triagem de "Sem etapa"); sem item nesse índice, fecha. Estado ajustado durante a renderização, sem efeito.
  let indiceAberto: number | null = null
  if (aberto !== null) {
    const atual = indicePorId.get(aberto.id)
    if (atual !== undefined) {
      indiceAberto = atual
      if (atual !== aberto.indice) setAberto({ id: aberto.id, indice: atual })
    } else if (aberto.indice < visiveis.length) {
      indiceAberto = aberto.indice
      setAberto({ id: visiveis[aberto.indice]!.id, indice: aberto.indice })
    } else {
      setAberto(null)
    }
  }

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || ev.defaultPrevented) return
      const ativo = document.activeElement as HTMLElement | null
      // Esc dentro de um menu (ex.: Origem) fecha só o menu.
      if (ativo?.closest('[role="menu"]')) return
      if (alvoDeDigitacao(ativo)) return
      // Captura + stopPropagation: visualizadores montados por baixo não fecham junto.
      ev.stopPropagation()
      aoFechar()
    }
    window.addEventListener("keydown", aoTeclar, { capture: true })
    return () => window.removeEventListener("keydown", aoTeclar, { capture: true })
  }, [aoFechar])

  const mudar = (parcial: Partial<FiltrosBiblioteca>) => setFiltros((f) => ({ ...f, ...parcial }))

  let corpo: React.ReactNode
  if (itens === null) {
    corpo = erro ? (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Não consegui carregar a biblioteca</EmptyTitle>
          <EmptyDescription>{erro}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  } else if (itens.length === 0) {
    corpo = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nenhuma imagem ainda</EmptyTitle>
          <EmptyDescription>Gráficos aprovados, anexos e o benchmark aparecem aqui.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else if (visiveis.length === 0) {
    corpo = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{filtros.busca.trim() ? "Nenhuma imagem para esta busca" : "Nenhuma imagem nesta etapa"}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  } else {
    corpo = (
      <div className="flex flex-col gap-6">
        {agruparPorEtapa(visiveis).map((g) => (
          <section key={g.etapa} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{rotuloEtapa(catalogo, g.etapa)}</h3>
            {agruparPorMarca(g.itens).map((m) => (
              <div key={m.marca ?? ""} className="flex flex-col gap-2">
                {m.marca && <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{m.marca}</h4>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                  {m.itens.map((i) => (
                    <CardImagem key={i.id} slug={slug} item={i} aoAbrir={() => setAberto({ id: i.id, indice: indicePorId.get(i.id) ?? 0 })} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Biblioteca">
      <header className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold">Biblioteca</h1>
          <div className="relative ml-auto w-full max-w-xs">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" aria-hidden />
            <Input className="pl-8" placeholder="Buscar por nome" aria-label="Buscar por nome" value={filtros.busca} onChange={(ev) => mudar({ busca: ev.target.value })} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <ListFilterIcon /> Origem
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ORIGENS_FILTRO.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o}
                  checked={filtros.origens.has(o)}
                  onCheckedChange={(marcado) => {
                    const origens = new Set(filtros.origens)
                    if (marcado) origens.add(o)
                    else origens.delete(o)
                    mudar({ origens })
                  }}
                >
                  {ROTULO_FILTRO_ORIGEM[o]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={filtros.versoesAntigas ? "secondary" : "outline"}
            size="sm"
            aria-pressed={filtros.versoesAntigas}
            onClick={() => mudar({ versoesAntigas: !filtros.versoesAntigas })}
          >
            <HistoryIcon /> Versões antigas
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar biblioteca" title="Fechar (Esc)" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
        <nav aria-label="Filtrar por etapa" className="flex flex-wrap gap-1">
          {PILULAS.map((e) => (
            <Button
              key={e}
              size="sm"
              variant={filtros.etapa === e ? "secondary" : "ghost"}
              aria-pressed={filtros.etapa === e}
              className={cn("gap-1.5", contagem[e] === 0 && filtros.etapa !== e && "text-muted-foreground/60")}
              onClick={() => mudar({ etapa: e })}
            >
              {e === "todas" ? "Todas" : rotuloEtapa(catalogo, e, true)}
              <span className="text-muted-foreground text-xs tabular-nums">{contagem[e]}</span>
            </Button>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{corpo}</div>
      <ImagemAmpliada
        slug={slug}
        catalogo={catalogo}
        itens={visiveis}
        indice={indiceAberto}
        aoMudarIndice={(n) => setAberto(n !== null && visiveis[n] ? { id: visiveis[n].id, indice: n } : null)}
        aoAjustar={aoAjustar}
        aoMencionar={(caminho) => {
          setAberto(null)
          aoMencionar(caminho)
        }}
      />
    </section>
  )
}
