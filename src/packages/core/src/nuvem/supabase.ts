import { createHash } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Comentario } from "../comentarios"
import { ErroConflitoVersao, ErroNaoEncontrado, ErroProspectExistente } from "../erros"
import type { Acumulado, LinhaPresenca, LinhaUso } from "../metricas/tipos"
import type { NivelEsforco } from "../modelos"
import { ORDEM_ETAPAS, type Estado, type EtapaId, type EventoConversa } from "../tipos"
import type {
  ArmazemArquivos,
  EntradaManifesto,
  EstadoVersionado,
  LinhaConfigModelo,
  RegistroUsoTurno,
  Repositorio,
} from "./tipos"

const BUCKET_PROSPECTS = "planejamento-prospects"
const BUCKET_SESSOES = "planejamento-sessoes"
/** Limite de linhas por resposta do PostgREST. */
const TAMANHO_PAGINA = 1000
/** Objetos por página de `storage.list`. */
const PAGINA_STORAGE = 1000
/** Caminhos por chamada de `storage.remove`. */
const LOTE_REMOCAO = 100

interface ErroDoCliente {
  message: string
  code?: string
  status?: number
  statusCode?: string | number
}

/** Cliente de serviço do planejamento: schema próprio e sem sessão guardada. */
export function criarClienteSupabase(url: string, chaveServico: string): SupabaseClient {
  return createClient(url, chaveServico, {
    db: { schema: "planejamento" },
    auth: { persistSession: false, autoRefreshToken: false },
    // O tipo padrão assume o schema "public"; as consultas daqui só usam nomes de tabela do planejamento.
  }) as unknown as SupabaseClient
}

/** Mensagem do Supabase sem endereços nem tokens que possam ter vindo no texto. */
function mensagemLimpa(erro: ErroDoCliente): string {
  return (erro.message || "erro desconhecido")
    .replace(/https?:\/\/\S+/gi, "[endereço omitido]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[chave omitida]")
}

/** Toda falha do cliente vira Error com a mensagem do Supabase, sem a URL nem a chave. */
export function falha(erro: ErroDoCliente): Error {
  return new Error(mensagemLimpa(erro))
}

function ehObjetoAusente(erro: ErroDoCliente): boolean {
  return (
    erro.status === 404 ||
    String(erro.statusCode ?? "") === "404" ||
    /not.?found/i.test(erro.message ?? "")
  )
}

/** Lê uma tabela de 1000 em 1000 linhas, até a página vir incompleta. */
export async function paginar<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroDoCliente | null }>,
): Promise<T[]> {
  const todas: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1)
    if (error) throw falha(error)
    const pagina = data ?? []
    todas.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) return todas
  }
}

interface LinhaUsoBanco {
  slug: string
  etapa: EtapaId
  autor: string | null
  sessao: string | null
  custo_usd: number | string | null
  custo_turno_usd: number | string | null
  modelos: Record<string, number> | null
  inicio: string
  fim: string
}

interface LinhaPresencaBanco {
  slug: string
  email: string
  etapa: EtapaId
  em: string
  visivel: boolean
  segundos_sem_interacao: number
}

interface LinhaConfigModeloBanco {
  etapa: EtapaId
  alvo: string
  modelo: string | null
  esforco: string | null
  alterado_por: string | null
  alterado_em: string | null
}

/** O PostgREST pode devolver `numeric` como texto; nulo continua nulo. */
function numeroOuNulo(v: number | string | null | undefined): number | null {
  return v == null ? null : Number(v)
}

/** Primeira etapa que ainda não foi concluída, ou null quando todas foram. */
function etapaAtualDe(estado: Estado): EtapaId | null {
  return ORDEM_ETAPAS.find((id) => estado.etapas[id].status !== "concluida") ?? null
}

/** Repositório no Postgres do Supabase (schema planejamento). */
export class SupabaseRepositorio implements Repositorio {
  constructor(
    private readonly cliente: SupabaseClient,
    private readonly agora: () => string = () => new Date().toISOString(),
  ) {}

  async listarSlugs(): Promise<string[]> {
    const linhas = await paginar<{ slug: string }>((de, ate) =>
      this.cliente.from("prospects").select("slug").is("excluido_em", null).order("slug").range(de, ate),
    )
    return linhas.map((l) => l.slug).sort()
  }

