import { createHash } from "node:crypto"
import type { Comentario } from "../comentarios"
import { ErroConflitoVersao, ErroNaoEncontrado, ErroProspectExistente, ErroSincronizacao } from "../erros"
import type { Acumulado, LinhaPresenca, LinhaUso } from "../metricas/tipos"
import type { NivelEsforco } from "../modelos"
import type { Estado, EtapaId, EventoConversa } from "../tipos"
import type {
  ArmazemArquivos,
  EntradaManifesto,
  EstadoVersionado,
  LinhaConfigModelo,
  RegistroUsoTurno,
  Repositorio,
} from "./tipos"

interface RegistroProspect {
  excluido: boolean
  estado: EstadoVersionado | null
  conversas: Map<EtapaId, EventoConversa[]>
  comentarios: Map<string, Comentario[]>
  sincronizacaoPendente: boolean
  criadoPor: string | null
}

/** Implementação em memória do Repositorio: base dos testes e do contrato compartilhado com o banco. */
export class MemoriaRepositorio implements Repositorio {
  private readonly prospects = new Map<string, RegistroProspect>()
  private readonly configModelos = new Map<string, LinhaConfigModelo>()
  /** Registros de uso, abertos para inspeção nos testes. */
  readonly usos: RegistroUsoTurno[] = []
  /** Avisos de presença, abertos para inspeção nos testes. */
  readonly presencas: LinhaPresenca[] = []

  constructor(private readonly agora: () => string = () => new Date().toISOString()) {}

  async listarSlugs(): Promise<string[]> {
    return [...this.prospects.entries()]
      .filter(([, p]) => !p.excluido)
      .map(([slug]) => slug)
      .sort()
  }

  async existe(slug: string): Promise<boolean> {
    const p = this.prospects.get(slug)
    return !!p && !p.excluido
  }

  async criarProspect(slug: string, criadoPor: string | null = null): Promise<void> {
    const atual = this.prospects.get(slug)
    if (atual && !atual.excluido) throw new ErroProspectExistente(slug)
    // Slug excluído: o registro antigo é substituído por inteiro, como no banco (uso e presença incluídos).
    if (atual) {
      this.usos.splice(0, this.usos.length, ...this.usos.filter((u) => u.slug !== slug))
      this.presencas.splice(0, this.presencas.length, ...this.presencas.filter((p) => p.slug !== slug))
    }
    this.prospects.set(slug, {
      excluido: false,
      estado: null,
      conversas: new Map(),
      comentarios: new Map(),
      sincronizacaoPendente: false,
      criadoPor,
    })
  }

  async excluirProspect(slug: string): Promise<void> {
    this.ativo(slug).excluido = true
  }

  async lerDono(slug: string): Promise<string | null> {
    return this.ativo(slug).criadoPor
  }

  async listarDonos(): Promise<Map<string, string | null>> {
    const donos = new Map<string, string | null>()
    for (const [slug, p] of this.prospects) if (!p.excluido) donos.set(slug, p.criadoPor)
    return donos
  }

  async trocarDono(slug: string, email: string): Promise<void> {
    this.ativo(slug).criadoPor = email
  }

  async lerEstado(slug: string): Promise<EstadoVersionado | null> {
    const p = this.prospects.get(slug)
    if (!p?.estado) return null
    return { estado: structuredClone(p.estado.estado), versao: p.estado.versao }
  }

  async gravarEstado(slug: string, estado: Estado, versaoLida: number): Promise<number> {
    const p = this.ativo(slug)
    const atual = p.estado?.versao ?? 0
    if (atual !== versaoLida) throw new ErroConflitoVersao(slug)
    p.estado = { estado: structuredClone(estado), versao: atual + 1 }
    return atual + 1
  }

