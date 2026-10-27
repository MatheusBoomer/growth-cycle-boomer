import { createHash } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Comentario } from "../comentarios"
import { ErroConflitoVersao, ErroNaoEncontrado, ErroProspectExistente } from "../erros"
import { ORDEM_ETAPAS, type Estado, type EtapaId, type EventoConversa } from "../tipos"
import type {
  ArmazemArquivos,
  EntradaManifesto,
  EstadoVersionado,
  RegistroUsoTurno,
  Repositorio,
} from "./tipos"

const BUCKET_PROSPECTS = "planejamento-prospects"
const BUCKET_SESSOES = "planejamento-sessoes"
/** Limite de linhas por resposta do PostgREST. */
const TAMANHO_PAGINA = 1000

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
function falha(erro: ErroDoCliente): Error {
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
async function paginar<T>(
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

  async criarProspect(slug: string): Promise<void> {
    const { error } = await this.cliente.from("prospects").insert({ slug })
    if (error) {
      if (error.code === "23505") throw new ErroProspectExistente(slug)
      throw falha(error)
    }
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
    const { error } = await this.cliente
      .from("eventos_conversa")
      .insert({ slug, etapa, evento, autor: null, em: evento.em })
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

  async registrarUso(r: RegistroUsoTurno): Promise<void> {
    const { error } = await this.cliente.from("uso_turnos").insert({
      slug: r.slug,
      etapa: r.etapa,
      autor: r.autor,
      custo_usd: r.custoUsd,
      tokens_entrada: r.tokensEntrada,
      tokens_saida: r.tokensSaida,
      inicio: r.inicio,
      fim: r.fim,
      status: r.status,
    })
    if (error) throw falha(error)
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

  async baixarSessao(slug: string, sessionId: string): Promise<Uint8Array | null> {
    const { data, error } = await this.cliente.storage.from(BUCKET_SESSOES).download(`${slug}/${sessionId}.jsonl`)
    if (error) {
      if (ehObjetoAusente(error)) return null
      throw falha(error)
    }
    return new Uint8Array(await data.arrayBuffer())
  }
}
