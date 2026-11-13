"use client"

import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import type { ResumoProspect } from "@workspace/core/tipos"
import { cn } from "@workspace/ui/lib/utils"
import { continuarDeOndeParou, numerosDaHome, partesDoRotulo } from "@/lib/home"
import { AnelCiclo } from "./anel-ciclo"
import { NumeroAnimado } from "./numero-animado"

const CARD = "vidro rounded-[18px] border border-border"

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div data-slot="numero" className={cn(CARD, "flex min-h-[116px] flex-col justify-between p-[18px]")}>
      <NumeroAnimado valor={valor} className="font-serif text-[56px] leading-[.9] sm:text-[64px]" />
      <span className="text-muted-foreground text-[13px]">{rotulo}</span>
    </div>
  )
}

function Aprovacoes({ prospects, aoFiltrarPendentes }: { prospects: ResumoProspect[]; aoFiltrarPendentes: () => void }) {
  const { aprovacoes, comAprovacao } = numerosDaHome(prospects)
  if (aprovacoes === 0) {
    return (
      <div data-slot="aprovacoes" className={cn(CARD, "text-muted-foreground col-span-2 flex items-center p-[18px] text-[15px]")}>
        Nenhuma aprovação esperando
      </div>
    )
  }
  const quem = comAprovacao.length === 1 ? comAprovacao[0]!.nome : `${comAprovacao.length} projetos`
  const conteudo = (
    <>
      <span className="text-left">
        <NumeroAnimado valor={aprovacoes} className="block font-serif text-[64px] leading-[.9] sm:text-[72px]" />
        <span className="mt-1 block text-[15px] text-black/70">
          {aprovacoes === 1 ? "1 aprovação esperando você" : `${aprovacoes} aprovações esperando você`} · {quem}
        </span>
      </span>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-black/85 text-primario-claro">
        <ArrowRightIcon className="size-5" />
      </span>
    </>
  )
  const estilo = cn(
    "from-primario-claro via-primary to-link-acao col-span-2 flex items-center justify-between gap-4 rounded-[18px] bg-linear-135 p-[18px] text-black/85",
    "shadow-[0_16px_36px_-18px_rgb(235_97_10/0.7)] transition-transform hover:-translate-y-0.5 focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
  )
  return comAprovacao.length === 1 ? (
    <Link data-slot="aprovacoes" href={`/prospects/${comAprovacao[0]!.slug}`} className={estilo}>
      {conteudo}
    </Link>
  ) : (
    <button data-slot="aprovacoes" type="button" onClick={aoFiltrarPendentes} className={cn(estilo, "cursor-pointer")}>
      {conteudo}
    </button>
  )
}

/** Bento da home: o projeto mexido por último em destaque, os números e as aprovações esperando (protótipo 2-home.html, arranjo B). */
export function Bento({ prospects, aoFiltrarPendentes }: { prospects: ResumoProspect[]; aoFiltrarPendentes: () => void }) {
  const continuar = continuarDeOndeParou(prospects)
  const { emAndamento, concluidos } = numerosDaHome(prospects)
  const etapa = continuar ? partesDoRotulo(continuar.rotuloEtapaAtual) : null
  return (
    <div className="grid gap-3.5 lg:grid-cols-[7fr_5fr]">
      <div className={cn(CARD, "flex min-h-[260px] items-center justify-between gap-5 p-6 sm:p-7")}>
        {continuar && etapa ? (
          <>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">Continue de onde parou</p>
              <p className="mt-2.5 truncate text-[32px] font-medium tracking-[-0.035em] sm:text-[38px]" title={continuar.nome}>
                {continuar.nome}
              </p>
              <p className="text-muted-foreground mt-4 text-[15px]">
                {etapa.numero ? `Etapa ${etapa.numero}` : "Etapa"}
                <em className="text-link-acao mt-1 block font-serif text-[34px] leading-none not-italic sm:text-[40px]">
                  <span className="italic">{etapa.titulo}</span>
                </em>
              </p>
              <Link
                href={`/prospects/${continuar.slug}`}
                className="bg-foreground text-background mt-6 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-transform hover:-translate-y-px"
              >
                Abrir etapa <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>
            <div className="max-sm:hidden">
              <AnelCiclo concluidas={continuar.concluidas} total={continuar.totalEtapas} atual tamanho={200} />
            </div>
          </>
        ) : (
          <div>
            <p className="text-muted-foreground text-[11px] tracking-[0.14em] uppercase">Continue de onde parou</p>
            <p className="mt-2.5 text-[28px] font-medium tracking-[-0.03em]">Nenhum projeto em andamento</p>
            <p className="text-muted-foreground mt-2 text-sm">Crie um prospect no botão “Novo prospect” para começar.</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        <Numero valor={emAndamento} rotulo="em andamento" />
        <Numero valor={concluidos} rotulo="concluídos" />
        <Aprovacoes prospects={prospects} aoFiltrarPendentes={aoFiltrarPendentes} />
      </div>
    </div>
  )
}