  async anexarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    const p = this.ativo(slug)
    const lista = p.conversas.get(etapa) ?? []
    lista.push(structuredClone(evento))
    p.conversas.set(etapa, lista)
  }

  async lerConversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]> {
    return structuredClone(this.prospects.get(slug)?.conversas.get(etapa) ?? [])
  }

  async lerComentarios(slug: string, entregavelId: string): Promise<Comentario[]> {
    return structuredClone(this.prospects.get(slug)?.comentarios.get(entregavelId) ?? [])
  }

  async gravarComentarios(slug: string, entregavelId: string, lista: Comentario[]): Promise<void> {
    this.ativo(slug).comentarios.set(entregavelId, structuredClone(lista))
  }

  async limparConversasEComentarios(slug: string): Promise<void> {
    const p = this.prospects.get(slug)
    p?.conversas.clear()
    p?.comentarios.clear()
  }

  async registrarUso(r: RegistroUsoTurno): Promise<void> {
    this.usos.push({ ...r })
  }

  async ultimoUsoDaSessao(slug: string, sessao: string): Promise<Acumulado | null> {
    let ultimo: RegistroUsoTurno | null = null
    for (const u of this.usos) {
      if (u.slug !== slug || u.sessao !== sessao) continue
      if (!ultimo || u.fim >= ultimo.fim) ultimo = u
    }
    if (!ultimo) return null
    return { custoUsd: ultimo.custoUsd, modelos: ultimo.modelosAcumulado ? { ...ultimo.modelosAcumulado } : null }
  }

  async ultimoUsoAntigo(slug: string, etapa: EtapaId): Promise<Acumulado | null> {
    let ultimo: RegistroUsoTurno | null = null
    for (const u of this.usos) {
      if (u.slug !== slug || u.etapa !== etapa || u.sessao !== null || u.custoTurnoUsd !== null) continue
      if (!ultimo || u.fim >= ultimo.fim) ultimo = u
    }
    return ultimo ? { custoUsd: ultimo.custoUsd, modelos: null } : null
  }

  async listarUsos(slug?: string, ativos?: ReadonlySet<string>): Promise<LinhaUso[]> {
    return this.usos
      .filter((u) => (slug ? u.slug === slug : ativos ? ativos.has(u.slug) : this.estaAtivo(u.slug)))
      .map((u) => ({
        slug: u.slug,
        etapa: u.etapa,
        autor: u.autor,
        sessao: u.sessao,
        custoUsd: u.custoUsd,
        custoTurnoUsd: u.custoTurnoUsd,
        modelos: u.modelos ? { ...u.modelos } : null,
        inicio: u.inicio,
        fim: u.fim,
      }))
  }

  async registrarPresenca(p: Omit<LinhaPresenca, "em">): Promise<void> {
    this.presencas.push({ ...p, em: this.agora() })
  }

  async listarPresencas(slug?: string, ativos?: ReadonlySet<string>): Promise<LinhaPresenca[]> {
    return this.presencas
      .filter((p) => (slug ? p.slug === slug : ativos ? ativos.has(p.slug) : this.estaAtivo(p.slug)))
      .map((p) => ({ ...p }))
      .sort((a, b) => a.em.localeCompare(b.em))
  }

  async marcarSincronizacao(slug: string, pendente: boolean): Promise<void> {
    this.ativo(slug).sincronizacaoPendente = pendente
  }

  /** Estado da marca de sincronização, para os testes. */
  sincronizacaoPendente(slug: string): boolean {
    return this.prospects.get(slug)?.sincronizacaoPendente ?? false
  }

  /** Quem criou o prospect (`prospects.criado_por`), para os testes. */
  async lerConfigModelos(): Promise<LinhaConfigModelo[]> {
    return [...this.configModelos.values()]
      .map((l) => ({ ...l }))
      .sort((a, b) => a.etapa.localeCompare(b.etapa) || a.alvo.localeCompare(b.alvo))
  }

  async gravarConfigModelo(l: {
    etapa: EtapaId
    alvo: string
    modelo: string | null
    esforco: NivelEsforco | null
    alteradoPor: string
  }): Promise<void> {
    const chave = `${l.etapa}/${l.alvo}`
    if (l.modelo === null && l.esforco === null) {
      this.configModelos.delete(chave)
      return
    }
    this.configModelos.set(chave, {
      etapa: l.etapa,
      alvo: l.alvo,
      modelo: l.modelo,
      esforco: l.esforco,
      alteradoPor: l.alteradoPor,
      alteradoEm: this.agora(),
    })
  }

  criadoPor(slug: string): string | null {
    return this.prospects.get(slug)?.criadoPor ?? null
  }

  private estaAtivo(slug: string): boolean {
    const p = this.prospects.get(slug)
    return !!p && !p.excluido
  }

  private ativo(slug: string): RegistroProspect {
    const p = this.prospects.get(slug)
    if (!p || p.excluido) throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
    return p
  }
}

