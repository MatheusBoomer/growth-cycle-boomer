import { afterAll, describe, expect, it } from "vitest"
import { ErroProspectExistente } from "../../src/erros"
import { criarClienteSupabase, SupabaseArmazem, SupabaseRepositorio } from "../../src/nuvem/supabase"
import type { ArmazemArquivos, EntradaManifesto } from "../../src/nuvem/tipos"
import type { ImagemReport } from "../../src/reports"
import { SupabaseUsuarios } from "../../src/nuvem/usuarios-supabase"
import { contratoArmazem } from "./contrato-armazem"
import { contratoRepositorio } from "./contrato-repositorio"
import { contratoUsuarios } from "./contrato-usuarios"
import { ehAlvoDeContrato, ehEmailDeContrato, ehItemDeContrato, ehSlugDeContrato, PREFIXO_CONTRATO, suiteVivaHabilitada } from "./suite-viva"

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
  enviarImagemReport(caminho: string, imagem: ImagemReport) {
    return this.armazem.enviarImagemReport(caminho, imagem)
  }
  baixarImagemReport(caminho: string) {
    return this.armazem.baixarImagemReport(caminho)
  }
  apagarImagensReport(id: number) {
    return this.armazem.apagarImagensReport(id)
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

  // Com a chave pública (anon) do projeto de teste: nem a tabela nem o bucket dos reports podem ser lidos. Pega uma
  // migração futura que dê grant a anon/authenticated ou torne o bucket público. Sem a chave, o caso é pulado.
  it.skipIf(!process.env.SUPABASE_TESTE_PUBLISHABLE_KEY)("anon não lê reports nem as imagens do bucket", async () => {
    const id = 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000)
    const caminho = `${id}/0.png`
    const { error: erroEnvio } = await cliente()
      .storage.from("planejamento-reports")
      .upload(caminho, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { contentType: "image/png" })
    expect(erroEnvio).toBeNull()
    try {
      const anon = criarClienteSupabase(process.env.SUPABASE_TESTE_URL ?? "", process.env.SUPABASE_TESTE_PUBLISHABLE_KEY ?? "")
      const tabela = await anon.from("reports").select("id").limit(1)
      expect(tabela.error !== null || (tabela.data ?? []).length === 0).toBe(true)
      const baixar = await anon.storage.from("planejamento-reports").download(caminho)
      expect(baixar.error).not.toBeNull()
      const listar = await anon.storage.from("planejamento-reports").list(String(id))
      expect(listar.error !== null || (listar.data ?? []).length === 0).toBe(true)
    } finally {
      await cliente().storage.from("planejamento-reports").remove([caminho])
    }
  })

  contratoUsuarios("supabase", async (agora) => ({
    repo: new SupabaseUsuarios(cliente(), agora),
    semearAdmin: async (email) => {
      const { error } = await cliente().from("usuarios").upsert({ email, papel: "admin" }, { onConflict: "email" })
      if (error) throw new Error(error.message)
    },
  }))

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
      for (const tabela of ["eventos_conversa", "comentarios", "uso_turnos", "presenca", "arquivos", "arquivos_lixeira", "prospects"]) {
        const { error } = await c.from(tabela).delete().eq("slug", slug)
        registrar(`apagar ${tabela}`, error)
      }
    }

    // Usuários criados pelos contratos: só o formato exato de novoEmail, nunca o admin real nem outra pessoa.
    const { data: usuarios, error: erroUsuarios } = await c
      .from("usuarios")
      .select("email")
      .like("email", `${PREFIXO_CONTRATO}%@teste.invalid`)
    registrar("ler usuarios", erroUsuarios)
    for (const linha of usuarios ?? []) {
      if (!ehEmailDeContrato(String(linha.email))) continue
      const { error } = await c.from("usuarios").delete().eq("email", linha.email)
      registrar("apagar usuarios", error)
    }

    // Configurações de modelo gravadas pelo contrato: só o formato exato de novoAlvoDeContrato, nunca uma real.
    const { data: configs, error: erroConfigs } = await c
      .from("config_modelos")
      .select("etapa, alvo")
      .like("alvo", `${PREFIXO_CONTRATO}%`)
    registrar("ler config_modelos", erroConfigs)
    for (const linha of configs ?? []) {
      if (!ehAlvoDeContrato(String(linha.alvo))) continue
      const { error } = await c.from("config_modelos").delete().eq("etapa", linha.etapa).eq("alvo", linha.alvo)
      registrar("apagar config_modelos", error)
    }

    // Notas das skills criadas pelo contrato: só itens no formato exato de novoItemDeContrato, nunca uma nota real.
    const { data: notas, error: erroNotas } = await c
      .from("notas_skills")
      .select("id, item")
      .like("item", `${PREFIXO_CONTRATO}%`)
    registrar("ler notas_skills", erroNotas)
    for (const linha of notas ?? []) {
      if (!ehItemDeContrato(String(linha.item))) continue
      const { error } = await c.from("notas_skills").delete().eq("id", linha.id)
      registrar("apagar notas_skills", error)
    }

    // Reports do contrato: só os de autor no formato exato de novoEmail, nunca um report real. As pastas de imagem do
    // contrato do armazém usam ids a partir de 1.000.000.000, que um report real não alcança.
    const { data: reports, error: erroReports } = await c.from("reports").select("id, autor")
    registrar("ler reports", erroReports)
    const pastasReport = new Set<string>()
    for (const linha of reports ?? []) {
      if (!ehEmailDeContrato(String(linha.autor))) continue
      pastasReport.add(String(linha.id))
      const { error } = await c.from("reports").delete().eq("id", linha.id)
      registrar("apagar reports", error)
    }
    const { data: raizReports, error: erroRaizReports } = await c.storage.from("planejamento-reports").list("", { limit: 1000 })
    registrar("listar planejamento-reports", erroRaizReports)
    for (const o of raizReports ?? []) if (/^\d+$/.test(o.name) && Number(o.name) >= 1_000_000_000) pastasReport.add(o.name)
    for (const pasta of pastasReport) {
      const { data: objetos, error: erroPasta } = await c.storage.from("planejamento-reports").list(pasta, { limit: 1000 })
      registrar(`listar planejamento-reports/${pasta}`, erroPasta)
      const nomes = (objetos ?? []).map((o) => `${pasta}/${o.name}`)
      if (nomes.length === 0) continue
      const { error } = await c.storage.from("planejamento-reports").remove(nomes)
      registrar(`remover em planejamento-reports/${pasta}`, error)
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
