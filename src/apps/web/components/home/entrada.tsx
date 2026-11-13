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
const TEMPO_SAINDO = 1300

type Fase = "entrando" | "saindo" | "fim"

/**
 * "Bem-vindo ao Growth Cycle": sobreposição de tela inteira que toca uma vez logo depois do login (a home só monta
 * quando o cookie de boas-vindas existe) e sai revelando a home. Clique ou Esc pulam. Com movimento reduzido não toca.
 */
export function Entrada({ emAndamento }: { emAndamento: number }) {
  // No servidor (primeira carga, logo após o login) começa entrando. No navegador, sem o cookie é porque a home veio do
  // cache do roteador (ex.: botão Voltar): não toca de novo.
  const [fase, setFase] = useState<Fase>(() =>
    typeof document === "undefined" || temCookieBoasVindas()
      ? "entrando"
      : "fim"
  )
  const hora = useHoraSaoPaulo()

  useEffect(() => {
    apagarCookieBoasVindas()
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setFase("fim")
      return
    }
    const id = setTimeout(
      () => setFase((f) => (f === "entrando" ? "saindo" : f)),
      TEMPO_NA_TELA
    )
    const aoTeclar = (e: KeyboardEvent) =>
      e.key === "Escape" && setFase((f) => (f === "entrando" ? "saindo" : f))
    window.addEventListener("keydown", aoTeclar)
    return () => {
      clearTimeout(id)
      window.removeEventListener("keydown", aoTeclar)
    }
  }, [])

  // Enquanto a entrada está na tela, os blocos da home ficam parados (classe no <html> pausa o .surgir); quando ela
  // começa a sair, eles sobem por baixo, e a passagem fica contínua em vez de revelar uma home já parada.
  useEffect(() => {
    const raiz = document.documentElement
    raiz.classList.toggle("entrada-ativa", fase === "entrando")
    return () => raiz.classList.remove("entrada-ativa")
  }, [fase])

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
        // Saída em duas camadas: o texto sobe e se desfaz primeiro (conteúdo), o fundo esmaece depois, devagar.
        "fixed inset-0 isolate z-50 flex cursor-pointer flex-col overflow-hidden bg-background transition-opacity delay-200 duration-1100 ease-[cubic-bezier(.65,0,.35,1)] motion-reduce:hidden",
        fase === "saindo" && "pointer-events-none opacity-0"
      )}
    >
      {/* O fundo fica parado e só esmaece com a camada; quem sobe é o texto (senão abre uma faixa lisa embaixo). */}
      <FundoDithered intensidade={0.75} />
      <div
        className={cn(
          "flex flex-1 flex-col justify-between px-6 py-7 transition-[opacity,filter,translate] duration-900 ease-[cubic-bezier(.22,1,.36,1)] sm:px-10 sm:py-8",
          fase === "saindo" && "-translate-y-3 opacity-0 blur-sm"
        )}
      >
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <LogoBoomer className="h-6" />
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 font-mono text-xs backdrop-blur">
            {hora ? `${hora} em São Paulo` : null}
          </span>
        </div>
        <div>
          <p className="font-serif text-[clamp(28px,3.6vw,52px)] italic">
            <TextoRevelado corBase="var(--muted-foreground)">
              Bem-vindo ao
            </TextoRevelado>
          </p>
          <h1 className="text-[clamp(48px,15.5vw,222px)] leading-[.82] font-semibold tracking-[-0.07em] whitespace-nowrap">
            <TextoRevelado atraso={0.17} corBase="var(--foreground)">
              Growth
            </TextoRevelado>
            <TextoRevelado
              atraso={0.33}
              corBase="var(--primary)"
              className="ml-[0.08em] font-serif font-normal tracking-[-0.03em] italic"
            >
              Cycle
            </TextoRevelado>
          </h1>
          <div className="mt-10 flex justify-between gap-4 text-sm text-muted-foreground">
            <span>Diagnóstico · Metas · Mídia · Plano de ação</span>
            <span>
              {emAndamento === 1
                ? "1 projeto em andamento"
                : `${emAndamento} projetos em andamento`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
