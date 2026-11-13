"use client"

import { CopyIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import { ROTULO_STATUS, ROTULO_TIPO, STATUS_REPORT, type Report, type StatusReport, textoReports, TIPOS_REPORT, type TipoReport } from "@workspace/core/reports"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { api, mensagemDeErro } from "@/lib/api"
import { STATUS_PADRAO } from "@/lib/filtro-reports"
import { DetalheReport } from "./detalhe-report"
import { dataHora, SeloTipo } from "./formatos"

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
        <div role="group" aria-label="Tipo" className="border-border flex gap-0.5 rounded-full border p-1">
          {[null, ...TIPOS_REPORT].map((t) => (
            <Button
              key={t ?? "todos"}
              size="sm"
              variant="ghost"
              className={tipo === t ? "bg-accent text-foreground shadow-(--sombra-card)" : "text-muted-foreground"}
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
            >
              {t ? ROTULO_TIPO[t] : "Todos"}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1">
          {STATUS_REPORT.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status.includes(s) ? "secondary" : "ghost"}
              aria-pressed={status.includes(s)}
              onClick={() => alternarStatus(s)}
            >
              {ROTULO_STATUS[s]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={copiar} disabled={!reports || reports.length === 0}>
          <CopyIcon /> Copiar para o Claude
        </Button>
      </div>

      {erro ? (
        <Alert>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : !reports ? (
        <Skeleton className="h-64 w-full" />
      ) : reports.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">Nenhum report com esses filtros.</p>
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
