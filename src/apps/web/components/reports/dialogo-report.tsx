"use client"

import { ImagePlusIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { type ClipboardEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { LIMITE_COMENTARIO, LIMITE_IMAGENS_EXTRAS, ROTULO_TIPO, TIPOS_REPORT, type TipoReport } from "@workspace/core/reports"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { MarcadorImagem } from "@/components/cards/marcador-imagem"
import type { Marca } from "@/lib/anotacoes"
import { renderizarAnotada } from "@/lib/anotacoes-canvas"
import { api } from "@/lib/api"
import { base64ParaBlob, contextoDaTela, extraAceito, montarFormularioReport } from "@/lib/report-envio"

interface Extra {
  arquivo: File
  url: string
}

const INSTRUCAO_MARCACAO = "Escolha a forma e marque na imagem onde está o problema. Explique cada número no comentário (ex.: “1: o botão não responde”)."

/**
 * Diálogo de report: tipo, comentário, o print da tela (com marcações) e até 3 imagens extras, coladas (Ctrl+V) ou
 * escolhidas do computador. Fecha só quando o envio dá certo; com erro, mantém o que foi preenchido. Fechar zera tudo,
 * então cada abertura (com print novo) começa sem marcações.
 */
export function DialogoReport({
  aberto,
  aoMudarAberto,
  print,
  aoRemoverPrint,
}: {
  aberto: boolean
  aoMudarAberto: (aberto: boolean) => void
  /** Data URL PNG do print, ou null quando a captura falhou ou foi removida. */
  print: string | null
  aoRemoverPrint: () => void
}) {
  const [tipo, setTipo] = useState<TipoReport | null>(null)
  const [comentario, setComentario] = useState("")
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [marcando, setMarcando] = useState(false)
  const [extras, setExtras] = useState<Extra[]>([])
  const [enviando, setEnviando] = useState(false)
  const entradaArquivo = useRef<HTMLInputElement>(null)

  function limpar() {
    setTipo(null)
    setComentario("")
    setMarcas([])
    setMarcando(false)
    for (const e of extras) URL.revokeObjectURL(e.url)
    setExtras([])
  }

  function mudarAberto(valor: boolean) {
    if (enviando) return
    if (!valor) limpar()
    aoMudarAberto(valor)
  }

  function adicionarExtras(arquivos: File[]) {
    const novos: Extra[] = []
    for (const arquivo of arquivos) {
      if (extras.length + novos.length >= LIMITE_IMAGENS_EXTRAS) {
        toast.error(`Envie no máximo ${LIMITE_IMAGENS_EXTRAS} imagens além do print.`)
        break
      }
      const erro = extraAceito(arquivo)
      if (erro) {
        toast.error(erro)
        continue
      }
      novos.push({ arquivo, url: URL.createObjectURL(arquivo) })
    }
    if (novos.length > 0) setExtras((atuais) => [...atuais, ...novos])
  }

  function aoColar(e: ClipboardEvent) {
    const imagens = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"))
    if (imagens.length === 0) return
    e.preventDefault()
    adicionarExtras(imagens)
  }

  function removerExtra(url: string) {
    URL.revokeObjectURL(url)
    setExtras((atuais) => atuais.filter((e) => e.url !== url))
  }

  async function enviar() {
    if (!tipo || !comentario.trim()) return
    setEnviando(true)
    try {
      const tela = print
        ? base64ParaBlob(marcas.length > 0 ? await renderizarAnotada(print, marcas) : print, "image/png")
        : null
      const form = montarFormularioReport({
        tipo,
        comentario,
        contexto: contextoDaTela(window.location, navigator, window),
        tela,
        extras: extras.map((e) => e.arquivo),
      })
      await api.enviarReport(form)
      toast.success("Recebido, obrigado!")
      limpar()
      aoMudarAberto(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o report.")
    } finally {
      setEnviando(false)
    }
  }

  const podeEnviar = tipo !== null && comentario.trim() !== "" && comentario.length <= LIMITE_COMENTARIO && !enviando

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" onPaste={aoColar}>
        <DialogHeader>
          <DialogTitle className="text-[26px] font-medium tracking-[-0.03em]">
            Reportar <em className="text-link-acao font-serif font-normal tracking-[-0.01em] italic">um bug ou ideia</em>
          </DialogTitle>
          <DialogDescription>Conte o que aconteceu ou o que poderia melhorar. O print da tela vai junto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div role="radiogroup" aria-label="Tipo" className="border-border flex w-fit gap-0.5 rounded-full border p-1">
            {TIPOS_REPORT.map((t) => (
              <Button key={t} role="radio" aria-checked={tipo === t} variant="ghost" size="sm" className={tipo === t ? "bg-accent text-foreground shadow-(--sombra-card)" : "text-muted-foreground"} onClick={() => setTipo(t)}>
                {ROTULO_TIPO[t]}
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            <Textarea
              aria-label="Comentário"
              placeholder={tipo === "melhoria" ? "O que poderia ser melhor, e por quê?" : "O que aconteceu? O que você esperava que acontecesse?"}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
            />
            <p className={comentario.length > LIMITE_COMENTARIO ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
              {comentario.length}/{LIMITE_COMENTARIO}
            </p>
          </div>

          {print ? (
            marcando ? (
              <MarcadorImagem
                titulo="Print da tela"
                urlImagem={print}
                marcas={marcas}
                primeiroNumero={1}
                aoMudar={setMarcas}
                aoFechar={() => setMarcando(false)}
                instrucao={INSTRUCAO_MARCACAO}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Print da tela</span>
                  {marcas.length > 0 && <span className="text-muted-foreground text-xs">{marcas.length} marcação(ões)</span>}
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => setMarcando(true)}>
                    <PencilIcon /> Marcar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMarcas([])
                      aoRemoverPrint()
                    }}
                  >
                    <Trash2Icon /> Remover
                  </Button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no navegador */}
                <img src={print} alt="Print da tela" className="max-h-56 w-full rounded-md border object-contain" />
              </div>
            )
          ) : (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
              Não consegui capturar a tela. Cole um print se quiser.
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Imagens extras</span>
              <span className="text-muted-foreground text-xs">até {LIMITE_IMAGENS_EXTRAS}, PNG ou JPEG; cole com Ctrl+V</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={extras.length >= LIMITE_IMAGENS_EXTRAS}
                onClick={() => entradaArquivo.current?.click()}
              >
                <ImagePlusIcon /> Adicionar imagem
              </Button>
              <input
                ref={entradaArquivo}
                type="file"
                accept="image/png,image/jpeg"
                multiple
                hidden
                onChange={(e) => {
                  adicionarExtras([...(e.target.files ?? [])])
                  e.target.value = ""
                }}
              />
            </div>
            {extras.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {extras.map((e) => (
                  <li key={e.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- object URL local */}
                    <img src={e.url} alt={e.arquivo.name} className="h-24 w-full rounded-md border object-contain" />
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      className="absolute top-1 right-1"
                      aria-label={`Remover ${e.arquivo.name}`}
                      onClick={() => removerExtra(e.url)}
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => mudarAberto(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={!podeEnviar}>
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
