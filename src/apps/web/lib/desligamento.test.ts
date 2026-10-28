import type { FsArmazenamento } from "@workspace/core/armazenamento"
import { ErroReiniciando } from "@workspace/core/erros"
import type { ServicoTurnos } from "@workspace/core/servico-turnos"
import { describe, expect, it, vi } from "vitest"
import { instalarDesligamento, prazoDeDrenagem } from "./desligamento"
import { respostaDeErro } from "./http"

const SEGREDO = "sb_secret_nao_pode_vazar"

/** Processo falso: guarda os ouvintes de sinal para o teste disparar. */
function processoFalso() {
  const ouvintes: Record<string, (() => void)[]> = {}
  const on = vi.fn((sinal: string, fn: () => void) => {
    ;(ouvintes[sinal] ??= []).push(fn)
  })
  const disparar = (sinal: string) => (ouvintes[sinal] ?? []).forEach((fn) => fn())
  return { processo: { on } as unknown as Pick<NodeJS.Process, "on">, on, disparar }
}

function montar(o: {
  env?: Record<string, string | undefined>
  drenar?: (prazoMs: number) => Promise<{ abortados: string[] }>
  sincronizarTudo?: () => Promise<void>
  semServicos?: boolean
} = {}) {
  const ordem: string[] = []
  const drenar = vi.fn(async (prazoMs: number) => {
    ordem.push("drenar")
    return o.drenar ? o.drenar(prazoMs) : { abortados: [] }
  })
  const sincronizarTudo = vi.fn(async () => {
    ordem.push("sincronizarTudo")
    if (o.sincronizarTudo) await o.sincronizarTudo()
  })
  const sair = vi.fn((codigo: number) => {
    ordem.push(`sair(${codigo})`)
  })
  const log = vi.fn<(mensagem: string) => void>()
  const { processo, on, disparar } = processoFalso()
  const servicos = {
    turnos: { drenar } as unknown as ServicoTurnos,
    armazenamento: { sincronizarTudo } as unknown as FsArmazenamento,
  }
  instalarDesligamento({
    env: o.env ?? { SUPABASE_SERVICE_ROLE_KEY: SEGREDO },
    servidor: () => (o.semServicos ? undefined : servicos),
    sair,
    processo,
    log,
  })
  return { ordem, drenar, sincronizarTudo, sair, log, on, disparar }
}

describe("prazoDeDrenagem", () => {
  it("padrão de 5 minutos sem a variável, vazia, inválida ou menor que 1 s", () => {
    expect(prazoDeDrenagem({})).toBe(300000)
    expect(prazoDeDrenagem({ PLANEJAMENTO_DRENAGEM_MS: "" })).toBe(300000)
    expect(prazoDeDrenagem({ PLANEJAMENTO_DRENAGEM_MS: "  " })).toBe(300000)
    expect(prazoDeDrenagem({ PLANEJAMENTO_DRENAGEM_MS: "abc" })).toBe(300000)
    expect(prazoDeDrenagem({ PLANEJAMENTO_DRENAGEM_MS: "500" })).toBe(300000)
    expect(prazoDeDrenagem({ PLANEJAMENTO_DRENAGEM_MS: "-2000" })).toBe(300000)
  })

  it("valor válido em milissegundos", () => {
    expect(prazoDeDrenagem({ PLANEJAMENTO_DRENAGEM_MS: "60000" })).toBe(60000)
    expect(prazoDeDrenagem({ PLANEJAMENTO_DRENAGEM_MS: " 1000 " })).toBe(1000)
  })
})

