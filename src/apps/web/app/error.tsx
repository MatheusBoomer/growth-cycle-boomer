"use client" // Páginas de erro precisam rodar no navegador.

import Link from "next/link"
import { useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import { PaginaErro } from "@/components/sistema/pagina-erro"

export default function ErroDaPagina({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PaginaErro
      codigo="ops"
      titulo="Algo deu"
      destaque="errado aqui"
      acoes={
        <>
          <Button onClick={() => retry()}>Tentar de novo</Button>
          <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
            Voltar aos prospects
          </Button>
        </>
      }
    >
      Nada do planejamento se perdeu. Tente de novo; se continuar, use o botão Reportar.
    </PaginaErro>
  )
}
