/** Vão entre os arcos, em graus. */
const VAO = 7

/**
 * O "ciclo" do Growth Cycle: um arco por etapa, começando no topo: concluídas em verde, a atual em laranja com
 * brilho, o resto apagado. Tamanho explícito em px (nunca esticado). Acima de 100 px mostra o placar no centro.
 */
export function AnelCiclo({ concluidas, total, atual, tamanho }: { concluidas: number; total: number; atual: boolean; tamanho: number }) {
  const feitas = Math.min(Math.max(concluidas, 0), total)
  const centro = tamanho / 2
  const raio = centro - tamanho * 0.07
  const espessura = Math.max(3, tamanho * 0.05)
  const passo = 360 / Math.max(total, 1)
  const ponto = (graus: number) => {
    const rad = ((graus - 90) * Math.PI) / 180
    return `${centro + raio * Math.cos(rad)} ${centro + raio * Math.sin(rad)}`
  }
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} role="img" aria-label={`${feitas} de ${total} etapas concluídas`} className="shrink-0">
      {Array.from({ length: total }, (_, i) => {
        const estado = i < feitas ? "concluida" : i === feitas && atual ? "atual" : "pendente"
        const cor = estado === "concluida" ? "var(--chart-3)" : estado === "atual" ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 12%, transparent)"
        return (
          <path
            key={i}
            data-estado={estado}
            d={`M${ponto(i * passo + VAO / 2)} A${raio} ${raio} 0 0 1 ${ponto((i + 1) * passo - VAO / 2)}`}
            fill="none"
            stroke={cor}
            strokeWidth={espessura}
            strokeLinecap="round"
            style={estado === "atual" ? { filter: `drop-shadow(0 0 ${tamanho * 0.04}px var(--primary))` } : undefined}
          />
        )
      })}
      {tamanho > 100 && (
        <>
          <text x="50%" y="47%" textAnchor="middle" className="fill-foreground font-serif" fontSize={tamanho * 0.3}>
            {feitas}
            <tspan className="fill-muted-foreground" fontSize={tamanho * 0.16}>
              /{total}
            </tspan>
          </text>
          <text x="50%" y="64%" textAnchor="middle" className="fill-muted-foreground" fontSize={tamanho * 0.06}>
            etapas concluídas
          </text>
        </>
      )}
    </svg>
  )
}
