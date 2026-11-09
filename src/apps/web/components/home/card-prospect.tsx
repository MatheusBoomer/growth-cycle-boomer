"use client"

import { EllipsisIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import type { ResumoProspect } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { AvatarPessoa } from "@/components/marca/avatar-pessoa"
import { useAmbiente, usePapel } from "@/components/marca/conta-contexto"
import { api, mensagemDeErro } from "@/lib/api"
import { BarraEtapas } from "./barra-etapas"
import { DialogoExcluirProspect } from "./dialogo-excluir-prospect"
import { DialogoTrocarDono } from "./dialogo-trocar-dono"

function quando(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

/** `fotoUrl` é a foto do dono (só o admin vê o analista no cartão). */
export function CardProspect({ prospect: p, fotoUrl }: { prospect: ResumoProspect; fotoUrl?: string | null }) {
  const router = useRouter()
  const { nuvem } = useAmbiente()
  const admin = usePapel() === "admin"
  const [excluindo, setExcluindo] = useState(false)
  const [trocandoDono, setTrocandoDono] = useState(false)
  const concluido = p.etapaAtual === null

  return (
    // O link do nome se estica sobre o card inteiro (::after); só o menu ⋯ fica por cima dele.
    <Card className="has-[a:focus-visible]:ring-ring relative transition duration-300 hover:border-foreground/15 has-[a:focus-visible]:ring-2">
      <CardHeader>
        <CardTitle className="text-texto-forte truncate">
          <Link href={`/prospects/${p.slug}`} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
            {p.nome}
          </Link>
        </CardTitle>
        {admin && (
          <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <AvatarPessoa email={p.dono} nome={p.dono ? nomeCurto(p.dono) : "Sem dono"} fotoUrl={fotoUrl} tamanho="sm" />
            <span className="truncate">{p.dono ? nomeCurto(p.dono) : "Sem dono"}</span>
          </div>
        )}
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
              {admin && nuvem && <DropdownMenuItem onClick={() => setTrocandoDono(true)}>Trocar dono</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setExcluindo(true)}>
                Excluir…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p className={cn("truncate text-sm font-medium", concluido ? "text-sucesso" : "text-texto-forte")}>
          {concluido ? "Concluído" : p.rotuloEtapaAtual}
        </p>
        <BarraEtapas concluidas={p.concluidas} total={p.totalEtapas} atual={!concluido} />
        {(p.teste || p.pendencias > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {p.teste && <Badge variant="outline">Teste</Badge>}
            {p.pendencias > 0 && (
              <Badge variant="aviso">
                {p.pendencias} aprovaç{p.pendencias === 1 ? "ão pendente" : "ões pendentes"}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground text-[11px]">
        <span className="truncate">
          {p.concluidas} de {p.totalEtapas} etapas · atualizado em {quando(p.atualizadoEm)}
        </span>
      </CardFooter>
      <DialogoExcluirProspect prospect={p} aberto={excluindo} aoMudar={setExcluindo} />
      {admin && nuvem && <DialogoTrocarDono prospect={p} aberto={trocandoDono} aoMudar={setTrocandoDono} />}
    </Card>
  )
}
