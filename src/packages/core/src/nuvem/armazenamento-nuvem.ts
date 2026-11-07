import { rm } from "node:fs/promises"
import { FsArmazenamento, normalizarEstado } from "../armazenamento"
import type { Comentario } from "../comentarios"
import { ErroProspectExistente, ErroSincronizacao } from "../erros"
import type { Estado, EtapaId, EventoConversa } from "../tipos"
import type { Mesa } from "./mesa"
import type { ArmazemArquivos, RegistroUsoTurno, Repositorio } from "./tipos"

const ATRASO_PADRAO_MS = 1000

/**
 * Armazenamento sobre o banco e a nuvem: estado, conversa, comentários e uso vão
 * ao Repositorio; os arquivos ficam na mesa local e a Mesa os sincroniza.
 * Só existe uma Mesa por processo (a fila por prospect vive nela).
 */
export class NuvemArmazenamento extends FsArmazenamento {
  private readonly repositorio: Repositorio
  private readonly armazem: ArmazemArquivos
  private readonly mesa: Mesa
  private readonly atrasoAgendamentoMs: number
  private readonly sincronizadosNestaExecucao = new Set<string>()
  private readonly sincronizacoesIniciais = new Map<string, Promise<void>>()
  private readonly versoes = new Map<string, number>()
  private readonly temporizadores = new Map<string, ReturnType<typeof setTimeout>>()
  /** Prospects com escrita (ou sincronização que falhou) desde a subida: o que o sincronizarTudo envia. */
  private readonly tocados = new Set<string>()

  constructor(d: {
    raiz: string
    repositorio: Repositorio
    armazem: ArmazemArquivos
    mesa: Mesa
    atrasoAgendamentoMs?: number
  }) {
    super(d.raiz)
    this.repositorio = d.repositorio
    this.armazem = d.armazem
    this.mesa = d.mesa
    this.atrasoAgendamentoMs = d.atrasoAgendamentoMs ?? ATRASO_PADRAO_MS
  }

  override listarSlugs(): Promise<string[]> {
    return this.repositorio.listarSlugs()
  }

  override existe(slug: string): Promise<boolean> {
    this.pastaProspect(slug)
    return this.repositorio.existe(slug)
  }

  /**
   * Uma pasta local sem linha no banco (prospect antigo do Mac) também bloqueia o slug, sem ser tocada.
   * Um slug excluído é recriado do zero: o banco e a nuvem são limpos antes de copiar o _template.
   */
  override async criarPasta(slug: string, criadoPor: string | null = null): Promise<void> {
    if (await super.existe(slug)) throw new ErroProspectExistente(slug)
    await this.repositorio.criarProspect(slug, criadoPor)
    // Sobras de um prospect excluído (ou objetos órfãos de um slug sem linha) não podem vazar para o novo.
    await this.armazem.apagarTudo(slug)
    await super.criarPasta(slug)
    try {
      await this.sincronizar(slug)
    } catch (e) {
      // O prospect já existe e a marca de pendente está feita: a próxima ação tenta de novo.
      console.error(`Falha ao sincronizar o prospect novo "${slug}":`, e)
    }
  }

  /** Não usa a lixeira do sistema: a nuvem guarda tudo. Não sincroniza depois (a Mesa baixaria tudo de volta). */
  override async excluir(slug: string): Promise<void> {
    this.pastaProspect(slug)
    await this.repositorio.excluirProspect(slug)
    this.cancelarAgendamento(slug)
    // esquecer entra na fila da Mesa: espera uma sincronização em andamento terminar antes de a pasta sumir
    await this.mesa.esquecer(slug)
    await rm(this.pastaProspect(slug), { recursive: true, force: true })
    this.sincronizadosNestaExecucao.delete(slug)
    this.sincronizacoesIniciais.delete(slug)
    this.tocados.delete(slug)
    this.versoes.delete(slug)
  }

  /** Apaga do disco; a próxima sincronização leva o arquivo para a lixeira da nuvem. */
  override async moverParaLixeiraNoProspect(slug: string, relativo: string): Promise<void> {
    await rm(this.caminhoAbsoluto(slug, relativo), { recursive: true, force: true })
    this.agendarSincronizacao(slug)
  }

  override lerDono(slug: string): Promise<string | null> {
    this.pastaProspect(slug)
    return this.repositorio.lerDono(slug)
  }

  override listarDonos(): Promise<Map<string, string | null>> {
    return this.repositorio.listarDonos()
  }

  override trocarDono(slug: string, email: string): Promise<void> {
    this.pastaProspect(slug)
    return this.repositorio.trocarDono(slug, email)
  }

  override async lerEstado(slug: string): Promise<Estado | null> {
    this.pastaProspect(slug)
    await this.sincronizarNaPrimeiraLeitura(slug)
    const lido = await this.repositorio.lerEstado(slug)
    if (!lido) {
      this.versoes.delete(slug)
      return null
    }
    this.versoes.set(slug, lido.versao)
    return normalizarEstado(lido.estado)
  }

