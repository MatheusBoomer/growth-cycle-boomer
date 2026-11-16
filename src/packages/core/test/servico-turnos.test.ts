import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { ErroEntrada, ErroNaoEhTeste, ErroReiniciando, ErroTurnoAtivo } from "../src/erros"
import { FakeExecutor, roteiroSimples, type Roteiro } from "../src/executor/fake"
import type { PedidoTurno } from "../src/executor/tipos"
import { pastaDoFixture } from "../src/fixture"
import type { MemoriaDeSessao } from "../src/nuvem/memoria-sessao"
import type { RegistroUsoTurno } from "../src/nuvem/tipos"
import type { EscolhaModelo } from "../src/modelos"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import { aspasShell, montarMcpConfig, montarSettingsHook, ServicoTurnos, type ConfigTurnos } from "../src/servico-turnos"
import { catalogoReal, RAIZ, raizTemporaria } from "./ajuda"
import { criarFixtureMinimo } from "./fixture-minimo"

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

  it("sem FIRECRAWL_API_KEY, o MCP é só o planejamento (JSON idêntico ao de antes)", () => {
    const base = montarMcpConfig(config, "tok")
    expect(montarMcpConfig(config, "tok", {})).toBe(base)
    expect(montarMcpConfig(config, "tok", { FIRECRAWL_API_KEY: "" })).toBe(base)
    expect(Object.keys((JSON.parse(base) as { mcpServers: object }).mcpServers)).toEqual(["planejamento"])
  })

  it("com FIRECRAWL_API_KEY, acrescenta o firecrawl e não mexe no planejamento", () => {
    const base = JSON.parse(montarMcpConfig(config, "tok")) as { mcpServers: Record<string, unknown> }
    const com = JSON.parse(montarMcpConfig(config, "tok", { FIRECRAWL_API_KEY: "fc-123" })) as {
      mcpServers: Record<string, unknown>
    }
    expect(com.mcpServers.planejamento).toEqual(base.mcpServers.planejamento)
    expect(com.mcpServers.firecrawl).toEqual({ command: "firecrawl-mcp", args: [], env: { FIRECRAWL_API_KEY: "fc-123" } })
  })

  it("o turno só leva o firecrawl no MCP quando firecrawlNoMcp está ligado", async () => {
    const chaveOriginal = process.env.FIRECRAWL_API_KEY
    process.env.FIRECRAWL_API_KEY = "fc-turno"
    try {
      const servidoresDoTurno = async (cfg: ConfigTurnos, nome: string) => {
        const executor = new FakeExecutor(roteiroSimples("ok"))
        const t = new ServicoTurnos({ servico, executor, barramento, catalogo: catalogoReal(), config: cfg })
        const slug = await servico.criarProspect(nome, null)
        await t.iniciar(slug, "01")
        await t.aguardarOcioso(slug)
        return Object.keys((JSON.parse(executor.pedidos[0]!.mcpConfig) as { mcpServers: object }).mcpServers)
      }
      expect(await servidoresDoTurno(config, "Sem Firecrawl")).toEqual(["planejamento"])
      expect(await servidoresDoTurno({ ...config, firecrawlNoMcp: true }, "Com Firecrawl")).toEqual(["planejamento", "firecrawl"])
    } finally {
      if (chaveOriginal === undefined) delete process.env.FIRECRAWL_API_KEY
      else process.env.FIRECRAWL_API_KEY = chaveOriginal
    }
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

describe("custo de cada turno", () => {
  class ArmazenamentoComUso extends FsArmazenamento {
    readonly usos: RegistroUsoTurno[] = []
    override async registrarUso(r: RegistroUsoTurno): Promise<void> {
      this.usos.push(r)
    }
  }

  function comArmazenamento(arm: FsArmazenamento, roteiro: Roteiro, agora?: () => string) {
    const svc = new ServicoPlanejamento({
      armazenamento: arm,
      catalogo: catalogoReal(),
      barramento,
      validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    })
    const t = new ServicoTurnos({ servico: svc, executor: new FakeExecutor(roteiro), barramento, catalogo: catalogoReal(), config, agora })
    return { svc, t }
  }

  const roteiroComUso: Roteiro = async function* () {
    yield { tipo: "sessao", sessionId: "s1" }
    yield { tipo: "fim", ok: true, erro: null, sessionId: "s1", uso: { custoUsd: 0.42, tokensEntrada: 1000, tokensSaida: 200, modelos: null } }
  }

  it("registra o uso do turno com início, fim, status e autor nulo", async () => {
    const arm = new ArmazenamentoComUso(raiz, async () => {})
    let n = 0
    const { svc, t } = comArmazenamento(arm, roteiroComUso, () => `2026-10-27T10:00:${String(n++).padStart(2, "0")}.000Z`)
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(arm.usos).toHaveLength(1)
    const uso = arm.usos[0]!
    expect(uso).toMatchObject({
      slug,
      etapa: "01",
      autor: null,
      custoUsd: 0.42,
      tokensEntrada: 1000,
      tokensSaida: 200,
      status: "ok",
    })
    expect(uso.inicio < uso.fim).toBe(true)
  })

  it("marca como retomada só o turno que continua uma sessão que já existia", async () => {
    const arm = new ArmazenamentoComUso(raiz, async () => {})
    const { svc, t } = comArmazenamento(arm, roteiroComUso)
    const espiao = vi.spyOn(svc, "registrarUso")
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await t.enviarMensagem(slug, "01", "Continue")
    await t.aguardarOcioso(slug)
    expect(espiao.mock.calls.map(([e]) => [e.sessao, e.retomada])).toEqual([
      ["s1", false],
      ["s1", true],
    ])
  })

  it("sessão nova no lugar da que existia não é retomada", async () => {
    const arm = new ArmazenamentoComUso(raiz, async () => {})
    let n = 0
    const roteiro: Roteiro = async function* () {
      const id = `s${++n}`
      yield { tipo: "sessao", sessionId: id }
      yield { tipo: "fim", ok: true, erro: null, sessionId: id, uso: { custoUsd: 0.1, tokensEntrada: 1, tokensSaida: 1, modelos: null } }
    }
    const { svc, t } = comArmazenamento(arm, roteiro)
    const espiao = vi.spyOn(svc, "registrarUso")
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    await t.enviarMensagem(slug, "01", "Continue")
    await t.aguardarOcioso(slug)
    expect(espiao.mock.calls.map(([e]) => [e.sessao, e.retomada])).toEqual([
      ["s1", false],
      ["s2", false],
    ])
  })

  it("falha ao registrar o uso não afeta o turno", async () => {
    class Quebrado extends FsArmazenamento {
      override async registrarUso(): Promise<void> {
        throw new Error("banco fora do ar")
      }
    }
    const { svc, t } = comArmazenamento(new Quebrado(raiz, async () => {}), roteiroComUso)
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect((await svc.conversa(slug, "01")).at(-1)).toMatchObject({ tipo: "turno_fim", status: "ok" })
  })
})

describe("autoria dos turnos", () => {
  const ANA = "ana.souza@boomer.com.br"

  class ArmazenamentoComUso extends FsArmazenamento {
    readonly usos: RegistroUsoTurno[] = []
    override async registrarUso(r: RegistroUsoTurno): Promise<void> {
      this.usos.push(r)
    }
  }

  const roteiroComUso: Roteiro = async function* () {
    yield { tipo: "sessao", sessionId: "s1" }
    yield { tipo: "fim", ok: true, erro: null, sessionId: "s1", uso: { custoUsd: 0.1, tokensEntrada: 10, tokensSaida: 2, modelos: null } }
  }

  function montar(roteiro: Roteiro = roteiroComUso) {
    const arm = new ArmazenamentoComUso(raiz, async () => {})
    const svc = new ServicoPlanejamento({
      armazenamento: arm,
      catalogo: catalogoReal(),
      barramento,
      validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    })
    const t = new ServicoTurnos({ servico: svc, executor: new FakeExecutor(roteiro), barramento, catalogo: catalogoReal(), config })
    return { arm, svc, t }
  }

  it("grava a sessão e o acumulado por modelo do turno, com o custo do turno igual ao acumulado na primeira vez", async () => {
    const modelos = { "claude-opus-5": 0.3, "claude-haiku-5": 0.1 }
    const { arm, svc, t } = montar(async function* () {
      yield { tipo: "sessao", sessionId: "s7" }
      yield { tipo: "fim", ok: true, erro: null, sessionId: "s7", uso: { custoUsd: 0.4, tokensEntrada: 10, tokensSaida: 2, modelos } }
    })
    const slug = await svc.criarProspect("Com Modelos", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(arm.usos).toHaveLength(1)
    expect(arm.usos[0]).toMatchObject({ slug, sessao: "s7", custoUsd: 0.4, modelosAcumulado: modelos, esforco: null })
  })

  it("sem modelUsage no resultado, o acumulado por modelo fica nulo", async () => {
    const { arm, svc, t } = montar()
    const slug = await svc.criarProspect("Sem Modelos", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(arm.usos[0]).toMatchObject({ sessao: "s1", modelosAcumulado: null, modelos: null })
  })

  it("iniciar grava o autor em uso_turnos; sem autor, null", async () => {
    const { arm, svc, t } = montar()
    const a = await svc.criarProspect("Com Autor", null)
    const b = await svc.criarProspect("Sem Autor", null)
    await t.iniciar(a, "01", ANA)
    await t.aguardarOcioso(a)
    await t.iniciar(b, "01")
    await t.aguardarOcioso(b)
    expect(arm.usos.map((u) => [u.slug, u.autor])).toEqual([
      [a, ANA],
      [b, null],
    ])
  })

  it("enviarMensagem grava o autor no evento da conversa e em uso_turnos; sem autor, o campo não aparece", async () => {
    const { arm, svc, t } = montar()
    const a = await svc.criarProspect("Com Autor", null)
    const b = await svc.criarProspect("Sem Autor", null)
    await t.iniciar(a, "01")
    await t.aguardarOcioso(a)
    await t.iniciar(b, "01")
    await t.aguardarOcioso(b)
    arm.usos.length = 0
    await t.enviarMensagem(a, "01", "oi", ANA)
    await t.aguardarOcioso(a)
    await t.enviarMensagem(b, "01", "oi")
    await t.aguardarOcioso(b)
    const msg = async (slug: string) => (await svc.conversa(slug, "01")).find((e) => e.tipo === "mensagem_analista")!
    expect(await msg(a)).toMatchObject({ texto: "oi", automatica: false, autor: ANA })
    expect(await msg(b)).not.toHaveProperty("autor")
    expect(arm.usos.map((u) => [u.slug, u.autor])).toEqual([
      [a, ANA],
      [b, null],
    ])
  })

  it("enviarMensagemComAjustes grava o autor no balão, em decididoPor e em uso_turnos", async () => {
    const { arm, svc, t } = montar()
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    arm.usos.length = 0
    await svc.ferramenta({ slug, etapa: "01" }, "solicitar_insumo", { insumo_id: "kickoff-transcricao" })
    await mkdir(path.join(raiz, "clientes", slug, ".app/rascunhos"), { recursive: true })
    await writeFile(path.join(raiz, "clientes", slug, ".app/rascunhos/s.md"), "# S")
    await svc.ferramenta({ slug, etapa: "01" }, "propor_entregavel", {
      tipo: "secao",
      titulo: "Resumo",
      arquivo_rascunho: `clientes/${slug}/.app/rascunhos/s.md`,
      nome_final: "resumo",
    })
    const id = (await svc.estado(slug)).entregaveis[0]!.id
    await t.enviarMensagemComAjustes(slug, "01", "tirar o último parágrafo", [{ entregavelId: id, marcas: [] }], ANA)
    await t.aguardarOcioso(slug)
    const balao = (await svc.conversa(slug, "01")).find((e) => e.tipo === "mensagem_analista")!
    expect(balao).toMatchObject({ texto: "tirar o último parágrafo", autor: ANA })
    expect((await svc.estado(slug)).entregaveis[0]!.decididoPor).toBe(ANA)
    expect(arm.usos.map((u) => u.autor)).toEqual([ANA])
  })

  it("a vaga ativa guarda o autor do turno do analista e volta a null no fim", async () => {
    const { arm, svc, t } = montar()
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    arm.usos.length = 0
    await t.enviarMensagem(slug, "01", "oi", ANA)
    expect(t.ativoPor(slug)).toBe(ANA)
    await t.aguardarOcioso(slug)
    expect(t.ativoPor(slug)).toBeNull()
    expect(arm.usos.map((u) => u.autor)).toEqual([ANA])
  })

  it("o turno disparado pela fila grava o autor do item em uso_turnos e no evento automático", async () => {
    const { arm, svc, t } = montar()
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    arm.usos.length = 0
    await svc.enfileirar(slug, "01", "continue", ANA)
    await t.aguardarOcioso(slug)
    expect(arm.usos.map((u) => u.autor)).toEqual([ANA])
    const automatica = (await svc.conversa(slug, "01")).filter((e) => e.tipo === "mensagem_analista" && e.automatica)
    expect(automatica).toHaveLength(1)
    expect(automatica[0]).toMatchObject({ texto: "continue", automatica: true, autor: ANA })
  })

  it("item da fila sem autor: uso_turnos com null e o evento automático sem a chave autor", async () => {
    const { arm, svc, t } = montar()
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    arm.usos.length = 0
    await svc.enfileirar(slug, "01", "continue")
    await t.aguardarOcioso(slug)
    expect(arm.usos.map((u) => u.autor)).toEqual([null])
    const automatica = (await svc.conversa(slug, "01")).find((e) => e.tipo === "mensagem_analista" && e.automatica)
    expect(automatica).toBeDefined()
    expect(automatica).not.toHaveProperty("autor")
  })

  describe("aviso de quem está com o agente rodando", () => {
    const BIA = "bia.lima@boomer.com.br"
    const segurar = (): Roteiro =>
      async function* (_p, sinal) {
        yield { tipo: "sessao", sessionId: "s" }
        if (!sinal.aborted) await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
      }

    it("enviarMensagem de outro analista é recusada com o nome de quem está rodando", async () => {
      const { t } = turnos(segurar())
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01", "ana.silva@boomer.com.br")
      const erro = await t.enviarMensagem(slug, "01", "oi", BIA).catch((e) => e)
      expect(erro).toBeInstanceOf(ErroTurnoAtivo)
      expect(erro.message).toBe("Ana Silva está com o agente rodando nesta etapa.")
      expect(erro.status).toBe(409)
      expect(erro.codigo).toBe("turno_ativo")
      t.parar(slug)
      await t.aguardarOcioso(slug)
    })

    it("iniciar e enviarMensagemComAjustes recusados também citam o autor do turno em andamento", async () => {
      const { t } = turnos(segurar())
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01", "ana.silva@boomer.com.br")
      const a = await t.iniciar(slug, "01", BIA).catch((e) => e)
      const b = await t.enviarMensagemComAjustes(slug, "01", "x", [], BIA).catch((e) => e)
      expect(a.message).toBe("Ana Silva está com o agente rodando nesta etapa.")
      expect(b.message).toBe("Ana Silva está com o agente rodando nesta etapa.")
      t.parar(slug)
      await t.aguardarOcioso(slug)
    })

    it("o próprio autor do turno (duplo clique, segunda aba) recebe a mensagem genérica, não o próprio nome", async () => {
      const { t } = turnos(segurar())
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01", "ana.silva@boomer.com.br")
      const mesmo = await t.enviarMensagem(slug, "01", "oi", "ana.silva@boomer.com.br").catch((e) => e)
      const outro = await t.enviarMensagem(slug, "01", "oi", BIA).catch((e) => e)
      expect(mesmo).toBeInstanceOf(ErroTurnoAtivo)
      expect(mesmo.message).toBe("O agente ainda está respondendo neste prospect. Aguarde ou clique em Parar.")
      expect(outro.message).toBe("Ana Silva está com o agente rodando nesta etapa.")
      t.parar(slug)
      await t.aguardarOcioso(slug)
    })

    it("sem autor no turno ativo a mensagem de sempre não muda", async () => {
      const { t } = turnos(segurar())
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01")
      expect(t.ativoPor(slug)).toBeNull()
      const erro = await t.enviarMensagem(slug, "01", "oi", BIA).catch((e) => e)
      expect(erro.message).toBe("O agente ainda está respondendo neste prospect. Aguarde ou clique em Parar.")
      t.parar(slug)
      await t.aguardarOcioso(slug)
    })

    it("ativoPor devolve o e-mail durante o turno e null antes e depois", async () => {
      const { t } = turnos(segurar())
      const slug = await servico.criarProspect("Iszi", null)
      expect(t.ativoPor(slug)).toBeNull()
      await t.iniciar(slug, "01", "ana.silva@boomer.com.br")
      expect(t.ativoPor(slug)).toBe("ana.silva@boomer.com.br")
      t.parar(slug)
      await t.aguardarOcioso(slug)
      expect(t.ativoPor(slug)).toBeNull()
    })

    it("o turno da fila leva o autor do item: ativoPor o devolve e a recusa cita o nome", async () => {
      let rodadas = 0
      const { t } = turnos(async function* (_p, sinal) {
        rodadas++
        yield { tipo: "sessao", sessionId: "s" }
        if (rodadas === 2 && !sinal.aborted) await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
        yield { tipo: "fim", ok: true, erro: null, sessionId: "s" }
      })
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01", "ana.silva@boomer.com.br")
      await t.aguardarOcioso(slug)
      await servico.enfileirar(slug, "01", "continue", "ana.silva@boomer.com.br")
      // o disparo da fila é assíncrono: espera o turno começar
      while (t.ativo(slug) !== "01" || rodadas < 2) await new Promise((r) => setTimeout(r, 5))
      expect(t.ativoPor(slug)).toBe("ana.silva@boomer.com.br")
      const erro = await t.enviarMensagem(slug, "01", "oi", BIA).catch((e) => e)
      expect(erro.message).toBe("Ana Silva está com o agente rodando nesta etapa.")
      t.parar(slug)
      await t.aguardarOcioso(slug)
    })

    it("o turno da fila sem autor no item: ativoPor é null e a recusa usa a mensagem de sempre", async () => {
      let rodadas = 0
      const { t } = turnos(async function* (_p, sinal) {
        rodadas++
        yield { tipo: "sessao", sessionId: "s" }
        if (rodadas === 2 && !sinal.aborted) await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
        yield { tipo: "fim", ok: true, erro: null, sessionId: "s" }
      })
      const slug = await servico.criarProspect("Iszi", null)
      await t.iniciar(slug, "01", "ana.silva@boomer.com.br")
      await t.aguardarOcioso(slug)
      await servico.enfileirar(slug, "01", "continue")
      while (t.ativo(slug) !== "01" || rodadas < 2) await new Promise((r) => setTimeout(r, 5))
      expect(t.ativoPor(slug)).toBeNull()
      const erro = await t.enviarMensagem(slug, "01", "oi", BIA).catch((e) => e)
      expect(erro.message).toBe("O agente ainda está respondendo neste prospect. Aguarde ou clique em Parar.")
      t.parar(slug)
      await t.aguardarOcioso(slug)
    })
  })
})

describe("desligamento: drenar os turnos", () => {
  const REINICIANDO = "O servidor está reiniciando. Tente de novo em instantes."

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Portão que o teste abre quando quer que o agente termine a resposta. */
  function portao() {
    let abrir: () => void = () => {}
    const aberto = new Promise<void>((r) => (abrir = r))
    return { aberto, abrir: () => abrir() }
  }

  /** Turnos sobre um armazenamento que registra cada sincronização em `log`. */
  function comLog(roteiro: Roteiro) {
    const log: string[] = []
    class ArmEspiao extends FsArmazenamento {
      override async sincronizar(_slug: string): Promise<void> {
        log.push("sincronizar")
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
      log.push("executor fim")
    })
    const t = new ServicoTurnos({ servico: svc, executor, barramento, catalogo: catalogoReal(), config })
    return { t, svc, executor, log }
  }

  /** Responde só depois de o portão abrir. */
  const roteiroComPortao = (p: { aberto: Promise<void> }): Roteiro =>
    async function* () {
      yield { tipo: "sessao", sessionId: "s" }
      await p.aberto
      yield { tipo: "texto", texto: "pronto" }
      yield { tipo: "fim", ok: true, erro: null, sessionId: "s" }
    }

  /** Só termina quando o turno é abortado (mesmo contrato do executor real). */
  const roteiroAteAbortar: Roteiro = async function* (_p, sinal) {
    yield { tipo: "sessao", sessionId: "s" }
    if (!sinal.aborted) await new Promise<void>((r) => sinal.addEventListener("abort", () => r(), { once: true }))
  }

  it("drenar sem turno ativo resolve na hora e não deixa temporizador", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { t } = turnos(roteiroSimples("ok", "s"))
    await expect(t.drenar(300000)).resolves.toEqual({ abortados: [] })
    expect(vi.getTimerCount()).toBe(0)
  })

  it("depois de drenar, iniciar, enviarMensagem e enviarMensagemComAjustes lançam ErroReiniciando (503)", async () => {
    const { t, executor } = turnos(roteiroSimples("ok", "s"))
    const slug = await servico.criarProspect("Iszi", null)
    await t.drenar(1000)
    for (const tentativa of [
      t.iniciar(slug, "01"),
      t.enviarMensagem(slug, "01", "oi"),
      t.enviarMensagemComAjustes(slug, "01", "ajustar", []),
    ]) {
      const erro = await tentativa.catch((e: unknown) => e)
      expect(erro).toBeInstanceOf(ErroReiniciando)
      expect(erro).toMatchObject({ message: REINICIANDO, codigo: "reiniciando", status: 503 })
    }
    expect(executor.pedidos).toHaveLength(0)
    expect(t.ativo(slug)).toBeNull()
    expect((await servico.estado(slug)).etapas["01"].status).not.toBe("em_andamento")
  })

  it("SIGTERM no meio do turno: o turno termina, sincroniza no fim e drenar resolve sem abortar", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const p = portao()
    const { t, svc, log } = comLog(roteiroComPortao(p))
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await vi.waitFor(() => expect(log).toContain("executor"))
    let resultado: { abortados: string[] } | null = null
    const drenagem = t.drenar(5000).then((r) => (resultado = r))
    // um turno novo é recusado com o aviso de reinício, mesmo com a vaga ocupada
    await expect(t.enviarMensagem(slug, "01", "oi")).rejects.toBeInstanceOf(ErroReiniciando)
    await vi.advanceTimersByTimeAsync(4000)
    expect(resultado).toBeNull()
    p.abrir()
    await drenagem
    expect(resultado).toEqual({ abortados: [] })
    expect(log).toEqual(["sincronizar", "executor", "executor fim", "sincronizar"])
    const conversa = await svc.conversa(slug, "01")
    expect(conversa.at(-1)).toMatchObject({ tipo: "turno_fim", status: "ok" })
    expect(conversa.some((e) => e.tipo === "texto_agente" && e.texto === "pronto")).toBe(true)
    expect(t.ativo(slug)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("passou do prazo: drenar aborta o turno, espera o turno_fim interrompido e a sincronização, e devolve o slug", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { t, svc, log } = comLog(roteiroAteAbortar)
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await vi.waitFor(() => expect(log).toContain("executor"))
    let resultado: { abortados: string[] } | null = null
    const drenagem = t.drenar(1000).then((r) => (resultado = r))
    await vi.advanceTimersByTimeAsync(999)
    expect(resultado).toBeNull()
    expect(t.ativo(slug)).toBe("01")
    await vi.advanceTimersByTimeAsync(1)
    await drenagem
    expect(resultado).toEqual({ abortados: [slug] })
    expect((await svc.conversa(slug, "01")).at(-1)).toMatchObject({ tipo: "turno_fim", status: "interrompido" })
    expect(log.at(-1)).toBe("sincronizar")
    expect(t.ativo(slug)).toBeNull()
  })

  it("o turno da fila que ia nascer depois do turno atual não nasce: o item continua na fila", async () => {
    const p = portao()
    const { t, svc, executor, log } = comLog(roteiroComPortao(p))
    const slug = await svc.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await vi.waitFor(() => expect(log).toContain("executor"))
    await svc.enfileirar(slug, "01", "O analista APROVOU o entregável X.")
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const drenagem = t.drenar(5000)
    p.abrir()
    await expect(drenagem).resolves.toEqual({ abortados: [] })
    await t.aguardarOcioso(slug)
    // a fila nem tenta reservar a vaga: nada de "turno falhou" no log
    expect(erro).not.toHaveBeenCalled()
    erro.mockRestore()
    expect(executor.pedidos).toHaveLength(1)
    expect((await svc.estado(slug)).filaAutomatica).toEqual([{ etapa: "01", texto: "O analista APROVOU o entregável X." }])
    expect(t.ativo(slug)).toBeNull()
  })

  it("item enfileirado depois de drenar não dispara turno", async () => {
    const { t, svc, executor } = comLog(roteiroSimples("ok", "s"))
    const slug = await svc.criarProspect("Iszi", null)
    await t.drenar(1000)
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    await svc.enfileirar(slug, "01", "O analista APROVOU X.", "ana.silva@boomer.com.br")
    await t.aguardarOcioso(slug)
    expect(erro).not.toHaveBeenCalled()
    erro.mockRestore()
    expect(executor.pedidos).toHaveLength(0)
    expect(t.ativo(slug)).toBeNull()
    expect((await svc.estado(slug)).filaAutomatica).toHaveLength(1)
  })

  it("turno aceito antes do drenar, ainda se preparando, também é esperado até o fim", async () => {
    const p = portao()
    const { t, svc, log } = comLog(roteiroSimples("ok", "s"))
    const slug = await svc.criarProspect("Iszi", null)
    const original = svc.iniciarEtapa.bind(svc)
    svc.iniciarEtapa = async (s, e) => {
      await p.aberto
      return original(s, e)
    }
    const inicio = t.iniciar(slug, "01")
    let resultado: { abortados: string[] } | null = null
    const drenagem = t.drenar(5000).then((r) => (resultado = r))
    await new Promise((r) => setTimeout(r, 10))
    expect(resultado).toBeNull()
    p.abrir()
    await inicio
    await drenagem
    expect(resultado).toEqual({ abortados: [] })
    expect(log).toContain("executor fim")
    expect((await svc.conversa(slug, "01")).at(-1)).toMatchObject({ tipo: "turno_fim", status: "ok" })
  })
})

describe("modelo e esforço configurados para a etapa", () => {
  const SEM: EscolhaModelo = { modelo: null, esforco: null }

  class ArmazenamentoComUso extends FsArmazenamento {
    readonly usos: RegistroUsoTurno[] = []
    override async registrarUso(r: RegistroUsoTurno): Promise<void> {
      this.usos.push(r)
    }
  }

  function montar(
    config: { principal?: EscolhaModelo; subagentes?: Record<string, EscolhaModelo> },
    roteiro: Roteiro = roteiroSimples("ok"),
    cfg: ConfigTurnos = { ...globalConfig() },
  ) {
    const arm = new ArmazenamentoComUso(raiz, async () => {})
    const svc = new ServicoPlanejamento({
      armazenamento: arm,
      catalogo: catalogoReal(),
      barramento,
      validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    })
    vi.spyOn(svc, "configDaEtapa").mockResolvedValue({ principal: config.principal ?? SEM, subagentes: config.subagentes ?? {} })
    const executor = new FakeExecutor(roteiro)
    const t = new ServicoTurnos({ servico: svc, executor, barramento, catalogo: catalogoReal(), config: cfg })
    return { arm, svc, t, executor }
  }
  const globalConfig = () => config

  async function rodar(m: ReturnType<typeof montar>, etapa: "01", nome: string) {
    const slug = await m.svc.criarProspect(nome, null)
    await m.t.iniciar(slug, etapa)
    await m.t.aguardarOcioso(slug)
    return slug
  }

  it("sem configuração, o pedido não tem modelo, esforço nem agentes", async () => {
    const m = montar({})
    await rodar(m, "01", "Sem Config")
    const pedido = m.executor.pedidos[0]!
    expect("modelo" in pedido).toBe(false)
    expect("esforco" in pedido).toBe(false)
    expect("agentes" in pedido).toBe(false)
  })

  it("modelo vazio na configuração vale como padrão", async () => {
    const m = montar({ principal: { modelo: "", esforco: null } })
    await rodar(m, "01", "Modelo Vazio")
    expect("modelo" in m.executor.pedidos[0]!).toBe(false)
  })

  it("o principal leva modelo e esforço ao pedido, e o uso grava o esforço", async () => {
    const m = montar({ principal: { modelo: "haiku", esforco: "low" } }, async function* () {
      yield { tipo: "sessao", sessionId: "s1" }
      yield { tipo: "fim", ok: true, erro: null, sessionId: "s1", uso: { custoUsd: 0.1, tokensEntrada: 1, tokensSaida: 1, modelos: null } }
    })
    await rodar(m, "01", "Com Config")
    expect(m.executor.pedidos[0]).toMatchObject({ modelo: "haiku", esforco: "low" })
    expect("agentes" in m.executor.pedidos[0]!).toBe(false)
    expect(m.arm.usos[0]).toMatchObject({ esforco: "low" })
  })

  it("subagente configurado vai em agentes com o model, as tools do .md e sem effort", async () => {
    await cp(path.join(RAIZ, ".claude/agents"), path.join(raiz, ".claude/agents"), { recursive: true })
    const m = montar({ subagentes: { "analista-dados": { modelo: "haiku", esforco: null } } })
    await rodar(m, "01", "Com Subagente")
    const agente = m.executor.pedidos[0]!.agentes?.["analista-dados"]
    expect(agente).toBeDefined()
    expect(agente!.model).toBe("haiku")
    expect(agente!.tools.length).toBeGreaterThan(0)
    expect(agente!.prompt).not.toBe("")
    expect("effort" in agente!).toBe(false)
  })

  it("subagente sem modelo nem esforço configurados fica de fora", async () => {
    await cp(path.join(RAIZ, ".claude/agents"), path.join(raiz, ".claude/agents"), { recursive: true })
    const m = montar({ subagentes: { "analista-dados": SEM } })
    await rodar(m, "01", "Subagente Padrao")
    expect("agentes" in m.executor.pedidos[0]!).toBe(false)
  })

  it("com o .md ilegível, o turno roda sem agentes e termina ok", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const m = montar({ subagentes: { "analista-dados": { modelo: "haiku", esforco: "low" } } })
      const slug = await rodar(m, "01", "Md Ilegivel")
      expect("agentes" in m.executor.pedidos[0]!).toBe(false)
      const conversa = await m.svc.conversa(slug, "01")
      expect(conversa.at(-1)).toMatchObject({ tipo: "turno_fim", status: "ok" })
      expect(erro).toHaveBeenCalledTimes(1)
    } finally {
      erro.mockRestore()
    }
  })

  it("um erro ao ler a configuração não derruba o turno", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const m = montar({})
      vi.mocked(m.svc.configDaEtapa).mockRejectedValue(new Error("falha inesperada"))
      const slug = await rodar(m, "01", "Config Quebrada")
      expect(m.executor.pedidos[0]).toBeDefined()
      expect((await m.svc.conversa(slug, "01")).at(-1)).toMatchObject({ tipo: "turno_fim", status: "ok" })
    } finally {
      erro.mockRestore()
    }
  })

  it("modelo recusado: a mensagem do turno diz onde ajustar, antes do erro original", async () => {
    const m = montar({ principal: { modelo: "claude-x", esforco: null } }, async function* () {
      yield { tipo: "sessao", sessionId: "s1" }
      yield { tipo: "fim", ok: false, erro: "model not found: claude-x", sessionId: "s1" }
    })
    const slug = await rodar(m, "01", "Modelo Recusado")
    const fim = (await m.svc.conversa(slug, "01")).at(-1)
    expect(fim).toMatchObject({ tipo: "turno_fim", status: "erro" })
    const detalhe = (fim as { detalhe: string }).detalhe
    expect(detalhe).toContain("O modelo claude-x foi recusado. Ajuste em Administração → Modelos.")
    expect(detalhe.endsWith("model not found: claude-x")).toBe(true)
  })

  it("erro sem relação com modelo, ou sem modelo configurado, não ganha a mensagem", async () => {
    const roteiro = (erro: string): Roteiro =>
      async function* () {
        yield { tipo: "fim", ok: false, erro, sessionId: null }
      }
    const a = montar({ principal: { modelo: "claude-x", esforco: null } }, roteiro("rede caiu"))
    const slugA = await rodar(a, "01", "Erro Rede")
    expect((await a.svc.conversa(slugA, "01")).at(-1)).toMatchObject({ detalhe: "rede caiu" })
    const b = montar({}, roteiro("model not found"))
    const slugB = await rodar(b, "01", "Erro Sem Modelo")
    expect((await b.svc.conversa(slugB, "01")).at(-1)).toMatchObject({ detalhe: "model not found" })
  })
})

