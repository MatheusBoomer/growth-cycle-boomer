import { randomUUID } from "node:crypto"
import path from "node:path"
import { descreverAtividade } from "./atividade"
import type { Barramento } from "./barramento"
import { etapaDoCatalogo } from "./catalogo"
import { carregarRoteiro, classificarGatilho } from "./ensaio/roteiro"
import { ErroFixture, ErroReiniciando, ErroTurnoAtivo } from "./erros"
import type { ContextoTurno, DefinicaoAgente, Executor, PedidoTurno } from "./executor/tipos"
import { lerDefinicaoSubagente } from "./executor/subagentes"
import type { MemoriaDeSessao } from "./nuvem/memoria-sessao"
import type { EntradaUsoTurno } from "./nuvem/tipos"
import { promptInicialEtapa, promptRetomadaEtapa, systemPromptModoInterface } from "./prompts"
import type { AjusteEnvio, ServicoPlanejamento } from "./servico-planejamento"
import type { Catalogo, EtapaId, EventoConversa } from "./tipos"
import { RegistroUso, type UsoAssinatura } from "./uso-assinatura"

const AVISO_SINCRONIZACAO_ANTES = "Não consegui baixar os arquivos do prospect. Tente de novo."
const AVISO_RETOMADA = "Retomei a etapa a partir do histórico."
const AVISO_SINCRONIZACAO_DEPOIS =
  "Os arquivos desta resposta ainda não foram salvos na nuvem. Vou tentar de novo na próxima ação."
const AVISO_FORA_DO_ROTEIRO = "Fora do roteiro: use Avançar ensaio ou reinicie a etapa."

/** Tudo o que o agente pode usar sem pedir permissão (o modo -p não pergunta). */
export const FERRAMENTAS_PERMITIDAS = [
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "Glob",
  "Grep",
  "Skill",
  "Agent",
  "Task",
  "TodoWrite",
  "WebSearch",
  "WebFetch",
  "Bash(python3 *)",
  "Bash(pandoc *)",
  "Bash(ls *)",
  "Bash(mkdir *)",
  "Bash(cat *)",
  "Bash(head *)",
  "Bash(wc *)",
  "mcp__planejamento",
  "mcp__firecrawl",
  "mcp__claude_ai_Canva",
]

export interface ConfigTurnos {
  raiz: string
  urlApp: string
  caminhoServidorMcp: string
  caminhoHook: string
  comandoNode: string
  /**
   * Acrescenta o Firecrawl ao MCP do turno (se FIRECRAWL_API_KEY existir). Só no executor SDK:
   * no modo CLI a configuração do Claude Code do analista já traz o Firecrawl.
   */
  firecrawlNoMcp?: boolean
}

export interface DependenciasTurnos {
  servico: ServicoPlanejamento
  executor: Executor
  /** Reproduz o roteiro gravado no cliente de teste com `teste.ensaio`. Sem ele, todo prospect usa `executor`. */
  executorEnsaio?: Executor
  barramento: Barramento
  catalogo: Catalogo
  config: ConfigTurnos
  agora?: () => string
  /** Guarda a sessão do agente na nuvem. Sem ela, nada muda (modo em disco). */
  memoria?: MemoriaDeSessao
}

export function aspasShell(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function montarMcpConfig(config: ConfigTurnos, token: string, env: Record<string, string | undefined> = {}): string {
  const mcpServers: Record<string, unknown> = {
    planejamento: {
      command: config.comandoNode,
      args: [config.caminhoServidorMcp],
      env: { PLANEJAMENTO_APP_URL: config.urlApp, PLANEJAMENTO_TOKEN: token },
    },
  }
  if (env.FIRECRAWL_API_KEY) {
    mcpServers.firecrawl = { command: "firecrawl-mcp", args: [], env: { FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY } }
  }
  return JSON.stringify({ mcpServers })
}

export function montarSettingsHook(config: ConfigTurnos, pastaProspect: string): string {
  return JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit|NotebookEdit",
          hooks: [
            { type: "command", command: [config.comandoNode, config.caminhoHook, pastaProspect].map(aspasShell).join(" ") },
          ],
        },
      ],
    },
  })
}

