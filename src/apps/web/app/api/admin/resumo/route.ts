import { STATUS_PADRAO } from "@/lib/filtro-reports"
import { json, respostaDeErro } from "@/lib/http"
import type { ResumoAdmin } from "@/lib/resumo-admin"
import { servidor } from "@/lib/servidor"
import { exigirAdmin } from "@/lib/sessao"

export const dynamic = "force-dynamic"

/** Número que não deu para ler vira null: o selo some, a tela não quebra. */
async function talvez<T>(ler: () => Promise<T>): Promise<T | null> {
  try {
    return await ler()
  } catch (e) {
    console.error(`Falha ao montar o resumo do admin: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

/**
 * Só admin: os números dos selos do cabeçalho e da aba Reports. Reports "abertos" são os que a aba mostra ao abrir
 * (aberto e em andamento). Sem a nuvem (modo fs) pessoas, notas e reports não existem e vêm null.
 */
export async function GET() {
  try {
    await exigirAdmin()
    const { servico, catalogo, usuarios } = servidor()
    const [pessoas, notas, reports] = await Promise.all([
      usuarios ? talvez(() => usuarios.listar()) : null,
      usuarios ? talvez(() => servico.contagemNotasAbertas()) : null,
      usuarios ? talvez(() => servico.listarReports({ status: STATUS_PADRAO })) : null,
    ])
    const resumo: ResumoAdmin = {
      pessoas: pessoas?.length ?? null,
      admins: pessoas ? pessoas.filter((p) => p.papel === "admin").length : null,
      etapas: catalogo.etapas.length,
      notasAbertas: notas ? Object.values(notas).reduce((a, n) => a + n, 0) : null,
      reportsAbertos: reports?.length ?? null,
    }
    return json(resumo)
  } catch (e) {
    return respostaDeErro(e)
  }
}
