import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import path from "node:path"
import type { FsArmazenamento } from "./armazenamento"
import type { Barramento } from "./barramento"
import {
  aplicarAjuste,
  classificarBiblioteca,
  etapaBibliotecaValida,
  sanearAjustes,
  type AjustesBiblioteca,
  type EtapaBiblioteca,
  type ItemBiblioteca,
} from "./biblioteca"
import { etapaDoCatalogo, insumoDoCatalogo } from "./catalogo"
import { extrairOverrides, montarDossie, type AnteriorDossie } from "./dossie"
import {
  aprovarEntregavel,
  destinoAprovado,
  encontrarEntregavel,
  EXTENSAO_POR_TIPO,
  marcarEditado,
  pedirAjuste,
  proporEntregavel,
} from "./entregaveis"
import { ehErroDominio, ErroEntrada, ErroNaoEncontrado, ErroTurnoAtivo } from "./erros"
import { destinoInsumo, extensao, extensaoAceita, nomeSeguro, registrarInsumo } from "./insumos"
import * as me from "./maquina-estados"
import { criarConjunto, encontrarConjunto, lerPerguntas, responderConjunto } from "./perguntas"
import { mensagemAjuste, mensagemAprovacao, mensagemEtapaAnteriorAlterada, mensagemInsumoRecebido, mensagemRespostas } from "./prompts"
import { normalizarSlug } from "./slug"
import { importarStatusMd, renderStatusMd } from "./status-md"
import {
  ORDEM_ETAPAS,
  TIPOS_ENTREGAVEL,
  type Catalogo,
  type Estado,
  type EtapaId,
  type EventoConversa,
  type InsumoCatalogo,
  type ItemFila,
  type RespostaEstado,
  type ResultadoValidacao,
  type ResumoProspect,
  type TipoEntregavel,
} from "./tipos"
import type { Validar } from "./validador"

export const PASTA_MODELOS = ".claude/skills/_shared/modelos-insumo"
const CONTEXTO_PERSISTIDO = [
  "contexto/kickoff-transcricao.md",
  "contexto/contextualizacao-estrategica.md",
  "contexto/site-referencia.md",
]
const ARQUIVO_STATUS = "contexto/status-planejamento.md"
const ARQUIVO_BIBLIOTECA = ".app/biblioteca.json"

export interface DependenciasServico {
  armazenamento: FsArmazenamento
  catalogo: Catalogo
  barramento: Barramento
  validar: Validar
  agora?: () => string
  gerarId?: () => string
}

export interface ConexaoTurnos {
  aoEnfileirar: (slug: string) => void
  estaOcupado: (slug: string) => boolean
}

export interface RespostaFerramenta {
  ok: boolean
  mensagem: string
}

function campoTexto(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !valor.trim()) throw new ErroEntrada(`Campo obrigatório ausente: ${campo}`)
  return valor.trim()
}

function validarUrl(url: string): string {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    throw new ErroEntrada("Site inválido. Use o endereço completo, começando com https://")
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new ErroEntrada("Site inválido. Use o endereço completo, começando com https://")
  }
  return u.toString()
}

function ultimoIndice<T>(lista: T[], teste: (x: T) => boolean): number {
  for (let i = lista.length - 1; i >= 0; i--) if (teste(lista[i]!)) return i
  return -1
}

export class ServicoPlanejamento {
  private readonly arm: FsArmazenamento
  private readonly catalogo: Catalogo
  private readonly barramento: Barramento
  private readonly validar: Validar
  private readonly agora: () => string
  private readonly gerarId: () => string
  private readonly exclusoes = new Map<string, Promise<unknown>>()
  private turnos: ConexaoTurnos = { aoEnfileirar: () => {}, estaOcupado: () => false }

  constructor(d: DependenciasServico) {
    this.arm = d.armazenamento
    this.catalogo = d.catalogo
    this.barramento = d.barramento
    this.validar = d.validar
    this.agora = d.agora ?? (() => new Date().toISOString())
    this.gerarId = d.gerarId ?? (() => randomUUID())
  }

  conectarTurnos(conexao: ConexaoTurnos): void {
    this.turnos = conexao
  }

  // ---------- núcleo: um prospect por vez, estado sempre salvo junto com o status.md ----------

