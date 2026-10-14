import { cn } from "@workspace/ui/lib/utils"

/** As duas versões vão no HTML e o tema escolhe por CSS: nenhuma troca visível na hidratação. */
export function LogoBoomer({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeno, sem otimização */}
      <img src="/marca/boomer-logo-claro.svg" alt="Boomer" className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
      <img src="/marca/boomer-logo-escuro.svg" alt="Boomer" className="hidden h-full w-auto dark:block" />
    </span>
  )
}