/** Quando o Claude recusa o modelo configurado, diz ao analista onde corrigir; o erro original segue depois. */
function detalheDoErro(erro: string | null, modelo: string | undefined): string | null {
  if (!modelo || !erro || !/model/i.test(erro)) return erro
  return `O modelo ${modelo} foi recusado. Ajuste em Administração → Modelos. ${erro}`
}

function horario(resetsAt: number | null): string {
  return resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
}

export class ServicoTurnos {
  private readonly servico: ServicoPlanejamento
  private readonly executor: Executor
  private readonly executorEnsaio: Executor | undefined
  private readonly barramento: Barramento
  private readonly catalogo: Catalogo
  private readonly config: ConfigTurnos
  private readonly agora: () => string
  private readonly memoria: MemoriaDeSessao | undefined
  /**
   * Vaga do turno por prospect. etapa null = reservada enquanto a fila é consultada.
   * `liberada` resolve quando a vaga é devolvida: é o que o drenar espera de um turno ainda se preparando.
   */
  private readonly ativos = new Map<
    string,
    { etapa: EtapaId | null; controle: AbortController; autor: string | null; liberada: Promise<void>; liberar: () => void }
  >()
  /** Ligado pelo drenar (desligamento): nenhum turno novo nasce depois disso, nem pela fila. */
  private drenando = false
  private readonly tokens = new Map<string, { slug: string; etapa: EtapaId }>()
  /** Trabalho em andamento por prospect (turnos e disparos da fila), base do aguardarOcioso. */
  private readonly pendentes = new Map<string, Set<Promise<void>>>()

  private readonly registroUso: RegistroUso
  /** Janelas de limite já avisadas ("chegando perto"): o Claude repete o aviso a cada resposta. */
  private readonly avisados = new Set<string>()

  /** Último uso da assinatura informado pelo Claude (null antes da primeira resposta). */
  uso(): Promise<UsoAssinatura | null> {
    return this.registroUso.ler()
  }

  constructor(d: DependenciasTurnos) {
    this.servico = d.servico
    this.executor = d.executor
    this.executorEnsaio = d.executorEnsaio
    this.barramento = d.barramento
    this.catalogo = d.catalogo
    this.config = d.config
    this.agora = d.agora ?? (() => new Date().toISOString())
    this.memoria = d.memoria
    this.registroUso = new RegistroUso(d.config.raiz)
    this.servico.conectarTurnos({
      aoEnfileirar: (slug) => this.acompanhar(slug, this.processarFila(slug)),
      estaOcupado: (slug) => this.ativos.has(slug),
    })
  }

  private acompanhar(slug: string, trabalho: Promise<void>): void {
    const conjunto = this.pendentes.get(slug) ?? new Set<Promise<void>>()
    this.pendentes.set(slug, conjunto)
    const rastreado: Promise<void> = trabalho
      .catch((e) => console.error(`Turno do prospect ${slug} falhou:`, e))
      .finally(() => {
        conjunto.delete(rastreado)
        if (conjunto.size === 0 && this.pendentes.get(slug) === conjunto) this.pendentes.delete(slug)
      })
    conjunto.add(rastreado)
  }

  ativo(slug: string): EtapaId | null {
    return this.ativos.get(slug)?.etapa ?? null
  }

  /** E-mail de quem está com o turno ativo; null sem turno, sem login ou quando o item da fila não tinha autor. */
  ativoPor(slug: string): string | null {
    return this.ativos.get(slug)?.autor ?? null
  }

  contextoDoToken(token: string): { slug: string; etapa: EtapaId } | null {
    return this.tokens.get(token) ?? null
  }

