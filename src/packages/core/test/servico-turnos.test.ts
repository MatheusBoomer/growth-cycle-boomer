import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { ErroTurnoAtivo } from "../src/erros"
import { FakeExecutor, roteiroSimples, type Roteiro } from "../src/executor/fake"
import type { PedidoTurno } from "../src/executor/tipos"
import type { MemoriaDeSessao } from "../src/nuvem/memoria-sessao"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import { aspasShell, montarMcpConfig, montarSettingsHook, ServicoTurnos, type ConfigTurnos } from "../src/servico-turnos"
import { catalogoReal, raizTemporaria } from "./ajuda"

let raiz: string
let servico: ServicoPlanejamento
let barramento: Barramento
let config: ConfigTurnos

beforeEach(async () => {
  raiz = await raizTemporaria()
  barramento = new Barramento()
  servico = new ServicoPlanejamento({
    armazenamento: new FsArmazenamento(raiz, async () => {}),
    catalogo: catalogoReal(),
    barramento,
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
  })
  config = {
    raiz,
    urlApp: "http://127.0.0.1:3000",
    caminhoServidorMcp: path.join(raiz, "src/packages/mcp-planejamento/src/servidor.ts"),
    caminhoHook: path.join(raiz, "src/packages/mcp-planejamento/src/hook-escrita.ts"),
    comandoNode: "/usr/local/bin/node",
  }
})

function turnos(roteiro: Roteiro) {
  const executor = new FakeExecutor(roteiro)
  const t = new ServicoTurnos({ servico, executor, barramento, catalogo: catalogoReal(), config })
  return { t, executor }
}

const tokenDo = (p: PedidoTurno) =>
  (JSON.parse(p.mcpConfig) as { mcpServers: { planejamento: { env: { PLANEJAMENTO_TOKEN: string } } } }).mcpServers
    .planejamento.env.PLANEJAMENTO_TOKEN

describe("configuração passada ao claude", () => {
  it("aspas sobrevivem a espaço e apóstrofo no caminho", () => {
    expect(aspasShell("/a/Projetos Boomer/x")).toBe("'/a/Projetos Boomer/x'")
    expect(aspasShell("/a/d'ávila")).toBe("'/a/d'\\''ávila'")
  })

  it("hook e MCP apontam para os arquivos certos", () => {
    const settings = JSON.parse(montarSettingsHook(config, path.join(raiz, "clientes/iszi"))) as {
      hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] }
    }
    const hook = settings.hooks.PreToolUse[0]!
    expect(hook.matcher).toBe("Write|Edit|MultiEdit|NotebookEdit")
    expect(hook.hooks[0]!.command).toBe(
      [config.comandoNode, config.caminhoHook, path.join(raiz, "clientes/iszi")].map(aspasShell).join(" "),
    )
    const mcp = JSON.parse(montarMcpConfig(config, "tok")) as { mcpServers: { planejamento: { args: string[]; env: Record<string, string> } } }
    expect(mcp.mcpServers.planejamento.args).toEqual([config.caminhoServidorMcp])
    expect(mcp.mcpServers.planejamento.env).toEqual({ PLANEJAMENTO_APP_URL: config.urlApp, PLANEJAMENTO_TOKEN: "tok" })
  })
})

