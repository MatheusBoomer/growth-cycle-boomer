import { CloudIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"

/** As mensagens do servidor para quem roda o app com os dados desta máquina (modo fs). */
export function ehSemNuvem(mensagem: string): boolean {
  return /só existem? com os dados na nuvem/.test(mensagem)
}

export type AbaAdmin = "pessoas" | "projetos" | "modelos" | "skills" | "notas" | "reports" | "detalhe"

const TEXTO_NUVEM: Record<AbaAdmin, { titulo: string; texto: string }> = {
  pessoas: { titulo: "Pessoas", texto: "Quem tem acesso e o papel de cada um ficam no Supabase e aparecem no app publicado." },
  projetos: { titulo: "Projetos e custos", texto: "Os custos e o tempo de cada projeto ficam no Supabase e aparecem no app publicado." },
  detalhe: { titulo: "O detalhe do projeto", texto: "Os custos e o tempo de cada projeto ficam no Supabase e aparecem no app publicado." },
  modelos: { titulo: "Modelos por etapa", texto: "A escolha de modelo e esforço de cada etapa fica no Supabase e vale no app publicado." },
  skills: { titulo: "O catálogo de skills", texto: "O catálogo e as notas ficam no Supabase e aparecem no app publicado." },
  notas: { titulo: "As notas", texto: "As notas de melhoria ficam no Supabase e aparecem no app publicado." },
  reports: { titulo: "Os reports", texto: "Os bugs e melhorias enviados pelo botão Reportar ficam no Supabase e aparecem no app publicado." },
}

const QUADRO = "flex items-center gap-4 rounded-[18px] border border-dashed border-border bg-muted/30 px-5 py-4.5"
const ICONE = "grid size-11 shrink-0 place-items-center rounded-[14px] [&_svg]:size-4.5"

/**
 * Aviso das telas da administração no lugar do Alert cinza: "só na nuvem" com o texto da aba quando o app roda com
 * os dados desta máquina; qualquer outro erro aparece com a mensagem e, se houver, "Tentar de novo".
 */
export function AvisoAdmin({ mensagem, aba, aoTentarDeNovo }: { mensagem: string; aba: AbaAdmin; aoTentarDeNovo?: () => void }) {
  if (ehSemNuvem(mensagem)) {
    const t = TEXTO_NUVEM[aba]
    return (
      <div data-slot="alert" role="status" className={QUADRO}>
        <div className={`${ICONE} bg-selo-sonnet-fundo text-selo-sonnet`} aria-hidden>
          <CloudIcon />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium">
            {t.titulo} <em className="font-serif text-[17px] font-normal text-link-acao italic">só na nuvem</em>
          </h3>
          <p className="mt-0.5 text-[13px] leading-normal text-muted-foreground">Aqui o app roda com os dados desta máquina. {t.texto}</p>
        </div>
      </div>
    )
  }
  return (
    <div data-slot="alert" role="alert" className={QUADRO}>
      <div className={`${ICONE} bg-perigo-fundo text-destructive`} aria-hidden>
        <TriangleAlertIcon />
      </div>
      <p className="min-w-0 flex-1 text-[13px] leading-normal">{mensagem}</p>
      {aoTentarDeNovo && (
        <Button type="button" variant="outline" size="sm" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

/** Nota curta de contexto (ex.: base pequena, lista de modelos incompleta), em âmbar e sem cara de erro. */
export function NotaAdmin({ children }: { children: ReactNode }) {
  return (
    <div data-slot="alert" role="note" className="flex items-start gap-2.5 rounded-[14px] bg-aviso-fundo px-3.5 py-3 text-[13px] leading-normal text-aviso">
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  )
}