  /** Checa e ocupa a vaga no mesmo tick: entre o teste e o set não pode haver await. */
  private reservar(slug: string, etapa: EtapaId | null, autor: string | null = null): AbortController {
    if (this.drenando) throw new ErroReiniciando()
    const ocupada = this.ativos.get(slug)
    // O nome só ajuda quando o turno é de outra pessoa; para o próprio autor (duplo clique, segunda aba) vale a genérica.
    if (ocupada) throw new ErroTurnoAtivo(ocupada.autor !== autor ? ocupada.autor : null)
    const controle = new AbortController()
    let liberar: () => void = () => {}
    const liberada = new Promise<void>((r) => (liberar = r))
    this.ativos.set(slug, { etapa, controle, autor, liberada, liberar })
    return controle
  }

  private liberar(slug: string, controle: AbortController): void {
    const vaga = this.ativos.get(slug)
    if (vaga?.controle !== controle) return
    this.ativos.delete(slug)
    vaga.liberar()
  }

  private async comReserva(slug: string, controle: AbortController, preparar: () => Promise<void>): Promise<void> {
    try {
      await preparar()
    } catch (e) {
      this.liberar(slug, controle)
      throw e
    }
  }

  async iniciar(slug: string, etapa: EtapaId, autor: string | null = null): Promise<void> {
    const controle = this.reservar(slug, etapa, autor)
    await this.comReserva(slug, controle, () => this.servico.iniciarEtapa(slug, etapa))
    this.emSegundoPlano(slug, etapa, null, controle, autor)
  }

  async enviarMensagem(slug: string, etapa: EtapaId, texto: string, autor: string | null = null): Promise<void> {
    const controle = this.reservar(slug, etapa, autor)
    await this.comReserva(slug, controle, async () => {
      await this.servico.registrarMensagemAnalista(slug, etapa)
      await this.registrar(slug, etapa, { tipo: "mensagem_analista", texto, automatica: false, ...(autor ? { autor } : {}), em: this.agora() })
    })
    this.emSegundoPlano(slug, etapa, texto, controle, autor)
  }

  /** Mensagem do chat que cita entregáveis pendentes: o balão mostra o texto do analista e as referências; o agente recebe a mensagem composta. */
  async enviarMensagemComAjustes(
    slug: string,
    etapa: EtapaId,
    texto: string,
    ajustes: AjusteEnvio[],
    autor: string | null = null,
  ): Promise<void> {
    const controle = this.reservar(slug, etapa, autor)
    let textoAgente = ""
    await this.comReserva(slug, controle, async () => {
      const envio = await this.servico.pedirAjustes(slug, etapa, texto, ajustes, autor)
      textoAgente = envio.textoAgente
      await this.servico.registrarMensagemAnalista(slug, etapa)
      await this.registrar(slug, etapa, {
        tipo: "mensagem_analista",
        texto: texto.trim(),
        automatica: false,
        referencias: envio.referencias,
        ...(autor ? { autor } : {}),
        em: this.agora(),
      })
    })
    this.emSegundoPlano(slug, etapa, textoAgente, controle, autor)
  }

  parar(slug: string): void {
    this.ativos.get(slug)?.controle.abort()
  }

  async processarFila(slug: string): Promise<void> {
    // Durante o desligamento o item fica na fila: roda na próxima ação do analista depois de o servidor voltar.
    if (this.drenando || this.ativos.has(slug)) return
    const controle = this.reservar(slug, null)
    let item: Awaited<ReturnType<ServicoPlanejamento["retirarFila"]>> = null
    await this.comReserva(slug, controle, async () => {
      item = await this.servico.retirarFila(slug)
    })
    if (!item) {
      this.liberar(slug, controle)
      return
    }
    const { etapa, texto, autor } = item
    // O turno de acompanhamento é de quem provocou o item (aprovou, pediu ajuste, enviou o insumo).
    const vaga = this.ativos.get(slug)
    if (vaga?.controle === controle) this.ativos.set(slug, { ...vaga, etapa, autor })
    await this.comReserva(slug, controle, () =>
      this.registrar(slug, etapa, { tipo: "mensagem_analista", texto, automatica: true, ...(autor ? { autor } : {}), em: this.agora() }),
    )
    this.emSegundoPlano(slug, etapa, texto, controle, autor)
  }

