import { NextResponse, type NextRequest } from "next/server"
import { decidirAcesso, dominiosPermitidos, modoDeAutenticacao } from "@workspace/core/autenticacao"
import { clienteSupabaseDoServidor, usuarioDeClaims } from "@/lib/sessao"

const MENSAGEM_ORIGEM_RECUSADA = "Requisição recusada: só a própria interface local pode chamar esta API."
const MENSAGEM_NAO_AUTENTICADO = "Você precisa entrar para continuar."

type CookieParaGravar = { name: string; value: string; options: Record<string, unknown> }

/** Host de PLANEJAMENTO_APP_URL (o endereço público), ou null se não há ou não é uma URL. */
function hostPublico(env: Record<string, string | undefined>): string | null {
  const valor = (env.PLANEJAMENTO_APP_URL ?? "").trim()
  if (valor === "") return null
  try {
    return new URL(valor).host
  } catch {
    return null
  }
}

/**
 * Origem para montar redirecionamentos. Sai do cabeçalho Host (já validado pela decisão de acesso) e não de
 * `request.nextUrl`, que troca 127.0.0.1 por localhost e mandaria o analista para outra origem, sem os cookies.
 * Atrás do balanceador da Railway o protocolo vem em x-forwarded-proto.
 */
function origemDaRequisicao(request: NextRequest): string {
  const encaminhado = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase()
  const protocolo = encaminhado === "http" || encaminhado === "https" ? encaminhado : request.nextUrl.protocol.replace(":", "")
  return `${protocolo}://${request.headers.get("host") ?? request.nextUrl.host}`
}

/** Confere a sessão (getClaims valida a assinatura e renova o token). Qualquer falha vale como sem sessão. */
async function sessaoValida(
  request: NextRequest,
  env: Record<string, string | undefined>,
  gravados: CookieParaGravar[],
  cabecalhos: Record<string, string>,
): Promise<boolean> {
  const supabase = clienteSupabaseDoServidor(
    {
      getAll: () => request.cookies.getAll(),
      setAll: (aGravar, headers) => {
        gravados.push(...aGravar)
        Object.assign(cabecalhos, headers)
        // A renovação também vale para esta mesma requisição, para os Server Components verem a sessão nova.
        for (const { name, value } of aGravar) request.cookies.set(name, value)
      },
    },
    env,
  )
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data) return false
    return usuarioDeClaims(data.claims, dominiosPermitidos(env.PLANEJAMENTO_DOMINIOS_PERMITIDOS)) !== null
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const env = process.env
  const modo = modoDeAutenticacao(env)
  const caminho = request.nextUrl.pathname + request.nextUrl.search
  const entrada = {
    modo,
    metodo: request.method,
    caminho,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    hostPublico: modo === "google" ? hostPublico(env) : null,
    autenticado: false,
  }

  // Primeiro sem sessão: só consulta o Supabase quando a decisão depende de saber quem é.
  let decisao = decidirAcesso(entrada)
  const gravados: CookieParaGravar[] = []
  const cabecalhos: Record<string, string> = {}
  if (modo === "google" && (decisao.tipo === "login" || decisao.tipo === "nao_autenticado")) {
    if (await sessaoValida(request, env, gravados, cabecalhos)) decisao = decidirAcesso({ ...entrada, autenticado: true })
  }

  let resposta: NextResponse
  switch (decisao.tipo) {
    case "passar":
      resposta = NextResponse.next({ request })
      break
    case "login": {
      const destino = new URL("/login", origemDaRequisicao(request))
      destino.searchParams.set("proximo", decisao.proximo)
      resposta = NextResponse.redirect(destino)
      break
    }
    case "nao_autenticado":
      resposta = NextResponse.json({ erro: MENSAGEM_NAO_AUTENTICADO, codigo: "nao_autenticado" }, { status: 401 })
      break
    case "recusar":
      resposta = NextResponse.json({ erro: MENSAGEM_ORIGEM_RECUSADA, codigo: "origem_recusada" }, { status: 403 })
      break
  }

  for (const { name, value, options } of gravados) resposta.cookies.set(name, value, options)
  for (const [nome, valor] of Object.entries(cabecalhos)) resposta.headers.set(nome, valor)
  return resposta
}

// Páginas e APIs, menos os estáticos do Next, o favicon e arquivos de imagem (imagem em /api/ continua
// passando pelo proxy, para uma rota com extensão de imagem não escapar do login).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|(?!api/).*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