  /** Serializa operações por prospect (evita perder atualização do estado.json). */
  private exclusivo<T>(slug: string, fn: () => Promise<T>): Promise<T> {
    const anterior = this.exclusoes.get(slug) ?? Promise.resolve()
    const atual = anterior.then(fn, fn)
    this.exclusoes.set(
      slug,
      atual.catch(() => {}),
    )
    return atual
  }

  private async carregar(slug: string): Promise<Estado> {
    if (!(await this.arm.existe(slug))) throw new ErroNaoEncontrado(`Prospect "${slug}" não existe.`)
    const salvo = await this.arm.lerEstado(slug)
    if (salvo) return salvo
    const md = await this.arm.lerTexto(slug, ARQUIVO_STATUS)
    const claudeMd = await this.arm.lerTexto(slug, "CLAUDE.md")
    const titulo = claudeMd?.match(/^#\s+(.+)$/m)?.[1]?.trim()
    const nome = titulo && titulo !== "[Nome do Prospect]" ? titulo : slug
    const prospect = { slug, nome, site: null }
    let estado = md
      ? importarStatusMd(md, this.catalogo, prospect, this.agora())
      : me.estadoInicial(prospect, this.agora())
    estado = await this.detectarInsumosExistentes(slug, estado)
    await this.salvar(slug, estado)
    return estado
  }

  private async salvar(slug: string, estado: Estado): Promise<void> {
    await this.arm.gravarEstado(slug, estado)
    await this.arm.gravarTexto(slug, ARQUIVO_STATUS, renderStatusMd(estado, this.catalogo))
    this.barramento.publicar(slug, { tipo: "estado" })
  }

  private mutar<T>(slug: string, fn: (e: Estado) => Promise<{ estado: Estado; resultado: T }> | { estado: Estado; resultado: T }): Promise<T> {
    return this.exclusivo(slug, async () => {
      const { estado, resultado } = await fn(await this.carregar(slug))
      await this.salvar(slug, estado)
      return resultado
    })
  }

  private async detectarInsumosExistentes(slug: string, estado: Estado): Promise<Estado> {
    let novo = estado
    for (const etapa of this.catalogo.etapas) {
      if (novo.etapas[etapa.id].status === "concluida") continue
      for (const ref of etapa.insumos) {
        const insumo = insumoDoCatalogo(this.catalogo, ref.id)
        const arquivo = await this.encontrarNoDisco(slug, insumo)
        if (!arquivo) continue
        novo = registrarInsumo(
          novo,
          {
            etapa: etapa.id,
            insumoId: insumo.id,
            status: "valido",
            problemas: [],
            avisos: ["O arquivo já estava na pasta do prospect e não passou pela validação da interface."],
            resumo: null,
            arquivo,
          },
          this.agora(),
        )
      }
    }
    return novo
  }

  private async encontrarNoDisco(slug: string, insumo: InsumoCatalogo): Promise<string | null> {
    if (insumo.tipo === "link") {
      const texto = await this.arm.lerTexto(slug, insumo.destino)
      return texto && /\*\*Link:\*\*\s*https?:\/\//.test(texto) ? insumo.destino : null
    }
    if (insumo.destino.endsWith("/")) {
      return (await this.arm.listarArquivos(slug, insumo.destino)).length > 0 ? insumo.destino : null
    }
    for (const formato of insumo.formatos) {
      const rel = `${insumo.destino}${formato}`
      if (await this.arm.existeArquivo(slug, rel)) return rel
    }
    return null
  }

  private async gravarLink(slug: string, destino: string, url: string): Promise<void> {
    const atual = (await this.arm.lerTexto(slug, destino)) ?? "# Referência do E-commerce\n\n**Link:**\n"
    const novo = /\*\*Link:\*\*.*$/m.test(atual)
      ? atual.replace(/\*\*Link:\*\*.*$/m, `**Link:** ${url}`)
      : `${atual.trimEnd()}\n\n**Link:** ${url}\n`
    await this.arm.gravarTexto(slug, destino, novo)
  }

  // ---------- leitura ----------

  estado(slug: string): Promise<Estado> {
    return this.exclusivo(slug, () => this.carregar(slug))
  }

  async listarBiblioteca(slug: string): Promise<ItemBiblioteca[]> {
    const estado = await this.estado(slug)
    const [arquivos, ajustes] = await Promise.all([this.arm.listarImagensDoProspect(slug), this.lerAjustesBiblioteca(slug)])
    return classificarBiblioteca({ arquivos, estado, catalogo: this.catalogo, ajustes })
  }

  /** Etapa e título escolhidos pelo analista; o arquivo no disco não muda. */
  async ajustarBiblioteca(slug: string, caminho: string, mudanca: { etapa?: unknown; titulo?: unknown }): Promise<ItemBiblioteca> {
    const rel = this.arm.relativoAoProspect(slug, caminho)
    if (mudanca.etapa !== undefined && !etapaBibliotecaValida(mudanca.etapa)) {
      throw new ErroEntrada(`Etapa inválida: ${JSON.stringify(mudanca.etapa)}`)
    }
    if (mudanca.titulo !== undefined && typeof mudanca.titulo !== "string") throw new ErroEntrada("O título precisa ser texto.")
    if (!(await this.listarBiblioteca(slug)).some((i) => i.caminho === rel)) {
      throw new ErroNaoEncontrado(`Imagem não encontrada na biblioteca: ${rel}`)
    }
    await this.exclusivo(slug, async () => {
      const ajustes = aplicarAjuste(await this.lerAjustesBiblioteca(slug), rel, {
        etapa: mudanca.etapa as EtapaBiblioteca | undefined,
        titulo: mudanca.titulo as string | undefined,
      })
      const vivos: AjustesBiblioteca = {}
      for (const [k, v] of Object.entries(ajustes)) {
        if (await this.arm.existeArquivo(slug, k).catch(() => false)) vivos[k] = v
      }
      await this.arm.gravarTexto(slug, ARQUIVO_BIBLIOTECA, JSON.stringify(vivos, null, 2))
    })
    this.barramento.publicar(slug, { tipo: "estado" })
    const item = (await this.listarBiblioteca(slug)).find((i) => i.caminho === rel)
    if (!item) throw new ErroNaoEncontrado(`Imagem não encontrada na biblioteca: ${rel}`)
    return item
  }

  private async lerAjustesBiblioteca(slug: string): Promise<AjustesBiblioteca> {
    const texto = await this.arm.lerTexto(slug, ARQUIVO_BIBLIOTECA)
    if (!texto) return {}
    try {
      return sanearAjustes(JSON.parse(texto))
    } catch (e) {
      console.error(`${ARQUIVO_BIBLIOTECA} inválido em ${slug}; tratado como vazio.`, e)
      return {}
    }
  }

  async respostaEstado(slug: string, turnoAtivo: EtapaId | null): Promise<RespostaEstado> {
    const estado = await this.estado(slug)
    const condicoes = Object.fromEntries(
      ORDEM_ETAPAS.map((id) => [id, me.condicoesConcluir(estado, id, this.catalogo)]),
    ) as Record<EtapaId, string[]>
    const modelosDisponiveis = this.catalogo.insumos
      .filter((i) => i.modelo && existsSync(path.join(this.arm.raiz, PASTA_MODELOS, i.modelo)))
      .map((i) => i.id)
    const aprovadosPelaInterface = new Set(
      estado.entregaveis.filter((e) => e.status === "aprovado").map((e) => destinoAprovado(e)),
    )
    const aprovadosForaDaInterface = (await this.arm.listarAprovados(slug)).filter((a) => !aprovadosPelaInterface.has(a))
    return { estado, catalogo: this.catalogo, condicoes, turnoAtivo, modelosDisponiveis, aprovadosForaDaInterface }
  }

  async listarProspects(): Promise<ResumoProspect[]> {
    const resumos: ResumoProspect[] = []
    for (const slug of await this.arm.listarSlugs()) {
      try {
        resumos.push(this.resumir(await this.estado(slug)))
      } catch (e) {
        console.error(`Não consegui ler o prospect ${slug}:`, e)
      }
    }
    return resumos.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
  }

  private resumir(e: Estado): ResumoProspect {
    const prioridades = [["em_andamento", "pronta"], ["desatualizada"], ["liberada"]]
    let atual: EtapaId | null = null
    for (const grupo of prioridades) {
      atual = ORDEM_ETAPAS.find((id) => grupo.includes(e.etapas[id].status)) ?? null
      if (atual) break
    }
    return {
      slug: e.prospect.slug,
      nome: e.prospect.nome,
      etapaAtual: atual,
      rotuloEtapaAtual: atual ? etapaDoCatalogo(this.catalogo, atual).rotuloStatus : "Planejamento concluído",
      concluidas: ORDEM_ETAPAS.filter((id) => id !== "final" && e.etapas[id].status === "concluida").length,
      totalEtapas: ORDEM_ETAPAS.length - 1,
      pendencias: e.entregaveis.filter((x) => x.status === "pendente").length,
      atualizadoEm: e.atualizadoEm,
    }
  }

  async dossie(slug: string, etapa: EtapaId): Promise<string> {
    const estado = await this.estado(slug)
    const anteriores: AnteriorDossie[] = []
    for (const id of ORDEM_ETAPAS.slice(0, ORDEM_ETAPAS.indexOf(etapa))) {
      const ee = estado.etapas[id]
      if (ee.status !== "concluida" && ee.status !== "desatualizada") continue
      const cat = etapaDoCatalogo(this.catalogo, id)
      const resumo =
        ee.resumoDecisoes ?? (cat.skill ? await this.arm.lerTexto(slug, `contexto/decisoes/${cat.skill}.md`) : null)
      anteriores.push({ rotulo: cat.rotuloStatus, origem: ee.origem, resumo, desatualizada: ee.status === "desatualizada" })
    }
    const contextoPersistido: string[] = []
    for (const c of CONTEXTO_PERSISTIDO) if (await this.arm.existeArquivo(slug, c)) contextoPersistido.push(c)
    const insumosRecebidos = estado.insumos
      .filter((i) => i.etapa === etapa && i.status === "valido" && i.arquivo)
      .map((i) => ({ nome: insumoDoCatalogo(this.catalogo, i.insumoId).nome, arquivo: i.arquivo! }))
    return montarDossie({
      nome: estado.prospect.nome,
      slug,
      site: estado.prospect.site,
      anteriores,
      aprovados: await this.arm.listarAprovados(slug),
      overrides: extrairOverrides(await this.arm.lerTexto(slug, "CLAUDE.md")),
      contextoPersistido,
      insumosRecebidos,
    })
  }

  // ---------- prospects ----------

  async criarProspect(nome: string, site: string | null): Promise<string> {
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) throw new ErroEntrada("Informe o nome do prospect.")
    const slug = normalizarSlug(nomeLimpo)
    if (!slug) throw new ErroEntrada("O nome precisa ter pelo menos uma letra ou número.")
    if (slug === "template") throw new ErroEntrada("Esse nome é reservado. Escolha outro.")
    const siteLimpo = site ? validarUrl(site) : null
    await this.arm.criarPasta(slug)
    const claudeMd = await this.arm.lerTexto(slug, "CLAUDE.md")
    if (claudeMd) await this.arm.gravarTexto(slug, "CLAUDE.md", claudeMd.replace("# [Nome do Prospect]", `# ${nomeLimpo}`))
    return this.exclusivo(slug, async () => {
      let estado = me.estadoInicial({ slug, nome: nomeLimpo, site: siteLimpo }, this.agora())
      if (siteLimpo) {
        await this.gravarLink(slug, "contexto/site-referencia.md", siteLimpo)
        estado = registrarInsumo(
          estado,
          { etapa: "01", insumoId: "site", status: "valido", problemas: [], avisos: [], resumo: siteLimpo, arquivo: "contexto/site-referencia.md" },
          this.agora(),
        )
      }
      await this.salvar(slug, estado)
      return slug
    })
  }