type OperacaoArmazem = "listar" | "enviar" | "baixar" | "remover"

/** Implementação em memória do ArmazemArquivos. `falharEm` permite simular falhas de rede nos testes. */
export class MemoriaArmazem implements ArmazemArquivos {
  falharEm?: (operacao: OperacaoArmazem, caminho: string) => boolean

  private readonly objetos = new Map<string, Uint8Array>()
  private readonly manifestos = new Map<string, Map<string, EntradaManifesto>>()
  private readonly sessoes = new Map<string, Uint8Array>()
  /** Caminhos removidos, na ordem (espelha arquivos_lixeira). */
  readonly lixeira: Array<{ slug: string; entrada: EntradaManifesto }> = []

  async listarManifesto(slug: string): Promise<EntradaManifesto[]> {
    this.verificar("listar", slug)
    return [...(this.manifestos.get(slug)?.values() ?? [])]
      .map((e) => ({ ...e }))
      .sort((a, b) => (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0))
  }

  async enviar(slug: string, caminho: string, dados: Uint8Array): Promise<EntradaManifesto> {
    this.verificar("enviar", caminho)
    const sha256 = createHash("sha256").update(dados).digest("hex")
    const chave = `${slug}/${sha256}`
    if (!this.objetos.has(chave)) this.objetos.set(chave, new Uint8Array(dados))
    const entrada: EntradaManifesto = { caminho, sha256, tamanho: dados.byteLength }
    const manifesto = this.manifestos.get(slug) ?? new Map<string, EntradaManifesto>()
    manifesto.set(caminho, entrada)
    this.manifestos.set(slug, manifesto)
    return { ...entrada }
  }

  async baixar(slug: string, sha256: string): Promise<Uint8Array> {
    this.verificar("baixar", sha256)
    const dados = this.objetos.get(`${slug}/${sha256}`)
    if (!dados) throw new ErroNaoEncontrado(`Objeto ${sha256} não encontrado para "${slug}".`)
    return new Uint8Array(dados)
  }

  async remover(slug: string, caminho: string): Promise<void> {
    this.verificar("remover", caminho)
    const manifesto = this.manifestos.get(slug)
    const entrada = manifesto?.get(caminho)
    if (!manifesto || !entrada) return
    manifesto.delete(caminho)
    this.lixeira.push({ slug, entrada: { ...entrada } })
  }

  async enviarSessao(slug: string, sessionId: string, dados: Uint8Array): Promise<void> {
    this.sessoes.set(`${slug}/${sessionId}`, new Uint8Array(dados))
  }

  async baixarSessao(slug: string, sessionId: string): Promise<Uint8Array | null> {
    const dados = this.sessoes.get(`${slug}/${sessionId}`)
    return dados ? new Uint8Array(dados) : null
  }

  async apagarTudo(slug: string): Promise<void> {
    const prefixo = `${slug}/`
    for (const mapa of [this.objetos, this.sessoes]) {
      for (const chave of [...mapa.keys()]) if (chave.startsWith(prefixo)) mapa.delete(chave)
    }
    this.manifestos.delete(slug)
    for (let i = this.lixeira.length - 1; i >= 0; i--) if (this.lixeira[i]!.slug === slug) this.lixeira.splice(i, 1)
  }

  private verificar(operacao: OperacaoArmazem, caminho: string): void {
    if (this.falharEm?.(operacao, caminho)) {
      throw new ErroSincronizacao(`Falha simulada em ${operacao}.`, caminho)
    }
  }
}
