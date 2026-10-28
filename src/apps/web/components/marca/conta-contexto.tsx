"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { ExecutorDoAmbiente } from "@workspace/core/sistema"

/** O que a interface precisa saber do ambiente do servidor: quem roda o agente e se os dados estão na nuvem. */
export interface Ambiente {
  executor: ExecutorDoAmbiente
  nuvem: boolean
}

/** Sem provedor (testes, páginas antigas): o modo local de sempre. */
const AMBIENTE_LOCAL: Ambiente = { executor: "cli", nuvem: false }

const ContaContexto = createContext<string | null>(null)
const AmbienteContexto = createContext<Ambiente>(AMBIENTE_LOCAL)

/**
 * Leva o e-mail de quem entrou e o ambiente do servidor (ambos lidos no layout, que roda no servidor) até os
 * componentes de cliente. `email` null = sem login (modo off) ou ninguém entrou: a barra não mostra conta.
 * `ambiente` só traz o que não é segredo; vem derivado das variáveis de ambiente no servidor.
 */
export function ProvedorConta({ email, ambiente = AMBIENTE_LOCAL, children }: { email: string | null; ambiente?: Ambiente; children: ReactNode }) {
  return (
    <ContaContexto.Provider value={email}>
      <AmbienteContexto.Provider value={ambiente}>{children}</AmbienteContexto.Provider>
    </ContaContexto.Provider>
  )
}

export function useEmailDaConta(): string | null {
  return useContext(ContaContexto)
}

export function useAmbiente(): Ambiente {
  return useContext(AmbienteContexto)
}
