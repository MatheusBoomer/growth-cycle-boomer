"use client"

import { CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import { ROTULO_STATUS, ROTULO_TIPO, STATUS_REPORT, type Report, type StatusReport, textoReports, TIPOS_REPORT, type TipoReport } from "@workspace/core/reports"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { api, mensagemDeErro } from "@/lib/api"
import { STATUS_PADRAO } from "@/lib/filtro-reports"
import { DetalheReport } from "./detalhe-report"
import { dataHora, SeloTipo } from "./formatos"
import { AvisoAdmin } from "@/components/admin/aviso-admin"

const SEGMENTO = "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
const SEGMENTO_LIGADO = "bg-foreground text-background hover:text-background"

/** Aba Reports do admin: filtros por tipo e status, lista dos mais recentes, detalhe lateral e cópia em Markdown. */
export function PainelReports() {
  const [tipo, setTipo] = useState<TipoReport | null>(null)
  const [status, setStatus] = useState<StatusReport[]>(STATUS_PADRAO)
  const [reports, setReports] = useState<Report[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<number | null>(null)

  useEffect(() => {
    let cancelado = false
    api
      .listarReports({ status, tipo })
      .then(({ reports }) => {
        if (cancelado) return
        setReports(reports)
        setErro(null)
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(mensagemDeErro(e))
      })
    return () => {
      cancelado = true
    }
  }, [status, tipo])

  function alternarStatus(s: StatusReport) {
    setStatus((atuais) => (atuais.includes(s) ? atuais.filter((x) => x !== s) : STATUS_REPORT.filter((x) => x === s || atuais.includes(x))))
  }

  function copiar() {
    if (!reports) return
    // Síncrono dentro do clique: o Safari recusa a escrita na área de transferência depois de um await.
    const texto = textoReports(reports, (id, n) => window.location.origin + api.urlImagemReport(id, n))
    try {
      navigator.clipboard.writeText(texto).then(
        () => toast.success("Copiado."),
        () => toast.error("Não foi possível copiar."),
      )
    } catch {
      toast.error("Não foi possível copiar.")
    }
  }

  function atualizado(report: Report) {
    setReports((atuais) => atuais?.map((r) => (r.id === report.id ? report : r)) ?? atuais)
  }

  const selecionado = reports?.find((r) => r.id === aberto) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Tipo" className="inline-flex gap-0.5 rounded-full border border-border bg-muted/30 p-[3px]">
          {[null, ...TIPOS_REPORT].map((t) => (
            <button
              key={t ?? "todos"}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={cn(SEGMENTO, tipo === t && SEGMENTO_LIGADO)}
            >
              {t ? ROTULO_TIPO[t] : "Todos"}
            </button>
          ))}
        </div>
        {/* Status é de escolha múltipla: cada um liga e desliga; a contagem aparece nos ligados (é o que veio da lista). */}
        <div role="group" aria-label="Status" className="inline-flex flex-wrap gap-0.5 rounded-full border border-border bg-muted/30 p-[3px]">
          {STATUS_REPORT.map((s) => {
            const ligado = status.includes(s)
            return (
              <button key={s} type="button" aria-pressed={ligado} onClick={() => alternarStatus(s)} className={cn(SEGMENTO, ligado && SEGMENTO_LIGADO)}>
                {ROTULO_STATUS[s]}
                {ligado && reports && <span className="font-mono text-[11px] opacity-60">{reports.filter((r) => r.status === s).length}</span>}
              </button>
            )
          })}
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={copiar} disabled={!reports || reports.length === 0}>
          <CopyIcon /> Copiar para o Claude
        </Button>
      </div>

      {erro ? (
        <AvisoAdmin mensagem={erro} aba="reports" />
      ) : !reports ? (
        <Skeleton className="h-64 w-full" />
      ) : reports.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Nenhum report com esses filtros.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {reports.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setAberto(r.id)}
                className="hover:bg-muted focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-[14px] border border-transparent px-3.5 py-3 text-left hover:border-border focus-visible:ring-3 focus-visible:outline-none"
              >
                <SeloTipo tipo={r.tipo} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{r.comentario}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    #{r.id} · {nomeCurto(r.autor)} · {r.contexto.url || "página desconhecida"} · {dataHora(r.criadoEm)}
                  </span>
                </span>
                <Badge variant="outline">{ROTULO_STATUS[r.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DetalheReport report={selecionado} aoFechar={() => setAberto(null)} aoAtualizar={atualizado} />
    </div>
  )
}
