"use client"

import { ChevronDownIcon } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { formatarDuracao, formatarUsd } from "@workspace/core/metricas/formato"
import type { Estatistica, MediaEtapa } from "@workspace/core/metricas/resumo"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { api, mensagemDeErro, type MediasPorEtapa } from "@/lib/api"
import type { EtapaRotulada } from "./comuns"
import { AvisoAdmin, NotaAdmin } from "@/components/admin/aviso-admin"
import { partesDoRotulo } from "@/lib/home"

/** Selo da média de uma etapa com poucos projetos na base. */
export const ROTULO_BASE_PEQUENA = "base pequena, menos de 5 projetos"

function Estat({ e, formatar }: { e: Estatistica | null; formatar: (v: number) => string }) {
  if (!e) return <span className="text-muted-foreground">Sem dados</span>
  return (
    <div className="tabular-nums">
      <div className="font-mono text-[15px] font-medium">{formatar(e.media)}</div>
      <div className="text-[11px] text-muted-foreground">
        mediana {formatar(e.mediana)} · {formatar(e.min)} a {formatar(e.max)} · {e.n} {e.n === 1 ? "projeto" : "projetos"}
      </div>
    </div>
  )
}

function TabelaMedias({ medias, etapas }: { medias: MediasPorEtapa; etapas: EtapaRotulada[] }) {
  const linhas = etapas.flatMap((e) => {
    const m: MediaEtapa | undefined = medias[e.id]
    return m ? [{ etapa: e, media: m }] : []
  })
  if (linhas.length === 0) return <p className="text-muted-foreground text-sm">Ainda não há etapa concluída para calcular médias.</p>
  return (
    <>
      {linhas.some((l) => l.media.basePequena) && (
        <NotaAdmin>Base pequena: as etapas marcadas têm menos de 5 projetos em alguma das médias, então vale pouco como referência.</NotaAdmin>
      )}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
        {linhas.map(({ etapa, media }) => {
          const { numero, titulo } = partesDoRotulo(etapa.rotulo)
          return (
            <li key={etapa.id} data-media={etapa.id} className="grid gap-2.5 rounded-[14px] border border-border px-3.5 py-3 text-xs">
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium">
                {numero && <span className="font-mono text-[11px] font-normal text-muted-foreground">{numero}</span>}
                <span className="min-w-0 truncate" title={etapa.rotulo}>
                  {titulo}
                </span>
                {media.basePequena && (
                  <Badge variant="aviso" className="ml-auto shrink-0">
                    {ROTULO_BASE_PEQUENA}
                  </Badge>
                )}
              </div>
              <div className="grid gap-0.5">
                <span className="text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase">Custo</span>
                <Estat e={media.custo} formatar={formatarUsd} />
              </div>
              <div className="grid gap-0.5">
                <span className="text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase">Tempo útil</span>
                <Estat e={media.tempoUtil} formatar={formatarDuracao} />
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/**
 * Seção recolhível "Médias por etapa" (fechada no começo), com média, mediana, mínimo a máximo e N de custo e tempo
 * útil das etapas concluídas. Os dados vêm de `api.metricasGerais()` só na primeira vez que a seção abre; erro fica
 * dentro da seção, com nova tentativa, e nunca afeta o resto do painel.
 */
export function SecaoMediasPorEtapa({ etapas }: { etapas: EtapaRotulada[] }) {
  const idConteudo = useId()
  const [aberto, setAberto] = useState(false)
  const [medias, setMedias] = useState<MediasPorEtapa | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!aberto || medias !== null) return
    let ativo = true
    setErro(null)
    api
      .metricasGerais()
      .then((d) => {
        if (ativo) setMedias(d.medias)
      })
      .catch((e: unknown) => {
        if (ativo) setErro(mensagemDeErro(e))
      })
    return () => {
      ativo = false
    }
  }, [aberto, medias, tentativa])

  let conteudo
  if (erro !== null) {
    conteudo = (
      <AvisoAdmin mensagem={erro} aba="projetos" aoTentarDeNovo={() => setTentativa((n) => n + 1)} />
    )
  } else if (medias === null) {
    conteudo = <Skeleton className="h-32 w-full" />
  } else {
    conteudo = <TabelaMedias medias={medias} etapas={etapas} />
  }

  return (
    <section aria-label="Médias por etapa" className="flex flex-col gap-3">
      <div>
        <Button type="button" variant="ghost" size="sm" aria-expanded={aberto} aria-controls={idConteudo} onClick={() => setAberto((a) => !a)} className="-ml-2.5 text-[13px]">
          <ChevronDownIcon data-icon="inline-start" aria-hidden="true" className={cn("transition-transform", !aberto && "-rotate-90")} />
          Médias <em className="font-serif text-[15px] font-normal text-link-acao italic">por etapa</em>
        </Button>
        <p className="text-muted-foreground text-sm">Etapas concluídas de projetos ativos, sem os clientes de teste. Não segue os filtros acima.</p>
      </div>
      <div id={idConteudo} hidden={!aberto} className="flex flex-col gap-3">
        {aberto && conteudo}
      </div>
    </section>
  )
}
