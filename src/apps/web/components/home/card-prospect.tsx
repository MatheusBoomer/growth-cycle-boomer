"use client"

import { EllipsisIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { ResumoProspect } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { Progress } from "@workspace/ui/components/progress"
import { useAmbiente } from "@/components/marca/conta-contexto"
import { api, mensagemDeErro } from "@/lib/api"
import { DialogoExcluirProspect } from "./dialogo-excluir-prospect"

function quando(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function CardProspect({ prospect: p }: { prospect: ResumoProspect }) {
  const router = useRouter()
  const { nuvem } = useAmbiente()
  const [excluindo, setExcluindo] = useState(false)
  const concluido = p.etapaAtual === null

  return (
    // O link do nome se estica sobre o card inteiro (::after); só o menu ⋯ fica por cima dele.
    <Card className="has-[a:focus-visible]:ring-ring relative transition duration-300 hover:border-foreground/15 has-[a:focus-visible]:ring-2">
      <CardHeader>
        <CardTitle className="text-texto-forte">
          <Link href={`/prospects/${p.slug}`} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
            {p.nome}
          </Link>
        </CardTitle>
        <CardDescription>{p.rotuloEtapaAtual}</CardDescription>
        <CardAction className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${p.nome}`} />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/prospects/${p.slug}`)}>Abrir</DropdownMenuItem>
              {!nuvem && (
                <DropdownMenuItem onClick={() => api.abrirPasta(p.slug).catch((e) => toast.error(mensagemDeErro(e)))}>
                  Abrir pasta no Finder
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(true)}>
                Excluir…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={(p.concluidas / p.totalEtapas) * 100} aria-label={`${p.concluidas} de ${p.totalEtapas} etapas`} />
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={concluido ? "sucesso" : "secondary"}>
            {p.concluidas} de {p.totalEtapas}
          </Badge>
          {p.teste && <Badge variant="outline">Teste</Badge>}
          {p.pendencias > 0 && (
            <Badge variant="aviso">
              {p.pendencias} aprovaç{p.pendencias === 1 ? "ão pendente" : "ões pendentes"}
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground text-[11px]">Atualizado em {quando(p.atualizadoEm)}</CardFooter>
      <DialogoExcluirProspect prospect={p} aberto={excluindo} aoMudar={setExcluindo} />
    </Card>
  )
}
