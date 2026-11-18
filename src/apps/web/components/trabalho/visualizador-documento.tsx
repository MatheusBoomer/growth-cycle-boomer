"use client"

import { DownloadIcon, FileTextIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { BarraVisualizador, CarregandoVisualizador, EstadoVisualizador } from "@/components/trabalho/barra-visualizador"

type Carga = { id: string; caminho: string | null; erro: string | null }

/**
 * Documento Word (.docx) em modo leitura, sem baixar: o servidor converte em PDF (LibreOffice, uma vez por versão) e
 * o visualizador de PDF do navegador mostra as páginas como no Word, com zoom e rolagem próprios.
 */
export function VisualizadorDocumento({
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

  // A primeira abertura de cada versão leva alguns segundos (conversão no servidor); as seguintes são imediatas.
  useEffect(() => {
    if (!id) return
    let ativo = true
    const terminar = (c: Omit<Carga, "id">) => ativo && setCarga({ id, ...c })
    void api
      .previaDocumento(slug, id)
      .then((previa) =>
        previa.disponivel && previa.caminho
          ? terminar({ caminho: previa.caminho, erro: null })
          : terminar({ caminho: null, erro: previa.erro ?? "Não consegui gerar a prévia do documento." }),
      )
      .catch((e) => terminar({ caminho: null, erro: mensagemDeErro(e) }))
    return () => {
      ativo = false
    }
  }, [slug, id])

  const baixar = entregavel ? urlArquivo(slug, entregavel.arquivoRascunho, true) : null

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Visualizador de documento">
      <BarraVisualizador
        titulo={entregavel?.titulo ?? "Documento"}
        selo={
          entregavel && (
            <Badge variant={entregavel.status === "aprovado" ? "sucesso" : entregavel.status === "pendente" ? "aviso" : "outline"}>
              {ROTULO_STATUS_ENTREGAVEL[entregavel.status]}
            </Badge>
          )
        }
      >
        {entregavel && (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={aoAlternarTelaCheia}>
              {telaCheia ? <Minimize2Icon /> : <Maximize2Icon />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Baixar documento" render={<a href={baixar!} download />} nativeButton={false}>
              <DownloadIcon />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
          <XIcon />
        </Button>
      </BarraVisualizador>
      {entregavel && !atual ? (
        <CarregandoVisualizador texto="Gerando a prévia do documento…" />
      ) : entregavel && atual?.caminho ? (
        // view=FitH: a página ocupa a largura da coluna; o zoom fica na barra do próprio visualizador de PDF.
        <iframe
          key={entregavel.id}
          src={`${urlArquivo(slug, atual.caminho)}#view=FitH`}
          title={entregavel.titulo}
          className="m-3 min-h-0 w-[calc(100%-1.5rem)] flex-1 rounded-xl border border-border bg-papel"
        />
      ) : (
        <EstadoVisualizador icone={<FileTextIcon />} titulo="Prévia" destaque="indisponível">
          {entregavel ? `${atual?.erro ?? "Não consegui carregar o documento."} Você ainda pode baixar o arquivo.` : "Este documento não está mais entre os entregáveis da etapa."}
        </EstadoVisualizador>
      )}
    </section>
  )
}
