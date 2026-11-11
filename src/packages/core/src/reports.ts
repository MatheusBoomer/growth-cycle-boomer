/**
 * Reports de bug e melhoria que qualquer usuário envia pelo app: tipos, limites, validação e o texto de exportação.
 * Sem imports de `node:`, porque componentes de cliente importam este módulo.
 */
import { nomeCurto } from "./autenticacao"
import { ErroEntrada } from "./erros"
import { normalizarSlug } from "./slug"

export type TipoReport = "bug" | "melhoria"
export type StatusReport = "aberto" | "em_andamento" | "resolvido" | "descartado"

export const TIPOS_REPORT: readonly TipoReport[] = ["bug", "melhoria"]
export const STATUS_REPORT: readonly StatusReport[] = ["aberto", "em_andamento", "resolvido", "descartado"]
export const ROTULO_TIPO: Record<TipoReport, string> = { bug: "Bug", melhoria: "Melhoria" }
export const ROTULO_STATUS: Record<StatusReport, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  descartado: "Descartado",
}

export const LIMITE_COMENTARIO = 2000
export const LIMITE_NOTA_ADMIN = 2000
export const LIMITE_IMAGENS_EXTRAS = 3
export const LIMITE_IMAGEM_BYTES = 5 * 1024 * 1024
export const MSG_REPORTS_SEM_NUVEM = "Os reports só existem com os dados na nuvem."

const LIMITE_URL = 500
const LIMITE_NAVEGADOR = 300

export interface ContextoReport {
  /** Caminho e query da página, sem host. */
  url: string
  /** Slug do prospect aberto, quando a página é de um prospect. */
  prospect: string | null
  navegador: string
  tela: { largura: number; altura: number } | null
}

export interface NovoReport {
  tipo: TipoReport
  comentario: string
  contexto: ContextoReport
}

export interface Report extends NovoReport {
  id: number
  status: StatusReport
  autor: string
  /** Caminhos no bucket (`<id>/<n>.<png|jpg>`); o print da tela, quando existe, é o primeiro. */
  imagens: string[]
  notaAdmin: string | null
  criadoEm: string
  atualizadoEm: string | null
  atualizadoPor: string | null
}

export interface FiltroReports {
  status?: StatusReport[]
  tipo?: TipoReport
}

export interface MudancaReport {
  status?: StatusReport
  notaAdmin?: string | null
}

export type FormatoImagem = "png" | "jpg"

export interface ImagemReport {
  bytes: Uint8Array
  formato: FormatoImagem
}

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const texto = (v: unknown): string => (typeof v === "string" ? v : "")

const ehTipo = (v: unknown): v is TipoReport => TIPOS_REPORT.includes(v as TipoReport)
export const ehStatusReport = (v: unknown): v is StatusReport => STATUS_REPORT.includes(v as StatusReport)

function caminhoSemHost(valor: string): string {
  if (valor === "") return ""
  try {
    const u = new URL(valor, "http://x")
    return (u.pathname + u.search).slice(0, LIMITE_URL)
  } catch {
    return ""
  }
}

function tela(v: unknown): ContextoReport["tela"] {
  const { largura, altura } = objeto(v)
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 100_000
  return ok(largura) && ok(altura) ? { largura, altura } : null
}

function contextoValido(v: unknown): ContextoReport {
  const c = objeto(v)
  const prospect = texto(c.prospect)
  return {
    url: caminhoSemHost(texto(c.url)),
    prospect: prospect !== "" && normalizarSlug(prospect) === prospect ? prospect : null,
    navegador: texto(c.navegador).slice(0, LIMITE_NAVEGADOR),
    tela: tela(c.tela),
  }
}

/** Valida e normaliza o que o cliente mandou. O autor nunca vem daqui: quem chama usa o da sessão. */
export function validarNovoReport(entrada: unknown): NovoReport {
  const e = objeto(entrada)
  if (!ehTipo(e.tipo)) throw new ErroEntrada("Escolha se é um bug ou uma melhoria.")
  const comentario = texto(e.comentario).trim()
  if (!comentario) throw new ErroEntrada("Escreva o que aconteceu ou o que sugere.")
  if (comentario.length > LIMITE_COMENTARIO) throw new ErroEntrada(`O comentário passa de ${LIMITE_COMENTARIO} caracteres.`)
  return { tipo: e.tipo, comentario, contexto: contextoValido(e.contexto) }
}

