// Montagem do report no navegador: contexto da tela, formulário multipart e checagem rápida dos extras.
// Lógica pura e testável; a captura e o diálogo ficam em components/reports.
import { type ContextoReport, LIMITE_IMAGEM_BYTES, type TipoReport } from "@workspace/core/reports"

/** Página, prospect (de `/prospects/<slug>`), navegador e tamanho da janela, sem nada do analista. */
export function contextoDaTela(
  loc: { pathname: string; search: string },
  nav: { userAgent: string },
  janela: { innerWidth: number; innerHeight: number },
): ContextoReport {
  const prospect = /^\/prospects\/([^/]+)/.exec(loc.pathname)?.[1] ?? null
  return {
    url: loc.pathname + loc.search,
    prospect: prospect ? decodeURIComponent(prospect) : null,
    navegador: nav.userAgent,
    tela: { largura: janela.innerWidth, altura: janela.innerHeight },
  }
}

/** Corpo de POST /api/reports. O autor nunca vai daqui: o servidor usa o da sessão. */
export function montarFormularioReport(d: {
  tipo: TipoReport
  comentario: string
  contexto: ContextoReport
  tela: Blob | null
  extras: File[]
}): FormData {
  const form = new FormData()
  form.set("dados", JSON.stringify({ tipo: d.tipo, comentario: d.comentario, contexto: d.contexto }))
  if (d.tela) form.set("tela", d.tela, "tela.png")
  for (const extra of d.extras) form.append("extras", extra)
  return form
}

/** Base64 (com ou sem o prefixo `data:...;base64,`) para Blob. */
export function base64ParaBlob(base64: string, tipo: string): Blob {
  const binario = atob(base64.replace(/^data:[^;]+;base64,/, ""))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}

/** Mensagem de erro quando o extra não serve, ou null. O servidor confere de novo pelos bytes. */
export function extraAceito(arquivo: File): string | null {
  if (arquivo.type !== "image/png" && arquivo.type !== "image/jpeg") return "Imagem em formato não aceito. Use PNG ou JPEG."
  if (arquivo.size > LIMITE_IMAGEM_BYTES) return "Cada imagem pode ter no máximo 5 MB."
  return null
}