  async existe(slug: string): Promise<boolean> {
    const { data, error } = await this.cliente
      .from("prospects")
      .select("slug")
      .eq("slug", slug)
      .is("excluido_em", null)
      .maybeSingle()
    if (error) throw falha(error)
    return !!data
  }

  async criarProspect(slug: string, criadoPor: string | null = null): Promise<void> {
    const { error } = await this.cliente
      .from("prospects")
      .insert(criadoPor ? { slug, criado_por: criadoPor } : { slug })
    if (!error) return
    if (error.code !== "23505") throw falha(error)
    await this.recriarExcluido(slug, criadoPor)
  }

  /**
   * O slug já tem linha: se está ativo, é duplicado; se foi excluído, os dados do antigo saem (filhos antes
   * do prospect, por causa das chaves estrangeiras) e a linha volta a ser nova. O reset só vale enquanto a linha
   * continua excluída: se outro criador chegou antes, zero linhas atualizadas viram ErroProspectExistente.
   * Resta uma janela pequena: um segundo criador pode apagar filhos recém-gravados pelo primeiro.
   */
  private async recriarExcluido(slug: string, criadoPor: string | null): Promise<void> {
    const { data, error } = await this.cliente
      .from("prospects")
      .select("excluido_em")
      .eq("slug", slug)
      .maybeSingle()
    if (error) throw falha(error)
    if (!data || data.excluido_em == null) throw new ErroProspectExistente(slug)

    for (const tabela of ["eventos_conversa", "comentarios", "uso_turnos", "presenca", "arquivos", "arquivos_lixeira"]) {
      const { error: erroApagar } = await this.cliente.from(tabela).delete().eq("slug", slug)
      if (erroApagar) throw falha(erroApagar)
    }

    const agora = this.agora()
    const { data: atualizadas, error: erroReset } = await this.cliente
      .from("prospects")
      .update({
        nome: null,
        estado: null,
        etapa_atual: null,
        versao: 0,
        sincronizacao_pendente: false,
        excluido_em: null,
        criado_em: agora,
        atualizado_em: agora,
        criado_por: criadoPor,
      })
      .eq("slug", slug)
      .not("excluido_em", "is", null)
      .select("slug")
    if (erroReset) throw falha(erroReset)
    if (!atualizadas || atualizadas.length === 0) throw new ErroProspectExistente(slug)
  }

  async excluirProspect(slug: string): Promise<void> {
    const { data, error } = await this.cliente
      .from("prospects")
      .update({ excluido_em: this.agora() })
      .eq("slug", slug)
      .is("excluido_em", null)
      .select("slug")
    if (error) throw falha(error)
    if (!data || data.length === 0) throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
  }

  async lerDono(slug: string): Promise<string | null> {
    const { data, error } = await this.cliente
      .from("prospects")
      .select("criado_por")
      .eq("slug", slug)
      .is("excluido_em", null)
      .maybeSingle()
    if (error) throw falha(error)
    if (!data) throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
    return (data.criado_por as string | null) ?? null
  }

  async listarDonos(): Promise<Map<string, string | null>> {
    const linhas = await paginar<{ slug: string; criado_por: string | null }>((de, ate) =>
      this.cliente.from("prospects").select("slug, criado_por").is("excluido_em", null).order("slug").range(de, ate),
    )
    return new Map(linhas.map((l) => [l.slug, l.criado_por ?? null]))
  }

  async trocarDono(slug: string, email: string): Promise<void> {
    const { data, error } = await this.cliente
      .from("prospects")
      .update({ criado_por: email })
      .eq("slug", slug)
      .is("excluido_em", null)
      .select("slug")
    if (error) throw falha(error)
    if (!data || data.length === 0) throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
  }

  async lerEstado(slug: string): Promise<EstadoVersionado | null> {
    const { data, error } = await this.cliente
      .from("prospects")
      .select("estado, versao")
      .eq("slug", slug)
      .maybeSingle()
    if (error) throw falha(error)
    if (!data || data.estado == null) return null
    return { estado: data.estado as Estado, versao: Number(data.versao) }
  }

