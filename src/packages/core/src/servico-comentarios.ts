import { campoDaRegiao, regiaoValida, textoDoAjuste, type Comentario, type MapaPrevia, type Regiao } from "./comentarios"
import type { FsArmazenamento } from "./armazenamento"
import { encontrarEntregavel } from "./entregaveis"
import { ErroEntrada, TransicaoInvalida } from "./erros"
import type { Previa } from "./previa"
import type { Entregavel, Estado } from "./tipos"

export interface DependenciasComentarios {
  armazenamento: FsArmazenamento
  planejamento: { estado(slug: string): Promise<Estado>; pedirAjuste(slug: string, id: string, texto: string): Promise<void> }
  previa: Previa
  agora?: () => string
  gerarId?: () => string
}

type SlideRoteiro = { tipo?: string; titulo?: string; subtitulo?: string; concorrente?: string }
const semNegrito = (t: unknown) => (typeof t === "string" ? t.replaceAll("**", "").trim() : "")

/** Prévia da apresentação (PNG por slide, em cache por versão) e comentários do analista. */
export class ServicoComentarios {
  private readonly arm: FsArmazenamento
  private readonly planejamento: DependenciasComentarios["planejamento"]
  private readonly gerador: Previa
  private readonly agora: () => string
  private readonly gerarId: () => string
  /** Conversões em andamento por pasta: duas aberturas simultâneas esperam a mesma. */
  private readonly gerando = new Map<string, Promise<{ slides: number } | { erro: string }>>()

  constructor(d: DependenciasComentarios) {
    this.arm = d.armazenamento
    this.planejamento = d.planejamento
    this.gerador = d.previa
    this.agora = d.agora ?? (() => new Date().toISOString())
    this.gerarId = d.gerarId ?? (() => crypto.randomUUID())
  }

  private async entregavel(slug: string, id: string): Promise<Entregavel> {
    return encontrarEntregavel(await this.planejamento.estado(slug), id)
  }

  private async lerMapa(slug: string, id: string): Promise<MapaPrevia | null> {
    const texto = await this.arm.lerTexto(slug, `.app/previas/${id}/mapa.json`)
    return texto ? (JSON.parse(texto) as MapaPrevia) : null
  }

  async previa(slug: string, id: string): Promise<{ disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }> {
    const e = await this.entregavel(slug, id)
    if (e.tipo !== "apresentacao") throw new ErroEntrada("A prévia em imagens é só para a apresentação.")
    let mapa = await this.lerMapa(slug, id)
    if (!mapa) {
      const pasta = this.arm.caminhoAbsoluto(slug, `.app/previas/${id}`)
      let pendente = this.gerando.get(pasta)
      if (!pendente) {
        pendente = this.gerador.gerar(this.arm.caminhoAbsoluto(slug, e.arquivoRascunho), pasta).finally(() => this.gerando.delete(pasta))
        this.gerando.set(pasta, pendente)
      }
      const r = await pendente
      if ("erro" in r) return { disponivel: false, slides: [], mapa: null, erro: r.erro }
      mapa = await this.lerMapa(slug, id)
    }
    const total = mapa?.slides.length ?? 0
    const slides = Array.from({ length: total }, (_, i) => `.app/previas/${id}/slide-${String(i + 1).padStart(2, "0")}.png`)
    return { disponivel: true, slides, mapa, erro: null }
  }

  async listar(slug: string, id: string): Promise<Comentario[]> {
    const texto = await this.arm.lerTexto(slug, `.app/comentarios/${id}.json`)
    return texto ? (JSON.parse(texto) as Comentario[]) : []
  }

  private async gravar(slug: string, id: string, lista: Comentario[]): Promise<void> {
    await this.arm.gravarTexto(slug, `.app/comentarios/${id}.json`, JSON.stringify(lista, null, 2))
  }

  private async roteiro(slug: string, e: Entregavel): Promise<SlideRoteiro[]> {
    const texto = await this.arm.lerTexto(slug, e.arquivoRascunho)
    const slides = texto ? (JSON.parse(texto) as { slides?: SlideRoteiro[] }).slides : null
    return Array.isArray(slides) ? slides : []
  }

  private async exigirPendente(slug: string, id: string): Promise<Entregavel> {
    const e = await this.entregavel(slug, id)
    if (e.tipo !== "apresentacao" && e.tipo !== "roteiro") throw new ErroEntrada("Comentários são para o roteiro e a apresentação.")
    if (e.status !== "pendente") throw new TransicaoInvalida("Esta versão não está aguardando aprovação.")
    return e
  }

