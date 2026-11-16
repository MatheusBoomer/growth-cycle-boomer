/** "16/11 às 14:32" no fuso informado (o do navegador por padrão); vazio se a data é inválida. */
export function dataDeGeracao(iso: string, fuso?: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ""
  try {
    const partes = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: fuso,
    }).formatToParts(data)
    const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ""
    return `${de("day")}/${de("month")} às ${de("hour")}:${de("minute")}`
  } catch {
    return ""
  }
}
