"use client"

import { FolderOpenIcon } from "lucide-react"
import { useState } from "react"
import type { ResumoProspect } from "@workspace/core/tipos"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { BarraTopo } from "@/components/marca/barra-topo"
import { CardProspect } from "./card-prospect"
import { DialogoNovoProspect } from "./dialogo-novo-prospect"

export function GradeProspects({ prospects }: { prospects: ResumoProspect[] }) {
  const [busca, setBusca] = useState("")
  const filtrados = prospects.filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase())
  )

  return (
    <>
      <BarraTopo titulo="Planejamento estratégico" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Prospects
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-texto-forte">
              Planejamentos estratégicos
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input
              className="w-64"
              placeholder="Buscar prospect…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <DialogoNovoProspect />
          </div>
        </header>
        {prospects.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpenIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum planejamento ainda</EmptyTitle>
              <EmptyDescription>
                Crie o primeiro prospect para começar pela Etapa 01.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <DialogoNovoProspect />
            </EmptyContent>
          </Empty>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum prospect com “{busca}”.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((p) => (
              <CardProspect key={p.slug} prospect={p} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
