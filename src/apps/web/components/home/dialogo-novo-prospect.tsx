"use client"

import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { normalizarSlug } from "@workspace/core/slug"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { api, ErroApi, mensagemDeErro } from "@/lib/api"

export function DialogoNovoProspect() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState("")
  const [site, setSite] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [existente, setExistente] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const slug = normalizarSlug(nome)

  async function criar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    setExistente(null)
    setEnviando(true)
    try {
      const { slug: criado } = await api.criarProspect(nome, site)
      router.push(`/prospects/${criado}`)
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "prospect_existente") setExistente(String(e.dados.slug))
      else setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button />}>
        <PlusIcon /> Novo prospect
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={criar} className="contents">
          <DialogHeader>
            <DialogTitle>Novo prospect</DialogTitle>
            <DialogDescription>Cria a pasta do prospect a partir do modelo e libera a Etapa 01.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome-prospect">Nome do prospect</FieldLabel>
              <Input id="nome-prospect" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Iszi Cosméticos" />
              <FieldDescription>
                {slug ? (
                  <>
                    Pasta: <code className="font-mono">clientes/{slug}/</code>
                  </>
                ) : (
                  "Use pelo menos uma letra ou número."
                )}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="site-prospect">Site / e-commerce</FieldLabel>
              <Input id="site-prospect" type="url" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" />
              <FieldDescription>Opcional agora; a Etapa 01 pede se faltar.</FieldDescription>
            </Field>
            {erro && <FieldError>{erro}</FieldError>}
            {existente && (
              <FieldError>
                Já existe um prospect <code className="font-mono">{existente}</code>.{" "}
                <button type="button" className="underline" onClick={() => router.push(`/prospects/${existente}`)}>
                  Abrir o existente
                </button>{" "}
                ou escolha outro nome.
              </FieldError>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!slug || enviando}>
              {enviando && <Spinner />} Criar e abrir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
