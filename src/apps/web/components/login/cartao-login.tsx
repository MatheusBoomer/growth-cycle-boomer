"use client"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { cn } from "@workspace/ui/lib/utils"
import { FundoDithered } from "@/components/marca/fundo-dithered"
import { LogoBoomer } from "@/components/marca/logo-boomer"
import { useHoraSaoPaulo } from "@/components/marca/relogio"

function LogoGoogle() {
  return (
    <span aria-hidden="true" className="grid size-[18px] place-items-center rounded-full bg-white">
      <svg width="12" height="12" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z" />
      </svg>
    </span>
  )
}

/**
 * Login B (centrado e editorial) com o fundo dithered. O botão é um link comum (não `next/link`, que pré-carregaria a
 * rota de login) para /auth/entrar.
 */
export function CartaoLogin({ href, mensagemDeErro, fases }: { href: string; mensagemDeErro: string | null; fases: string[] }) {
  const hora = useHoraSaoPaulo()
  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-hidden">
      <FundoDithered centroLimpo />
      <div className="flex items-center justify-between px-6 pt-7 sm:px-10 sm:pt-8">
        <LogoBoomer className="h-6" />
        <span className="border-border bg-background/60 text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs backdrop-blur">
          {hora ? `${hora} em São Paulo` : null}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="border-border bg-background/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] backdrop-blur">
          <i className="bg-sucesso size-1.5 rounded-full" />
          Growth Cycle · acesso da equipe
        </span>
        <h1 className="mt-6 text-[clamp(44px,7vw,88px)] leading-[.95] font-medium tracking-[-0.055em]">
          Do diagnóstico ao
          <br />
          <em className="text-link-acao font-serif font-normal tracking-[-0.02em] italic">contrato fechado.</em>
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-md text-base leading-relaxed">
          Entre com a sua conta Google da Boomer para continuar os planejamentos.
        </p>
        <a
          href={href}
          className={cn(
            "brilho-passa bg-foreground text-background mt-7 inline-flex w-full max-w-[300px] items-center justify-center gap-2.5 rounded-full px-5 py-3 text-[15px] font-medium transition-transform hover:-translate-y-px",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
          )}
        >
          <LogoGoogle />
          Entrar com Google
        </a>
        {mensagemDeErro && (
          <Alert variant="destructive" className="bg-popover mt-5 max-w-sm text-left">
            <AlertDescription>{mensagemDeErro}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex justify-center px-6 pb-6">
        <span className="border-border bg-background/60 text-muted-foreground rounded-full border px-3.5 py-1.5 text-center text-[12.5px] backdrop-blur">
          {fases.join(" · ")}
        </span>
      </div>
    </main>
  )
}
