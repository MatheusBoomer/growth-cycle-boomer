/**
 * Verificação de saúde do provedor de nuvem. Livre para qualquer host (o proxy deixa passar este caminho exato,
 * só GET e HEAD) e por isso não lê sessão, dados nem variável de ambiente: responde apenas que o processo está de pé.
 */
export const dynamic = "force-dynamic"

const CABECALHOS = { "cache-control": "no-store" }

export async function GET() {
  return Response.json({ ok: true }, { headers: CABECALHOS })
}

export async function HEAD() {
  return new Response(null, { status: 200, headers: { ...CABECALHOS, "content-type": "application/json" } })
}