  /** Para testes e para o desligamento: espera o turno atual e os que a fila disparar. */
  async aguardarOcioso(slug: string): Promise<void> {
    while (this.pendentes.get(slug)?.size) await Promise.all([...this.pendentes.get(slug)!])
  }

  /**
   * Desligamento: recusa turnos novos (ErroReiniciando), não dispara a fila e espera os turnos em andamento,
   * inclusive os aceitos que ainda se preparam. Passado `prazoMs`, aborta os que sobraram (viram "interrompido",
   * e o fim do turno ainda sincroniza os arquivos) e espera eles saírem. Devolve os slugs abortados.
   */
  async drenar(prazoMs: number): Promise<{ abortados: string[] }> {
    this.drenando = true
    const ocioso = this.aguardarTudo()
    let estourou = false
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const prazo = new Promise<void>((r) => {
      temporizador = setTimeout(() => {
        estourou = true
        r()
      }, prazoMs)
    })
    await Promise.race([ocioso, prazo])
    clearTimeout(temporizador)
    if (!estourou) return { abortados: [] }
    const abortados = [...this.ativos.keys()]
    for (const vaga of this.ativos.values()) vaga.controle.abort()
    await ocioso
    return { abortados }
  }

  /** Espera até não sobrar vaga ocupada nem trabalho pendente em nenhum prospect. */
  private async aguardarTudo(): Promise<void> {
    while (this.ativos.size || this.pendentes.size) {
      await Promise.all([
        ...[...this.ativos.values()].map((v) => v.liberada),
        ...[...this.pendentes.values()].flatMap((c) => [...c]),
      ])
    }
  }

  private registrar(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    return this.servico.registrarConversa(slug, etapa, evento)
  }

  private emSegundoPlano(slug: string, etapa: EtapaId, texto: string | null, controle: AbortController, autor: string | null = null): void {
    this.barramento.publicar(slug, { tipo: "turno", etapa, ativo: true })
    this.acompanhar(
      slug,
      this.executarTurno(slug, etapa, texto, controle.signal, autor)
        .catch((e) => console.error(`Turno do prospect ${slug} falhou:`, e))
        .finally(() => {
          this.liberar(slug, controle)
          this.barramento.publicar(slug, { tipo: "turno", etapa, ativo: false })
        })
        // o próximo turno (se houver fila) é registrado em `pendentes` antes deste sair de lá
        .then(() => this.processarFila(slug)),
    )
  }

  /** Um turno completo: sincroniza antes, roda o agente e sincroniza de novo no fim (mesmo se interrompido ou com erro). */
  private async executarTurno(slug: string, etapa: EtapaId, texto: string | null, sinal: AbortSignal, autor: string | null): Promise<void> {
    if (!(await this.prepararTurno(slug, etapa))) return
    try {
      await this.rodarTurno(slug, etapa, texto, sinal, autor)
    } finally {
      await this.encerrarTurno(slug, etapa)
    }
  }

  /** Baixa os arquivos do prospect antes do turno. Sem eles o turno não roda: registra o erro e devolve false. */
  private async prepararTurno(slug: string, etapa: EtapaId): Promise<boolean> {
    try {
      await this.servico.sincronizarArquivos(slug)
      return true
    } catch (e) {
      console.error(`Falha ao sincronizar "${slug}" antes do turno:`, e)
      await this.registrar(slug, etapa, { tipo: "turno_inicio", em: this.agora() })
      await this.registrar(slug, etapa, { tipo: "aviso", nivel: "erro", texto: AVISO_SINCRONIZACAO_ANTES, em: this.agora() })
      await this.registrar(slug, etapa, {
        tipo: "turno_fim",
        status: "erro",
        detalhe: AVISO_SINCRONIZACAO_ANTES,
        em: this.agora(),
      })
      return false
    }
  }