describe("modo ensaiado: o executor é escolhido por prospect", () => {
  const FORA_DO_ROTEIRO = "Fora do roteiro: use Avançar ensaio ou reinicie a etapa."

  beforeEach(async () => {
    await criarFixtureMinimo(pastaDoFixture(raiz, "mini"))
  })

  function comEnsaio() {
    const executor = new FakeExecutor(roteiroSimples("principal"))
    const executorEnsaio = new FakeExecutor(roteiroSimples("ensaio"))
    const t = new ServicoTurnos({ servico, executor, executorEnsaio, barramento, catalogo: catalogoReal(), config })
    return { t, executor, executorEnsaio }
  }

  async function lerRoteiro03() {
    return JSON.parse(await readFile(path.join(pastaDoFixture(raiz, "mini"), "ensaio/03/roteiro.json"), "utf8")) as {
      trechos: unknown[]
    }
  }

  it("prospect sem ensaio usa o executor principal, com contexto sem trecho e sem consumir o índice", async () => {
    const { t, executor, executorEnsaio } = comEnsaio()
    const slug = await servico.criarClienteTeste("mini", "03", null, false)
    await servico.iniciarEtapa(slug, "03")
    await t.enviarMensagem(slug, "03", "oi")
    await t.aguardarOcioso(slug)
    expect(executorEnsaio.pedidos).toHaveLength(0)
    expect(executor.pedidos).toHaveLength(1)
    expect(executor.pedidos[0]!.contexto).toEqual({ slug, etapa: "03", fixture: "mini", trecho: null, textoAnalista: "oi", mensagemTurno: "oi", automatica: false })
    expect((await servico.estado(slug)).teste?.trechos?.["03"]).toBeUndefined()
  })

  it("prospect comum recebe contexto com fixture null", async () => {
    const { t, executor } = comEnsaio()
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos[0]!.contexto).toEqual({ slug, etapa: "01", fixture: null, trecho: null, textoAnalista: null, mensagemTurno: null, automatica: true })
  })

  it("prospect com ensaio toca o trecho 0 e, no turno seguinte, o trecho 1", async () => {
    const { t, executor, executorEnsaio } = comEnsaio()
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    const { trechos } = await lerRoteiro03()
    await t.enviarMensagem(slug, "03", "Segue a planilha.")
    await t.aguardarOcioso(slug)
    await t.enviarMensagem(slug, "03", "O analista APROVOU o entregável “X” (x). Siga.")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos).toHaveLength(0)
    expect(executorEnsaio.pedidos).toHaveLength(2)
    expect(executorEnsaio.pedidos[0]!.contexto).toEqual({
      slug,
      etapa: "03",
      fixture: "mini",
      trecho: trechos[0],
      textoAnalista: "Segue a planilha.",
      mensagemTurno: "Segue a planilha.",
      automatica: false,
    })
    expect(executorEnsaio.pedidos[1]!.contexto?.trecho).toEqual(trechos[1])
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.some((e) => e.tipo === "aviso" && e.texto === FORA_DO_ROTEIRO)).toBe(false)
  })

  it("depois do último trecho, o executor de ensaio recebe trecho null e sem aviso de fora do roteiro", async () => {
    const { t, executorEnsaio } = comEnsaio()
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    for (const texto of ["Segue a planilha.", "O analista APROVOU o entregável “X” (x).", "mais uma"]) {
      await t.enviarMensagem(slug, "03", texto)
      await t.aguardarOcioso(slug)
    }
    expect(executorEnsaio.pedidos[2]!.contexto?.trecho).toBeNull()
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.some((e) => e.tipo === "aviso" && e.texto === FORA_DO_ROTEIRO)).toBe(false)
  })

  it("aprovação onde o trecho espera ajuste registra o aviso de fora do roteiro e toca o trecho mesmo assim", async () => {
    const { t, executorEnsaio } = comEnsaio()
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    const arquivo = path.join(pastaDoFixture(raiz, "mini"), "ensaio/03/roteiro.json")
    const ajuste = { gatilho: "ajuste", textoPreenchido: "mais curto", passos: [] }
    await writeFile(arquivo, JSON.stringify({ versao: 1, etapa: "03", trechos: [ajuste] }))
    await t.enviarMensagem(slug, "03", "O analista APROVOU o entregável “X” (x). Siga para o próximo passo da skill.")
    await t.aguardarOcioso(slug)
    expect(executorEnsaio.pedidos[0]!.contexto?.trecho).toEqual(ajuste)
    const conversa = await servico.conversa(slug, "03")
    const aviso = conversa.findIndex((e) => e.tipo === "aviso" && e.nivel === "alerta" && e.texto === FORA_DO_ROTEIRO)
    expect(aviso).toBeGreaterThan(-1)
    expect(conversa.findIndex((e) => e.tipo === "texto_agente")).toBeGreaterThan(aviso)
  })

  it("etapa sem pacote de ensaio termina com aviso de erro e turno_fim erro, e aceita um turno novo depois", async () => {
    const { t, executor, executorEnsaio } = comEnsaio()
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    await rm(path.join(pastaDoFixture(raiz, "mini"), "ensaio"), { recursive: true })
    await t.enviarMensagem(slug, "03", "oi")
    await t.aguardarOcioso(slug)
    expect(executor.pedidos).toHaveLength(0)
    expect(executorEnsaio.pedidos).toHaveLength(0)
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.at(-2)).toMatchObject({ tipo: "aviso", nivel: "erro", texto: expect.stringContaining("Falta o roteiro de ensaio") })
    expect(conversa.at(-1)).toMatchObject({ tipo: "turno_fim", status: "erro" })
    expect((await servico.estado(slug)).teste?.trechos?.["03"]).toBeUndefined()
    await expect(t.enviarMensagem(slug, "03", "de novo")).resolves.toBeUndefined()
    await t.aguardarOcioso(slug)
  })
})

