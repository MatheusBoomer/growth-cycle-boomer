import { destinoAprovado } from "./entregaveis"
import { ORDEM_ETAPAS, type Catalogo, type Entregavel, type Estado, type EtapaId } from "./tipos"

export const SEM_ETAPA = "sem-etapa"
export type EtapaBiblioteca = EtapaId | typeof SEM_ETAPA
export const ORDEM_BIBLIOTECA: readonly EtapaBiblioteca[] = [...ORDEM_ETAPAS, SEM_ETAPA]

export type OrigemImagem = "aprovado" | "proposta" | "substituido" | "anexo" | "insumo" | "benchmark" | "previa"
export type GrupoImagem = { tipo: "anuncio"; marca: string } | { tipo: "previa" }

export interface ItemBiblioteca {
  /** = caminho: estável entre recargas. */
  id: string
  /** Relativo à pasta do prospect; num grupo (anúncio, prévia), a pasta do grupo. */
  caminho: string
  origem: OrigemImagem
  etapa: EtapaBiblioteca
  titulo: string
  nomeArquivo: string
  grupo?: GrupoImagem
  /** Uma imagem num item simples; todas as do grupo, capa primeiro. */
  imagens: string[]
  capa: string
  modificadoEm: string
}

export interface AjusteBiblioteca {
  etapa?: EtapaBiblioteca
  titulo?: string
}
export type AjustesBiblioteca = Record<string, AjusteBiblioteca>

export interface ArquivoBiblioteca {
  caminho: string
  modificadoEm: string
}

const IMAGEM = /\.(png|jpe?g|webp|gif)$/i
const BENCHMARK = /^dados\/benchmark-meta\/([^/]+)\/midia\/([^/]+)\/[^/]+$/
const PREVIA = /^\.app\/previas\/([^/]+)\/slide-\d+\.png$/i

export function ehImagem(caminho: string): boolean {
  return IMAGEM.test(caminho)
}

export function etapaBibliotecaValida(v: unknown): v is EtapaBiblioteca {
  return typeof v === "string" && (ORDEM_BIBLIOTECA as readonly string[]).includes(v)
}

const nomeDe = (caminho: string) => caminho.split("/").pop() ?? caminho

/** "1728830000000-print_ads.png" → "Print ads". O prefixo numérico longo é o carimbo de hora do anexo. */
export function tituloLegivel(nomeArquivo: string): string {
  const limpo = nomeArquivo
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{10,}-/, "")
    .replace(/[-_]+/g, " ")
    .trim()
  if (!limpo) return nomeArquivo
  return limpo.charAt(0).toUpperCase() + limpo.slice(1)
}

function maisRecente(arquivos: ArquivoBiblioteca[]): string {
  return arquivos.reduce((max, a) => (a.modificadoEm > max ? a.modificadoEm : max), arquivos[0]!.modificadoEm)
}

function pastasDeInsumoComImagem(catalogo: Catalogo): { pasta: string; etapa: EtapaBiblioteca }[] {
  return catalogo.insumos
    .filter((i) => i.tipo === "arquivo" && i.destino.endsWith("/") && i.formatos.some((f) => ehImagem(`x${f}`)))
    .map((i) => ({ pasta: i.destino, etapa: catalogo.etapas.find((e) => e.insumos.some((r) => r.id === i.id))?.id ?? SEM_ETAPA }))
}

