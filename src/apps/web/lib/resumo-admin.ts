import { filtroDeParametros } from "./painel-filtro"

/** Resposta de GET /api/admin/resumo. Null é "não deu para saber" (sem a nuvem ou a leitura falhou): a tela some com o selo. */
export interface ResumoAdmin {
  pessoas: number | null
  admins: number | null
  etapas: number
  notasAbertas: number | null
  reportsAbertos: number | null
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const RAPIDOS: Record<string, string> = { "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", ano: "Este ano" }
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/** Período do painel de Projetos em palavras, com a mesma regra da tela: inválido cai em "Últimos 30 dias". */
export function rotuloDoPeriodo(p: URLSearchParams): string {
  const rapido = RAPIDOS[p.get("periodo") ?? ""]
  if (rapido) return rapido
  const { de, ate } = filtroDeParametros(p, new Date())
  return de === p.get("de") && ate === p.get("ate") ? `${dataBr(de)} a ${dataBr(ate)}` : RAPIDOS["30d"]!
}

/** Selo de contexto acima do título de cada aba (protótipo 6). Só a página da aba tem selo; sub-rotas não. */
export function seloDaAba(caminho: string, r: ResumoAdmin | null, params: URLSearchParams): string | null {
  switch (caminho) {
    case "/admin/pessoas":
      return r?.pessoas == null || r.admins == null ? null : `${plural(r.pessoas, "pessoa", "pessoas")} · ${plural(r.admins, "admin", "admins")}`
    case "/admin/projetos":
      return rotuloDoPeriodo(params)
    case "/admin/modelos":
      return r ? plural(r.etapas, "etapa", "etapas") : null
    case "/admin/skills":
      if (r?.notasAbertas == null) return null
      return r.notasAbertas === 0 ? "Nenhuma nota aberta" : plural(r.notasAbertas, "nota aberta", "notas abertas")
    case "/admin/reports":
      if (r?.reportsAbertos == null) return null
      return r.reportsAbertos === 0 ? "Nenhum aberto" : plural(r.reportsAbertos, "aberto", "abertos")
    default:
      return null
  }
}

/** Evento que as telas do admin disparam depois de mudar algo que entra no resumo (papel, nota, status de report). */
export const EVENTO_RESUMO_ADMIN = "resumo-admin:mudou"
export function avisarResumoAdmin() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_RESUMO_ADMIN))
}
