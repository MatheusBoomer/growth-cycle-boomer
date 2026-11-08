import type { EtapaId } from "@workspace/core/tipos"
import type { CorpoPresenca } from "./api"

/** A rota rejeita `segundosSemInteracao` acima de 24 h; uma aba esquecida aberta por dias continua avisando. */
const LIMITE_SEGUNDOS = 86_400

export interface MedidorPresenca {
  registrarInteracao(): void
  corpo(etapa: EtapaId, visivel: boolean): CorpoPresenca
}

/** Guarda o horário da última interação e monta o corpo do aviso de presença. Puro: o relógio vem de fora. */
export function criarMedidorPresenca(agora: () => number): MedidorPresenca {
  let ultima = agora()
  return {
    registrarInteracao() {
      ultima = agora()
    },
    corpo(etapa, visivel) {
      const segundos = Math.floor((agora() - ultima) / 1000)
      return { etapa, visivel, segundosSemInteracao: Math.min(LIMITE_SEGUNDOS, Math.max(0, segundos)) }
    },
  }
}

/** Tipo da mensagem que o script injetado nos visualizadores manda à janela de cima a cada interação. */
export const TIPO_MENSAGEM_INTERACAO = "planejamento:interacao"

/** Intervalo mínimo entre duas mensagens do script injetado (o `pointermove` e o `scroll` disparam o tempo todo). */
const INTERVALO_MENSAGEM_MS = 5_000

/**
 * Script (tag `<script>`) que vai dentro do `srcDoc` dos visualizadores. O iframe tem sandbox e uma janela própria:
 * teclado, clique, rolagem e movimento lá dentro nunca chegam ao `window` da página, então o script avisa a página
 * por `postMessage`, no máximo uma vez a cada 5 s.
 */
export function scriptDeInteracao(): string {
  const eventos = JSON.stringify(["keydown", "pointerdown", "wheel", "scroll", "pointermove"])
  const mensagem = JSON.stringify({ tipo: TIPO_MENSAGEM_INTERACAO })
  return (
    `<script>(function(){var u=0;function a(){var n=Date.now();if(n-u<${INTERVALO_MENSAGEM_MS})return;u=n;` +
    `try{parent.postMessage(${mensagem},"*")}catch(e){}}` +
    `${eventos}.forEach(function(e){window.addEventListener(e,a,{capture:true,passive:true})})})()</script>`
  )
}

/** O HTML do visualizador com o script de interação no fim (antes dele, um script quebraria o doctype). */
export function comScriptDeInteracao(html: string): string {
  return html + scriptDeInteracao()
}

/**
 * Uma mensagem conta como interação quando traz o tipo certo e vem da janela de algum iframe da página; qualquer
 * outra origem (outra aba, extensão, iframe de fora) é ignorada.
 */
export function ehMensagemDeInteracao(dados: unknown, origem: unknown, janelasDeIframe: ReadonlyArray<unknown>): boolean {
  if (typeof dados !== "object" || dados === null) return false
  if ((dados as { tipo?: unknown }).tipo !== TIPO_MENSAGEM_INTERACAO) return false
  return origem != null && janelasDeIframe.some((j) => j != null && j === origem)
}

/** O foco saiu da página para dentro de um iframe (PDF e outros conteúdos que não dão para instrumentar). */
export function focoFoiParaIframe(elementoAtivo: { tagName?: string } | null): boolean {
  return elementoAtivo?.tagName === "IFRAME"
}