  /** Envia à nuvem o que o turno produziu. Se falhar, o turno continua ok e o analista recebe um alerta. */
  private async encerrarTurno(slug: string, etapa: EtapaId): Promise<void> {
    await this.salvarSessao(slug, etapa)
    try {
      await this.servico.sincronizarArquivos(slug)
    } catch (e) {
      console.error(`Falha ao sincronizar "${slug}" depois do turno:`, e)
      await this.registrar(slug, etapa, { tipo: "aviso", nivel: "alerta", texto: AVISO_SINCRONIZACAO_DEPOIS, em: this.agora() }).catch(
        (erro) => console.error(`Não consegui registrar o aviso de sincronização de "${slug}":`, erro),
      )
    }
  }

  /** Guarda o custo do turno. Falha só vai para o console: não pode afetar o turno. */
  private async registrarUso(r: EntradaUsoTurno): Promise<void> {
    try {
      await this.servico.registrarUso(r)
    } catch (e) {
      console.error(`Falha ao registrar o uso do turno de "${r.slug}":`, e)
    }
  }

  /** Guarda a sessão do agente na nuvem. Falha só vai para o console: o analista não precisa saber. */
  private async salvarSessao(slug: string, etapa: EtapaId): Promise<void> {
    if (!this.memoria) return
    try {
      const sessionId = (await this.servico.estado(slug)).etapas[etapa].sessionId
      if (sessionId) await this.memoria.salvar(slug, sessionId)
    } catch (e) {
      console.error(`Falha ao salvar a sessão do agente de "${slug}":`, e)
    }
  }

  /** Confere se o .jsonl da sessão está no disco; se não der para restaurar, devolve false (a etapa recomeça pelo histórico). */
  private async restaurarSessao(slug: string, sessionId: string): Promise<boolean> {
    if (!this.memoria) return true
    try {
      return await this.memoria.restaurar(slug, sessionId)
    } catch (e) {
      console.error(`Falha ao restaurar a sessão do agente de "${slug}":`, e)
      return false
    }
  }

  /**
   * Modelo, esforço e subagentes configurados para a etapa. Sem configuração devolve {}, e o pedido
   * fica como era antes. Nenhum problema de configuração pode derrubar o turno: tudo cai no padrão.
   */
  private async configuracaoDaEtapa(etapa: EtapaId): Promise<Pick<PedidoTurno, "modelo" | "esforco" | "agentes">> {
    const extra: Pick<PedidoTurno, "modelo" | "esforco" | "agentes"> = {}
    try {
      const { principal, subagentes } = await this.servico.configDaEtapa(etapa)
      if (principal.modelo) extra.modelo = principal.modelo
      if (principal.esforco) extra.esforco = principal.esforco
      const agentes: Record<string, DefinicaoAgente> = {}
      for (const [nome, escolha] of Object.entries(subagentes)) {
        if (!escolha.modelo && !escolha.esforco) continue
        try {
          const definicao = lerDefinicaoSubagente(this.config.raiz, nome)
          if (escolha.modelo) definicao.model = escolha.modelo
          if (escolha.esforco) definicao.effort = escolha.esforco
          agentes[nome] = definicao
        } catch (e) {
          console.error(`Não consegui ler o subagente "${nome}"; ele segue com o padrão:`, e)
        }
      }
      if (Object.keys(agentes).length > 0) extra.agentes = agentes
    } catch (e) {
      console.error(`Não consegui montar a configuração de modelo da etapa ${etapa}; usando o padrão:`, e)
    }
    return extra
  }

