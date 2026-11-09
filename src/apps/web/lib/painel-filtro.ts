import type { FiltroPainel } from "@workspace/core/metricas/painel"

export type PeriodoRapido = "7d" | "30d" | "90d" | "ano"

const DIAS_DO_PERIODO = { "7d": 7, "30d": 30, "90d": 90 } as const
const PADRAO: PeriodoRapido = "30d"
/** Teto do período personalizado (cerca de 10 anos): acima disso o pedido cai no padrão. */
const MAXIMO_DIAS = 3660
const DIA_MS = 86_400_000

const calendarioDeBrasilia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function ehPeriodoRapido(v: string | null): v is PeriodoRapido {
  return v === "7d" || v === "30d" || v === "90d" || v === "ano"
}

/** Dia `AAAA-MM-DD` de hoje em Brasília. */
function hojeEmBrasilia(agora: Date): string {
  return calendarioDeBrasilia.format(agora)
}

/** Milissegundos UTC da meia-noite do dia `AAAA-MM-DD`, ou null se a data não existe. */
function msDoDia(data: string | null): number | null {
  const m = data === null ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(ms).toISOString().slice(0, 10) === data ? ms : null
}

function somarDias(data: string, dias: number): string {
  return new Date(msDoDia(data)! + dias * DIA_MS).toISOString().slice(0, 10)
}

function periodoRapido(rapido: PeriodoRapido, hoje: string): { de: string; ate: string } {
  if (rapido === "ano") return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje }
  return { de: somarDias(hoje, 1 - DIAS_DO_PERIODO[rapido]), ate: hoje }
}

function lista(p: URLSearchParams, chave: string): string[] {
  const itens = (p.get(chave) ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "")
  return [...new Set(itens)]
}

/**
 * Filtro do painel a partir da query string. Nunca lança nem devolve período inválido: `periodo` desconhecido, datas
 * que não existem, só uma das duas, `ate` antes de `de` ou período maior que 10 anos caem no padrão (30 dias até hoje
 * em Brasília). `periodo` válido vence `de`/`ate`.
 */
export function filtroDeParametros(p: URLSearchParams, agora: Date): FiltroPainel {
  const hoje = hojeEmBrasilia(agora)
  const rapido = p.get("periodo")
  let periodo = periodoRapido(PADRAO, hoje)
  if (ehPeriodoRapido(rapido)) {
    periodo = periodoRapido(rapido, hoje)
  } else {
    const de = p.get("de")
    const ate = p.get("ate")
    const msDe = msDoDia(de)
    const msAte = msDoDia(ate)
    if (de !== null && ate !== null && msDe !== null && msAte !== null && msAte >= msDe && (msAte - msDe) / DIA_MS < MAXIMO_DIAS) {
      periodo = { de, ate }
    }
  }
  return {
    ...periodo,
    donos: lista(p, "donos"),
    projetos: lista(p, "projetos"),
    etapas: lista(p, "etapas"),
    modelos: lista(p, "modelos"),
    incluirTestes: p.get("testes") === "1",
  }
}

/** Inversa de `filtroDeParametros`: `rapido` diz se o período vai como `periodo=` ou como `de`/`ate`. */
export function parametrosDeFiltro(f: FiltroPainel, rapido: PeriodoRapido | "custom"): URLSearchParams {
  const p = new URLSearchParams()
  if (rapido === "custom") {
    p.set("de", f.de)
    p.set("ate", f.ate)
  } else {
    p.set("periodo", rapido)
  }
  for (const [chave, valores] of [["donos", f.donos], ["projetos", f.projetos], ["etapas", f.etapas], ["modelos", f.modelos]] as const) {
    if (valores.length > 0) p.set(chave, valores.join(","))
  }
  if (f.incluirTestes) p.set("testes", "1")
  return p
}
