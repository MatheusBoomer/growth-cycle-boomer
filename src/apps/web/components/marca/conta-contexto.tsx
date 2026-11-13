"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Papel } from "@workspace/core/papeis"
import type { ExecutorDoAmbiente } from "@workspace/core/sistema"

/** O que a interface precisa saber do ambiente do servidor: quem roda o agente e se os dados estão na nuvem. */
export interface Ambiente {
  executor: ExecutorDoAmbiente
  nuvem: boolean
  /** Modo local sem login (PLANEJAMENTO_AUTH=off): a barra mostra um "Sair" que só volta à tela de login, para conferi-la. */
  semLogin?: boolean
}

/** Sem provedor (testes, páginas antigas): o modo local de sempre. */
const AMBIENTE_LOCAL: Ambiente = { executor: "cli", nuvem: false }

const ContaContexto = createContext<string | null>(null)
const AmbienteContexto = createContext<Ambiente>(AMBIENTE_LOCAL)
/** Sem provedor: o papel mais restrito. Só o servidor (layout) concede "admin". */
const PapelContexto = createContext<Papel>("usuario")

/**
 * Leva o e-mail e o papel de quem entrou e o ambiente do servidor (lidos no layout, que roda no servidor) até os
 * componentes de cliente. O papel aqui só decide o que a tela mostra; quem barra de verdade é o servidor. `email` null = sem login (modo off) ou ninguém entrou: a barra não mostra conta.
 * `ambiente` só traz o que não é segredo; vem derivado das variáveis de ambiente no servidor.
 */
export function ProvedorConta({
  email,
  papel = "usuario",
  ambiente = AMBIENTE_LOCAL,
  children,
}: {
  email: string | null
  papel?: Papel
  ambiente?: Ambiente
  children: ReactNode
}) {
  return (
    <ContaContexto.Provider value={email}>
      <PapelContexto.Provider value={papel}>
        <AmbienteContexto.Provider value={ambiente}>{children}</AmbienteContexto.Provider>
      </PapelContexto.Provider>
    </ContaContexto.Provider>
  )
}

export function useEmailDaConta(): string | null {
  return useContext(ContaContexto)
}

export function useAmbiente(): Ambiente {
  return useContext(AmbienteContexto)
}

export function usePapel(): Papel {
  return useContext(PapelContexto)
}