export function classificarBiblioteca({
  arquivos,
  estado,
  catalogo,
  ajustes,
}: {
  arquivos: ArquivoBiblioteca[]
  estado: Estado
  catalogo: Catalogo
  ajustes: AjustesBiblioteca
}): ItemBiblioteca[] {
  const aprovados = new Map<string, Entregavel>()
  const porProposta = new Map<string, Entregavel>()
  for (const e of estado.entregaveis) {
    porProposta.set(e.arquivoRascunho, e)
    if (e.status === "aprovado") aprovados.set(destinoAprovado(e), e)
  }
  const pastasInsumo = pastasDeInsumoComImagem(catalogo)
  const itens: ItemBiblioteca[] = []
  const anuncios = new Map<string, { marca: string; anuncio: string; arquivos: ArquivoBiblioteca[] }>()
  const previas = new Map<string, ArquivoBiblioteca[]>()

  for (const a of arquivos) {
    const c = a.caminho
    if (!ehImagem(c) || c.startsWith(".app/rascunhos/") || c.startsWith(".app/comentarios/")) continue
    const nome = nomeDe(c)
    const simples = (origem: OrigemImagem, etapa: EtapaBiblioteca, titulo?: string) =>
      itens.push({ id: c, caminho: c, origem, etapa, titulo: titulo ?? tituloLegivel(nome), nomeArquivo: nome, imagens: [c], capa: c, modificadoEm: a.modificadoEm })

    const anuncio = BENCHMARK.exec(c)
    const previa = PREVIA.exec(c)
    if (c.startsWith("entrega/ativos-aprovados/")) {
      const e = aprovados.get(c)
      simples("aprovado", e?.etapa ?? SEM_ETAPA, e?.titulo)
    } else if (c.startsWith(".app/propostas/")) {
      const e = porProposta.get(c)
      // A cópia aprovada já aparece em ativos-aprovados/.
      if (!e || e.status === "aprovado") continue
      simples(e.status === "pendente" ? "proposta" : "substituido", e.etapa, e.titulo)
    } else if (c.startsWith(".app/anexos/")) {
      const partes = c.split("/")
      const pasta = partes.length === 4 ? partes[2]! : ""
      simples("anexo", (ORDEM_ETAPAS as readonly string[]).includes(pasta) ? (pasta as EtapaId) : SEM_ETAPA)
    } else if (anuncio) {
      const [, marca, id] = anuncio
      const pasta = `dados/benchmark-meta/${marca}/midia/${id}`
      const grupo = anuncios.get(pasta) ?? { marca: marca!, anuncio: id!, arquivos: [] }
      grupo.arquivos.push(a)
      anuncios.set(pasta, grupo)
    } else if (previa) {
      const id = previa[1]!
      previas.set(id, [...(previas.get(id) ?? []), a])
    } else {
      const insumo = pastasInsumo.find((p) => c.startsWith(p.pasta))
      if (insumo) simples("insumo", insumo.etapa)
    }
  }

  for (const [pasta, g] of anuncios) {
    const ordenadas = g.arquivos.map((x) => x.caminho).sort()
    const capa = ordenadas.find((x) => nomeDe(x).toLowerCase().includes("capa")) ?? ordenadas[0]!
    itens.push({
      id: pasta,
      caminho: pasta,
      origem: "benchmark",
      etapa: "07",
      titulo: `${g.marca} · anúncio ${g.anuncio}`,
      nomeArquivo: g.anuncio,
      grupo: { tipo: "anuncio", marca: g.marca },
      imagens: [capa, ...ordenadas.filter((x) => x !== capa)],
      capa,
      modificadoEm: maisRecente(g.arquivos),
    })
  }

  const apresentacao = estado.entregaveis
    .filter((e) => e.tipo === "apresentacao" && previas.has(e.id))
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))[0]
  if (apresentacao) {
    const slides = previas.get(apresentacao.id)!
    const imagens = slides.map((x) => x.caminho).sort()
    const pasta = `.app/previas/${apresentacao.id}`
    itens.push({
      id: pasta,
      caminho: pasta,
      origem: "previa",
      etapa: "final",
      titulo: `Apresentação, prévia (${imagens.length} ${imagens.length === 1 ? "slide" : "slides"})`,
      nomeArquivo: apresentacao.id,
      grupo: { tipo: "previa" },
      imagens,
      capa: imagens[0]!,
      modificadoEm: maisRecente(slides),
    })
  }

  const ordem = (e: EtapaBiblioteca) => ORDEM_BIBLIOTECA.indexOf(e)
  return itens
    .map((i) => {
      const aj = ajustes[i.caminho]
      if (!aj) return i
      return { ...i, ...(aj.etapa ? { etapa: aj.etapa } : {}), ...(aj.titulo ? { titulo: aj.titulo } : {}) }
    })
    .sort(
      (a, b) =>
        ordem(a.etapa) - ordem(b.etapa) ||
        (a.modificadoEm < b.modificadoEm ? 1 : a.modificadoEm > b.modificadoEm ? -1 : 0) ||
        (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0),
    )
}

/** Título vazio apaga o título do ajuste (volta ao automático); ajuste sem nada sai do mapa. */
export function aplicarAjuste(ajustes: AjustesBiblioteca, caminho: string, mudanca: AjusteBiblioteca): AjustesBiblioteca {
  const atual: AjusteBiblioteca = { ...ajustes[caminho] }
  if (mudanca.etapa !== undefined) atual.etapa = mudanca.etapa
  if (mudanca.titulo !== undefined) {
    const titulo = mudanca.titulo.trim()
    if (titulo) atual.titulo = titulo
    else delete atual.titulo
  }
  const novo = { ...ajustes }
  if (atual.etapa === undefined && atual.titulo === undefined) delete novo[caminho]
  else novo[caminho] = atual
  return novo
}

/** O biblioteca.json é editável à mão: o que não tiver a forma esperada é descartado. */
export function sanearAjustes(bruto: unknown): AjustesBiblioteca {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {}
  const ajustes: AjustesBiblioteca = {}
  for (const [caminho, valor] of Object.entries(bruto)) {
    if (!valor || typeof valor !== "object") continue
    const { etapa, titulo } = valor as Record<string, unknown>
    const ajuste: AjusteBiblioteca = {}
    if (etapaBibliotecaValida(etapa)) ajuste.etapa = etapa
    if (typeof titulo === "string" && titulo.trim()) ajuste.titulo = titulo.trim()
    if (ajuste.etapa !== undefined || ajuste.titulo !== undefined) ajustes[caminho] = ajuste
  }
  return ajustes
}
