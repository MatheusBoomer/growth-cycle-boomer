"use client"

import { ChevronRightIcon, FolderOpenIcon, SearchXIcon } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import { normalizarEmail } from "@workspace/core/papeis"
import type { EtapaId, ResumoProspect } from "@workspace/core/tipos"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import type { EtapaParaEscolher } from "@/components/home/escolha-etapa"
import { BarraTopo } from "@/components/marca/barra-topo"
import { FaixaDithered } from "@/components/marca/faixa-dithered"
import { useEmailDaConta, usePapel } from "@/components/marca/conta-contexto"
import {
  filtrarProspects,
  ordenarProspects,
  separarPorSituacao,
  type Ordem,
} from "@/lib/filtro-prospects"
import { numerosDaHome } from "@/lib/home"
import { Bento } from "./bento"
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
    <Select
      items={itens}
      value={valor}
      onValueChange={(v) => aoMudar(v ?? TODOS)}
    >
      <SelectTrigger
        className={cn(
          "w-full data-[size=default]:h-10 sm:w-44 sm:data-[size=default]:h-8",
          className
        )}
        aria-label={rotulo}
      >
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

/** Segmentado em pílula; cada opção é um botão com aria-pressed (40 px de toque no celular). */
function Segmentado({
  opcoes,
}: {
  opcoes: { rotulo: string; ativo: boolean; aoClicar: () => void }[]
}) {
  return (
    <div className="col-span-2 flex items-center gap-0.5 rounded-full border border-border p-1 sm:col-span-1">
      {opcoes.map((o) => (
        <button
          key={o.rotulo}
          type="button"
          aria-pressed={o.ativo}
          onClick={o.aoClicar}
          className={cn(
            "h-10 flex-1 rounded-full px-3 text-sm whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-7 sm:flex-none",
            o.ativo && "bg-accent text-foreground shadow-(--sombra-card)"
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

function Contador({ n }: { n: number }) {
  return (
    <span className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums">
      {n}
    </span>
  )
}

export function GradeProspects({
  prospects,
  etapas,
  avatares,
}: {
  prospects: ResumoProspect[]
  etapas: EtapaParaEscolher[]
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
    const donos =
      admin && analista !== TODOS
        ? [analista === MEUS ? (email ?? "") : analista]
        : []
    const filtrados = filtrarProspects(prospects, {
      busca,
      donos,
      etapas: etapa === TODOS ? [] : [etapa as EtapaId],
      soPendentes,
      buscaPorDono: admin,
      email,
    })
    return separarPorSituacao(ordenarProspects(filtrados, ordem))
  }, [prospects, busca, analista, etapa, soPendentes, ordem, admin, email])

  // Ctrl+K / ⌘K leva o cursor para a busca, menos com um diálogo aberto (o cursor sairia de dentro dele).
  const campoBusca = useRef<HTMLInputElement>(null)
  // Mac mostra ⌘K; os outros, Ctrl K. Começa em ⌘K e só troca depois de hidratar, para o servidor e o cliente baterem.
  const [atalho, setAtalho] = useState("⌘K")
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setAtalho("Ctrl K")
  }, [])
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        campoBusca.current?.focus()
      }
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [])
  const numeros = numerosDaHome(prospects)

  const itensAnalista = useMemo(() => {
    const porEmail = new Map<string, string>()
    for (const p of prospects)
      if (p.dono !== null) porEmail.set(normalizarEmail(p.dono), p.dono)
    const pessoas = [...porEmail.entries()]
      .map(([value, original]) => ({ value, label: nomeCurto(original) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
    return [
      { value: TODOS, label: "Todos os analistas" },
      ...(email === null ? [] : [{ value: MEUS, label: "Meus" }]),
      ...pessoas,
    ]
  }, [prospects, email])

  const itensEtapa = useMemo(
    () => [
      { value: TODOS, label: "Todas as etapas" },
      ...etapas.map((e) => ({ value: e.id as string, label: e.rotulo })),
    ],
    [etapas]
  )

  const algumFiltro =
    busca.trim() !== "" || analista !== TODOS || etapa !== TODOS || soPendentes
  function limparFiltros() {
    setBusca("")
    setAnalista(TODOS)
    setEtapa(TODOS)
    setSoPendentes(false)
  }

  const fotoDe = (dono: string | null) =>
    dono === null ? undefined : avatares[normalizarEmail(dono)]
  const cartoes = (lista: ResumoProspect[]) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lista.map((p) => (
        <CardProspect key={p.slug} prospect={p} fotoUrl={fotoDe(p.dono)} />
      ))}
    </div>
  )

  return (
    <>
      <BarraTopo titulo="Growth Cycle" />
      <div className="relative isolate">
        <FaixaDithered />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 pt-8 pb-10 sm:px-8">
          <header
            className="surgir flex flex-wrap items-end gap-4"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {numeros.aprovacoes > 0 && (
                  <i className="size-1.5 rounded-full bg-aviso" />
                )}
                {numeros.emAndamento} em andamento ·{" "}
                {numeros.aprovacoes === 1
                  ? "1 aprovação pendente"
                  : `${numeros.aprovacoes} aprovações pendentes`}
              </span>
              <h1 className="mt-3.5 text-[44px] leading-[.95] font-medium tracking-[-0.045em] sm:text-[60px]">
                Seus Growth{" "}
                <em className="font-serif font-normal tracking-[-0.02em] text-link-acao italic">
                  Cycles
                </em>
              </h1>
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
                <EmptyDescription>
                  Crie o primeiro prospect para começar pela Etapa 01.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <DialogoNovoProspect />
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div
                className="surgir"
                style={{ "--i": 1 } as React.CSSProperties}
              >
                <Bento
                  prospects={prospects}
                  aoFiltrarPendentes={() => setSoPendentes(true)}
                />
              </div>
              <div
                className="surgir grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
                style={{ "--i": 2 } as React.CSSProperties}
                role="search"
              >
                <Segmentado
                  opcoes={[
                    {
                      rotulo: "Todos",
                      ativo: !soPendentes && analista === TODOS,
                      aoClicar: () => (
                        setSoPendentes(false),
                        setAnalista(TODOS)
                      ),
                    },
                    ...(admin && email !== null
                      ? [
                          {
                            rotulo: "Meus",
                            ativo: !soPendentes && analista === MEUS,
                            aoClicar: () => (
                              setSoPendentes(false),
                              setAnalista(MEUS)
                            ),
                          },
                        ]
                      : []),
                    {
                      rotulo: "Com aprovação pendente",
                      ativo: soPendentes,
                      aoClicar: () => setSoPendentes((v) => !v),
                    },
                  ]}
                />
                <Input
                  ref={campoBusca}
                  className="col-span-2 h-10 sm:h-8 sm:w-72"
                  aria-label="Buscar prospect"
                  aria-keyshortcuts="Control+K Meta+K"
                  placeholder={`${admin ? "Buscar prospect, etapa ou analista" : "Buscar prospect ou etapa"}  ${atalho}`}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                {admin && (
                  <FiltroSelect
                    rotulo="Analista"
                    valor={analista}
                    itens={itensAnalista}
                    aoMudar={setAnalista}
                  />
                )}
                <FiltroSelect
                  rotulo="Etapa"
                  valor={etapa}
                  itens={itensEtapa}
                  aoMudar={setEtapa}
                  className="sm:w-52"
                />
                <div className="col-span-2 sm:col-span-1 sm:ml-auto">
                  <FiltroSelect
                    rotulo="Ordenar"
                    valor={ordem}
                    itens={ITENS_ORDEM}
                    aoMudar={(v) => setOrdem(v as Ordem)}
                  />
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
                      {busca.trim() === ""
                        ? "Nenhum prospect combina com esses filtros."
                        : `Nenhum prospect combina com “${busca.trim()}” e os filtros escolhidos.`}
                    </EmptyDescription>
                  </EmptyHeader>
                  {algumFiltro && (
                    <EmptyContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={limparFiltros}
                      >
                        Limpar filtros
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              ) : (
                <>
                  <section
                    className="surgir flex flex-col gap-3"
                    style={{ "--i": 3 } as React.CSSProperties}
                    aria-labelledby={`${id}-andamento`}
                  >
                    <h2
                      id={`${id}-andamento`}
                      className="flex items-baseline gap-2 text-sm font-medium text-texto-forte"
                    >
                      <span>
                        Em andamento
                        <Contador n={emAndamento.length} />
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-border"
                      />
                    </h2>
                    {emAndamento.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum prospect em andamento.
                      </p>
                    ) : (
                      cartoes(emAndamento)
                    )}
                  </section>
                  {concluidos.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <h2 className="text-base font-semibold">
                        <button
                          type="button"
                          aria-expanded={concluidosAbertos}
                          aria-controls={`${id}-concluidos`}
                          onClick={() => setConcluidosAbertos((v) => !v)}
                          className="flex min-h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-texto-forte outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8"
                        >
                          <ChevronRightIcon
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              concluidosAbertos && "rotate-90"
                            )}
                            aria-hidden="true"
                          />
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
      </div>
    </>
  )
}