describe("instalarDesligamento", () => {
  it("instala SIGTERM e SIGINT uma única vez por processo", () => {
    const { processo, on } = processoFalso()
    const d = { env: {}, servidor: () => undefined, sair: vi.fn(), processo, log: vi.fn() }
    instalarDesligamento(d)
    instalarDesligamento(d)
    expect(on.mock.calls.map((c) => c[0]).sort()).toEqual(["SIGINT", "SIGTERM"])
  })

  it("no SIGTERM: drenar com o prazo, depois sincronizarTudo, depois sair(0)", async () => {
    const m = montar({ env: { PLANEJAMENTO_DRENAGEM_MS: "60000" } })
    m.disparar("SIGTERM")
    await vi.waitFor(() => expect(m.sair).toHaveBeenCalled())
    expect(m.ordem).toEqual(["drenar", "sincronizarTudo", "sair(0)"])
    expect(m.drenar).toHaveBeenCalledWith(60000)
    expect(m.log.mock.calls.every(([texto]) => texto.includes("desligamento"))).toBe(true)
  })

  it("SIGINT segue o mesmo caminho", async () => {
    const m = montar()
    m.disparar("SIGINT")
    await vi.waitFor(() => expect(m.sair).toHaveBeenCalled())
    expect(m.ordem).toEqual(["drenar", "sincronizarTudo", "sair(0)"])
    expect(m.drenar).toHaveBeenCalledWith(300000)
  })

  it("segundo SIGTERM (ou um SIGINT no meio) não repete o desligamento", async () => {
    let soltar: () => void = () => {}
    const m = montar({ drenar: () => new Promise((r) => (soltar = () => r({ abortados: [] }))) })
    m.disparar("SIGTERM")
    m.disparar("SIGTERM")
    m.disparar("SIGINT")
    soltar()
    await vi.waitFor(() => expect(m.sair).toHaveBeenCalled())
    m.disparar("SIGTERM")
    await new Promise((r) => setTimeout(r, 10))
    expect(m.ordem).toEqual(["drenar", "sincronizarTudo", "sair(0)"])
  })

  it("turnos abortados por prazo aparecem no log e a saída continua 0", async () => {
    const m = montar({ drenar: async () => ({ abortados: ["acme", "beta"] }) })
    m.disparar("SIGTERM")
    await vi.waitFor(() => expect(m.sair).toHaveBeenCalled())
    expect(m.ordem).toEqual(["drenar", "sincronizarTudo", "sair(0)"])
    expect(m.log.mock.calls.some(([texto]) => texto.includes("desligamento") && texto.includes("acme, beta"))).toBe(true)
  })

  it("sem serviços criados, sai direto com 0", async () => {
    const m = montar({ semServicos: true })
    m.disparar("SIGTERM")
    await vi.waitFor(() => expect(m.sair).toHaveBeenCalled())
    expect(m.ordem).toEqual(["sair(0)"])
  })

  it("falha ao drenar: ainda sincroniza, sai com 1 e o log não imprime valores", async () => {
    const m = montar({
      drenar: async () => {
        throw new Error(`falhou com ${SEGREDO} em https://projeto.supabase.co`)
      },
    })
    m.disparar("SIGTERM")
    await vi.waitFor(() => expect(m.sair).toHaveBeenCalled())
    expect(m.ordem).toEqual(["drenar", "sincronizarTudo", "sair(1)"])
    const textos = m.log.mock.calls.map(([t]) => t).join("\n")
    expect(textos).toContain("desligamento")
    expect(textos).not.toContain(SEGREDO)
    expect(textos).not.toContain("projeto.supabase.co")
  })

  it("falha ao sincronizar: sai com 1 e o log não imprime valores", async () => {
    const m = montar({
      sincronizarTudo: async () => {
        throw new Error(`chave ${SEGREDO}`)
      },
    })
    m.disparar("SIGTERM")
    await vi.waitFor(() => expect(m.sair).toHaveBeenCalled())
    expect(m.ordem).toEqual(["drenar", "sincronizarTudo", "sair(1)"])
    const textos = m.log.mock.calls.map(([t]) => t).join("\n")
    expect(textos).toContain("desligamento")
    expect(textos).not.toContain(SEGREDO)
  })
})

describe("turno recusado no desligamento pela API", () => {
  it("vira 503 com o código reiniciando e o texto exato", async () => {
    const r = respostaDeErro(new ErroReiniciando())
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ erro: "O servidor está reiniciando. Tente de novo em instantes.", codigo: "reiniciando" })
  })
})
