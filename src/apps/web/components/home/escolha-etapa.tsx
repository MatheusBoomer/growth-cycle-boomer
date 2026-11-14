import type { EtapaId } from "@workspace/core/tipos"
import { cn } from "@workspace/ui/lib/utils"

export type EtapaParaEscolher = { id: EtapaId; rotulo: string; fase?: string }

/** Número e nome a partir do rótulo "03 · Diagnóstico de performance"; sem o separador, o rótulo inteiro é o nome. */
function partes(rotulo: string): [string, string] {
  const i = rotulo.indexOf(" · ")
  return i === -1 ? ["", rotulo] : [rotulo.slice(0, i), rotulo.slice(i + 3)]
}

/** Escolha de uma etapa agrupada por fase, como a trilha (cliente de teste e reposicionar). */
export function EscolhaEtapa({
  etapas,
  valor,
  aoEscolher,
  rotulo,
}: {
  etapas: EtapaParaEscolher[]
  valor: EtapaId
  aoEscolher: (id: EtapaId) => void
  rotulo: string
}) {
  const grupos: { fase: string; etapas: EtapaParaEscolher[] }[] = []
  for (const e of etapas) {
    const fase = e.fase ?? ""
    const ultimo = grupos.at(-1)
    if (ultimo && ultimo.fase === fase) ultimo.etapas.push(e)
    else grupos.push({ fase, etapas: [e] })
  }
  return (
    <div role="radiogroup" aria-label={rotulo} className="-mr-1 grid max-h-[min(260px,40vh)] gap-1 overflow-y-auto pr-1">
      {grupos.map((g) => (
        <div key={g.fase + g.etapas[0]!.id} className="grid gap-1">
          {g.fase && (
            <div data-fase className="px-1 pt-2.5 pb-1 text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
              {g.fase}
            </div>
          )}
          {g.etapas.map((e) => {
            const [n, nome] = partes(e.rotulo)
            const marcada = valor === e.id
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={marcada}
                onClick={() => aoEscolher(e.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[14px] border border-border bg-background px-3 py-2.5 text-left text-[13.5px] transition-colors outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
                  marcada && "border-primary/55 bg-primary/7 hover:border-primary/55",
                )}
              >
                {n && <span className="w-[18px] shrink-0 font-mono text-[11px] text-muted-foreground">{n}</span>}
                <span className="min-w-0 flex-1">{nome}</span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-border",
                    marcada && "border-primary after:size-2 after:rounded-full after:bg-primary",
                  )}
                />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
