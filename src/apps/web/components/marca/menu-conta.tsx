"use client"

import { ChevronDownIcon, ClockIcon, LogOutIcon, MoonIcon, SunIcon, UserRoundIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useRef } from "react"
import { nomeCurto } from "@workspace/core/autenticacao"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { aplicarTemaJa, trocarTemaComCirculo } from "@/lib/transicao-tema"
import { useAmbiente, useEmailDaConta, usePapel } from "./conta-contexto"
import { useHoraSaoPaulo } from "./relogio"

/** "Ana Silva" vira "AS"; um nome só vira as duas primeiras letras. */
export function iniciais(nome: string): string {
  const partes = nome.split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase()
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase()
}

/**
 * Avatar no fim da ilha da barra do topo. Abre o menu da conta: quem entrou, o horário de São Paulo, o tema e o Sair
 * (POST em /auth/sair). Sem e-mail o avatar vira um ícone; no modo local sem login o Sair só volta à tela de login.
 */
export function MenuConta() {
  const email = useEmailDaConta()
  const papel = usePapel()
  const { semLogin } = useAmbiente()
  const hora = useHoraSaoPaulo()
  const { resolvedTheme, setTheme } = useTheme()
  const formSair = useRef<HTMLFormElement>(null)
  const nome = email ? nomeCurto(email) : null
  const podeSair = email !== null || semLogin === true

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={nome ? `Conta de ${nome}` : "Conta e preferências"}
          className="text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent inline-flex h-7.5 items-center gap-1 rounded-full pr-1.5 pl-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden="true"
            className="from-primary text-primary-foreground grid size-6.5 place-items-center rounded-full bg-linear-to-br to-[#f6a04d] text-[10.5px] font-semibold"
          >
            {nome ? iniciais(nome) : <UserRoundIcon className="size-3.5" />}
          </span>
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72">
          {nome && (
            <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
              <span
                aria-hidden="true"
                className="from-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br to-[#f6a04d] text-xs font-semibold"
              >
                {iniciais(nome)}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13.5px] font-semibold">{nome}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {email}
                  {papel === "admin" && " · Admin"}
                </p>
              </div>
            </div>
          )}
          {!nome && semLogin && <p className="text-muted-foreground px-2.5 pt-2 pb-2.5 text-xs">Modo local, sem login</p>}
          {(nome || semLogin) && <DropdownMenuSeparator />}
          <div className="flex items-center gap-1.5 px-2.5 py-2 text-[13px]" aria-label={hora ? `Horário de São Paulo: ${hora}` : undefined}>
            <ClockIcon aria-hidden="true" className="text-muted-foreground size-4" />
            São Paulo
            <span className="text-muted-foreground ml-auto font-mono text-xs tabular-nums">{hora}</span>
          </div>
          <DropdownMenuRadioGroup
            value={resolvedTheme ?? "light"}
            onValueChange={(valor: string) => {
              if (valor !== "light" && valor !== "dark") return
              const r = document.querySelector("[data-slot=dropdown-menu-content]")?.getBoundingClientRect()
              const origem = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth, y: 0 }
              trocarTemaComCirculo(origem, () => aplicarTemaJa(valor, setTheme))
            }}
          >
            <DropdownMenuRadioItem value="light" closeOnClick={false}>
              <SunIcon aria-hidden="true" /> Tema claro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" closeOnClick={false}>
              <MoonIcon aria-hidden="true" /> Tema escuro
              <span className="text-muted-foreground ml-auto font-mono text-[11px]">D</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {podeSair && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => formSair.current?.requestSubmit()} title={email ? undefined : "Modo local: volta à tela de login"}>
                <LogOutIcon aria-hidden="true" /> Sair
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {podeSair && <form ref={formSair} method="post" action="/auth/sair" hidden />}
    </>
  )
}
