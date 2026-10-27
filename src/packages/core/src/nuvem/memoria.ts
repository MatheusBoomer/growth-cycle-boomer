import { createHash } from "node:crypto"
import type { Comentario } from "../comentarios"
import { ErroConflitoVersao, ErroNaoEncontrado, ErroProspectExistente, ErroSincronizacao } from "../erros"
import type { Estado, EtapaId, EventoConversa } from "../tipos"
import type {
  ArmazemArquivos,
  EntradaManifesto,
  EstadoVersionado,
  RegistroUsoTurno,
  Repositorio,
} from "./tipos"

interface RegistroProspect {
  excluido: boolean
  estado: EstadoVersionado | null
  conversas: Map<EtapaId, EventoConversa[]>
  comentarios: Map<string, Comentario[]>
  sincronizacaoPendente: boolean
}

/** Implementação em memória do Repositorio: base dos testes e do contrato compartilhado com o banco. */
export class MemoriaRepositorio implements Repositorio {
  private readonly prospects = new Map<string, RegistroProspect>()
  /** Registros de uso, abertos para inspeção nos testes. */
  readonly usos: RegistroUsoTurno[] = []

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

  async criarProspect(slug: string): Promise<void> {
    if (this.prospects.has(slug)) throw new ErroProspectExistente(slug)
    this.prospects.set(slug, {
      excluido: false,
      estado: null,
      conversas: new Map(),
      comentarios: new Map(),
      sincronizacaoPendente: false,
    })
  }

  async excluirProspect(slug: string): Promise<void> {
    this.ativo(slug).excluido = true
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

  async registrarUso(r: RegistroUsoTurno): Promise<void> {
    this.usos.push({ ...r })
  }

  async marcarSincronizacao(slug: string, pendente: boolean): Promise<void> {
    this.ativo(slug).sincronizacaoPendente = pendente
  }

  /** Estado da marca de sincronização, para os testes. */
  sincronizacaoPendente(slug: string): boolean {
    return this.prospects.get(slug)?.sincronizacaoPendente ?? false
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

  private verificar(operacao: OperacaoArmazem, caminho: string): void {
    if (this.falharEm?.(operacao, caminho)) {
      throw new ErroSincronizacao(`Falha simulada em ${operacao}.`, caminho)
    }
  }
}
