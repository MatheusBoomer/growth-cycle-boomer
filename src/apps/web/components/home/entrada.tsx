"use client"

import { useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { FundoDithered } from "@/components/marca/fundo-dithered"
import { LogoBoomer } from "@/components/marca/logo-boomer"
import { useHoraSaoPaulo } from "@/components/marca/relogio"
import { TextoRevelado } from "@/components/marca/texto-revelado"
import { apagarCookieBoasVindas, temCookieBoasVindas } from "@/lib/boas-vindas"

/** Tempo com o nome na tela antes de começar a sair, e duração da saída (protótipo 2-home.html). */
const TEMPO_NA_TELA = 2400
const TEMPO_SAINDO = 600

type Fase = "entrando" | "saindo" | "fim"

/**
 * "Bem-vindo ao Growth Cycle": sobreposição de tela inteira que toca uma vez logo depois do login (a home só monta
 * quando o cookie de boas-vindas existe) e sai revelando a home. Clique ou Esc pulam. Com movimento reduzido não toca.
 */
export function Entrada({ emAndamento }: { emAndamento: number }) {
  // No servidor (primeira carga, logo após o login) começa entrando. No navegador, sem o cookie é porque a home veio do
  // cache do roteador (ex.: botão Voltar): não toca de novo.
  const [fase, setFase] = useState<Fase>(() => (typeof document === "undefined" || temCookieBoasVindas() ? "entrando" : "fim"))
  const hora = useHoraSaoPaulo()

  useEffect(() => {
    apagarCookieBoasVindas()
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setFase("fim")
      return
    }
    const id = setTimeout(() => setFase((f) => (f === "entrando" ? "saindo" : f)), TEMPO_NA_TELA)
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setFase((f) => (f === "entrando" ? "saindo" : f))
    window.addEventListener("keydown", aoTeclar)
    return () => {
      clearTimeout(id)
      window.removeEventListener("keydown", aoTeclar)
    }
  }, [])

  useEffect(() => {
    if (fase !== "saindo") return
    const id = setTimeout(() => setFase("fim"), TEMPO_SAINDO)
    return () => clearTimeout(id)
  }, [fase])

  if (fase === "fim") return null
  return (
    <div
      role="presentation"
      onClick={() => setFase((f) => (f === "entrando" ? "saindo" : f))}
      className={cn(
        "bg-background fixed inset-0 z-50 isolate flex motion-reduce:hidden cursor-pointer flex-col justify-between overflow-hidden px-6 py-7 transition-[opacity,filter,transform] duration-600 ease-[cubic-bezier(.7,0,.2,1)] sm:px-10 sm:py-8",
        fase === "saindo" && "pointer-events-none scale-[1.04] opacity-0 blur-md",
      )}
    >
      <FundoDithered intensidade={0.75} />
      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <LogoBoomer className="h-6" />
        <span className="border-border bg-background/60 rounded-full border px-3 py-1 font-mono text-xs backdrop-blur">
          {hora ? `${hora} em São Paulo` : null}
        </span>
      </div>
      <div>
        <p className="font-serif text-[clamp(28px,3.6vw,52px)] italic">
          <TextoRevelado corBase="var(--muted-foreground)">Bem-vindo ao</TextoRevelado>
        </p>
        <h1 className="text-[clamp(48px,15.5vw,222px)] leading-[.82] font-semibold tracking-[-0.07em] whitespace-nowrap">
          <TextoRevelado atraso={0.17} corBase="var(--foreground)">Growth</TextoRevelado>
          <TextoRevelado atraso={0.33} corBase="var(--primary)" className="ml-[0.08em] font-serif font-normal tracking-[-0.03em] italic">
            Cycle
          </TextoRevelado>
        </h1>
        <div className="text-muted-foreground mt-10 flex justify-between gap-4 text-sm">
          <span>Diagnóstico · Metas · Mídia · Plano de ação</span>
          <span>{emAndamento === 1 ? "1 projeto em andamento" : `${emAndamento} projetos em andamento`}</span>
        </div>
      </div>
    </div>
  )
}
