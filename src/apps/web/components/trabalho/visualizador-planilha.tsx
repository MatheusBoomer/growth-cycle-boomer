"use client"

import { DownloadIcon, Maximize2Icon, Minimize2Icon, SheetIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { comScriptDeInteracao } from "@/lib/presenca"
import { BarraVisualizador, CarregandoVisualizador, EstadoVisualizador } from "@/components/trabalho/barra-visualizador"

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
      <BarraVisualizador titulo={entregavel?.titulo ?? "Planilha"} selo={entregavel && <Badge variant={entregavel.status === "aprovado" ? "sucesso" : entregavel.status === "pendente" ? "aviso" : "outline"}>{ROTULO_STATUS_ENTREGAVEL[entregavel.status]}</Badge>}>
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
      </BarraVisualizador>
      {entregavel && !atual ? (
        <CarregandoVisualizador texto="Gerando a prévia da planilha…" />
      ) : entregavel && atual?.html ? (
        // Sem allow-same-origin: a página da planilha roda isolada, só para trocar de aba.
        <iframe key={entregavel.id} srcDoc={comScriptDeInteracao(atual.html)} title={entregavel.titulo} sandbox="allow-scripts" className="m-3 min-h-0 w-[calc(100%-1.5rem)] flex-1 rounded-xl border border-border bg-papel" />
      ) : (
        <EstadoVisualizador icone={<SheetIcon />} titulo="Prévia" destaque="indisponível">
          {entregavel ? `${atual?.erro ?? "Não consegui carregar a planilha."} Você ainda pode baixar o arquivo.` : "Esta planilha não está mais entre os entregáveis da etapa."}
        </EstadoVisualizador>
      )}
    </section>
  )
}