/** Mudança do admin: status e/ou nota interna. Nota vazia vira null (apaga a nota). */
export function validarMudancaReport(entrada: unknown): MudancaReport {
  const e = objeto(entrada)
  const mudanca: MudancaReport = {}
  if ("status" in e) {
    if (!ehStatusReport(e.status)) throw new ErroEntrada("Status inválido.")
    mudanca.status = e.status
  }
  if ("notaAdmin" in e) {
    if (e.notaAdmin !== null && typeof e.notaAdmin !== "string") throw new ErroEntrada("Nota inválida.")
    const nota = (e.notaAdmin ?? "").trim()
    if (nota.length > LIMITE_NOTA_ADMIN) throw new ErroEntrada(`A nota passa de ${LIMITE_NOTA_ADMIN} caracteres.`)
    mudanca.notaAdmin = nota === "" ? null : nota
  }
  if (Object.keys(mudanca).length === 0) throw new ErroEntrada("Nada para alterar.")
  return mudanca
}

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ASSINATURA_JPG = [0xff, 0xd8, 0xff]

/** Formato pela assinatura dos bytes (nunca pelo nome ou pelo Content-Type). */
export function tipoDaImagem(bytes: Uint8Array): FormatoImagem | null {
  const comeca = (assinatura: number[]) => bytes.length >= assinatura.length && assinatura.every((b, i) => bytes[i] === b)
  if (comeca(ASSINATURA_PNG)) return "png"
  if (comeca(ASSINATURA_JPG)) return "jpg"
  return null
}

/** Confere quantidade, tamanho e formato; devolve a tela (quando há) primeiro e depois os extras. */
export function validarImagensReport(tela: Uint8Array | null, extras: Uint8Array[]): ImagemReport[] {
  if (extras.length > LIMITE_IMAGENS_EXTRAS) throw new ErroEntrada(`Envie no máximo ${LIMITE_IMAGENS_EXTRAS} imagens além do print.`)
  const imagens: ImagemReport[] = []
  for (const [i, bytes] of [...(tela ? [tela] : []), ...extras].entries()) {
    if (bytes.byteLength > LIMITE_IMAGEM_BYTES) throw new ErroEntrada("Cada imagem pode ter no máximo 5 MB.")
    const formato = tipoDaImagem(bytes)
    if (tela && i === 0 && formato !== "png") throw new ErroEntrada("O print da tela precisa ser PNG.")
    if (!formato) throw new ErroEntrada("Imagem em formato não aceito. Use PNG ou JPEG.")
    imagens.push({ bytes, formato })
  }
  return imagens
}

function diaMes(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
}

/** Markdown dos reports, um bloco por report na ordem recebida, para colar numa conversa com o Claude. */
export function textoReports(reports: Report[], urlImagem: (id: number, n: number) => string): string {
  if (reports.length === 0) return "Nenhum report."
  return reports
    .map((r) => {
      const linhas = [
        `## #${r.id} · ${ROTULO_TIPO[r.tipo]} · ${ROTULO_STATUS[r.status]}`,
        r.comentario,
        "",
        `Autor: ${nomeCurto(r.autor)} (${diaMes(r.criadoEm)})`,
        `Página: ${r.contexto.url || "(desconhecida)"}`,
      ]
      if (r.contexto.prospect) linhas.push(`Prospect: ${r.contexto.prospect}`)
      if (r.contexto.tela) linhas.push(`Tela: ${r.contexto.tela.largura}x${r.contexto.tela.altura}`)
      if (r.notaAdmin) linhas.push(`Nota do admin: ${r.notaAdmin}`)
      if (r.imagens.length > 0) linhas.push("Imagens:", ...r.imagens.map((_, n) => `- ${urlImagem(r.id, n)}`))
      return linhas.join("\n")
    })
    .join("\n\n")
}