  override async gravarEstado(slug: string, estado: Estado): Promise<void> {
    this.pastaProspect(slug)
    const versaoLida = this.versoes.get(slug) ?? (await this.repositorio.lerEstado(slug))?.versao ?? 0
    this.versoes.set(slug, await this.repositorio.gravarEstado(slug, estado, versaoLida))
  }

  override anexarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    this.pastaProspect(slug)
    return this.repositorio.anexarConversa(slug, etapa, evento)
  }

  override lerConversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]> {
    this.pastaProspect(slug)
    return this.repositorio.lerConversa(slug, etapa)
  }

  override lerComentarios(slug: string, id: string): Promise<Comentario[]> {
    this.pastaProspect(slug)
    return this.repositorio.lerComentarios(slug, id)
  }

  override gravarComentarios(slug: string, id: string, lista: Comentario[]): Promise<void> {
    this.pastaProspect(slug)
    return this.repositorio.gravarComentarios(slug, id, lista)
  }

  override limparConversasEComentarios(slug: string): Promise<void> {
    this.pastaProspect(slug)
    return this.repositorio.limparConversasEComentarios(slug)
  }

  override async gravarTexto(slug: string, rel: string, conteudo: string): Promise<void> {
    await super.gravarTexto(slug, rel, conteudo)
    this.agendarSincronizacao(slug)
  }

  override async gravarBinario(slug: string, rel: string, dados: Uint8Array): Promise<void> {
    await super.gravarBinario(slug, rel, dados)
    this.agendarSincronizacao(slug)
  }

  override async copiar(slug: string, relOrigem: string, relDestino: string): Promise<void> {
    await super.copiar(slug, relOrigem, relDestino)
    this.agendarSincronizacao(slug)
  }

  override async moverParaDentro(slug: string, absOrigem: string, relDestino: string): Promise<void> {
    await super.moverParaDentro(slug, absOrigem, relDestino)
    this.agendarSincronizacao(slug)
  }

  /** Sincroniza agora. Com falha, marca o prospect como pendente e relança; com sucesso, desmarca. */
  override async sincronizar(slug: string): Promise<void> {
    this.pastaProspect(slug)
    try {
      await this.mesa.sincronizar(slug)
    } catch (e) {
      this.tocados.add(slug)
      if (e instanceof ErroSincronizacao) {
        try {
          await this.repositorio.marcarSincronizacao(slug, true)
        } catch (m) {
          console.error(`Não consegui marcar a sincronização pendente de "${slug}":`, m)
        }
      }
      throw e
    }
    await this.repositorio.marcarSincronizacao(slug, false)
  }

  /** Reinicia o temporizador do prospect; o erro é registrado (a marca de pendente já foi feita). */
  override agendarSincronizacao(slug: string): void {
    this.tocados.add(slug)
    this.cancelarAgendamento(slug)
    const t = setTimeout(() => {
      this.temporizadores.delete(slug)
      this.sincronizar(slug).catch((e) => console.error(`Falha ao sincronizar "${slug}":`, e))
    }, this.atrasoAgendamentoMs)
    this.temporizadores.set(slug, t)
  }

  /**
   * Desligamento: cancela os temporizadores e sincroniza agora cada prospect tocado desde a subida. A falha de um
   * não impede os outros; depois de tentar todos, relança o último erro (o prospect já ficou marcado como pendente).
   * A Mesa enfileira por prospect, então uma sincronização do temporizador que já estava rodando termina antes.
   */
  override async sincronizarTudo(): Promise<void> {
    for (const slug of [...this.temporizadores.keys()]) this.cancelarAgendamento(slug)
    const resultados = await Promise.allSettled([...this.tocados].map((slug) => this.sincronizar(slug)))
    const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected")
    for (const f of falhas) console.error("Falha ao sincronizar no desligamento:", f.reason)
    if (falhas.length) throw falhas.at(-1)!.reason
  }

  override registrarUso(r: RegistroUsoTurno): Promise<void> {
    return this.repositorio.registrarUso(r)
  }

  private cancelarAgendamento(slug: string): void {
    const t = this.temporizadores.get(slug)
    if (t) clearTimeout(t)
    this.temporizadores.delete(slug)
  }

  /** Uma vez por processo e por slug; leituras simultâneas esperam a mesma sincronização. A falha não impede a leitura. */
  private async sincronizarNaPrimeiraLeitura(slug: string): Promise<void> {
    if (this.sincronizadosNestaExecucao.has(slug)) return
    let andamento = this.sincronizacoesIniciais.get(slug)
    if (!andamento) {
      andamento = (async () => {
        try {
          if (!(await this.repositorio.existe(slug))) return
          await this.sincronizar(slug)
          this.sincronizadosNestaExecucao.add(slug)
        } catch (e) {
          console.error(`Não consegui sincronizar "${slug}" antes de ler o estado:`, e)
        } finally {
          this.sincronizacoesIniciais.delete(slug)
        }
      })()
      this.sincronizacoesIniciais.set(slug, andamento)
    }
    await andamento
  }
}
