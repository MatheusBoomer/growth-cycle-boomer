"use client"

import { useState } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import { LIMITE_NOTA_ADMIN, ROTULO_STATUS, STATUS_REPORT, type Report, type StatusReport } from "@workspace/core/reports"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { api, mensagemDeErro } from "@/lib/api"
import { dataHora, SeloTipo } from "./formatos"

/** Painel lateral de um report: comentário, imagens, contexto, status e nota interna. */
export function DetalheReport({
  report,
  aoFechar,
  aoAtualizar,
}: {
  report: Report | null
  aoFechar: () => void
  aoAtualizar: (report: Report) => void
}) {
  return (
    <Sheet open={report !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {/* A key remonta o conteúdo a cada report: a nota em edição não vaza de um para outro. */}
        {report && <Conteudo key={report.id} report={report} aoAtualizar={aoAtualizar} />}
      </SheetContent>
    </Sheet>
  )
}

function Conteudo({ report, aoAtualizar }: { report: Report; aoAtualizar: (report: Report) => void }) {
  const [nota, setNota] = useState(report.notaAdmin ?? "")
  const [salvando, setSalvando] = useState(false)

  async function salvar(mudanca: { status?: StatusReport; notaAdmin?: string }) {
    setSalvando(true)
    try {
      aoAtualizar((await api.atualizarReport(report.id, mudanca)).report)
      toast.success("Salvo.")
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const { contexto } = report
  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <SheetHeader className="px-0">
        <SheetTitle className="font-serif text-[26px] font-normal flex items-center gap-2">
          <SeloTipo tipo={report.tipo} /> Report #{report.id}
        </SheetTitle>
        <SheetDescription>
          {nomeCurto(report.autor)} · {dataHora(report.criadoEm)}
        </SheetDescription>
      </SheetHeader>

      <p className="text-sm whitespace-pre-wrap">{report.comentario}</p>

      {report.imagens.length > 0 && (
        <div className="space-y-2">
          {report.imagens.map((_, n) => (
            <a key={n} href={api.urlImagemReport(report.id, n)} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem privada servida pela rota do admin */}
              <img
                src={api.urlImagemReport(report.id, n)}
                alt={`Imagem ${n + 1} do report`}
                className="max-h-80 w-full rounded-md border object-contain"
              />
            </a>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Página</dt>
        <dd className="truncate">
          {contexto.url ? (
            <a href={contexto.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
              {contexto.url}
            </a>
          ) : (
            "desconhecida"
          )}
        </dd>
        {contexto.prospect && (
          <>
            <dt className="text-muted-foreground">Prospect</dt>
            <dd>{contexto.prospect}</dd>
          </>
        )}
        {contexto.tela && (
          <>
            <dt className="text-muted-foreground">Tela</dt>
            <dd>
              {contexto.tela.largura}x{contexto.tela.altura}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Navegador</dt>
        <dd className="break-all">{contexto.navegador || "desconhecido"}</dd>
      </dl>

      <div className="space-y-2">
        <p className="text-sm font-medium">Status</p>
        <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-1">
          {STATUS_REPORT.map((s) => (
            <Button
              key={s}
              role="radio"
              aria-checked={report.status === s}
              size="sm"
              variant={report.status === s ? "default" : "outline"}
              disabled={salvando}
              onClick={() => report.status !== s && salvar({ status: s })}
            >
              {ROTULO_STATUS[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Nota interna</p>
        <Textarea aria-label="Nota interna" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={LIMITE_NOTA_ADMIN} />
        <Button size="sm" disabled={salvando || nota === (report.notaAdmin ?? "")} onClick={() => salvar({ notaAdmin: nota })}>
          Salvar nota
        </Button>
      </div>

      {report.atualizadoPor && report.atualizadoEm && (
        <p className="text-muted-foreground text-xs">
          Atualizado por {nomeCurto(report.atualizadoPor)} em {dataHora(report.atualizadoEm)}
        </p>
      )}
    </div>
  )
}