  async gravarEstado(slug: string, estado: Estado, versaoLida: number): Promise<number> {
    const nova = versaoLida + 1
    const { data, error } = await this.cliente
      .from("prospects")
      .update({
        estado,
        nome: estado.prospect.nome,
        etapa_atual: etapaAtualDe(estado),
        versao: nova,
        atualizado_em: this.agora(),
      })
      .eq("slug", slug)
      .eq("versao", versaoLida)
      .is("excluido_em", null)
      .select("versao")
    if (error) throw falha(error)
    if (data && data.length > 0) return nova
    // Nenhuma linha atualizada: o prospect não existe (ou foi excluído) ou a versão mudou por fora.
    if (!(await this.existe(slug))) throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
    throw new ErroConflitoVersao(slug)
  }

  async anexarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void> {
    const autor = evento.tipo === "mensagem_analista" ? (evento.autor ?? null) : null
    const { error } = await this.cliente.from("eventos_conversa").insert({ slug, etapa, evento, autor, em: evento.em })
    if (error) {
      if (error.code === "23503") throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
      throw falha(error)
    }
  }

  async lerConversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]> {
    const linhas = await paginar<{ evento: EventoConversa }>((de, ate) =>
      this.cliente
        .from("eventos_conversa")
        .select("evento")
        .eq("slug", slug)
        .eq("etapa", etapa)
        .order("id")
        .range(de, ate),
    )
    return linhas.map((l) => l.evento)
  }

  async lerComentarios(slug: string, entregavelId: string): Promise<Comentario[]> {
    const { data, error } = await this.cliente
      .from("comentarios")
      .select("lista")
      .eq("slug", slug)
      .eq("entregavel_id", entregavelId)
      .maybeSingle()
    if (error) throw falha(error)
    return (data?.lista as Comentario[] | undefined) ?? []
  }

  async gravarComentarios(slug: string, entregavelId: string, lista: Comentario[]): Promise<void> {
    const { error } = await this.cliente
      .from("comentarios")
      .upsert(
        { slug, entregavel_id: entregavelId, lista, atualizado_em: this.agora() },
        { onConflict: "slug,entregavel_id" },
      )
    if (error) {
      if (error.code === "23503") throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
      throw falha(error)
    }
  }

  async limparConversasEComentarios(slug: string): Promise<void> {
    for (const tabela of ["eventos_conversa", "comentarios"]) {
      const { error } = await this.cliente.from(tabela).delete().eq("slug", slug)
      if (error) throw falha(error)
    }
  }

  async registrarUso(r: RegistroUsoTurno): Promise<void> {
    const { error } = await this.cliente.from("uso_turnos").insert({
      slug: r.slug,
      etapa: r.etapa,
      autor: r.autor,
      sessao: r.sessao,
      custo_usd: r.custoUsd,
      custo_turno_usd: r.custoTurnoUsd,
      modelos: r.modelos,
      modelos_acumulado: r.modelosAcumulado,
      esforco: r.esforco,
      tokens_entrada: r.tokensEntrada,
      tokens_saida: r.tokensSaida,
      inicio: r.inicio,
      fim: r.fim,
      status: r.status,
    })
    if (error) throw falha(error)
  }

  async ultimoUsoDaSessao(slug: string, sessao: string): Promise<Acumulado | null> {
    const { data, error } = await this.cliente
      .from("uso_turnos")
      .select("custo_usd, modelos_acumulado")
      .eq("slug", slug)
      .eq("sessao", sessao)
      .order("fim", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw falha(error)
    if (!data) return null
    return {
      custoUsd: numeroOuNulo(data.custo_usd),
      modelos: (data.modelos_acumulado as Record<string, number> | null) ?? null,
    }
  }

  async ultimoUsoAntigo(slug: string, etapa: EtapaId): Promise<Acumulado | null> {
    const { data, error } = await this.cliente
      .from("uso_turnos")
      .select("custo_usd")
      .eq("slug", slug)
      .eq("etapa", etapa)
      .is("sessao", null)
      .is("custo_turno_usd", null)
      .order("fim", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw falha(error)
    if (!data) return null
    return { custoUsd: numeroOuNulo(data.custo_usd), modelos: null }
  }

  async listarUsos(slug?: string, ativosLidos?: ReadonlySet<string>): Promise<LinhaUso[]> {
    const ativos = slug ? null : (ativosLidos ?? new Set(await this.listarSlugs()))
    const linhas = await paginar<LinhaUsoBanco>((de, ate) => {
      let consulta = this.cliente
        .from("uso_turnos")
        .select("slug, etapa, autor, sessao, custo_usd, custo_turno_usd, modelos, inicio, fim")
      if (slug) consulta = consulta.eq("slug", slug)
      return consulta.order("id").range(de, ate)
    })
    return linhas
      .filter((l) => !ativos || ativos.has(l.slug))
      .map((l) => ({
        slug: l.slug,
        etapa: l.etapa,
        autor: l.autor,
        sessao: l.sessao,
        custoUsd: numeroOuNulo(l.custo_usd),
        custoTurnoUsd: numeroOuNulo(l.custo_turno_usd),
        modelos: l.modelos,
        inicio: new Date(l.inicio).toISOString(),
        fim: new Date(l.fim).toISOString(),
      }))
  }

  async registrarPresenca(p: Omit<LinhaPresenca, "em">): Promise<void> {
    const { error } = await this.cliente.from("presenca").insert({
      slug: p.slug,
      email: p.email,
      etapa: p.etapa,
      visivel: p.visivel,
      segundos_sem_interacao: p.segundosSemInteracao,
    })
    if (error) throw falha(error)
  }

  async listarPresencas(slug?: string, ativosLidos?: ReadonlySet<string>): Promise<LinhaPresenca[]> {
    const ativos = slug ? null : (ativosLidos ?? new Set(await this.listarSlugs()))
    const linhas = await paginar<LinhaPresencaBanco>((de, ate) => {
      let consulta = this.cliente
        .from("presenca")
        .select("slug, email, etapa, em, visivel, segundos_sem_interacao")
      if (slug) consulta = consulta.eq("slug", slug)
      return consulta.order("em").order("id").range(de, ate)
    })
    return linhas
      .filter((l) => !ativos || ativos.has(l.slug))
      .map((l) => ({
        slug: l.slug,
        email: l.email,
        etapa: l.etapa,
        em: new Date(l.em).toISOString(),
        visivel: l.visivel,
        segundosSemInteracao: l.segundos_sem_interacao,
      }))
  }

  async marcarSincronizacao(slug: string, pendente: boolean): Promise<void> {
    const { data, error } = await this.cliente
      .from("prospects")
      .update({ sincronizacao_pendente: pendente })
      .eq("slug", slug)
      .is("excluido_em", null)
      .select("slug")
    if (error) throw falha(error)
    if (!data || data.length === 0) throw new ErroNaoEncontrado(`Prospect "${slug}" não encontrado.`)
  }

  async lerConfigModelos(): Promise<LinhaConfigModelo[]> {
    const linhas = await paginar<LinhaConfigModeloBanco>((de, ate) =>
      this.cliente
        .from("config_modelos")
        .select("etapa, alvo, modelo, esforco, alterado_por, alterado_em")
        .order("etapa")
        .order("alvo")
        .range(de, ate),
    )
    return linhas.map((l) => ({
      etapa: l.etapa,
      alvo: l.alvo,
      modelo: l.modelo,
      esforco: l.esforco,
      alteradoPor: l.alterado_por,
      alteradoEm: l.alterado_em ? new Date(l.alterado_em).toISOString() : null,
    }))
  }

  async gravarConfigModelo(l: {
    etapa: EtapaId
    alvo: string
    modelo: string | null
    esforco: NivelEsforco | null
    alteradoPor: string
  }): Promise<void> {
    if (l.modelo === null && l.esforco === null) {
      const { error } = await this.cliente.from("config_modelos").delete().eq("etapa", l.etapa).eq("alvo", l.alvo)
      if (error) throw falha(error)
      return
    }
    const { error } = await this.cliente.from("config_modelos").upsert(
      {
        etapa: l.etapa,
        alvo: l.alvo,
        modelo: l.modelo,
        esforco: l.esforco,
        alterado_por: l.alteradoPor,
        alterado_em: this.agora(),
      },
      { onConflict: "etapa,alvo" },
    )
    if (error) throw falha(error)
  }
}

/** Arquivos no Storage (objetos por conteúdo) com manifesto na tabela `arquivos`. */
export class SupabaseArmazem implements ArmazemArquivos {
  constructor(private readonly cliente: SupabaseClient) {}

  async listarManifesto(slug: string): Promise<EntradaManifesto[]> {
    const linhas = await paginar<{ caminho: string; sha256: string; tamanho: number | string }>((de, ate) =>
      this.cliente
        .from("arquivos")
        .select("caminho, sha256, tamanho")
        .eq("slug", slug)
        .order("caminho")
        .range(de, ate),
    )
    return linhas
      .map((l) => ({ caminho: l.caminho, sha256: l.sha256, tamanho: Number(l.tamanho) }))
      .sort((a, b) => (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0))
  }

  async enviar(slug: string, caminho: string, dados: Uint8Array): Promise<EntradaManifesto> {
    const sha256 = createHash("sha256").update(dados).digest("hex")
    const { error: erroObjeto } = await this.cliente.storage
      .from(BUCKET_PROSPECTS)
      .upload(`${slug}/${sha256}`, dados, { upsert: true, contentType: "application/octet-stream" })
    if (erroObjeto) throw falha(erroObjeto)
    const entrada: EntradaManifesto = { caminho, sha256, tamanho: dados.byteLength }
    const { error } = await this.cliente
      .from("arquivos")
      .upsert(
        { slug, caminho, sha256, tamanho: entrada.tamanho, atualizado_em: new Date().toISOString() },
        { onConflict: "slug,caminho" },
      )
    if (error) throw falha(error)
    return entrada
  }

  async baixar(slug: string, sha256: string): Promise<Uint8Array> {
    const { data, error } = await this.cliente.storage.from(BUCKET_PROSPECTS).download(`${slug}/${sha256}`)
    if (error) {
      if (ehObjetoAusente(error)) throw new ErroNaoEncontrado(`Objeto ${sha256} não encontrado para "${slug}".`)
      throw falha(error)
    }
    return new Uint8Array(await data.arrayBuffer())
  }

  async remover(slug: string, caminho: string): Promise<void> {
    const { data, error } = await this.cliente
      .from("arquivos")
      .select("caminho, sha256, tamanho")
      .eq("slug", slug)
      .eq("caminho", caminho)
      .maybeSingle()
    if (error) throw falha(error)
    if (!data) return
    const { error: erroLixeira } = await this.cliente
      .from("arquivos_lixeira")
      .insert({ slug, caminho, sha256: data.sha256 })
    if (erroLixeira) throw falha(erroLixeira)
    const { error: erroApagar } = await this.cliente.from("arquivos").delete().eq("slug", slug).eq("caminho", caminho)
    if (erroApagar) throw falha(erroApagar)
  }

  async enviarSessao(slug: string, sessionId: string, dados: Uint8Array): Promise<void> {
    const { error } = await this.cliente.storage
      .from(BUCKET_SESSOES)
      .upload(`${slug}/${sessionId}.jsonl`, dados, { upsert: true, contentType: "application/octet-stream" })
    if (error) throw falha(error)
  }

  async apagarTudo(slug: string): Promise<void> {
    // Linhas antes dos objetos: se a remoção no Storage falhar no meio, sobra objeto solto (que a próxima
    // chamada limpa), nunca manifesto apontando para objeto que já não existe.
    for (const tabela of ["arquivos", "arquivos_lixeira"]) {
      const { error } = await this.cliente.from(tabela).delete().eq("slug", slug)
      if (error) throw falha(error)
    }
    for (const bucket of [BUCKET_PROSPECTS, BUCKET_SESSOES]) {
      await this.apagarPasta(bucket, slug)
    }
  }

  /** Lista a pasta inteira antes de remover (remover durante a paginação deslocaria o offset). */
  private async apagarPasta(bucket: string, slug: string): Promise<void> {
    const caminhos: string[] = []
    for (let offset = 0; ; offset += PAGINA_STORAGE) {
      const { data, error } = await this.cliente.storage
        .from(bucket)
        .list(slug, { limit: PAGINA_STORAGE, offset })
      if (error) throw falha(error)
      const pagina = data ?? []
      for (const objeto of pagina) caminhos.push(`${slug}/${objeto.name}`)
      if (pagina.length < PAGINA_STORAGE) break
    }
    for (let i = 0; i < caminhos.length; i += LOTE_REMOCAO) {
      const { error } = await this.cliente.storage.from(bucket).remove(caminhos.slice(i, i + LOTE_REMOCAO))
      if (error) throw falha(error)
    }
  }

  async baixarSessao(slug: string, sessionId: string): Promise<Uint8Array | null> {
    const { data, error } = await this.cliente.storage.from(BUCKET_SESSOES).download(`${slug}/${sessionId}.jsonl`)
    if (error) {
      if (ehObjetoAusente(error)) return null
      throw falha(error)
    }
    return new Uint8Array(await data.arrayBuffer())
  }
}
