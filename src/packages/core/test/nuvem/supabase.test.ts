import { afterAll, describe } from "vitest"
import { criarClienteSupabase, SupabaseArmazem, SupabaseRepositorio } from "../../src/nuvem/supabase"
import { contratoArmazem } from "./contrato-armazem"
import { contratoRepositorio } from "./contrato-repositorio"

/** Suíte viva: só roda com SUPABASE_TESTE_URL e SUPABASE_TESTE_SERVICE_ROLE_KEY no .env da raiz. */
describe.skipIf(!process.env.SUPABASE_TESTE_URL)("Supabase (integração)", () => {
  // O corpo do describe roda mesmo quando a suíte é pulada: o cliente só nasce quando alguém o pede.
  let instancia: ReturnType<typeof criarClienteSupabase> | null = null
  const cliente = () =>
    (instancia ??= criarClienteSupabase(
      process.env.SUPABASE_TESTE_URL ?? "",
      process.env.SUPABASE_TESTE_SERVICE_ROLE_KEY ?? "",
    ))

  contratoRepositorio("supabase", async () => new SupabaseRepositorio(cliente()))
  contratoArmazem("supabase", async () => new SupabaseArmazem(cliente()))

  /** Apaga linhas e objetos dos slugs `contrato-*`, só nos buckets planejamento-*. */
  afterAll(async () => {
    const c = cliente()
    const { data: prospects } = await c.from("prospects").select("slug").like("slug", "contrato-%")
    const slugs = (prospects ?? []).map((p) => p.slug as string)
    const { data: orfaos } = await c.from("arquivos_lixeira").select("slug").like("slug", "contrato-%")
    const todos = [...new Set([...slugs, ...(orfaos ?? []).map((o) => o.slug as string)])]
    for (const slug of todos) {
      await c.from("eventos_conversa").delete().eq("slug", slug)
      await c.from("comentarios").delete().eq("slug", slug)
      await c.from("uso_turnos").delete().eq("slug", slug)
      await c.from("arquivos").delete().eq("slug", slug)
      await c.from("arquivos_lixeira").delete().eq("slug", slug)
      await c.from("prospects").delete().eq("slug", slug)
      for (const bucket of ["planejamento-prospects", "planejamento-sessoes"]) {
        const { data: objetos } = await c.storage.from(bucket).list(slug, { limit: 1000 })
        const nomes = (objetos ?? []).map((o) => `${slug}/${o.name}`)
        if (nomes.length > 0) await c.storage.from(bucket).remove(nomes)
      }
    }
  })
})