  /**
   * Escolhe o trecho do roteiro que o turno de ensaio vai tocar e o põe em `contexto`. Roteiro ausente ou inválido:
   * registra o erro e fecha o turno sem consumir o índice (devolve false). Gatilho diferente do esperado: avisa e segue.
   */
  private async prepararEnsaio(
    slug: string,
    etapa: EtapaId,
    mensagem: string,
    automatica: boolean,
    contexto: ContextoTurno,
  ): Promise<boolean> {
    let roteiro
    try {
      roteiro = await carregarRoteiro(this.config.raiz, contexto.fixture!, etapa)
    } catch (e) {
      if (!(e instanceof ErroFixture)) throw e
      await this.registrar(slug, etapa, { tipo: "aviso", nivel: "erro", texto: e.message, em: this.agora() })
      await this.registrar(slug, etapa, { tipo: "turno_fim", status: "erro", detalhe: e.message, em: this.agora() })
      return false
    }
    const indice = await this.servico.consumirTrechoEnsaio(slug, etapa)
    const trecho = roteiro.trechos[indice] ?? null
    contexto.trecho = trecho
    if (trecho && trecho.gatilho !== classificarGatilho(mensagem, automatica)) {
      await this.registrar(slug, etapa, { tipo: "aviso", nivel: "alerta", texto: AVISO_FORA_DO_ROTEIRO, em: this.agora() })
    }
    return true
  }

