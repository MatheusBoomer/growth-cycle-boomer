"use client"

import { FolderOpenIcon } from "lucide-react"
import { useState } from "react"
import type { EtapaId, ResumoProspect } from "@workspace/core/tipos"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { BarraTopo } from "@/components/marca/barra-topo"
import { useEmailDaConta, usePapel } from "@/components/marca/conta-contexto"
import { filtrarProspects } from "@/lib/filtro-prospects"
import { CardProspect } from "./card-prospect"
import { DialogoClienteTeste } from "./dialogo-cliente-teste"
import { DialogoNovoProspect } from "./dialogo-novo-prospect"

export function GradeProspects({ prospects, etapas }: { prospects: ResumoProspect[]; etapas: { id: EtapaId; rotulo: string }[] }) {
  const [busca, setBusca] = useState("")
  const admin = usePapel() === "admin"
  const email = useEmailDaConta()
  // Só o admin vê o alternador: para os outros a lista já vem filtrada pelo servidor.
  const [apenasMeus, setApenasMeus] = useState(false)
  const filtrados = filtrarProspects(prospects, { busca, apenasMeus: admin && apenasMeus, email })

  return (
    <>
      <BarraTopo titulo="Growth Cycle" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">Prospects</p>
            <h1 className="text-texto-forte mt-1 text-2xl font-semibold tracking-tight">Growth Cycles</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Input className="w-64" placeholder="Buscar prospect…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {admin && (
              <div role="group" aria-label="Quais prospects mostrar" className="flex gap-1">
                <Button variant={apenasMeus ? "secondary" : "outline"} size="sm" aria-pressed={apenasMeus} onClick={() => setApenasMeus(true)}>
                  Meus
                </Button>
                <Button variant={apenasMeus ? "outline" : "secondary"} size="sm" aria-pressed={!apenasMeus} onClick={() => setApenasMeus(false)}>
                  Todos
                </Button>
              </div>
            )}
            {admin && <DialogoClienteTeste etapas={etapas} />}
            <DialogoNovoProspect />
          </div>
        </header>
        {prospects.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpenIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum Growth Cycle ainda</EmptyTitle>
              <EmptyDescription>Crie o primeiro prospect para começar pela Etapa 01.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <DialogoNovoProspect />
            </EmptyContent>
          </Empty>
        ) : filtrados.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {busca.trim() === "" ? "Nenhum prospect seu por aqui." : `Nenhum prospect com “${busca}”.`}
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
