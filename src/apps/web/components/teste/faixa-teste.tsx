"use client"

import { useState } from "react"
import type { EtapaId, RespostaEstado } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { DialogoReposicionar } from "./dialogo-reposicionar"
import { PainelKit } from "./painel-kit"

/** Faixa no topo da área de trabalho de um cliente de teste; some em qualquer outro prospect. */
export function FaixaTeste({ slug, dados, etapa }: { slug: string; dados: RespostaEstado; etapa: EtapaId }) {
  const [reposicionando, setReposicionando] = useState(false)
  const [kitAberto, setKitAberto] = useState(false)
  const teste = dados.estado.teste
  if (!teste) return null
  const rotulo = dados.catalogo.etapas.find((e) => e.id === etapa)?.rotuloStatus ?? etapa

  return (
    <div className="bg-muted/60 flex flex-wrap items-center gap-2 border-b px-4 py-1.5 text-xs">
      <Badge variant="secondary">Cliente de teste</Badge>
      <span className="text-muted-foreground">Dados fictícios. Reposicione para começar de outra etapa.</span>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setKitAberto(true)}>
          Kit da etapa
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReposicionando(true)}>
          Reposicionar
        </Button>
      </div>
      <Dialog open={kitAberto} onOpenChange={setKitAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kit da etapa</DialogTitle>
            <DialogDescription>{rotulo}</DialogDescription>
          </DialogHeader>
          <PainelKit slug={slug} etapa={etapa} semMoldura mensagemVazia="Esta etapa não tem arquivos nem roteiro." />
        </DialogContent>
      </Dialog>
      <DialogoReposicionar
        slug={slug}
        catalogo={dados.catalogo}
        etapaAtual={teste.etapaInicial}
        aberto={reposicionando}
        aoMudar={setReposicionando}
      />
    </div>
  )
}
