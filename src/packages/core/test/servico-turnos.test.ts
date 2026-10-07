import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { ErroTurnoAtivo } from "../src/erros"
import { FakeExecutor, roteiroSimples, type Roteiro } from "../src/executor/fake"
import type { PedidoTurno } from "../src/executor/tipos"
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