describe("modo ensaiado: sessão, leitura da conversa e aviso", () => {
  const RETOMADA = "Retomei a etapa a partir do histórico."

  beforeEach(async () => {
    await criarFixtureMinimo(pastaDoFixture(raiz, "mini"))
  })

  it("turno de ensaio não restaura sessão nem avisa retomada, mesmo com memória que não restaura", async () => {
    const chamadas: string[] = []
    const memoria: MemoriaDeSessao = {
      restaurar: async (s, id) => {
        chamadas.push(`restaurar ${s} ${id}`)
        return false
      },
      salvar: async (s, id) => void chamadas.push(`salvar ${s} ${id}`),
    }
    const executorEnsaio = new FakeExecutor(async function* (p) {
      const id = `ensaio-${p.contexto!.slug}-${p.contexto!.etapa}`
      yield { tipo: "sessao", sessionId: id }
      yield { tipo: "texto", texto: "tocado" }
      yield { tipo: "fim", ok: true, erro: null, sessionId: id }
    })
    const t = new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio, barramento, catalogo: catalogoReal(), config, memoria })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    await t.enviarMensagem(slug, "03", "Segue a planilha.")
    await t.aguardarOcioso(slug)
    await t.enviarMensagem(slug, "03", "O analista APROVOU o entregável “X” (x). Siga.")
    await t.aguardarOcioso(slug)
    expect(executorEnsaio.pedidos).toHaveLength(2)
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.some((e) => e.tipo === "aviso" && e.texto === RETOMADA)).toBe(false)
    expect(chamadas).toEqual([])
  })

  it("turno de prospect comum não lê a conversa e segue com automática por abertura e sem texto do analista", async () => {
    const executor = new FakeExecutor(roteiroSimples("ok"))
    const t = new ServicoTurnos({ servico, executor, barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarProspect("Iszi", null)
    await t.iniciar(slug, "01")
    await t.aguardarOcioso(slug)
    const espiao = vi.spyOn(servico, "conversa")
    try {
      await t.enviarMensagem(slug, "01", "segue")
      await t.aguardarOcioso(slug)
      expect(espiao).not.toHaveBeenCalled()
    } finally {
      espiao.mockRestore()
    }
    expect(executor.pedidos[1]!.contexto).toMatchObject({ fixture: null, automatica: false, textoAnalista: null })
    expect(executor.pedidos[0]!.contexto).toMatchObject({ fixture: null, automatica: true, textoAnalista: null })
  })

  it("Avançar ensaio sobre um trecho de mensagem não registra o aviso de fora do roteiro", async () => {
    const trechos = [{ gatilho: "mensagem", textoPreenchido: "Oi", passos: [{ dtMs: 0, evento: { tipo: "texto", texto: "t0" } }] }]
    await writeFile(path.join(pastaDoFixture(raiz, "mini"), "ensaio/03/roteiro.json"), JSON.stringify({ versao: 1, etapa: "03", trechos }))
    const executorEnsaio = new FakeExecutor(roteiroSimples("ensaio"))
    const t = new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio, barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    await servico.avancarEnsaio(slug, "03", null)
    await t.aguardarOcioso(slug)
    expect(executorEnsaio.pedidos).toHaveLength(1)
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.some((e) => e.tipo === "aviso" && e.texto === "Fora do roteiro: use Avançar ensaio ou reinicie a etapa.")).toBe(false)
  })
})

