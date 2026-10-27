import { afterAll, describe } from "vitest"
import { ErroProspectExistente } from "../../src/erros"
import { criarClienteSupabase, SupabaseArmazem, SupabaseRepositorio } from "../../src/nuvem/supabase"
import type { ArmazemArquivos, EntradaManifesto } from "../../src/nuvem/tipos"
import { contratoArmazem } from "./contrato-armazem"
import { contratoRepositorio } from "./contrato-repositorio"
import { ehSlugDeContrato, PREFIXO_CONTRATO, suiteVivaHabilitada } from "./suite-viva"

const BUCKETS = ["planejamento-prospects", "planejamento-sessoes"]

/**
 * Só para a suíte viva: `arquivos.slug` tem chave estrangeira para `prospects`, e o contrato do armazém
 * não cria prospect. O envio garante a linha antes (ignorando a que já existe).
 */
class ArmazemComProspect implements ArmazemArquivos {
  constructor(
    private readonly armazem: SupabaseArmazem,
    private readonly repo: SupabaseRepositorio,
  ) {}

  private async garantirProspect(slug: string): Promise<void> {
    try {
      await this.repo.criarProspect(slug)
    } catch (e) {
      if (!(e instanceof ErroProspectExistente)) throw e
    }
  }

  listarManifesto(slug: string) {
    return this.armazem.listarManifesto(slug)
  }
  async enviar(slug: string, caminho: string, dados: Uint8Array): Promise<EntradaManifesto> {
    await this.garantirProspect(slug)
    return this.armazem.enviar(slug, caminho, dados)
  }
  baixar(slug: string, sha256: string) {
    return this.armazem.baixar(slug, sha256)
  }
  remover(slug: string, caminho: string) {
    return this.armazem.remover(slug, caminho)
  }
  enviarSessao(slug: string, sessionId: string, dados: Uint8Array) {
    return this.armazem.enviarSessao(slug, sessionId, dados)
  }
  baixarSessao(slug: string, sessionId: string) {
    return this.armazem.baixarSessao(slug, sessionId)
  }
  apagarTudo(slug: string) {
    return this.armazem.apagarTudo(slug)
  }
}

/** Suíte viva: só roda com SUPABASE_TESTE_URL e SUPABASE_TESTE_SERVICE_ROLE_KEY no .env da raiz. */
describe.skipIf(!suiteVivaHabilitada(process.env))("Supabase (integração)", () => {
  // O corpo do describe roda mesmo quando a suíte é pulada: o cliente só nasce quando alguém o pede.
  let instancia: ReturnType<typeof criarClienteSupabase> | null = null
  const cliente = () =>
    (instancia ??= criarClienteSupabase(
      process.env.SUPABASE_TESTE_URL ?? "",
      process.env.SUPABASE_TESTE_SERVICE_ROLE_KEY ?? "",
    ))

  contratoRepositorio("supabase", async () => new SupabaseRepositorio(cliente()), async (_repo, slug) => {
    const { data, error } = await cliente().from("prospects").select("criado_por").eq("slug", slug).single()
    if (error) throw new Error(error.message)
    return (data?.criado_por as string | null) ?? null
  })
  contratoArmazem(
    "supabase",
    async () => new ArmazemComProspect(new SupabaseArmazem(cliente()), new SupabaseRepositorio(cliente())),
  )

  /**
   * Apaga linhas e objetos dos slugs gerados pelos contratos (formato exato de novoSlug, nunca só o prefixo:
   * um prospect real "Contrato X" vira contrato-x), só no schema planejamento e nos buckets planejamento-*.
   */
  afterAll(async () => {
    const c = cliente()
    const falhas: string[] = []
    const registrar = (onde: string, erro: { message: string } | null) => {
      if (erro) falhas.push(`${onde}: ${erro.message.replace(/https?:\/\/\S+/gi, "[endereço omitido]")}`)
    }

    const slugs = new Set<string>()
    for (const tabela of ["prospects", "arquivos_lixeira"]) {
      const { data, error } = await c.from(tabela).select("slug").like("slug", `${PREFIXO_CONTRATO}%`)
      registrar(`ler ${tabela}`, error)
      for (const linha of data ?? []) if (ehSlugDeContrato(String(linha.slug))) slugs.add(String(linha.slug))
    }

    for (const slug of slugs) {
      for (const tabela of ["eventos_conversa", "comentarios", "uso_turnos", "arquivos", "arquivos_lixeira", "prospects"]) {
        const { error } = await c.from(tabela).delete().eq("slug", slug)
        registrar(`apagar ${tabela}`, error)
      }
    }

    // Objetos sem linha no banco também vazam: a busca parte da raiz de cada bucket.
    for (const bucket of BUCKETS) {
      const { data: raiz, error: erroRaiz } = await c.storage
        .from(bucket)
        .list("", { search: PREFIXO_CONTRATO, limit: 1000 })
      registrar(`listar ${bucket}`, erroRaiz)
      const pastas = new Set((raiz ?? []).map((o) => o.name).filter(ehSlugDeContrato))
      for (const slug of slugs) pastas.add(slug)
      for (const pasta of pastas) {
        const { data: objetos, error: erroPasta } = await c.storage.from(bucket).list(pasta, { limit: 1000 })
        registrar(`listar ${bucket}/${pasta}`, erroPasta)
        const nomes = (objetos ?? []).map((o) => `${pasta}/${o.name}`)
        if (nomes.length === 0) continue
        const { error } = await c.storage.from(bucket).remove(nomes)
        registrar(`remover em ${bucket}/${pasta}`, error)
      }
    }

    if (falhas.length > 0) throw new Error(`Limpeza da suíte viva falhou:\n${falhas.join("\n")}`)
  })
})
