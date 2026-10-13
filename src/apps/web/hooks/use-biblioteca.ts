"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import type { AjusteBiblioteca, ItemBiblioteca } from "@workspace/core/biblioteca"
import { api, mensagemDeErro } from "@/lib/api"

/** `sinal` muda a cada recarga do estado do prospect (aprovação, anexo, ajuste): a lista é buscada de novo. */
export function useBiblioteca(slug: string, sinal: unknown) {
  const [itens, setItens] = useState<ItemBiblioteca[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const r = await api.biblioteca(slug)
      setItens(r.itens)
      setErro(null)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }, [slug])

  useEffect(() => {
    void recarregar()
  }, [recarregar, sinal])

  const ajustar = useCallback(
    async (caminho: string, mudanca: AjusteBiblioteca) => {
      // Otimista: a etapa muda na hora; o título só quando não está vazio (vazio volta ao automático, que vem do servidor).
      setItens(
        (atual) =>
          atual?.map((i) =>
            i.caminho !== caminho
              ? i
              : { ...i, ...(mudanca.etapa ? { etapa: mudanca.etapa } : {}), ...(mudanca.titulo?.trim() ? { titulo: mudanca.titulo.trim() } : {}) },
          ) ?? null,
      )
      try {
        const { item } = await api.ajustarBiblioteca(slug, caminho, mudanca)
        setItens((atual) => atual?.map((i) => (i.caminho === caminho ? item : i)) ?? null)
      } catch (e) {
        toast.error(mensagemDeErro(e))
        await recarregar()
      }
    },
    [slug, recarregar],
  )

  return { itens, erro, recarregar, ajustar }
}
