"use client"

import { HistoryIcon, ImageIcon, ImageOffIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react"
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
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  agruparPorEtapa,
  contarPorEtapa,
  FILTROS_INICIAIS,
  filtrarItens,
  ordemDeExibicao,
  ORIGENS_FILTRO,
  ROTULO_FILTRO_ORIGEM,
  rotuloEtapa,
  totalVisivel,
  type FiltroEtapa,
  type FiltrosBiblioteca,
} from "@/lib/biblioteca"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { CarregandoVisualizador, EstadoVisualizador, TituloDestacado } from "@/components/trabalho/barra-visualizador"
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

  const filtrosMudados =
    filtros.etapa !== FILTROS_INICIAIS.etapa || filtros.busca.trim() !== "" || filtros.versoesAntigas !== FILTROS_INICIAIS.versoesAntigas || filtros.origens.size !== FILTROS_INICIAIS.origens.size

  let corpo: React.ReactNode
  if (itens === null) {
    corpo = erro ? (
      <EstadoVisualizador icone={<ImageOffIcon />} titulo="Não consegui carregar" destaque="a biblioteca">
        {erro}
      </EstadoVisualizador>
    ) : (
      <CarregandoVisualizador className="h-full" texto="Carregando as imagens…" />
    )
  } else if (itens.length === 0) {
    corpo = (
      <EstadoVisualizador icone={<ImageIcon />} titulo="Nenhuma" destaque="imagem ainda">
        Gráficos aprovados e anexos aparecem aqui conforme a conversa avança.
      </EstadoVisualizador>
    )
  } else if (visiveis.length === 0) {
    corpo = (
      <EstadoVisualizador
        icone={<SearchIcon />}
        titulo={filtros.busca.trim() ? "Nada para" : "Nenhuma imagem"}
        destaque={filtros.busca.trim() ? `"${filtros.busca.trim()}"` : "com estes filtros"}
        acao={
          filtrosMudados && (
            <Button size="sm" variant="outline" onClick={() => setFiltros(FILTROS_INICIAIS)}>
              Limpar filtros
            </Button>
          )
        }
      >
        Tente outro nome ou limpe os filtros.
      </EstadoVisualizador>
    )
  } else {
    corpo = (
      <div className="flex flex-col gap-6.5">
        {agruparPorEtapa(visiveis).map((g) => {
          const e = catalogo.etapas.find((x) => x.id === g.etapa)
          return (
            <section key={g.etapa} className="flex flex-col gap-3">
              <h3 className="flex items-baseline gap-2.5 text-[13px] font-medium">
                {e?.numero && <span className="font-mono text-[11px] text-muted-foreground">{e.numero}</span>}
                <span>
                  <TituloDestacado texto={g.etapa === "sem-etapa" ? "Sem etapa" : (e?.titulo ?? rotuloEtapa(catalogo, g.etapa))} />
                </span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{g.itens.length}</span>
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5">
                {g.itens.map((i) => (
                  <CardImagem key={i.id} slug={slug} item={i} aoAbrir={() => setAberto({ id: i.id, indice: indicePorId.get(i.id) ?? 0 })} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  const total = itens ? totalVisivel(itens) : null

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Biblioteca">
      <header className="flex flex-col gap-3.5 border-b border-border py-4 pr-4 pl-5.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-1.5 text-[22px] font-medium tracking-[-0.03em]">
            Biblioteca <em className="font-serif text-[25px] font-normal text-link-acao italic">do prospect</em>
          </h1>
          {total !== null && (
            <span className="mr-auto font-mono text-xs text-muted-foreground">
              {total} {total === 1 ? "imagem" : "imagens"}
            </span>
          )}
          <div className="relative ml-auto w-full max-w-60">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-[15px] -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-9" placeholder="Buscar por nome" aria-label="Buscar por nome" value={filtros.busca} onChange={(ev) => mudar({ busca: ev.target.value })} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <ListFilterIcon /> Origem <span className="font-mono text-[11px] text-muted-foreground">{filtros.origens.size}</span>
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
            variant="outline"
            size="sm"
            aria-pressed={filtros.versoesAntigas}
            className={cn(filtros.versoesAntigas && "bg-muted text-foreground")}
            onClick={() => mudar({ versoesAntigas: !filtros.versoesAntigas })}
          >
            <HistoryIcon /> Versões antigas
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Fechar biblioteca" title="Fechar (Esc)" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
        <nav aria-label="Filtrar por etapa" className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-full border border-border bg-muted/30 p-[3px]">
          {PILULAS.map((e) => {
            const marcada = filtros.etapa === e
            return (
              <button
                key={e}
                type="button"
                aria-pressed={marcada}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  marcada && "bg-foreground text-background hover:text-background",
                  contagem[e] === 0 && !marcada && "opacity-45",
                )}
                onClick={() => mudar({ etapa: e })}
              >
                {e === "todas" ? "Todas" : rotuloEtapa(catalogo, e, true)}
                <span className={cn("font-mono text-[11px] tabular-nums", marcada ? "opacity-60" : "text-muted-foreground")}>{contagem[e]}</span>
              </button>
            )
          })}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5.5 pt-5 pb-6">{corpo}</div>
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
