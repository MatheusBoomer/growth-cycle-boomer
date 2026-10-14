"use client"

import { Maximize2Icon, Minimize2Icon, PencilIcon, QuoteIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { Markdown } from "@/components/markdown"
import { api, mensagemDeErro, urlArquivo } from "@/lib/api"
import { citacao } from "@/lib/citacao"
import { alvoDeDigitacao } from "@/lib/layout-colunas"
import { useVisualizador } from "./contexto-visualizador"

/**
 * Seção de texto aberta na coluna larga. Selecionar um trecho mostra "Citar no chat" (o trecho
 * entra no campo de mensagem, para o analista dizer à IA o que ajustar). Pendente, o analista
 * pode editar o texto e salvar: a versão salva é a que será aprovada, e a aprovação avisa a IA.
 */
export function VisualizadorSecao({
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
  const { inserirNoCompositor } = useVisualizador()
  const url = entregavel ? urlArquivo(slug, entregavel.arquivoRascunho) : null
  const [carregado, setCarregado] = useState<{ url: string; texto: string | null } | null>(null)
  const [versao, setVersao] = useState(0)
  const texto = url && carregado?.url === url ? carregado.texto : undefined
  const [rascunho, setRascunho] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [selecao, setSelecao] = useState<{ trecho: string; topo: number; esquerda: number } | null>(null)
  const corpo = useRef<HTMLDivElement>(null)
  const editando = rascunho !== null
  const podeEditar = entregavel?.status === "pendente"

  useEffect(() => {
    if (!url) return
    let ativo = true
    void fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((t) => ativo && setCarregado({ url, texto: t }))
    return () => {
      ativo = false
    }
  }, [url, versao])

  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || alvoDeDigitacao(document.activeElement as HTMLElement | null)) return
      if (telaCheia) aoAlternarTelaCheia()
      else aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [telaCheia, aoAlternarTelaCheia, aoFechar])

  // Botão flutuante logo acima do trecho selecionado dentro do texto.
  function aoSoltar() {
    const sel = window.getSelection()
    const el = corpo.current
    if (!sel || sel.isCollapsed || !el || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) {
      setSelecao(null)
      return
    }
    const trecho = sel.toString()
    if (!trecho.trim()) return setSelecao(null)
    const caixa = sel.getRangeAt(0).getBoundingClientRect()
    const base = el.getBoundingClientRect()
    setSelecao({ trecho, topo: caixa.top - base.top + el.scrollTop, esquerda: caixa.left - base.left })
  }

  function citar() {
    if (!selecao || !entregavel) return
    inserirNoCompositor(`Em “${entregavel.titulo}”:\n${citacao(selecao.trecho)}`)
    setSelecao(null)
    window.getSelection()?.removeAllRanges()
  }

  async function salvar() {
    if (!entregavel || rascunho === null) return
    setSalvando(true)
    try {
      await api.editarEntregavel(slug, entregavel.id, rascunho)
      toast.success("Texto salvo. Ao aprovar, a IA é avisada da sua edição.")
      setRascunho(null)
      setVersao((v) => v + 1)
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Visualizador de seção">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="truncate text-sm font-medium">{entregavel?.titulo ?? "Seção"}</h2>
        {entregavel && (
          <Badge variant={entregavel.status === "aprovado" ? "sucesso" : entregavel.status === "pendente" ? "aviso" : "outline"}>
            {entregavel.editadoEm && entregavel.status === "pendente" ? "Editada por você" : ROTULO_STATUS_ENTREGAVEL[entregavel.status]}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {editando ? (
            <>
              <Button variant="ghost" size="sm" disabled={salvando} onClick={() => setRascunho(null)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={salvando || !rascunho.trim()} onClick={() => void salvar()}>
                {salvando && <Spinner />} Salvar
              </Button>
            </>
          ) : (
            podeEditar &&
            typeof texto === "string" && (
              <Button variant="ghost" size="sm" onClick={() => setRascunho(texto)}>
                <PencilIcon /> Editar
              </Button>
            )
          )}
          {entregavel && (
            <Button variant="ghost" size="icon-sm" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={aoAlternarTelaCheia}>
              {telaCheia ? <Minimize2Icon /> : <Maximize2Icon />}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
      </header>
      {entregavel && texto === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : entregavel && typeof texto === "string" ? (
        editando ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <p className="text-muted-foreground text-xs">Editando o texto em markdown. Para mudanças maiores, peça ajuste à IA.</p>
            <Textarea
              autoFocus
              aria-label={`Texto de ${entregavel.titulo}`}
              className="min-h-0 flex-1 resize-none font-mono text-sm"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
            />
          </div>
        ) : (
          <div ref={corpo} className="relative min-h-0 flex-1 overflow-y-auto p-5" onMouseUp={aoSoltar} onScroll={() => setSelecao(null)}>
            <Markdown>{texto}</Markdown>
            {selecao && (
              <Button
                size="sm"
                className="absolute z-10 -translate-y-full shadow-md"
                style={{ top: selecao.topo - 6, left: Math.max(selecao.esquerda, 8) }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={citar}
              >
                <QuoteIcon /> Citar no chat
              </Button>
            )}
          </div>
        )
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Seção indisponível</EmptyTitle>
            <EmptyDescription>
              {entregavel ? "Não consegui carregar o texto." : "Esta seção não está mais entre os entregáveis da etapa."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}