describe("turnos", () => {
  it("iniciar manda o prompt inicial, grava a sessão e a conversa", async () => {
    const { t, executor } = turnos(roteiroSimples("Olá, vamos começar.", "sessao-1"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    const pedido = executor.pedidos[0]!
    expect(pedido.sessionId).toBeNull()
    expect(pedido.mensagem).toContain("`01-preparacao-de-contexto`")
    expect(pedido.systemPrompt).toContain("clientes/iszi/.app/rascunhos/")
    expect(pedido.cwd).toBe(raiz)
    expect((await servico.estado(slug)).etapas["01"].sessionId).toBe("sessao-1")
    const tipos = (await servico.conversa(slug, "01")).map((e) => e.tipo)
    expect(tipos).toEqual(["aviso", "turno_inicio", "texto_agente", "turno_fim"])
  })

  it("a segunda mensagem retoma a sessão e manda só o texto", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "sessao-1"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await t.enviarMensagem(slug, "01", "segue a transcrição")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos[1]).toMatchObject({ sessionId: "sessao-1", mensagem: "segue a transcrição" })
  })

  it("mensagem com ajustes mostra o texto curto no chat e manda a mensagem composta ao agente", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "sessao-1"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await servico.ferramenta({ slug, etapa: "01" }, "solicitar_insumo", { insumo_id: "kickoff-transcricao" })
    await mkdir(path.join(raiz, "clientes", slug, ".app/rascunhos"), { recursive: true })
    await writeFile(path.join(raiz, "clientes", slug, ".app/rascunhos/s.md"), "# S")
    await servico.ferramenta({ slug, etapa: "01" }, "propor_entregavel", {
      tipo: "secao",
      titulo: "Resumo",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/s.md`,
      nome_final: "resumo",
    })
    const id = (await servico.estado(slug)).entregaveis[0]!.id
    await t.enviarMensagemComAjustes(slug, "01", "tirar o último parágrafo", [{ entregavelId: id, marcas: [] }])
    await t.aguardarOcioso(slug)
    expect(executor.pedidos.at(-1)!.mensagem).toContain("AJUSTE no entregável “Resumo” (resumo)")
    expect(executor.pedidos.at(-1)!.mensagem).toContain("tirar o último parágrafo")
    const balao = (await servico.conversa(slug, "01")).find((e) => e.tipo === "mensagem_analista")!
    expect(balao).toMatchObject({
      texto: "tirar o último parágrafo",
      referencias: [{ entregavelId: id, titulo: "Resumo", marcacoes: 0, primeiraMarcacao: 1 }],
    })
  })

  it("mensagem com ajuste inválido não envia nada e libera o prospect", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "sessao-1"))
    const slug = await servico.criarProspect("Iszi", null)
    const antes = executor.pedidos.length
    await expect(t.enviarMensagemComAjustes(slug, "01", "ajustar", [{ entregavelId: "nao-existe", marcas: [] }])).rejects.toThrow()
    expect(executor.pedidos.length).toBe(antes)
    expect(t.ativo(slug)).toBeNull()
  })

  it("ferramenta chamada no meio do turno usa o token do turno", async () => {
    let resposta = ""
    const { t } = turnos(async function* (pedido) {
      yield { tipo: "sessao", sessionId: "s" }
      const ctx = t.contextoDoToken(tokenDo(pedido))!
      resposta = (await servico.ferramenta(ctx, "solicitar_insumo", { insumo_id: "kickoff-transcricao" })).mensagem
      yield { tipo: "fim", ok: true, erro: null, sessionId: "s" }
    })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(resposta).toContain("Transcrição do kickoff")
    expect(t.contextoDoToken("qualquer")).toBeNull()
  })

  it("recusa mensagem com turno ativo e Parar interrompe", async () => {
    const { t } = turnos(async function* (_p, sinal) {
      yield { tipo: "sessao", sessionId: "s" }
      // o Parar pode chegar antes de o roteiro começar a escutar (mesmo contrato do executor real)
      if (!sinal.aborted) await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
    })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    expect(t.ativo(slug)).toBe("01")
    await expect(t.enviarMensagem(slug, "01", "oi")).rejects.toBeInstanceOf(ErroTurnoAtivo)
    t.parar(slug)
    await t.aguardarOcioso(slug)
    expect(t.ativo(slug)).toBeNull()
    expect((await servico.conversa(slug, "01")).at(-1)).toMatchObject({ tipo: "turno_fim", status: "interrompido" })
  })

  it("item na fila dispara um turno automático", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "s"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await servico.enfileirar(slug, "01", "O analista APROVOU o entregável X.")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos.at(-1)!.mensagem).toContain("APROVOU")
    const conversa = await servico.conversa(slug, "01")
    expect(conversa.find((e) => e.tipo === "mensagem_analista")).toMatchObject({ automatica: true })
  })

  it("enquanto a fila é retirada, a mensagem do analista é recusada e o item da fila não se perde", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "s"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    const original = servico.retirarFila.bind(servico)
    let recusa: unknown = null
    servico.retirarFila = async (s: string) => {
      const item = await original(s)
      if (item) recusa = await t.enviarMensagem(s, "01", "mensagem do analista").catch((e) => e)
      return item
    }
    await servico.enfileirar(slug, "01", "O analista APROVOU o entregável X.")
    await t.aguardarOcioso(slug)
    expect(recusa).toBeInstanceOf(ErroTurnoAtivo)
    expect(executor.pedidos.some((p) => p.mensagem.includes("APROVOU"))).toBe(true)
  })

  describe("nunca dois turnos ao mesmo tempo no mesmo prospect", () => {
    function contador() {
      const c = { agora: 0, maximo: 0 }
      const roteiro: Roteiro = async function* () {
        c.agora++
        c.maximo = Math.max(c.maximo, c.agora)
        yield { tipo: "sessao", sessionId: "s1" }
        await new Promise((r) => setTimeout(r, 30))
        c.agora--
        yield { tipo: "fim", ok: true, erro: null, sessionId: "s1" }
      }
      return { c, roteiro }
    }

    it("duas mensagens simultâneas (duplo clique): uma roda, a outra é recusada", async () => {
      const { c, roteiro } = contador()
      const { t, executor } = turnos(roteiro)
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01")
      await t.aguardarOcioso(slug)
      const antes = executor.pedidos.length
      const r = await Promise.allSettled([
        t.enviarMensagem(slug, "01", "Continue de onde parou."),
        t.enviarMensagem(slug, "01", "Continue de onde parou."),
      ])
      await t.aguardarOcioso(slug)
      expect(r.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected"])
      expect((r.find((x) => x.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(ErroTurnoAtivo)
      expect(executor.pedidos.length - antes).toBe(1)
      expect(c.maximo).toBe(1)
    })

    it("fila automática e mensagem do analista no mesmo instante: nunca em paralelo", async () => {
      const { c, roteiro } = contador()
      const { t } = turnos(roteiro)
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01")
      await t.aguardarOcioso(slug)
      await servico.enfileirar(slug, "01", "O analista APROVOU X.")
      const envio = await t.enviarMensagem(slug, "01", "oi").catch((e) => e)
      await t.aguardarOcioso(slug)
      expect(envio).toBeInstanceOf(ErroTurnoAtivo)
      expect(c.maximo).toBe(1)
    })

    it("iniciar duas vezes seguidas não abre dois turnos", async () => {
      const { c, roteiro } = contador()
      const { t } = turnos(roteiro)
      const slug = await servico.criarProspect("Iszi", null)
      const r = await Promise.allSettled([t.iniciar(slug, "01"), t.iniciar(slug, "01")])
      await t.aguardarOcioso(slug)
      expect(r.filter((x) => x.status === "rejected")).toHaveLength(1)
      expect(c.maximo).toBe(1)
    })
  })

  it("erro do executor vira turno_fim com detalhe e limite vira aviso", async () => {
    const { t } = turnos(async function* () {
      yield { tipo: "limite", status: "rejected", resetsAt: 1790651400 }
      yield { tipo: "fim", ok: false, erro: "usage limit reached", sessionId: null }
    })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    const conversa = await servico.conversa(slug, "01")
    expect(conversa.find((e) => e.tipo === "aviso" && e.nivel === "erro")).toBeTruthy()
    expect(conversa.at(-1)).toMatchObject({ tipo: "turno_fim", status: "erro", detalhe: "usage limit reached" })
  })
})

describe("uso da assinatura", () => {
  const usoAlto = { tipo: "uso" as const, janelas: [{ janela: "five_hour", utilizacao: 0.82, resetsAt: 1790651400 }] }

  it("guarda o último uso informado pelo Claude e o mantém depois de reiniciar", async () => {
    const { t } = turnos(async function* () {
      yield usoAlto
      yield { tipo: "fim", ok: true, erro: null, sessionId: null }
    })
    expect(await t.uso()).toBeNull()
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(await t.uso()).toMatchObject({ janelas: usoAlto.janelas })
    const { t: depois } = turnos(roteiroSimples("x"))
    expect((await depois.uso())?.janelas).toEqual(usoAlto.janelas)
  })

  it("aviso de 'chegando perto' aparece uma vez por janela, não a cada resposta", async () => {
    const { t } = turnos(async function* () {
      yield { tipo: "limite", status: "allowed_warning", resetsAt: 1790651400 }
      yield { tipo: "fim", ok: true, erro: null, sessionId: null }
    })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await t.enviarMensagem(slug, "01", "de novo")
    await t.aguardarOcioso(slug)
    const avisos = (await servico.conversa(slug, "01")).filter((e) => e.tipo === "aviso" && e.nivel === "alerta")
    expect(avisos).toHaveLength(1)
  })
})

describe("sincronização dos arquivos do prospect", () => {
  const AVISO_ANTES = "Não consegui baixar os arquivos do prospect. Tente de novo."
  const AVISO_DEPOIS = "Os arquivos desta resposta ainda não foram salvos na nuvem. Vou tentar de novo na próxima ação."

  /** Serviço cujo armazenamento registra cada sincronização em `log` e pode falhar na n-ésima chamada. */
  function comSincronizacao(roteiro: Roteiro, falharNa: number | null = null) {
    const log: string[] = []
    let chamadas = 0
    class ArmEspiao extends FsArmazenamento {
      override async sincronizar(_slug: string): Promise<void> {
        chamadas++
        log.push("sincronizar")
        if (falharNa === chamadas) throw new Error("rede fora")
      }
    }
    const svc = new ServicoPlanejamento({
      armazenamento: new ArmEspiao(raiz, async () => {}),
      catalogo: catalogoReal(),
      barramento,
      validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    })
    const executor = new FakeExecutor(async function* (pedido, sinal) {
      log.push("executor")
      yield* roteiro(pedido, sinal)
    })
    const t = new ServicoTurnos({ servico: svc, executor, barramento, catalogo: catalogoReal(), config })
    return { t, svc, executor, log }
  }

  it("sincroniza antes e depois do turno", async () => {
    const { t, svc, log } = comSincronizacao(roteiroSimples("ok", "s1"))
    const slug = await svc.criarProspect("Iszi", null)
    log.length = 0
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(log).toEqual(["sincronizar", "executor", "sincronizar"])
  })

  it("falha antes do turno: não chama o executor e avisa", async () => {
    const { t, svc, executor, log } = comSincronizacao(roteiroSimples("ok", "s1"), 1)
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos).toHaveLength(0)
    expect(log).toEqual(["sincronizar"])
    const conversa = await svc.conversa(slug, "01")
    expect(conversa.find((e) => e.tipo === "aviso" && e.nivel === "erro" && e.texto === AVISO_ANTES)).toBeTruthy()
    expect(conversa.at(-1)).toMatchObject({ tipo: "turno_fim", status: "erro", detalhe: AVISO_ANTES })
    expect(t.ativo(slug)).toBeNull()
  })

  it("falha depois do turno: avisa com alerta e o turno fica ok", async () => {
    const { t, svc } = comSincronizacao(roteiroSimples("ok", "s1"), 2)
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    const conversa = await svc.conversa(slug, "01")
    const iFim = conversa.findIndex((e) => e.tipo === "turno_fim")
    const iAviso = conversa.findIndex((e) => e.tipo === "aviso" && e.texto === AVISO_DEPOIS)
    expect(conversa[iFim]).toMatchObject({ status: "ok" })
    expect(conversa[iAviso]).toMatchObject({ nivel: "alerta" })
    expect(iAviso).toBeGreaterThan(iFim)
  })

  it("turno interrompido também sincroniza no fim", async () => {
    const { t, svc, log } = comSincronizacao(async function* (_p, sinal) {
      yield { tipo: "sessao", sessionId: "s" }
      if (!sinal.aborted) await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
    })
    const slug = await svc.criarProspect("Iszi", null)
    log.length = 0
    await t.iniciar(slug, "01")
    t.parar(slug)
    await t.aguardarOcioso(slug)
    expect((await svc.conversa(slug, "01")).at(-1)).toMatchObject({ tipo: "turno_fim", status: "interrompido" })
    expect(log.at(-1)).toBe("sincronizar")
    expect(log.filter((x) => x === "sincronizar")).toHaveLength(2)
  })
})

describe("memória da sessão do agente", () => {
  class MemoriaFalsa implements MemoriaDeSessao {
    readonly chamadas: string[] = []
    constructor(private readonly restaurada: boolean) {}
    async restaurar(slug: string, sessionId: string): Promise<boolean> {
      this.chamadas.push(`restaurar ${slug} ${sessionId}`)
      return this.restaurada
    }
    async salvar(slug: string, sessionId: string): Promise<void> {
      this.chamadas.push(`salvar ${slug} ${sessionId}`)
    }
  }

  function comMemoria(memoria: MemoriaDeSessao, roteiro: Roteiro) {
    const executor = new FakeExecutor(roteiro)
    const t = new ServicoTurnos({ servico, executor, barramento, catalogo: catalogoReal(), config, memoria })
    return { t, executor }
  }

  /** Primeiro turno abre a sessão s1 e o seguinte (sem sessionId) abre s2. */
  const roteiroDuasSessoes: Roteiro = async function* (pedido) {
    const id = pedido.sessionId ?? (pedido.mensagem.includes("Histórico desta etapa") ? "s2" : "s1")
    yield { tipo: "sessao", sessionId: id }
    yield { tipo: "texto", texto: "resposta" }
    yield { tipo: "fim", ok: true, erro: null, sessionId: id }
  }

  it("com sessionId e memória restaurada, envia resume e salva no fim", async () => {
    const memoria = new MemoriaFalsa(true)
    const { t, executor } = comMemoria(memoria, roteiroDuasSessoes)
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    memoria.chamadas.length = 0
    await t.enviarMensagem(slug, "01", "Continue")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos[1]).toMatchObject({ sessionId: "s1", mensagem: "Continue" })
    expect(memoria.chamadas).toEqual([`restaurar ${slug} s1`, `salvar ${slug} s1`])
    const conversa = await servico.conversa(slug, "01")
    expect(conversa.find((e) => e.tipo === "aviso" && e.texto === "Retomei a etapa a partir do histórico.")).toBeUndefined()
  })

  it("memória não restaurada: sessão nova, prompt de retomada e aviso info", async () => {
    const memoria = new MemoriaFalsa(false)
    const { t, executor } = comMemoria(memoria, roteiroDuasSessoes)
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    memoria.chamadas.length = 0
    await t.enviarMensagem(slug, "01", "Siga em frente")
    await t.aguardarOcioso(slug)
    const pedido = executor.pedidos[1]!
    expect(pedido.sessionId).toBeNull()
    expect(pedido.mensagem.startsWith("Vamos trabalhar na ")).toBe(true)
    expect(pedido.mensagem).toContain("### Histórico desta etapa")
    expect(pedido.mensagem).toContain("**Agente:** resposta")
    expect(pedido.mensagem.endsWith("Siga em frente")).toBe(true)
    const conversa = await servico.conversa(slug, "01")
    expect(conversa).toContainEqual(
      expect.objectContaining({ tipo: "aviso", nivel: "info", texto: "Retomei a etapa a partir do histórico." }),
    )
    expect((await servico.estado(slug)).etapas["01"].sessionId).toBe("s2")
    expect(memoria.chamadas).toEqual([`restaurar ${slug} s1`, `salvar ${slug} s2`])
  })
})