  private async rodarTurno(slug: string, etapa: EtapaId, texto: string | null, sinal: AbortSignal, autor: string | null): Promise<void> {
    const estado = await this.servico.estado(slug)
    // Última mensagem do analista na conversa: diz se o turno é automático e qual texto o analista escreveu.
    // O turno de abertura (texto null) não tem mensagem própria: conta como automático e sem texto.
    const ultimaMensagem =
      texto === null
        ? undefined
        : [...(await this.servico.conversa(slug, etapa))]
            .reverse()
            .find((e): e is Extract<EventoConversa, { tipo: "mensagem_analista" }> => e.tipo === "mensagem_analista")
    const automatica = ultimaMensagem ? ultimaMensagem.automatica === true : true
    const textoAnalista = ultimaMensagem && !automatica ? ultimaMensagem.texto : null
    const etapaCat = etapaDoCatalogo(this.catalogo, etapa)
    let sessionId = estado.etapas[etapa].sessionId
    let retomada = false
    if (sessionId && !(await this.restaurarSessao(slug, sessionId))) {
      sessionId = null
      retomada = true
    }
    let mensagem: string
    if (sessionId) {
      mensagem = texto ?? "Continue de onde parou."
    } else if (retomada) {
      let historico = await this.servico.conversa(slug, etapa)
      // a mensagem do turno já foi registrada no histórico e segue no fim do prompt
      const ultimo = historico.at(-1)
      if (texto && ultimo?.tipo === "mensagem_analista" && ultimo.texto === texto) historico = historico.slice(0, -1)
      mensagem = [
        promptRetomadaEtapa({ slug, etapa: etapaCat, dossie: await this.servico.dossie(slug, etapa), historico }),
        texto ?? "Continue de onde parou.",
      ].join("\n\n---\n\n")
    } else {
      mensagem = [promptInicialEtapa({ slug, etapa: etapaCat, dossie: await this.servico.dossie(slug, etapa) }), texto]
        .filter(Boolean)
        .join("\n\n---\n\n")
    }

    const contexto: ContextoTurno = { slug, etapa, fixture: estado.teste?.fixture ?? null, trecho: null, textoAnalista, mensagemTurno: texto, automatica }
    const ensaio = estado.teste?.ensaio === true && this.executorEnsaio !== undefined
    const executor = ensaio ? this.executorEnsaio! : this.executor

    const token = randomUUID()
    this.tokens.set(token, { slug, etapa })
    const pedido: PedidoTurno = {
      cwd: this.config.raiz,
      mensagem,
      sessionId,
      systemPrompt: systemPromptModoInterface({ slug, etapa: etapaCat }),
      mcpConfig: montarMcpConfig(this.config, token, this.config.firecrawlNoMcp ? process.env : {}),
      settings: montarSettingsHook(this.config, path.join(this.config.raiz, "clientes", slug)),
      allowedTools: FERRAMENTAS_PERMITIDAS,
      ...(await this.configuracaoDaEtapa(etapa)),
      contexto,
    }

    // Conversa que já existia antes deste turno (e que o SDK continua): o custo dela já tem linhas anteriores.
    const sessaoAnterior = sessionId
    const inicio = this.agora()
    await this.registrar(slug, etapa, { tipo: "turno_inicio", em: inicio })
    if (retomada) await this.registrar(slug, etapa, { tipo: "aviso", nivel: "info", texto: AVISO_RETOMADA, em: this.agora() })
    let terminou = false
    try {
      if (ensaio && !(await this.prepararEnsaio(slug, etapa, texto ?? "", automatica, contexto))) return
      for await (const ev of executor.executar(pedido, sinal)) {
        if (ev.tipo === "sessao" && ev.sessionId !== sessionId) {
          sessionId = ev.sessionId
          await this.servico.definirSessao(slug, etapa, ev.sessionId)
        } else if (ev.tipo === "texto_delta") {
          this.barramento.publicar(slug, { tipo: "delta", etapa, texto: ev.texto })
        } else if (ev.tipo === "texto" && ev.texto.trim()) {
          await this.registrar(slug, etapa, { tipo: "texto_agente", texto: ev.texto, em: this.agora() })
        } else if (ev.tipo === "ferramenta") {
          const atividade = descreverAtividade(ev.nome, ev.entrada, this.config.raiz)
          if (atividade) await this.registrar(slug, etapa, { tipo: "atividade", ...atividade, em: this.agora() })
        } else if (ev.tipo === "uso") {
          await this.registroUso.gravar(ev.janelas, this.agora())
        } else if (ev.tipo === "limite") {
          const chave = `${ev.status}:${ev.resetsAt}`
          if (ev.status !== "rejected" && this.avisados.has(chave)) continue
          this.avisados.add(chave)
          const hora = horario(ev.resetsAt)
          await this.registrar(slug, etapa, {
            tipo: "aviso",
            nivel: ev.status === "rejected" ? "erro" : "alerta",
            texto:
              ev.status === "rejected"
                ? `O limite de uso da sua assinatura do Claude foi atingido.${hora ? ` Ele renova às ${hora}.` : ""} Depois disso, clique em Tentar de novo.`
                : `Você está chegando perto do limite de uso da assinatura do Claude.${hora ? ` Ele renova às ${hora}.` : ""}`,
            em: this.agora(),
          })
        } else if (ev.tipo === "fim") {
          terminou = true
          if (ev.sessionId && ev.sessionId !== sessionId) await this.servico.definirSessao(slug, etapa, ev.sessionId)
          const status = sinal.aborted ? "interrompido" : ev.ok ? "ok" : "erro"
          const fim = this.agora()
          const detalhe = ev.ok ? null : detalheDoErro(ev.erro, pedido.modelo)
          await this.registrar(slug, etapa, { tipo: "turno_fim", status, detalhe, em: fim })
          const sessao = ev.sessionId ?? sessionId ?? null
          await this.registrarUso({
            slug,
            etapa,
            autor,
            sessao,
            retomada: sessaoAnterior != null && sessaoAnterior === sessao,
            custoUsd: ev.uso?.custoUsd ?? null,
            modelosAcumulado: ev.uso?.modelos ?? null,
            esforco: pedido.esforco ?? null,
            tokensEntrada: ev.uso?.tokensEntrada ?? null,
            tokensSaida: ev.uso?.tokensSaida ?? null,
            inicio,
            fim,
            status,
          })
        }
      }
      if (!terminou) {
        await this.registrar(slug, etapa, {
          tipo: "turno_fim",
          status: sinal.aborted ? "interrompido" : "erro",
          detalhe: sinal.aborted ? "Interrompido pelo analista." : "O agente parou sem concluir a resposta.",
          em: this.agora(),
        })
      }
    } catch (e) {
      await this.registrar(slug, etapa, {
        tipo: "turno_fim",
        status: sinal.aborted ? "interrompido" : "erro",
        detalhe: e instanceof Error ? e.message : String(e),
        em: this.agora(),
      })
    } finally {
      this.tokens.delete(token)
    }
  }
}
