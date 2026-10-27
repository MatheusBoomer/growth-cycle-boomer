"use client"

import { createContext, useContext, type ReactNode } from "react"

const ContaContexto = createContext<string | null>(null)

/**
 * Leva o e-mail de quem entrou (lido no servidor, no layout) até a barra do topo, que é usada por
 * componentes de cliente. `null` = sem login (modo off) ou ninguém entrou: a barra não mostra conta.
 */
export function ProvedorConta({ email, children }: { email: string | null; children: ReactNode }) {
  return <ContaContexto.Provider value={email}>{children}</ContaContexto.Provider>
}

export function useEmailDaConta(): string | null {
  return useContext(ContaContexto)
}
