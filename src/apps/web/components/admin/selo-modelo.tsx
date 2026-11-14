import type { ListaDeModelos } from "@workspace/core/modelos"
import { seloDoModelo } from "@workspace/core/modelos"
import { cn } from "@workspace/ui/lib/utils"
import { textoSelo } from "@/lib/celula-modelo"

/** Cor do selo por família: Haiku verde, Sonnet azul, Opus roxo, outra família neutra e Padrão cinza tracejado. Tudo por token (claro e escuro). */
const COR_POR_FAMILIA: Record<string, string> = {
  haiku: "border-transparent bg-selo-haiku-fundo text-selo-haiku",
  sonnet: "border-transparent bg-selo-sonnet-fundo text-selo-sonnet",
  opus: "border-transparent bg-selo-opus-fundo text-selo-opus",
}
const COR_NEUTRA = "border-transparent bg-muted text-muted-foreground"
const COR_PADRAO = "border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground"

/** Selo do modelo escolhido para um agente. `null` é o modelo padrão. */
export function SeloModelo({ modelo, lista, className }: { modelo: string | null; lista: ListaDeModelos; className?: string }) {
  const selo = seloDoModelo(modelo, lista)
  const cor = selo.padrao ? COR_PADRAO : ((selo.familia !== null ? COR_POR_FAMILIA[selo.familia] : undefined) ?? COR_NEUTRA)
  return (
    <span className={cn("inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", cor, className)}>
      {textoSelo(selo, lista)}
    </span>
  )
}
