import { Badge } from "@workspace/ui/components/badge"
import type { Diferenca, StatusSlide } from "@/lib/roteiro"

const ROTULO: Record<StatusSlide | "removido", string> = { igual: "Igual", alterado: "Alterado", novo: "Novo", movido: "Movido", removido: "Removido" }
const VARIANTE = { igual: "outline", alterado: "aviso", novo: "sucesso", movido: "secondary", removido: "perigo" } as const

/** Etiqueta do que aconteceu com o slide em relação à versão anterior do roteiro. */
export function EtiquetaMudanca({ status }: { status: StatusSlide | "removido" }) {
  return (
    <Badge variant={VARIANTE[status]} className="shrink-0 text-[10px]">
      {ROTULO[status]}
    </Badge>
  )
}

const nomeDoArquivo = (rotulo: string, v: string) => (rotulo === "Imagem" ? (v.split("/").pop() ?? v) : v)

/** O que saiu (riscado) e o que entrou (destacado) em cada parte do slide. */
export function DiferencasDoSlide({ diferencas }: { diferencas: Diferenca[] }) {
  if (diferencas.length === 0) return null
  return (
    <ul className="space-y-1.5 text-xs">
      {diferencas.map((d) => (
        <li key={d.rotulo}>
          <span className="text-muted-foreground font-mono text-[10px] uppercase">{d.rotulo}</span>
          {d.removidos.length === 0 && d.adicionados.length === 0 ? (
            <p className="text-muted-foreground">Mudou algo que não aparece na prévia (ordem ou campos internos).</p>
          ) : (
            <>
              {d.removidos.map((t) => (
                <p key={`r-${t}`} className="text-muted-foreground line-through decoration-1">
                  {nomeDoArquivo(d.rotulo, t)}
                </p>
              ))}
              {d.adicionados.map((t) => (
                <p key={`a-${t}`} className="bg-sucesso-fundo text-sucesso rounded px-1 py-0.5">
                  {nomeDoArquivo(d.rotulo, t)}
                </p>
              ))}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
