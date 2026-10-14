/** Fundo fixo da marca: três brilhos difusos (laranja, azul, verde) e uma grade de pontos quase invisível. */
export function FundoBoomer() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-40 size-[520px] rounded-full blur-[120px]" style={{ background: "rgb(235 97 10 / var(--orb-laranja))" }} />
      <div className="absolute top-1/3 -right-32 size-[480px] rounded-full blur-[120px]" style={{ background: "rgb(57 135 229 / var(--orb-azul))" }} />
      <div className="absolute bottom-0 left-1/3 size-[360px] rounded-full blur-[120px]" style={{ background: "rgb(25 158 112 / var(--orb-verde))" }} />
      <div
        className="absolute inset-0"
        style={{ opacity: "var(--pontos)", backgroundImage: "radial-gradient(var(--pontos-cor) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
    </div>
  )
}