  async criar(slug: string, id: string, d: { slide: number; regiao: Regiao | null; texto: string }): Promise<Comentario> {
    const e = await this.exigirPendente(slug, id)
    const texto = (d.texto ?? "").trim()
    if (!texto) throw new ErroEntrada("Escreva o comentário.")
    if (d.regiao !== null && !regiaoValida(d.regiao)) throw new ErroEntrada("Região inválida.")
    let campo: string | null = null
    if (e.tipo === "roteiro") {
      if (d.regiao) throw new ErroEntrada("No roteiro, comente o slide inteiro.")
      const total = (await this.roteiro(slug, e)).length
      if (!Number.isInteger(d.slide) || d.slide < 1 || d.slide > total) throw new ErroEntrada(`Slide ${d.slide} não existe no roteiro.`)
    } else {
      const mapa = await this.lerMapa(slug, id)
      const total = mapa?.slides.length ?? 0
      if (!Number.isInteger(d.slide) || d.slide < 1 || d.slide > total) throw new ErroEntrada(`Slide ${d.slide} não existe na prévia.`)
      const slide = mapa?.slides[d.slide - 1]
      if (d.regiao && slide) campo = campoDaRegiao(d.regiao, slide.campos)
    }
    const c: Comentario = { id: this.gerarId(), slide: d.slide, regiao: d.regiao, campo, texto, criadoEm: this.agora(), enviadoEm: null }
    await this.gravar(slug, id, [...(await this.listar(slug, id)), c])
    return c
  }

  private async alterar(slug: string, id: string, cid: string, f: (c: Comentario) => Comentario | null): Promise<void> {
    await this.exigirPendente(slug, id)
    const lista = await this.listar(slug, id)
    const alvo = lista.find((c) => c.id === cid)
    if (!alvo) throw new ErroEntrada("Comentário não encontrado.")
    if (alvo.enviadoEm) throw new TransicaoInvalida("Este comentário já foi enviado ao agente.")
    const novo = f(alvo)
    await this.gravar(slug, id, novo ? lista.map((c) => (c.id === cid ? novo : c)) : lista.filter((c) => c.id !== cid))
  }

  async editar(slug: string, id: string, cid: string, texto: string): Promise<void> {
    if (!texto.trim()) throw new ErroEntrada("Escreva o comentário.")
    await this.alterar(slug, id, cid, (c) => ({ ...c, texto: texto.trim() }))
  }

  async apagar(slug: string, id: string, cid: string): Promise<void> {
    await this.alterar(slug, id, cid, () => null)
  }

  async enviar(slug: string, id: string): Promise<number> {
    const e = await this.exigirPendente(slug, id)
    const lista = await this.listar(slug, id)
    const pendentes = lista.filter((c) => !c.enviadoEm).sort((a, b) => a.slide - b.slide)
    if (pendentes.length === 0) throw new ErroEntrada("Nenhum comentário novo para enviar.")
    const recortes: Record<string, string> = {}
    let rotulo: (n: number) => string
    if (e.tipo === "apresentacao") {
      const mapa = await this.lerMapa(slug, id)
      for (const c of pendentes) {
        if (!c.regiao) continue
        const rel = `.app/comentarios/${id}/${c.id}.png`
        await this.gerador.recortar(
          this.arm.caminhoAbsoluto(slug, `.app/previas/${id}/slide-${String(c.slide).padStart(2, "0")}.png`),
          c.regiao,
          this.arm.caminhoAbsoluto(slug, rel),
        )
        recortes[c.id] = `clientes/${slug}/${rel}`
      }
      rotulo = (n) => {
        const titulo = mapa?.slides[n - 1]?.titulo
        return titulo ? `Slide ${n} · "${titulo}"` : `Slide ${n}`
      }
    } else {
      const slides = await this.roteiro(slug, e)
      rotulo = (n) => {
        const s = slides[n - 1] ?? {}
        const titulo = [semNegrito(s.titulo), semNegrito(s.subtitulo), semNegrito(s.concorrente)].filter(Boolean).join(" · ")
        return `Slide ${n} do roteiro · ${s.tipo ?? "slide"}${titulo ? ` "${titulo}"` : ""}`
      }
    }
    await this.planejamento.pedirAjuste(slug, id, textoDoAjuste({ titulo: e.titulo, comentarios: pendentes, rotulo, recortes }))
    const em = this.agora()
    const enviados = new Set(pendentes.map((c) => c.id))
    await this.gravar(slug, id, lista.map((c) => (enviados.has(c.id) ? { ...c, enviadoEm: em } : c)))
    return pendentes.length
  }
}
