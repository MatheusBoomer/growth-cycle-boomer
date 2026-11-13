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
import { partesDoRotulo } from "@/lib/home"
import { BarraEtapas } from "./barra-etapas"
import { DialogoExcluirProspect } from "./dialogo-excluir-prospect"
import { DialogoTrocarDono } from "./dialogo-trocar-dono"

/** Fuso fixo: servidor (UTC) e navegador (Brasília) renderizam o mesmo texto, sem erro de hidratação. */
function quando(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

/** `fotoUrl` é a foto do dono (só o admin vê o analista no cartão). */
export function CardProspect({ prospect: p, fotoUrl }: { prospect: ResumoProspect; fotoUrl?: string | null }) {
  const router = useRouter()
  const { nuvem } = useAmbiente()
  const admin = usePapel() === "admin"
  const [excluindo, setExcluindo] = useState(false)
  const [trocandoDono, setTrocandoDono] = useState(false)
  const concluido = p.etapaAtual === null
  const nomeDono = p.dono ? nomeCurto(p.dono) : "Sem dono"
  const etapa = partesDoRotulo(p.rotuloEtapaAtual)

  return (
    // O link do nome se estica sobre o card inteiro (::after); só o menu ⋯ fica por cima dele.
    <Card
      className={cn(
        "luz-mouse has-[a:focus-visible]:ring-ring relative h-full transition duration-300 hover:-translate-y-0.5 hover:border-foreground/15 has-[a:focus-visible]:ring-2",
        p.pendencias > 0 && "borda-correndo",
      )}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
      }}
    >
      <CardHeader>
        <CardTitle className="text-texto-forte truncate">
          <Link href={`/prospects/${p.slug}`} title={p.nome} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
            {p.nome}
          </Link>
        </CardTitle>
        {admin && (
          <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <AvatarPessoa email={p.dono} nome={nomeDono} fotoUrl={fotoUrl} tamanho="sm" />
            <span className="truncate" title={nomeDono}>
              {nomeDono}
            </span>
          </div>
        )}
        <CardAction className="relative z-10 max-sm:-my-1.5 max-sm:-mr-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="max-sm:size-10" aria-label={`Ações de ${p.nome}`} />}>
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
        {concluido ? (
          <p className="text-sucesso text-sm font-medium">Concluído</p>
        ) : (
          <p className="text-muted-foreground min-w-0 text-xs" title={p.rotuloEtapaAtual}>
            {etapa.numero && `Etapa ${etapa.numero}`}
            <em className="text-texto-forte mt-0.5 block truncate font-serif text-[19px] leading-[1.1] not-italic">
              <span className="italic">{etapa.titulo}</span>
            </em>
          </p>
        )}
        <BarraEtapas concluidas={p.concluidas} total={p.totalEtapas} atual={!concluido} aguardando={p.pendencias > 0} />
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
      <CardFooter className="text-muted-foreground mt-auto text-[11px]">
        <span className="truncate">
          {p.concluidas} de {p.totalEtapas} etapas · atualizado em {quando(p.atualizadoEm)}
        </span>
      </CardFooter>
      <DialogoExcluirProspect prospect={p} aberto={excluindo} aoMudar={setExcluindo} />
      {admin && nuvem && <DialogoTrocarDono prospect={p} aberto={trocandoDono} aoMudar={setTrocandoDono} />}
    </Card>
  )
}
