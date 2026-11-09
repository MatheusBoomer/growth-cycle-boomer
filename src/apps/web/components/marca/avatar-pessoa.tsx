"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Seis pares fundo/texto do tema, os mesmos dos selos (verde, âmbar, azul, violeta, laranja, rosa). Cada par já
 * tem contraste próprio nos temas claro e escuro, então as iniciais ficam legíveis sem cor escrita à mão. Os
 * nomes de classe ficam inteiros aqui para o Tailwind enxergá-los.
 */
export const PALETA = [
  "bg-sucesso-fundo text-sucesso",
  "bg-aviso-fundo text-aviso",
  "bg-selo-sonnet-fundo text-selo-sonnet",
  "bg-selo-opus-fundo text-selo-opus",
  "bg-primary/10 text-link-acao",
  "bg-perigo-fundo text-destructive",
] as const

export const NEUTRO = "bg-muted text-muted-foreground"

/** Duas letras do nome (primeira de cada uma das duas primeiras palavras); uma palavra só dá uma letra. */
export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter((p) => p !== "")
  if (palavras.length === 0) return "?"
  return palavras
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("")
}

/** Cor da bolinha a partir de um hash estável do e-mail (sem caixa nem espaços); sem e-mail, o cinza neutro. */
export function corDoAvatar(email: string | null): string {
  if (email === null) return NEUTRO
  const chave = email.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < chave.length; i++) hash = (hash * 31 + chave.charCodeAt(i)) >>> 0
  return PALETA[hash % PALETA.length]!
}

/**
 * Foto do Google quando houver; sem foto ou com a imagem falhando, as iniciais numa bolinha colorida pelo e-mail.
 * A imagem é decorativa (`alt=""`, o nome aparece ao lado) e não manda o referrer para o servidor de fotos.
 */
export function AvatarPessoa({
  email,
  nome,
  fotoUrl,
  tamanho = "md",
}: {
  email: string | null
  nome: string
  fotoUrl?: string | null
  tamanho?: "sm" | "md"
}) {
  // Guarda qual URL falhou (e não um booleano): ao chegar outra foto, ela é tentada de novo.
  const [urlQueFalhou, setUrlQueFalhou] = useState<string | null>(null)
  const mostrarFoto = Boolean(fotoUrl) && fotoUrl !== urlQueFalhou
  const texto = email === null ? "?" : iniciais(nome)

  return (
    <Avatar size={tamanho === "sm" ? "sm" : "default"} aria-hidden="true">
      {mostrarFoto && (
        <AvatarImage
          src={fotoUrl!}
          alt=""
          referrerPolicy="no-referrer"
          keepMounted
          onLoadingStatusChange={(status) => status === "error" && setUrlQueFalhou(fotoUrl!)}
        />
      )}
      <AvatarFallback className={cn("text-[11px] font-medium", corDoAvatar(email))}>{texto}</AvatarFallback>
    </Avatar>
  )
}
