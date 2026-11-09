"use client"

import { ChevronRightIcon, FolderOpenIcon, SearchXIcon } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import { normalizarEmail } from "@workspace/core/papeis"
import type { EtapaId, ResumoProspect } from "@workspace/core/tipos"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { BarraTopo } from "@/components/marca/barra-topo"
import { useEmailDaConta, usePapel } from "@/components/marca/conta-contexto"
import { filtrarProspects, ordenarProspects, separarPorSituacao, type Ordem } from "@/lib/filtro-prospects"
import { CardProspect } from "./card-prospect"
import { DialogoClienteTeste } from "./dialogo-cliente-teste"
import { DialogoNovoProspect } from "./dialogo-novo-prospect"

/** Valores do select que desligam o filtro ("todos") ou escolhem quem está logado ("meus"). */
const TODOS = "todos"
const MEUS = "meus"

const ITENS_ORDEM: { value: string; label: string }[] = [
  { value: "atividade", label: "Atividade recente" },
  { value: "nome", label: "Nome" },
  { value: "etapa", label: "Etapa" },
]

/** Select de escolha única com rótulo acessível; o item "todos" representa o filtro desligado. */
function FiltroSelect({
  rotulo,
  valor,
  itens,
  aoMudar,
  className,
}: {
  rotulo: string
  valor: string
  itens: { value: string; label: string }[]
  aoMudar: (valor: string) => void
  className?: string
}) {
  return (
    <Select items={itens} value={valor} onValueChange={(v) => aoMudar(v ?? TODOS)}>
      <SelectTrigger className={cn("w-full data-[size=default]:h-10 sm:w-44 sm:data-[size=default]:h-8", className)} aria-label={rotulo}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {itens.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Contador({ n }: { n: number }) {
  return <span className="text-muted-foreground ml-1.5 text-sm font-normal tabular-nums">{n}</span>
}

export function GradeProspects({
  prospects,
  etapas,
  avatares,
}: {
  prospects: ResumoProspect[]
  etapas: { id: EtapaId; rotulo: string }[]
  /** E-mail do dono (minúsculo) para a URL da foto, só de quem tem foto. */
  avatares: Record<string, string>
}) {
  const [busca, setBusca] = useState("")
  const [analista, setAnalista] = useState(TODOS)
  const [etapa, setEtapa] = useState(TODOS)
  const [soPendentes, setSoPendentes] = useState(false)
  const [ordem, setOrdem] = useState<Ordem>("atividade")
  const [concluidosAbertos, setConcluidosAbertos] = useState(false)
  const id = useId()
  const admin = usePapel() === "admin"
  const email = useEmailDaConta()

  // Só o admin vê os filtros de analista e de pendência: para os outros a lista já vem filtrada pelo servidor.
  const { emAndamento, concluidos } = useMemo(() => {
    const donos = admin && analista !== TODOS ? [analista === MEUS ? (email ?? "") : analista] : []
    const filtrados = filtrarProspects(prospects, {
      busca,
      donos,
      etapas: etapa === TODOS ? [] : [etapa as EtapaId],
      soPendentes: admin && soPendentes,
      email,
    })
    return separarPorSituacao(ordenarProspects(filtrados, ordem))
  }, [prospects, busca, analista, etapa, soPendentes, ordem, admin, email])

  const itensAnalista = useMemo(() => {
    const porEmail = new Map<string, string>()
    for (const p of prospects) if (p.dono !== null) porEmail.set(normalizarEmail(p.dono), p.dono)
    const pessoas = [...porEmail.entries()]
      .map(([value, original]) => ({ value, label: nomeCurto(original) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
    return [{ value: TODOS, label: "Todos os analistas" }, ...(email === null ? [] : [{ value: MEUS, label: "Meus" }]), ...pessoas]
  }, [prospects, email])

  const itensEtapa = useMemo(() => [{ value: TODOS, label: "Todas as etapas" }, ...etapas.map((e) => ({ value: e.id as string, label: e.rotulo }))], [etapas])

  const algumFiltro = busca.trim() !== "" || analista !== TODOS || etapa !== TODOS || soPendentes
  function limparFiltros() {
    setBusca("")
    setAnalista(TODOS)
    setEtapa(TODOS)
    setSoPendentes(false)
  }

  const fotoDe = (dono: string | null) => (dono === null ? undefined : avatares[normalizarEmail(dono)])
  const cartoes = (lista: ResumoProspect[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lista.map((p) => (
        <CardProspect key={p.slug} prospect={p} fotoUrl={fotoDe(p.dono)} />
      ))}
    </div>
  )

  return (
    <>
      <BarraTopo titulo="Growth Cycle" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">Prospects</p>
            <h1 className="text-texto-forte mt-1 text-2xl font-semibold tracking-tight">Growth Cycles</h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {admin && <DialogoClienteTeste etapas={etapas} />}
            <DialogoNovoProspect />
          </div>
        </header>
        {prospects.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpenIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum Growth Cycle ainda</EmptyTitle>
              <EmptyDescription>Crie o primeiro prospect para começar pela Etapa 01.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <DialogoNovoProspect />
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" role="search">
              <Input className="col-span-2 h-10 sm:h-8 sm:w-64" aria-label="Buscar prospect" placeholder="Buscar prospect…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              {admin && <FiltroSelect rotulo="Analista" valor={analista} itens={itensAnalista} aoMudar={setAnalista} />}
              <FiltroSelect rotulo="Etapa" valor={etapa} itens={itensEtapa} aoMudar={setEtapa} className="sm:w-52" />
              {admin && (
                <Button
                  variant={soPendentes ? "secondary" : "outline"}
                  className="col-span-2 h-10 sm:h-8"
                  aria-pressed={soPendentes}
                  onClick={() => setSoPendentes((v) => !v)}
                >
                  Com aprovação pendente
                </Button>
              )}
              <div className={cn("sm:ml-auto", admin && "col-span-2 sm:col-span-1")}>
                <FiltroSelect rotulo="Ordenar" valor={ordem} itens={ITENS_ORDEM} aoMudar={(v) => setOrdem(v as Ordem)} />
              </div>
            </div>
            {emAndamento.length + concluidos.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchXIcon />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum prospect encontrado</EmptyTitle>
                  <EmptyDescription>
                    {busca.trim() === "" ? "Nenhum prospect combina com esses filtros." : `Nenhum prospect combina com “${busca.trim()}” e os filtros escolhidos.`}
                  </EmptyDescription>
                </EmptyHeader>
                {algumFiltro && (
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={limparFiltros}>
                      Limpar filtros
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <>
                <section className="flex flex-col gap-3" aria-labelledby={`${id}-andamento`}>
                  <h2 id={`${id}-andamento`} className="text-texto-forte text-base font-semibold">
                    Em andamento
                    <Contador n={emAndamento.length} />
                  </h2>
                  {emAndamento.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum prospect em andamento.</p> : cartoes(emAndamento)}
                </section>
                {concluidos.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold">
                      <button
                        type="button"
                        aria-expanded={concluidosAbertos}
                        aria-controls={`${id}-concluidos`}
                        onClick={() => setConcluidosAbertos((v) => !v)}
                        className="text-texto-forte border-input hover:bg-accent focus-visible:ring-ring/50 flex min-h-10 items-center gap-1.5 rounded-lg border px-3 outline-none focus-visible:ring-3 sm:min-h-8"
                      >
                        <ChevronRightIcon className={cn("text-muted-foreground size-4 transition-transform", concluidosAbertos && "rotate-90")} aria-hidden="true" />
                        Concluídos
                        <Contador n={concluidos.length} />
                      </button>
                    </h2>
                    <div id={`${id}-concluidos`} hidden={!concluidosAbertos}>
                      {concluidosAbertos && cartoes(concluidos)}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
