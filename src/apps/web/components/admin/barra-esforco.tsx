import { FRASES_ESFORCO, NIVEIS_ESFORCO, ROTULOS_ESFORCO, segmentosDoEsforco, type NivelEsforco } from "@workspace/core/modelos"
import { cn } from "@workspace/ui/lib/utils"

/** Cinco segmentos que acendem até o nível escolhido, com o rótulo ao lado. Em padrão ficam todos apagados. */
export function BarraEsforco({ esforco }: { esforco: NivelEsforco | null }) {
  const acesos = segmentosDoEsforco(esforco)
  const rotulo = esforco === null ? "padrão" : ROTULOS_ESFORCO[esforco]
  return (
    <span className="flex items-center gap-2" title={FRASES_ESFORCO[esforco ?? "padrao"]}>
      <span className="flex gap-0.5" aria-hidden="true">
        {NIVEIS_ESFORCO.map((n, i) => (
          <span key={n} className={cn("h-1.5 w-4 rounded-full", i < acesos ? "bg-foreground/70" : "bg-muted")} />
        ))}
      </span>
      <span className="text-muted-foreground text-xs">
        <span className="sr-only">Esforço: </span>
        {rotulo}
      </span>
    </span>
  )
}
