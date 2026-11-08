"use client"

import { AtSignIcon, DownloadIcon, ExternalLinkIcon, FileIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Markdown } from "@/components/markdown"
import { urlArquivo } from "@/lib/api"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { comScriptDeInteracao } from "@/lib/presenca"

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
    conteudo = <img key={url} src={url} alt={nome} className="mx-auto max-w-full rounded-md border bg-papel" />
  } else if (comTexto && texto === undefined) {
    conteudo = (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  } else if (HTML.test(caminho) && texto) {
    conteudo = (
      <iframe
        srcDoc={comScriptDeInteracao(texto)}
        title={nome}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        className="h-full w-full rounded-md border bg-papel"
      />
    )
  } else if (TEXTO.test(caminho) && texto) {
    conteudo = <Markdown>{texto}</Markdown>
  } else {
    conteudo = (
      <div className="flex flex-col items-center gap-3 py-8 text-center text-sm">
        <FileIcon className="text-muted-foreground size-8" />
        <p className="text-muted-foreground">Este tipo de arquivo não tem prévia aqui.</p>
        <Button size="sm" variant="outline" render={<a href={urlArquivo(slug, caminho, true)} download />} nativeButton={false}>
          <DownloadIcon /> Baixar
        </Button>
      </div>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Visualizador de arquivo">
      <header className="flex items-center gap-1 border-b px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium" title={caminho}>
          {nome}
        </h2>
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
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">{conteudo}</div>
    </section>
  )
}
