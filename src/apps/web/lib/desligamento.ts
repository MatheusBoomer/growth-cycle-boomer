import type { FsArmazenamento } from "@workspace/core/armazenamento"
import { ehErroDominio } from "@workspace/core/erros"
import type { ServicoTurnos } from "@workspace/core/servico-turnos"

/**
 * Desligamento seguro (SIGTERM do provedor a cada deploy ou reinício). Só vale com NEXT_MANUAL_SIG_HANDLE=true, que
 * desliga o tratamento de sinais do próprio Next. Espera os turnos do agente (até o prazo), envia à nuvem o que
 * ainda estava agendado e sai. O log nunca imprime valor de variável nem mensagem de erro (pode conter chave ou URL).
 */

const PRAZO_PADRAO_MS = 300000
const PRAZO_MINIMO_MS = 1000

interface Servicos {
  turnos: ServicoTurnos
  armazenamento: FsArmazenamento
}

/** PLANEJAMENTO_DRENAGEM_MS em milissegundos; ausente, inválido ou menor que 1 s vale o padrão (5 minutos). */
export function prazoDeDrenagem(env: Record<string, string | undefined>): number {
  const texto = env.PLANEJAMENTO_DRENAGEM_MS?.trim() ?? ""
  const valor = Number(texto)
  if (texto === "" || !Number.isInteger(valor) || valor < PRAZO_MINIMO_MS) return PRAZO_PADRAO_MS
  return valor
}

/** Serviços já criados por lib/servidor.ts (registro global), sem criar nenhum: undefined = nunca houve requisição. */
export function servidorJaCriado(): Servicos | undefined {
  return (globalThis as unknown as { __planejamento?: Servicos }).__planejamento
}

/** Só o tipo do erro, nunca a mensagem. */
function descrever(e: unknown): string {
  if (ehErroDominio(e)) return e.codigo
  return e instanceof Error ? e.name : "erro desconhecido"
}

const instalados = new WeakSet<object>()

export function instalarDesligamento(d: {
  env: Record<string, string | undefined>
  servidor: () => Servicos | undefined
  sair: (codigo: number) => void
  processo?: Pick<NodeJS.Process, "on">
  log?: (mensagem: string) => void
}): void {
  const processo = d.processo ?? process
  if (instalados.has(processo)) return
  instalados.add(processo)
  const log = d.log ?? ((mensagem: string) => console.info(mensagem))
  let iniciado = false

  const desligar = async (sinal: string): Promise<void> => {
    const servicos = d.servidor()
    if (!servicos) {
      log(`[planejamento] desligamento: ${sinal} recebido, nenhum serviço criado; saindo.`)
      d.sair(0)
      return
    }
    const prazo = prazoDeDrenagem(d.env)
    log(`[planejamento] desligamento: ${sinal} recebido, esperando os turnos em andamento (prazo de ${Math.round(prazo / 1000)} s).`)
    let falhou = false
    try {
      const { abortados } = await servicos.turnos.drenar(prazo)
      if (abortados.length) log(`[planejamento] desligamento: prazo esgotado, turnos interrompidos: ${abortados.join(", ")}.`)
    } catch (e) {
      falhou = true
      log(`[planejamento] desligamento: falha ao esperar os turnos (${descrever(e)}).`)
    }
    // Mesmo se a espera falhou: o que estava agendado ainda vai para a nuvem.
    try {
      await servicos.armazenamento.sincronizarTudo()
    } catch (e) {
      falhou = true
      log(`[planejamento] desligamento: falha ao sincronizar os arquivos (${descrever(e)}).`)
    }
    log(`[planejamento] desligamento: ${falhou ? "concluído com falhas" : "concluído"}; saindo.`)
    d.sair(falhou ? 1 : 0)
  }

  const aoSinal = (sinal: string) => {
    // O provedor pode repetir o sinal; o desligamento roda uma vez só.
    if (iniciado) return
    iniciado = true
    void desligar(sinal)
  }
  processo.on("SIGTERM", () => aoSinal("SIGTERM"))
  processo.on("SIGINT", () => aoSinal("SIGINT"))
}
