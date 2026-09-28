import { randomUUID } from "node:crypto"
import path from "node:path"
import { descreverAtividade } from "./atividade"
import type { Barramento } from "./barramento"
import { etapaDoCatalogo } from "./catalogo"
import { ErroTurnoAtivo } from "./erros"
import type { Executor, PedidoTurno } from "./executor/tipos"
import { promptInicialEtapa, systemPromptModoInterface } from "./prompts"
import type { ServicoPlanejamento } from "./servico-planejamento"
import type { Catalogo, EtapaId, EventoConversa } from "./tipos"

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
}

export interface DependenciasTurnos {
  servico: ServicoPlanejamento
  executor: Executor
  barramento: Barramento
  catalogo: Catalogo
  config: ConfigTurnos
  agora?: () => string
}

export function aspasShell(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function montarMcpConfig(config: ConfigTurnos, token: string): string {
  return JSON.stringify({
    mcpServers: {
      planejamento: {
        command: config.comandoNode,
        args: [config.caminhoServidorMcp],
        env: { PLANEJAMENTO_APP_URL: config.urlApp, PLANEJAMENTO_TOKEN: token },
      },
    },
  })
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

function horario(resetsAt: number | null): string {
  return resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""
}

export class ServicoTurnos {
  private readonly servico: ServicoPlanejamento
  private readonly executor: Executor
  private readonly barramento: Barramento
  private readonly catalogo: Catalogo
  private readonly config: ConfigTurnos
  private readonly agora: () => string
  private readonly ativos = new Map<string, { etapa: EtapaId; controle: AbortController }>()
  private readonly tokens = new Map<string, { slug: string; etapa: EtapaId }>()
  /** Trabalho em andamento por prospect (turnos e disparos da fila) — base do aguardarOcioso. */
  private readonly pendentes = new Map<string, Set<Promise<void>>>()

  constructor(d: DependenciasTurnos) {
    this.servico = d.servico
    this.executor = d.executor
    this.barramento = d.barramento
    this.catalogo = d.catalogo
    this.config = d.config
    this.agora = d.agora ?? (() => new Date().toISOString())
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

  contextoDoToken(token: string): { slug: string; etapa: EtapaId } | null {
    return this.tokens.get(token) ?? null
  }

  async iniciar(slug: string, etapa: EtapaId): Promise<void> {
    if (this.ativos.has(slug)) throw new ErroTurnoAtivo()
    await this.servico.iniciarEtapa(slug, etapa)
    this.emSegundoPlano(slug, etapa, null)
  }

  async enviarMensagem(slug: string, etapa: EtapaId, texto: string): Promise<void> {
    if (this.ativos.has(slug)) throw new ErroTurnoAtivo()
    await this.servico.registrarMensagemAnalista(slug, etapa)
    await this.registrar(slug, etapa, { tipo: "mensagem_analista", texto, automatica: false, em: this.agora() })
    this.emSegundoPlano(slug, etapa, texto)
  }

  parar(slug: string): void {
    this.ativos.get(slug)?.controle.abort()
  }

  async processarFila(slug: string): Promise<void> {
    if (this.ativos.has(slug)) return
    const item = await this.servico.retirarFila(slug)
    if (!item || this.ativos.has(slug)) return
    await this.registrar(slug, item.etapa, { tipo: "mensagem_analista", texto: item.texto, automatica: true, em: this.agora() })
    this.emSegundoPlano(slug, item.etapa, item.texto)
  }

  /** Para testes e para o desligamento: espera o turno atual e os que a fila disparar. */
  async aguardarOcioso(slug: string): Promise<void> {
    while (this.pendentes.get(slug)?.size) await Promise.all([...this.pendentes.get(slug)!])
  }

  private registrar(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    return this.servico.registrarConversa(slug, etapa, evento)
  }

  private emSegundoPlano(slug: string, etapa: EtapaId, texto: string | null): void {
    const controle = new AbortController()
    this.ativos.set(slug, { etapa, controle })
    this.barramento.publicar(slug, { tipo: "turno", etapa, ativo: true })
    this.acompanhar(
      slug,
      this.executarTurno(slug, etapa, texto, controle.signal)
        .catch((e) => console.error(`Turno do prospect ${slug} falhou:`, e))
        .finally(() => {
          this.ativos.delete(slug)
          this.barramento.publicar(slug, { tipo: "turno", etapa, ativo: false })
        })
        // o próximo turno (se houver fila) é registrado em `pendentes` antes deste sair de lá
        .then(() => this.processarFila(slug)),
    )
  }

  private async executarTurno(slug: string, etapa: EtapaId, texto: string | null, sinal: AbortSignal): Promise<void> {
    const estado = await this.servico.estado(slug)
    const etapaCat = etapaDoCatalogo(this.catalogo, etapa)
    let sessionId = estado.etapas[etapa].sessionId
    const mensagem = sessionId
      ? (texto ?? "Continue de onde parou.")
      : [promptInicialEtapa({ slug, etapa: etapaCat, dossie: await this.servico.dossie(slug, etapa) }), texto]
          .filter(Boolean)
          .join("\n\n---\n\n")

    const token = randomUUID()
    this.tokens.set(token, { slug, etapa })
    const pedido: PedidoTurno = {
      cwd: this.config.raiz,
      mensagem,
      sessionId,
      systemPrompt: systemPromptModoInterface({ slug, etapa: etapaCat }),
      mcpConfig: montarMcpConfig(this.config, token),
      settings: montarSettingsHook(this.config, path.join(this.config.raiz, "clientes", slug)),
      allowedTools: FERRAMENTAS_PERMITIDAS,
    }

    await this.registrar(slug, etapa, { tipo: "turno_inicio", em: this.agora() })
    let terminou = false
    try {
      for await (const ev of this.executor.executar(pedido, sinal)) {
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
        } else if (ev.tipo === "limite") {
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
          await this.registrar(slug, etapa, {
            tipo: "turno_fim",
            status: sinal.aborted ? "interrompido" : ev.ok ? "ok" : "erro",
            detalhe: ev.ok ? null : ev.erro,
            em: this.agora(),
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
