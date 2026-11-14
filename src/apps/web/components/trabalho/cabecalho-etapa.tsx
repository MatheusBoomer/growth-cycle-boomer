import type { ReactNode } from "react"

/**
 * Cabeçalho da etapa na tela de trabalho: "Etapa 04 · Diagnóstico" pequeno e o nome da etapa grande em serifada,
 * com o selo "Agente trabalhando" enquanto o agente roda nesta etapa. `antes` e `depois` recebem os botões dos painéis.
 */
export function CabecalhoEtapa({
  numero,
  fase,
  titulo,
  trabalhando,
  selo,
  antes,
  depois,
}: {
  numero: string | null
  fase: string | null
  titulo: string
  trabalhando: boolean
  selo?: ReactNode
  antes?: ReactNode
  depois?: ReactNode
}) {
  const linha = [numero ? `Etapa ${numero}` : null, fase].filter(Boolean).join(" · ")
  return (
    <header className="border-border flex items-center gap-3 border-b px-5 py-3.5">
      {antes}
      <div className="min-w-0">
        {linha && <p className="text-muted-foreground text-xs">{linha}</p>}
        <h1 className="text-texto-forte truncate pr-1 font-serif text-[26px] leading-[1.1] italic tracking-[-0.01em] sm:text-[32px]">{titulo}</h1>
      </div>
      {selo}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {trabalhando && (
          <span className="border-primary/35 text-link-acao inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap">
            <i aria-hidden="true" className="bg-primary size-1.5 rounded-full motion-safe:animate-pulse" />
            Agente trabalhando
          </span>
        )}
        {depois}
      </div>
    </header>
  )
}
