"use client"

import { usePathname } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { EVENTO_RESUMO_ADMIN, type ResumoAdmin } from "@/lib/resumo-admin"

const Contexto = createContext<ResumoAdmin | null>(null)

/** Lê o resumo do admin ao entrar e a cada troca de aba, e de novo quando uma tela avisa que mudou papel, nota ou report. */
export function ProvedorResumoAdmin({ children }: { children: React.ReactNode }) {
  const caminho = usePathname()
  const [resumo, setResumo] = useState<ResumoAdmin | null>(null)
  useEffect(() => {
    let vivo = true
    // Falhou: os selos somem (ficam no último valor lido); a aba continua usável.
    const ler = () =>
      api.resumoAdmin().then(
        (r) => vivo && setResumo(r),
        () => {},
      )
    void ler()
    window.addEventListener(EVENTO_RESUMO_ADMIN, ler)
    return () => {
      vivo = false
      window.removeEventListener(EVENTO_RESUMO_ADMIN, ler)
    }
  }, [caminho])
  return <Contexto.Provider value={resumo}>{children}</Contexto.Provider>
}

export const useResumoAdmin = () => useContext(Contexto)

/** Conteúdo da aba: a chave pela rota remonta o bloco, e a animação de entrada (Blur Fade) roda a cada troca de aba. */
export function ConteudoAba({ children }: { children: React.ReactNode }) {
  const caminho = usePathname()
  return (
    <div key={caminho} className="entrar-aba flex flex-col gap-6">
      {children}
    </div>
  )
}
