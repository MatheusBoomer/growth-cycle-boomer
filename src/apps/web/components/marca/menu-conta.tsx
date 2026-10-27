"use client"

import { nomeCurto } from "@workspace/core/autenticacao"
import { Button } from "@workspace/ui/components/button"
import { useEmailDaConta } from "./conta-contexto"

/** Quem está logado e o botão Sair (POST em /auth/sair). Sem e-mail no contexto (modo off) não renderiza nada. */
export function MenuConta() {
  const email = useEmailDaConta()
  if (!email) return null
  return (
    <div className="flex items-center gap-2">
      <div className="hidden min-w-0 flex-col items-end leading-tight sm:flex">
        <span className="text-xs font-semibold">{nomeCurto(email)}</span>
        <span className="text-muted-foreground max-w-48 truncate text-[0.7rem]">{email}</span>
      </div>
      <form method="post" action="/auth/sair">
        <Button type="submit" variant="outline" size="sm">
          Sair
        </Button>
      </form>
    </div>
  )
}
