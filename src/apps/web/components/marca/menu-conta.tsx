"use client"

import { nomeCurto } from "@workspace/core/autenticacao"
import { Button } from "@workspace/ui/components/button"
import { useAmbiente, useEmailDaConta } from "./conta-contexto"

/** Quem está logado e o botão Sair (POST em /auth/sair). Sem e-mail: no modo local sem login só o Sair; senão nada. */
export function MenuConta() {
  const email = useEmailDaConta()
  const { semLogin } = useAmbiente()
  if (!email) {
    // Modo local sem login: um "Sair" que só volta à tela de login, para poder conferi-la.
    if (!semLogin) return null
    return (
      <form method="post" action="/auth/sair">
        <Button type="submit" variant="outline" size="sm" title="Modo local: volta à tela de login">
          Sair
        </Button>
      </form>
    )
  }
  return (
    <div className="flex items-center gap-1 sm:gap-2">
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
