"use client"

import { DownloadIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { comScriptDeInteracao } from "@/lib/presenca"

type Carga = { id: string; html: string | null; erro: string | null }

/** Planilha (.xlsx) em modo leitura: todas as abas, com os valores já calculados, sem baixar o arquivo. */
export function VisualizadorPlanilha({
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
  const id = entregavel?.id ?? null
  const [carga, setCarga] = useState<Carga | null>(null)
  const atual = carga && carga.id === id ? carga : null

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || alvoDeDigitacao(document.activeElement as HTMLElement | null)) return
      if (telaCheia) aoAlternarTelaCheia()
      else aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [telaCheia, aoAlternarTelaCheia, aoFechar])

  // A conversão roda no servidor (LibreOffice) uma vez por versão; a primeira abertura leva alguns segundos.
  useEffect(() => {
    if (!id) return
    let ativo = true
    const terminar = (c: Omit<Carga, "id">) => ativo && setCarga({ id, ...c })
    void api
      .previaPlanilha(slug, id)
      .then(async (previa) => {
        if (!previa.disponivel || !previa.caminho) return terminar({ html: null, erro: previa.erro ?? "Não consegui gerar a prévia da planilha." })
        const resposta = await fetch(urlArquivo(slug, previa.caminho), { cache: "no-store" })
        if (!resposta.ok) return terminar({ html: null, erro: "Não consegui carregar a prévia da planilha." })
        terminar({ html: await resposta.text(), erro: null })
      })
      .catch((e) => terminar({ html: null, erro: mensagemDeErro(e) }))
    return () => {
      ativo = false
    }
  }, [slug, id])

  const baixar = entregavel ? urlArquivo(slug, entregavel.arquivoRascunho, true) : null

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Visualizador de planilha">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="truncate text-sm font-medium">{entregavel?.titulo ?? "Planilha"}</h2>
        {entregavel && (
          <Badge variant={entregavel.status === "aprovado" ? "sucesso" : entregavel.status === "pendente" ? "aviso" : "outline"}>{ROTULO_STATUS_ENTREGAVEL[entregavel.status]}</Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {entregavel && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={aoAlternarTelaCheia}>
                {telaCheia ? <Minimize2Icon /> : <Maximize2Icon />}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Baixar planilha" render={<a href={baixar!} download />} nativeButton={false}>
                <DownloadIcon />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
      </header>
      {entregavel && !atual ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-sm">
          <Spinner />
          Gerando prévia…
        </div>
      ) : entregavel && atual?.html ? (
        // Sem allow-same-origin: a página da planilha roda isolada, só para trocar de aba.
        <iframe key={entregavel.id} srcDoc={comScriptDeInteracao(atual.html)} title={entregavel.titulo} sandbox="allow-scripts" className="min-h-0 w-full flex-1 bg-papel" />
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Prévia indisponível</EmptyTitle>
            <EmptyDescription>
              {entregavel ? `${atual?.erro ?? "Não consegui carregar a planilha."} Você ainda pode baixar o arquivo.` : "Esta planilha não está mais entre os entregáveis da etapa."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}
