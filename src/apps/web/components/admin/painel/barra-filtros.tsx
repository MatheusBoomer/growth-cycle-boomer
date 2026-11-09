"use client"

import { DownloadIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import type { FiltroPainel } from "@workspace/core/metricas/painel"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { parametrosDeFiltro, type PeriodoRapido } from "@/lib/painel-filtro"
import type { RespostaPainel } from "@/lib/api"
import { rotuloModelo, type EtapaRotulada } from "./comuns"

type Periodo = PeriodoRapido | "custom"
type ListaDoFiltro = "donos" | "projetos" | "etapas" | "modelos"

const PERIODOS: Array<{ valor: Periodo; rotulo: string }> = [
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Este ano" },
  { valor: "custom", rotulo: "Personalizado" },
]
/** Mesmo teto do leitor da URL: acima disso o pedido cairia no padrão sem aviso. */
const MAXIMO_DIAS = 3660
const DIA_MS = 86_400_000
/** Valor do item neutro de cada select: ele só mostra o nome do filtro e não escolhe nada. */
const NEUTRO = "__filtro__"

interface Props {
  filtro: FiltroPainel
  /** Como o período foi escolhido (`periodo=` na URL ou `de`/`ate`). */
  periodo: Periodo
  opcoes: RespostaPainel["opcoes"]
  etapas: EtapaRotulada[]
  /** Recebe a query string completa do novo filtro (o painel a coloca na URL). */
  aoMudar: (params: URLSearchParams) => void
  aoAtualizar: () => void
  aoExportar: () => void
  atualizando?: boolean
  /** O último pedido falhou e os dados na tela estão velhos: não exporta o que não é o filtro atual. */
  exportarDesabilitado?: boolean
}

function diasEntre(de: string, ate: string): number {
  return (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS
}

function periodoValido(de: string, ate: string): boolean {
  if (de === "" || ate === "") return false
  const dias = diasEntre(de, ate)
  return Number.isFinite(dias) && dias >= 0 && dias < MAXIMO_DIAS
}

interface Chip {
  chave: string
  texto: string
  tituloRemover: string
  remover: () => void
}

/** Filtros de projeto inteiro e de custo, escolhidos por selects, com chips dos ativos, "Limpar" e as ações do painel. */
export function BarraFiltros({ filtro, periodo, opcoes, etapas, aoMudar, aoAtualizar, aoExportar, atualizando = false, exportarDesabilitado = false }: Props) {
  const [personalizado, setPersonalizado] = useState(periodo === "custom")
  const [de, setDe] = useState(filtro.de)
  const [ate, setAte] = useState(filtro.ate)
  useEffect(() => {
    setDe(filtro.de)
    setAte(filtro.ate)
  }, [filtro.de, filtro.ate])
  useEffect(() => {
    if (periodo !== "custom") setPersonalizado(false)
  }, [periodo])

  const emitir = (proximo: FiltroPainel, como: Periodo = periodo) => aoMudar(parametrosDeFiltro(proximo, como))

  const trocarPeriodo = (v: string[]) => {
    const novo = PERIODOS.find((p) => p.valor === (v.find((x) => x !== periodo) ?? v[0]))
    if (!novo || novo.valor === periodo) return
    if (novo.valor === "custom") {
      setPersonalizado(true)
      emitir(filtro, "custom")
    } else {
      setPersonalizado(false)
      emitir(filtro, novo.valor)
    }
  }

  const mudarData = (campo: "de" | "ate", valor: string) => {
    const proximo = { de: campo === "de" ? valor : de, ate: campo === "ate" ? valor : ate }
    if (campo === "de") setDe(valor)
    else setAte(valor)
    if (periodoValido(proximo.de, proximo.ate)) emitir({ ...filtro, ...proximo }, "custom")
  }

  const rotuloDe = (lista: ListaDoFiltro, id: string): string => {
    if (lista === "donos") return nomeCurto(id)
    if (lista === "projetos") return opcoes.projetos.find((p) => p.slug === id)?.nome ?? id
    if (lista === "etapas") return etapas.find((e) => e.id === id)?.rotulo ?? id
    return rotuloModelo(id)
  }

  const adicionar = (lista: ListaDoFiltro, id: string | null) => {
    if (id === null || id === NEUTRO || filtro[lista].includes(id)) return
    emitir({ ...filtro, [lista]: [...filtro[lista], id] })
  }

  const SELECTS: Array<{ lista: ListaDoFiltro; rotulo: string; larguraMenu: string; itens: Array<{ value: string; label: string }> }> = [
    { lista: "donos", rotulo: "Analista", larguraMenu: "min-w-56", itens: opcoes.donos.map((d) => ({ value: d, label: nomeCurto(d) })) },
    { lista: "projetos", rotulo: "Projeto", larguraMenu: "min-w-56", itens: opcoes.projetos.map((p) => ({ value: p.slug, label: p.nome })) },
    { lista: "etapas", rotulo: "Etapa", larguraMenu: "min-w-56", itens: etapas.map((e) => ({ value: e.id, label: e.rotulo })) },
    { lista: "modelos", rotulo: "Modelo", larguraMenu: "min-w-56", itens: opcoes.modelos.map((m) => ({ value: m, label: rotuloModelo(m) })) },
  ]

  const chips: Chip[] = []
  for (const { lista, rotulo } of SELECTS) {
    for (const id of filtro[lista]) {
      const texto = rotuloDe(lista, id)
      chips.push({
        chave: `${lista}:${id}`,
        texto: `${rotulo}: ${texto}`,
        tituloRemover: `Remover filtro ${rotulo}: ${texto}`,
        remover: () => emitir({ ...filtro, [lista]: filtro[lista].filter((x) => x !== id) }),
      })
    }
  }
  if (filtro.incluirTestes) {
    chips.push({ chave: "testes", texto: "Incluindo testes", tituloRemover: "Remover filtro Incluir testes", remover: () => emitir({ ...filtro, incluirTestes: false }) })
  }

  const mostrarDatas = personalizado || periodo === "custom"
  const datasInvalidas = mostrarDatas && !periodoValido(de, ate)

  return (
    <section aria-label="Filtros do painel" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ToggleGroup
          aria-label="Período"
          variant="outline"
          size="sm"
          spacing={0}
          value={[periodo]}
          onValueChange={(v: string[]) => trocarPeriodo(v)}
        >
          {PERIODOS.map((p) => (
            <ToggleGroupItem key={p.valor} value={p.valor}>
              {p.rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {mostrarDatas && (
          <div className="flex items-center gap-2">
            <Input type="date" value={de} onChange={(ev) => mudarData("de", ev.target.value)} aria-label="Data inicial" aria-invalid={datasInvalidas} className="w-36" />
            <span className="text-muted-foreground text-sm" aria-hidden="true">
              até
            </span>
            <Input type="date" value={ate} onChange={(ev) => mudarData("ate", ev.target.value)} aria-label="Data final" aria-invalid={datasInvalidas} className="w-36" />
          </div>
        )}
        {datasInvalidas && (
          <p role="alert" className="text-destructive text-xs">
            Datas inválidas: a final não pode vir antes da inicial, e o período vai até 10 anos.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SELECTS.map(({ lista, rotulo, larguraMenu, itens }) => (
          <Select
            key={lista}
            items={[{ value: NEUTRO, label: rotulo }, ...itens]}
            value={NEUTRO}
            onValueChange={(v) => adicionar(lista, v)}
          >
            <SelectTrigger size="sm" aria-label={rotulo} className="max-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className={larguraMenu}>
              {itens
                .filter((i) => !filtro[lista].includes(i.value))
                .map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ))}
        <label className="flex items-center gap-1.5 px-1 text-sm">
          <input
            type="checkbox"
            checked={filtro.incluirTestes}
            onChange={(ev) => emitir({ ...filtro, incluirTestes: ev.target.checked })}
            className="accent-primary size-4 rounded"
          />
          Incluir testes
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={aoAtualizar} disabled={atualizando}>
            <RefreshCwIcon data-icon="inline-start" className={atualizando ? "animate-spin" : undefined} />
            Atualizar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={aoExportar} disabled={exportarDesabilitado}>
            <DownloadIcon data-icon="inline-start" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {chips.length > 0 && (
        <ul aria-label="Filtros ativos" className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <li key={c.chave} className="bg-muted flex max-w-full items-center gap-0.5 rounded-full py-0.5 pr-0.5 pl-2.5 text-xs">
              <span className="max-w-56 truncate" title={c.texto}>
                {c.texto}
              </span>
              <button
                type="button"
                aria-label={c.tituloRemover}
                onClick={c.remover}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-5 items-center justify-center rounded-full outline-none focus-visible:ring-3"
              >
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
          <li>
            <Button type="button" variant="ghost" size="xs" onClick={() => emitir({ ...filtro, donos: [], projetos: [], etapas: [], modelos: [], incluirTestes: false })}>
              Limpar
            </Button>
          </li>
        </ul>
      )}
    </section>
  )
}