  async excluirProspect(slug: string, confirmacao: string): Promise<void> {
    if (confirmacao.trim() !== slug) {
      throw new ErroEntrada("Digite o nome da pasta exatamente como aparece para confirmar.")
    }
    if (this.turnos.estaOcupado(slug)) throw new ErroTurnoAtivo()
    await this.exclusivo(slug, () => this.arm.excluir(slug))
    this.exclusoes.delete(slug)
  }

  // ---------- etapas ----------

  async iniciarEtapa(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.iniciarEtapa(e, etapa, this.agora()), resultado: undefined }))
    await this.registrarConversa(slug, etapa, {
      tipo: "aviso",
      nivel: "info",
      texto: "Etapa iniciada. O agente recebeu o dossiê das etapas anteriores.",
      em: this.agora(),
    })
  }

  async registrarMensagemAnalista(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.registrarMensagemAnalista(e, etapa, this.agora()), resultado: undefined }))
  }

  async definirSessao(slug: string, etapa: EtapaId, sessionId: string): Promise<void> {
    await this.mutar(slug, (e) => ({
      estado: e.etapas[etapa].sessionId === sessionId ? e : me.comEtapa(e, etapa, { sessionId }, this.agora()),
      resultado: undefined,
    }))
  }

  async concluirEtapa(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, async (e) => {
      const novo = me.concluirEtapa(e, etapa, this.catalogo, this.agora())
      const cat = etapaDoCatalogo(this.catalogo, etapa)
      const resumo = novo.etapas[etapa].resumoDecisoes
      if (resumo && cat.skill) {
        await this.arm.gravarTexto(slug, `contexto/decisoes/${cat.skill}.md`, `# Decisões da etapa ${cat.rotuloStatus}\n\n${resumo.trim()}\n`)
      }
      return { estado: novo, resultado: undefined }
    })
  }

  async reabrirEtapa(slug: string, etapa: EtapaId): Promise<void> {
    const afetadas = await this.mutar(slug, (e) => {
      const r = me.reabrirEtapa(e, etapa, this.agora())
      return { estado: r.estado, resultado: r.afetadasEmAndamento }
    })
    const rotulo = etapaDoCatalogo(this.catalogo, etapa).rotuloStatus
    for (const outra of afetadas) {
      await this.registrarConversa(slug, outra, {
        tipo: "aviso",
        nivel: "alerta",
        texto: `A etapa ${rotulo} foi reaberta. O que for aprovado lá pode mudar as bases desta etapa.`,
        em: this.agora(),
      })
      await this.enfileirar(slug, outra, mensagemEtapaAnteriorAlterada(rotulo))
    }
  }

  async confirmarValida(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.confirmarValida(e, etapa, this.agora()), resultado: undefined }))
  }

  async revisarEtapa(slug: string, etapa: EtapaId): Promise<void> {
    await this.mutar(slug, (e) => ({ estado: me.revisarEtapa(e, etapa, this.agora()), resultado: undefined }))
  }

  // ---------- entregáveis ----------

  async aprovarEntregavel(slug: string, id: string): Promise<void> {
    const aprovado = await this.mutar(slug, async (e) => {
      const alvo = encontrarEntregavel(e, id)
      let novo = aprovarEntregavel(e, id, this.agora())
      const destino = destinoAprovado(alvo)
      await this.arm.copiar(slug, alvo.arquivoRascunho, destino)
      novo = me.reavaliarPronta(novo, alvo.etapa, this.catalogo, this.agora())
      return { estado: novo, resultado: { ...alvo, destino } }
    })
    await this.enfileirar(
      slug,
      aprovado.etapa,
      mensagemAprovacao(aprovado.titulo, aprovado.nomeFinal, `clientes/${slug}/${aprovado.destino}`, aprovado.editadoEm !== undefined),
    )
  }

  /** O analista corrige a seção pendente direto no visualizador; o texto vale como a proposta. */
  async editarEntregavel(slug: string, id: string, conteudo: unknown): Promise<void> {
    if (typeof conteudo !== "string" || !conteudo.trim()) throw new ErroEntrada("O texto não pode ficar vazio.")
    await this.mutar(slug, async (e) => {
      const novo = marcarEditado(e, id, this.agora())
      await this.arm.gravarTexto(slug, encontrarEntregavel(e, id).arquivoRascunho, conteudo)
      return { estado: novo, resultado: undefined }
    })
  }

  /** `imagem`: PNG do gráfico com as marcações numeradas do analista; a IA abre o caminho com Read. */
  async pedirAjuste(slug: string, id: string, texto: string, imagem?: Uint8Array): Promise<void> {
    const alvo = await this.mutar(slug, (e) => {
      const entregavel = encontrarEntregavel(e, id)
      let novo = pedirAjuste(e, id, texto, this.agora())
      novo = me.registrarMensagemAnalista(novo, entregavel.etapa, this.agora())
      return { estado: novo, resultado: entregavel }
    })
    let caminhoImagem: string | undefined
    if (imagem) {
      const pasta = `.app/ajustes/${id}`
      const rel = `${pasta}/ajuste-${(await this.arm.listarArquivos(slug, pasta)).length + 1}.png`
      await this.arm.gravarBinario(slug, rel, imagem)
      caminhoImagem = `clientes/${slug}/${rel}`
    }
    await this.enfileirar(slug, alvo.etapa, mensagemAjuste(alvo.titulo, alvo.nomeFinal, texto.trim(), caminhoImagem))
  }

  async responderPerguntas(slug: string, id: string, respostas: unknown): Promise<void> {
    const conjunto = await this.mutar(slug, (e) => {
      let novo = responderConjunto(e, id, respostas, this.agora())
      const alvo = encontrarConjunto(novo, id)
      novo = me.registrarMensagemAnalista(novo, alvo.etapa, this.agora())
      return { estado: novo, resultado: alvo }
    })
    await this.enfileirar(slug, conjunto.etapa, mensagemRespostas(conjunto))
  }

  // ---------- insumos e anexos ----------

  private insumoDaEtapa(etapa: EtapaId, insumoId: string): InsumoCatalogo {
    const cat = etapaDoCatalogo(this.catalogo, etapa)
    if (!cat.insumos.some((r) => r.id === insumoId)) {
      throw new ErroEntrada(
        `O insumo "${insumoId}" não pertence a esta etapa. Ids válidos aqui: ${cat.insumos.map((r) => r.id).join(", ") || "nenhum"}.`,
      )
    }
    return insumoDoCatalogo(this.catalogo, insumoId)
  }

  async receberInsumoArquivo(
    slug: string,
    etapa: EtapaId,
    insumoId: string,
    arquivoTemp: string,
    nomeOriginal: string,
  ): Promise<ResultadoValidacao> {
    const insumo = this.insumoDaEtapa(etapa, insumoId)
    if (insumo.tipo !== "arquivo") throw new ErroEntrada("Este insumo é um link, não um arquivo.")
    let resultado: ResultadoValidacao
    if (!extensaoAceita(insumo, nomeOriginal)) {
      resultado = { ok: false, problemas: [`Formato não aceito. Envie ${insumo.formatos.join(" ou ")}.`], avisos: [], resumo: null }
    } else if (insumo.validador) {
      resultado = await this.validar({ insumoId, arquivoAbs: arquivoTemp })
    } else {
      resultado = { ok: true, problemas: [], avisos: [], resumo: nomeOriginal }
    }
    let destino: string | null = null
    if (resultado.ok) {
      destino = destinoInsumo(insumo, nomeOriginal)
      await this.arm.moverParaDentro(slug, arquivoTemp, destino)
    } else {
      await rm(arquivoTemp, { force: true })
    }
    await this.registrarResultadoInsumo(slug, etapa, insumo, resultado, destino)
    return resultado
  }

  async receberInsumoLink(slug: string, etapa: EtapaId, insumoId: string, url: string): Promise<ResultadoValidacao> {
    const insumo = this.insumoDaEtapa(etapa, insumoId)
    if (insumo.tipo !== "link") throw new ErroEntrada("Este insumo é um arquivo, não um link.")
    const limpo = validarUrl(url)
    await this.gravarLink(slug, insumo.destino, limpo)
    const resultado: ResultadoValidacao = { ok: true, problemas: [], avisos: [], resumo: limpo }
    await this.registrarResultadoInsumo(slug, etapa, insumo, resultado, insumo.destino)
    return resultado
  }

  /** Desfaz um envio errado: o arquivo vai para a lixeira do sistema e o registro sai do estado. */
  async removerInsumo(slug: string, etapa: EtapaId, insumoId: string): Promise<void> {
    const insumo = this.insumoDaEtapa(etapa, insumoId)
    if (insumo.tipo !== "arquivo") throw new ErroEntrada("Links não são excluídos: salve o link certo por cima.")
    if (this.turnos.estaOcupado(slug)) throw new ErroTurnoAtivo()
    const atual = await this.estado(slug)
    const status = atual.etapas[etapa].status
    if (status === "concluida" || status === "desatualizada") {
      throw new ErroEntrada("Reabra a etapa para excluir um arquivo dela.")
    }
    const registro = atual.insumos.find((i) => i.etapa === etapa && i.insumoId === insumoId)
    if (!registro) throw new ErroNaoEncontrado(`Nenhum arquivo enviado para "${insumo.nome}".`)
    // Primeiro o disco: o estado relê arquivos presentes na pasta como insumos válidos.
    if (registro.arquivo) await this.arm.moverParaLixeiraNoProspect(slug, registro.arquivo)
    await this.mutar(slug, (e) => {
      const semRegistro: Estado = {
        ...e,
        insumos: e.insumos.filter((i) => !(i.etapa === etapa && i.insumoId === insumoId)),
        atualizadoEm: this.agora(),
      }
      return { estado: me.reavaliarPronta(semRegistro, etapa, this.catalogo, this.agora()), resultado: undefined }
    })
  }

  private async registrarResultadoInsumo(
    slug: string,
    etapa: EtapaId,
    insumo: InsumoCatalogo,
    resultado: ResultadoValidacao,
    destino: string | null,
  ): Promise<void> {
    const emAndamento = await this.mutar(slug, (e) => {
      let novo = registrarInsumo(
        e,
        {
          etapa,
          insumoId: insumo.id,
          status: resultado.ok ? "valido" : "invalido",
          problemas: resultado.problemas,
          avisos: resultado.avisos,
          resumo: resultado.resumo,
          arquivo: destino,
        },
        this.agora(),
      )
      novo = me.reavaliarPronta(novo, etapa, this.catalogo, this.agora())
      const s = novo.etapas[etapa].status
      return { estado: novo, resultado: s === "em_andamento" || s === "pronta" }
    })
    if (resultado.ok && destino && emAndamento) {
      await this.enfileirar(slug, etapa, mensagemInsumoRecebido(insumo.nome, `clientes/${slug}/${destino}`, resultado.resumo))
    }
  }

  async salvarAnexo(slug: string, etapa: EtapaId, nomeOriginal: string, dados: Uint8Array): Promise<string> {
    const rel = `.app/anexos/${etapa}/${Date.now()}-${nomeSeguro(nomeOriginal)}`
    await this.arm.gravarBinario(slug, rel, dados)
    // A biblioteca aberta recarrega com o anexo novo.
    this.barramento.publicar(slug, { tipo: "estado" })
    return `clientes/${slug}/${rel}`
  }

  // ---------- conversa e fila automática ----------

  async registrarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    await this.arm.anexarConversa(slug, etapa, evento)
    this.barramento.publicar(slug, { tipo: "conversa", etapa, evento })
  }

  async conversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]> {
    const eventos = await this.arm.lerConversa(slug, etapa)
    const inicio = ultimoIndice(eventos, (e) => e.tipo === "turno_inicio")
    const fim = ultimoIndice(eventos, (e) => e.tipo === "turno_fim")
    if (inicio > fim && !this.turnos.estaOcupado(slug)) {
      const interrompido: EventoConversa = {
        tipo: "turno_fim",
        status: "interrompido",
        detalhe: "O app foi fechado ou o processo parou antes de o agente terminar.",
        em: this.agora(),
      }
      await this.arm.anexarConversa(slug, etapa, interrompido)
      eventos.push(interrompido)
    }
    return eventos
  }

  async enfileirar(slug: string, etapa: EtapaId, texto: string): Promise<void> {
    await this.mutar(slug, (e) => ({
      estado: { ...e, filaAutomatica: [...e.filaAutomatica, { etapa, texto }], atualizadoEm: this.agora() },
      resultado: undefined,
    }))
    this.turnos.aoEnfileirar(slug)
  }

  /** Tira da fila tudo o que é da primeira etapa com pendência e junta numa mensagem só. */
  async retirarFila(slug: string): Promise<ItemFila | null> {
    return this.mutar(slug, (e) => {
      const primeiro = e.filaAutomatica[0]
      if (!primeiro) return { estado: e, resultado: null }
      const daEtapa = e.filaAutomatica.filter((i) => i.etapa === primeiro.etapa)
      const resto = e.filaAutomatica.filter((i) => i.etapa !== primeiro.etapa)
      return {
        estado: { ...e, filaAutomatica: resto, atualizadoEm: this.agora() },
        resultado: { etapa: primeiro.etapa, texto: daEtapa.map((i) => i.texto).join("\n\n") },
      }
    })
  }

  // ---------- ferramentas do MCP "planejamento" ----------

  async ferramenta(ctx: { slug: string; etapa: EtapaId }, nome: string, entrada: unknown): Promise<RespostaFerramenta> {
    try {
      const dados = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>
      if (nome === "propor_entregavel") return await this.ferramentaPropor(ctx.slug, ctx.etapa, dados)
      if (nome === "solicitar_insumo") return await this.ferramentaSolicitar(ctx.slug, ctx.etapa, dados)
      if (nome === "fazer_perguntas") return await this.ferramentaPerguntar(ctx.slug, ctx.etapa, dados)
      if (nome === "sinalizar_etapa_pronta") return await this.ferramentaSinalizar(ctx.slug, ctx.etapa, dados)
      return { ok: false, mensagem: `Ferramenta desconhecida: ${nome}` }
    } catch (e) {
      if (ehErroDominio(e)) return { ok: false, mensagem: e.message }
      throw e
    }
  }

  private async ferramentaPropor(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const tipo = campoTexto(d.tipo, "tipo") as TipoEntregavel
    const titulo = campoTexto(d.titulo, "titulo")
    const arquivo = campoTexto(d.arquivo_rascunho, "arquivo_rascunho")
    const nomeFinal = campoTexto(d.nome_final, "nome_final")
    if (!TIPOS_ENTREGAVEL.includes(tipo)) {
      throw new ErroEntrada(`tipo "${tipo}" inválido. Use um de: ${TIPOS_ENTREGAVEL.join(", ")}.`)
    }
    const rel = this.arm.relativoAoProspect(slug, arquivo)
    if (!rel.startsWith(".app/rascunhos/")) {
      throw new ErroEntrada(`Salve o arquivo em clientes/${slug}/.app/rascunhos/ antes de propor (recebido: ${arquivo}).`)
    }
    if (!(await this.arm.existeArquivo(slug, rel))) {
      throw new ErroEntrada(`Arquivo não encontrado: clientes/${slug}/${rel}. Gere o arquivo antes de propor.`)
    }
    const ext = extensao(rel)
    if (ext !== EXTENSAO_POR_TIPO[tipo]) {
      throw new ErroEntrada(`Um entregável do tipo "${tipo}" precisa ser ${EXTENSAO_POR_TIPO[tipo]} (recebido: ${ext || "sem extensão"}).`)
    }
    const id = this.gerarId()
    const copia = `.app/propostas/${id}${ext}`
    await this.mutar(slug, async (e) => {
      const novo = proporEntregavel(e, { etapa, tipo, titulo, arquivoRascunho: copia, nomeFinal }, id, this.agora())
      await this.arm.copiar(slug, rel, copia)
      return { estado: me.reavaliarPronta(novo, etapa, this.catalogo, this.agora()), resultado: undefined }
    })
    await this.registrarConversa(slug, etapa, { tipo: "card_entregavel", entregavelId: id, em: this.agora() })
    return {
      ok: true,
      mensagem: `Entregável "${titulo}" enviado para aprovação (id ${id}). Encerre sua resposta agora e aguarde: a decisão do analista chega como nova mensagem.`,
    }
  }

  private async ferramentaSolicitar(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const insumo = this.insumoDaEtapa(etapa, campoTexto(d.insumo_id, "insumo_id"))
    await this.registrarConversa(slug, etapa, { tipo: "card_insumo", insumoId: insumo.id, em: this.agora() })
    return {
      ok: true,
      mensagem: `Pedido de "${insumo.nome}" mostrado ao analista, com o modelo para baixar quando houver. Aguarde: quando o arquivo passar na validação você recebe uma mensagem com o caminho.`,
    }
  }

  private async ferramentaPerguntar(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const perguntas = lerPerguntas(d.perguntas)
    const id = this.gerarId()
    await this.mutar(slug, (e) => ({ estado: criarConjunto(e, etapa, perguntas, id, this.agora()), resultado: undefined }))
    await this.registrarConversa(slug, etapa, { tipo: "card_perguntas", conjuntoId: id, em: this.agora() })
    return {
      ok: true,
      mensagem: `Perguntas mostradas ao analista (id ${id}). Encerre sua resposta agora e aguarde: as respostas chegam como nova mensagem.`,
    }
  }

  private async ferramentaSinalizar(slug: string, etapa: EtapaId, d: Record<string, unknown>): Promise<RespostaFerramenta> {
    const resumoDecisoes = campoTexto(d.resumo_decisoes, "resumo_decisoes")
    const handoff = campoTexto(d.handoff_proxima, "handoff_proxima")
    const faltando = await this.mutar(slug, (e) => {
      const r = me.sinalizarPronta(e, etapa, { resumoDecisoes, handoff }, this.catalogo, this.agora())
      return { estado: r.estado, resultado: r.faltando }
    })
    if (faltando.length > 0) {
      return {
        ok: true,
        mensagem: `Sinal registrado, mas a etapa ainda não pode ser concluída. Falta: ${faltando.join("; ")}. Aprovações e envios dependem do analista: avise o que falta em uma frase e encerre.`,
      }
    }
    await this.registrarConversa(slug, etapa, {
      tipo: "aviso",
      nivel: "info",
      texto: "O agente terminou o trabalho desta etapa. Confira os entregáveis e clique em Concluir etapa.",
      em: this.agora(),
    })
    return { ok: true, mensagem: "Etapa pronta para conclusão. Faça um fechamento curto para o analista e encerre." }
  }
}
