import { ROTULO_TIPO, type TipoReport } from "@workspace/core/reports"
import { Badge } from "@workspace/ui/components/badge"

/** dd/mm hh:mm no horário de Brasília. */
export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
}

export function SeloTipo({ tipo }: { tipo: TipoReport }) {
  return <Badge variant={tipo === "bug" ? "destructive" : "secondary"}>{ROTULO_TIPO[tipo]}</Badge>
}
