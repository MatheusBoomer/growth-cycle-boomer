"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { nomeCurto } from "@workspace/core/autenticacao"
import { normalizarEmail } from "@workspace/core/papeis"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useEmailDaConta } from "@/components/marca/conta-contexto"
import { api, mensagemDeErro, type PessoaComProjetos } from "@/lib/api"

export interface RotuloAcao {
  texto: "Tornar admin" | "Retirar admin"
  desabilitado: boolean
  motivo: string | null
  confirmacao: string
}

/** O botão da linha: o que ele diz, se pode ser clicado e o que a confirmação avisa. Puro, para testar sem tela. */
export function rotuloAcao(pessoa: PessoaComProjetos, ctx: { admins: number; euMesmo: boolean }): RotuloAcao {
  const nome = nomeCurto(pessoa.email)
  if (pessoa.papel === "usuario") {
    return {
      texto: "Tornar admin",
      desabilitado: false,
      motivo: null,
      confirmacao: `${nome} vai ver todos os prospects e poder administrar as pessoas.`,
    }
  }
  const ultimo = ctx.admins <= 1
  const aviso = ctx.euMesmo ? " Você vai perder o acesso à administração." : ""
  return {
    texto: "Retirar admin",
    desabilitado: ultimo,
    motivo: ultimo ? "É preciso manter pelo menos um administrador." : null,
    confirmacao: `${nome} deixa de ver os prospects de outras pessoas e de administrar.${aviso}`,
  }
}

function data(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

interface Lista {
  pessoas: PessoaComProjetos[]
  admins: number
}

/** Aba "Pessoas": quem já entrou no app, com o papel de cada um e a ação de tornar ou retirar admin. */
export function TabelaPessoas() {
  const router = useRouter()
  const meuEmail = useEmailDaConta()
  const [lista, setLista] = useState<Lista | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<PessoaComProjetos | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setLista(await api.listarPessoas())
      setErro(null)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const euMesmo = (p: PessoaComProjetos) => meuEmail !== null && normalizarEmail(p.email) === normalizarEmail(meuEmail)

  async function confirmar() {
    if (!alvo || !lista) return
    const rebaixandoAMim = alvo.papel === "admin" && euMesmo(alvo)
    setSalvando(true)
    try {
      await api.alterarPapel(alvo.email, alvo.papel === "admin" ? "usuario" : "admin")
      toast.success(alvo.papel === "admin" ? `${nomeCurto(alvo.email)} não é mais admin.` : `${nomeCurto(alvo.email)} agora é admin.`)
      setAlvo(null)
      if (rebaixandoAMim) router.push("/")
      else await carregar()
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  if (erro) {
    return (
      <Alert>
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    )
  }
  if (!lista) return <Skeleton className="h-40 w-full" />
  if (lista.pessoas.length === 0) return <p className="text-muted-foreground text-sm">Ninguém entrou no app ainda.</p>

  const rotulo = alvo ? rotuloAcao(alvo, { admins: lista.admins, euMesmo: euMesmo(alvo) }) : null

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Primeiro acesso</TableHead>
            <TableHead>Último acesso</TableHead>
            <TableHead className="text-right">Projetos</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.pessoas.map((p) => {
            const acao = rotuloAcao(p, { admins: lista.admins, euMesmo: euMesmo(p) })
            return (
              <TableRow key={p.email}>
                <TableCell className="font-medium">{nomeCurto(p.email)}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell>
                  <Badge variant={p.papel === "admin" ? "default" : "secondary"}>{p.papel === "admin" ? "Admin" : "Usuário"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{data(p.primeiroAcesso)}</TableCell>
                <TableCell className="text-muted-foreground">{data(p.ultimoAcesso)}</TableCell>
                <TableCell className="text-right tabular-nums">{p.projetos}</TableCell>
                <TableCell className="text-right">
                  {acao.desabilitado ? (
                    <Tooltip>
                      <TooltipTrigger render={<span tabIndex={0} className="inline-block" />}>
                        <Button variant="outline" size="sm" disabled>
                          {acao.texto}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{acao.motivo}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setAlvo(p)}>
                      {acao.texto}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <AlertDialog open={alvo !== null} onOpenChange={(v) => !v && !salvando && setAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rotulo ? `${rotulo.texto}: ${alvo ? nomeCurto(alvo.email) : ""}?` : ""}</AlertDialogTitle>
            <AlertDialogDescription>{rotulo?.confirmacao}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={salvando} onClick={() => void confirmar()}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
