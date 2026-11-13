import { FundoDithered } from "./fundo-dithered"

/**
 * Faixa fraca do fundo dithered no topo da home e do admin (força ~45%), que some antes dos cards.
 * Sobe 56 px por trás da barra do topo (transparente), para não marcar um degrau onde ela termina.
 * O pai precisa ser `relative isolate`. Nunca na tela de trabalho.
 */
export function FaixaDithered() {
  return (
    <div
      data-slot="faixa-dithered"
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-14 isolate -z-10 h-[416px] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]"
    >
      <FundoDithered intensidade={0.45} />
    </div>
  )
}
