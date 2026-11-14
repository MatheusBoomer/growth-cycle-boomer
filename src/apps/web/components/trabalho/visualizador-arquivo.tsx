"use client"

import { AtSignIcon, DownloadIcon, ExternalLinkIcon, FileIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Markdown } from "@/components/markdown"
import { urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { comScriptDeInteracao } from "@/lib/presenca"
import { BarraVisualizador, CarregandoVisualizador, EstadoVisualizador } from "@/components/trabalho/barra-visualizador"

const IMAGEM = /\.(png|jpe?g|gif|webp)$/i
const TEXTO = /\.(md|txt)$/i
const HTML = /\.html?$/i

export function VisualizadorArquivo({
  slug,
  caminho,
  aoMencionar,
  aoFechar,
}: {
  slug: string
  caminho: string
  aoMencionar: () => void
  aoFechar: () => void
}) {
  const url = urlArquivo(slug, caminho)
  const nome = caminho.split("/").pop() ?? caminho
  const comTexto = TEXTO.test(caminho) || HTML.test(caminho)
  const [carregado, setCarregado] = useState<{ url: string; texto: string | null } | null>(null)
  const texto = comTexto && carregado?.url === url ? carregado.texto : undefined

  useEffect(() => {
    if (!comTexto) return
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((t) => ativo && setCarregado({ url, texto: t }))
    return () => {
      ativo = false
    }
  }, [url, comTexto])

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !alvoDeDigitacao(document.activeElement as HTMLElement | null)) aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [aoFechar])

  let conteudo: React.ReactNode
  if (IMAGEM.test(caminho)) {
    // eslint-disable-next-line @next/next/no-img-element -- arquivo local servido pela rota do app
    conteudo = <img key={url} src={url} alt={nome} className="mx-auto max-w-full rounded-xl border border-border bg-papel" />
  } else if (comTexto && texto === undefined) {
    conteudo = (
      <CarregandoVisualizador texto="Carregando o arquivo…" />
    )
  } else if (HTML.test(caminho) && texto) {
    conteudo = (
      <iframe
        srcDoc={comScriptDeInteracao(texto)}
        title={nome}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        className="min-h-0 w-full flex-1 rounded-xl border border-border bg-papel"
      />
    )
  } else if (TEXTO.test(caminho) && texto) {
    conteudo = <Markdown>{texto}</Markdown>
  } else {
    conteudo = (
      <EstadoVisualizador
        icone={<FileIcon />}
        titulo="Sem"
        destaque="prévia aqui"
        acao={
          <Button size="sm" variant="outline" render={<a href={urlArquivo(slug, caminho, true)} download />} nativeButton={false}>
            <DownloadIcon /> Baixar
          </Button>
        }
      >
        Este tipo de arquivo não abre no navegador.
      </EstadoVisualizador>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Visualizador de arquivo">
      <BarraVisualizador titulo={caminho} dica={caminho} mono>
        <Button variant="ghost" size="icon-sm" aria-label="Mencionar no chat" title="Mencionar no chat" onClick={aoMencionar}>
          <AtSignIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Abrir em nova aba"
          title="Abrir em nova aba"
          render={<a href={url} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          <ExternalLinkIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Fechar arquivo" title="Fechar" onClick={aoFechar}>
          <XIcon />
        </Button>
      </BarraVisualizador>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">{conteudo}</div>
    </section>
  )
}
