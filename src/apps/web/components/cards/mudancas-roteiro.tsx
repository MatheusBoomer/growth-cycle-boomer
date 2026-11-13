import { Badge } from "@workspace/ui/components/badge"
import type { Diferenca, StatusSlide } from "@/lib/roteiro"

const ROTULO: Record<StatusSlide | "removido", string> = { igual: "Igual", alterado: "Alterado", novo: "Novo", movido: "Movido", removido: "Saiu" }
const VARIANTE = { igual: "outline", alterado: "aviso", novo: "sucesso", movido: "secondary", removido: "perigo" } as const

/** Etiqueta do que aconteceu com o slide em relação à versão anterior do roteiro. */
export function EtiquetaMudanca({ status }: { status: StatusSlide | "removido" }) {
  return (
    <Badge variant={VARIANTE[status]} className="shrink-0">
      {ROTULO[status]}
    </Badge>
  )
}

const nomeDoArquivo = (rotulo: string, v: string) => (rotulo === "Imagem" ? (v.split("/").pop() ?? v) : v)

/** O que saiu (riscado) e o que entrou (destacado) em cada parte do slide. */
export function DiferencasDoSlide({ diferencas }: { diferencas: Diferenca[] }) {
  if (diferencas.length === 0) return null
  return (
    <ul className="grid gap-1.5 text-[12.5px]">
      {diferencas.map((d) => (
        <li key={d.rotulo} className="grid gap-1">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">{d.rotulo}</span>
          {d.removidos.length === 0 && d.adicionados.length === 0 ? (
            <p className="text-muted-foreground">Mudou algo que não aparece na prévia (ordem ou campos internos).</p>
          ) : (
            <>
              {d.removidos.map((t) => (
                <del key={`r-${t}`} className="block text-muted-foreground decoration-1">
                  {nomeDoArquivo(d.rotulo, t)}
                </del>
              ))}
              {d.adicionados.map((t) => (
                <ins key={`a-${t}`} className="block w-fit rounded-md bg-sucesso-fundo px-1.5 py-0.5 text-sucesso no-underline">
                  {nomeDoArquivo(d.rotulo, t)}
                </ins>
              ))}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
