import type { ReactNode } from "react"

/** Moldura das páginas 404 e de erro: o código grande em serifada laranja, título com destaque e as ações (protótipo 11). */
export function PaginaErro({ codigo, titulo, destaque, children, acoes }: { codigo: string; titulo: string; destaque: string; children: ReactNode; acoes: ReactNode }) {
  return (
    <main className="relative isolate grid min-h-[calc(100svh-4rem)] place-items-center px-6 py-16 text-center">
      {/* Pontilhado laranja que some nas bordas, no lugar do fundo dithered (página sem JavaScript garantido). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(color-mix(in_srgb,var(--primary)_35%,transparent)_1px,transparent_1.5px)] bg-size-[6px_6px] opacity-50 mask-[radial-gradient(60%_60%_at_50%_40%,#000,transparent_75%)]"
      />
      <div>
        <p className="font-serif text-[clamp(88px,14vw,140px)] leading-[0.9] tracking-[-0.02em] text-link-acao italic">{codigo}</p>
        <h1 className="mt-3 text-[clamp(24px,3vw,30px)] font-medium tracking-[-0.03em]">
          {titulo} <em className="font-serif font-normal text-link-acao italic">{destaque}</em>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">{acoes}</div>
      </div>
    </main>
  )
}
