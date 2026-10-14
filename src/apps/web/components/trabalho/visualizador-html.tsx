"use client"

import { ExternalLinkIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"

export function VisualizadorHtml({
  slug,
  entregavel,
  telaCheia,
  aoAlternarTelaCheia,
  aoFechar,
}: {
  slug: string
  entregavel: Entregavel | null
  telaCheia: boolean
  aoAlternarTelaCheia: () => void
  aoFechar: () => void
}) {
  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || alvoDeDigitacao(document.activeElement as HTMLElement | null)) return
      if (telaCheia) aoAlternarTelaCheia()
      else aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [telaCheia, aoAlternarTelaCheia, aoFechar])

  const url = entregavel ? urlArquivo(slug, entregavel.arquivoRascunho) : null
  // O HTML entra por srcDoc, não por src: um iframe com sandbox que navega para uma URL é
  // bloqueado por alguns navegadores embutidos (net::ERR_BLOCKED_BY_CLIENT) e fica em branco.
  const [carregado, setCarregado] = useState<{ url: string; html: string | null } | null>(null)
  const html = url && carregado?.url === url ? carregado.html : undefined

  useEffect(() => {
    if (!url) return
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((texto) => ativo && setCarregado({ url, html: texto }))
    return () => {
      ativo = false
    }
  }, [url])

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Visualizador de relatório">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="truncate text-sm font-medium">{entregavel?.titulo ?? "Relatório"}</h2>
        {entregavel && (
          <Badge variant={entregavel.status === "aprovado" ? "sucesso" : entregavel.status === "pendente" ? "aviso" : "outline"}>{ROTULO_STATUS_ENTREGAVEL[entregavel.status]}</Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {entregavel && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={aoAlternarTelaCheia}>
                {telaCheia ? <Minimize2Icon /> : <Maximize2Icon />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Abrir em nova aba"
                render={<a href={url!} target="_blank" rel="noreferrer" />}
                nativeButton={false}
              >
                <ExternalLinkIcon />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
      </header>
      {entregavel && html === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : entregavel && html !== null ? (
        <iframe
          key={entregavel.id}
          srcDoc={html}
          title={entregavel.titulo}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          className="min-h-0 w-full flex-1 bg-papel"
        />
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Relatório indisponível</EmptyTitle>
            <EmptyDescription>
              {entregavel ? "Não consegui carregar o arquivo. Tente abrir em nova aba." : "Este relatório não está mais entre os entregáveis da etapa."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}