describe("modo ensaiado: avançar ensaio", () => {
  const passo = (texto: string) => ({ dtMs: 0, evento: { tipo: "texto", texto } })

  beforeEach(async () => {
    await criarFixtureMinimo(pastaDoFixture(raiz, "mini"))
  })

  async function gravarRoteiro03(gatilhos: string[]) {
    const trechos = gatilhos.map((gatilho, i) => ({ gatilho, textoPreenchido: null, passos: [passo(`trecho ${i}`)] }))
    await writeFile(path.join(pastaDoFixture(raiz, "mini"), "ensaio/03/roteiro.json"), JSON.stringify({ versao: 1, etapa: "03", trechos }))
  }

  async function proporDois(slug: string): Promise<[string, string]> {
    await mkdir(path.join(raiz, "clientes", slug, ".app/rascunhos"), { recursive: true })
    for (const nome of ["primeiro", "segundo"]) {
      await writeFile(path.join(raiz, "clientes", slug, `.app/rascunhos/${nome}.md`), `# ${nome}`)
      await servico.ferramenta({ slug, etapa: "03" }, "propor_entregavel", {
        tipo: "secao",
        titulo: `Seção ${nome}`,
        arquivo_rascunho: `clientes/${slug}/.app/rascunhos/${nome}.md`,
        nome_final: nome,
      })
    }
    const [a, b] = (await servico.estado(slug)).entregaveis.filter((e) => e.etapa === "03")
    return [a!.id, b!.id]
  }

  const statusDe = async (slug: string, id: string) => (await servico.estado(slug)).entregaveis.find((e) => e.id === id)!.status

  it("aprova só o mais antigo; o segundo só depois que o turno da primeira aprovação termina", async () => {
    await gravarRoteiro03(["aprovar", "aprovar", "automatica"])
    let soltar: () => void = () => {}
    const portao = new Promise<void>((r) => (soltar = r))
    let turnosEnsaio = 0
    const executorEnsaio = new FakeExecutor(async function* () {
      turnosEnsaio++
      if (turnosEnsaio === 1) await portao
      yield { tipo: "texto", texto: "tocado" }
      yield { tipo: "fim", ok: true, erro: null, sessionId: null }
    })
    const t = new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio, barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    const [a, b] = await proporDois(slug)

    await servico.avancarEnsaio(slug, "03", null)
    expect((await servico.estado(slug)).teste?.avancando).toBe("03")
    expect(await statusDe(slug, a)).toBe("aprovado")
    await vi.waitFor(() => expect(executorEnsaio.pedidos).toHaveLength(1))
    expect(await statusDe(slug, b)).toBe("pendente")

    soltar()
    await t.aguardarOcioso(slug)
    expect(await statusDe(slug, b)).toBe("aprovado")
    expect(executorEnsaio.pedidos).toHaveLength(3)
    expect(executorEnsaio.pedidos[0]!.mensagem).toContain("Seção primeiro")
    expect(executorEnsaio.pedidos[1]!.mensagem).toContain("Seção segundo")
    expect(executorEnsaio.pedidos[2]!.mensagem).toContain("Siga para o próximo passo.")
    expect((await servico.estado(slug)).teste?.avancando).toBeNull()
  })

  it("quando o último trecho toca, avancando volta a null e nenhuma aprovação nova acontece", async () => {
    await gravarRoteiro03(["aprovar"])
    const executorEnsaio = new FakeExecutor(roteiroSimples("ensaio"))
    const t = new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio, barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    const [a, b] = await proporDois(slug)
    await servico.avancarEnsaio(slug, "03", null)
    await t.aguardarOcioso(slug)
    expect(executorEnsaio.pedidos).toHaveLength(1)
    expect(await statusDe(slug, a)).toBe("aprovado")
    expect(await statusDe(slug, b)).toBe("pendente")
    expect((await servico.estado(slug)).teste?.avancando).toBeNull()
  })

  it("turno de ensaio com erro interrompe o avanço", async () => {
    await gravarRoteiro03(["aprovar", "aprovar"])
    const executorEnsaio = new FakeExecutor(async function* () {
      yield { tipo: "fim", ok: false, erro: "falhou", sessionId: null }
    })
    const t = new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio, barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    const [, b] = await proporDois(slug)
    await servico.avancarEnsaio(slug, "03", null)
    await t.aguardarOcioso(slug)
    expect(executorEnsaio.pedidos).toHaveLength(1)
    expect(await statusDe(slug, b)).toBe("pendente")
    expect((await servico.estado(slug)).teste?.avancando).toBeNull()
  })

  it("sem pendente, enfileira a mensagem automática para tocar o trecho seguinte", async () => {
    await gravarRoteiro03(["automatica"])
    const executorEnsaio = new FakeExecutor(roteiroSimples("ensaio"))
    const t = new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio, barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    await servico.avancarEnsaio(slug, "03", null)
    await t.aguardarOcioso(slug)
    expect(executorEnsaio.pedidos).toHaveLength(1)
    expect(executorEnsaio.pedidos[0]!.mensagem).toContain("Siga para o próximo passo.")
    const conversa = await servico.conversa(slug, "03")
    expect(conversa.some((e) => e.tipo === "mensagem_analista" && e.automatica && e.texto === "Siga para o próximo passo.")).toBe(true)
  })

  it("prospect sem ensaio lança ErroNaoEhTeste; com turno ativo, ErroTurnoAtivo", async () => {
    let soltar: () => void = () => {}
    const portao = new Promise<void>((r) => (soltar = r))
    const executorEnsaio = new FakeExecutor(async function* () {
      await portao
      yield { tipo: "fim", ok: true, erro: null, sessionId: null }
    })
    const t = new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio, barramento, catalogo: catalogoReal(), config })
    const comum = await servico.criarProspect("Iszi", null)
    await expect(servico.avancarEnsaio(comum, "03", null)).rejects.toBeInstanceOf(ErroNaoEhTeste)
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    await t.enviarMensagem(slug, "03", "oi")
    await expect(servico.avancarEnsaio(slug, "03", null)).rejects.toBeInstanceOf(ErroTurnoAtivo)
    soltar()
    await t.aguardarOcioso(slug)
  })

  it("falha ao aprovar devolve avancando a null e repassa o erro", async () => {
    await gravarRoteiro03(["aprovar"])
    new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio: new FakeExecutor(roteiroSimples("ensaio")), barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    await proporDois(slug)
    const espiao = vi.spyOn(servico, "aprovarEntregavel").mockRejectedValue(new Error("disco cheio"))
    try {
      await expect(servico.avancarEnsaio(slug, "03", null)).rejects.toThrow("disco cheio")
    } finally {
      espiao.mockRestore()
    }
    expect((await servico.estado(slug)).teste?.avancando).toBeNull()
  })

  it("um segundo pedido enquanto o avanço da etapa está em curso é recusado", async () => {
    await gravarRoteiro03(["aprovar", "aprovar"])
    new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio: new FakeExecutor(roteiroSimples("ensaio")), barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    const [a] = await proporDois(slug)
    let soltar: () => void = () => {}
    const portao = new Promise<void>((r) => (soltar = r))
    const espiao = vi.spyOn(servico, "aprovarEntregavel").mockImplementation(() => portao)
    try {
      const primeiro = servico.avancarEnsaio(slug, "03", null)
      await vi.waitFor(() => expect(espiao).toHaveBeenCalledTimes(1))
      const segundo = servico.avancarEnsaio(slug, "03", null)
      await expect(segundo).rejects.toBeInstanceOf(ErroEntrada)
      await expect(segundo).rejects.toThrow("O ensaio já está avançando nesta etapa.")
      expect(espiao).toHaveBeenCalledTimes(1)
      soltar()
      await primeiro
    } finally {
      espiao.mockRestore()
    }
    expect(await statusDe(slug, a)).toBe("pendente")
  })

  it("roteiro já tocado até o fim: recusa sem aprovar nada", async () => {
    await gravarRoteiro03(["aprovar"])
    new ServicoTurnos({ servico, executor: new FakeExecutor(roteiroSimples("principal")), executorEnsaio: new FakeExecutor(roteiroSimples("ensaio")), barramento, catalogo: catalogoReal(), config })
    const slug = await servico.criarClienteTeste("mini", "03", null, true)
    await servico.iniciarEtapa(slug, "03")
    const [a] = await proporDois(slug)
    await servico.consumirTrechoEnsaio(slug, "03")
    const pedido = servico.avancarEnsaio(slug, "03", null)
    await expect(pedido).rejects.toBeInstanceOf(ErroEntrada)
    await expect(pedido).rejects.toThrow("O ensaio desta etapa terminou.")
    expect(await statusDe(slug, a)).toBe("pendente")
    expect((await servico.estado(slug)).teste?.avancando ?? null).toBeNull()
  })
})
