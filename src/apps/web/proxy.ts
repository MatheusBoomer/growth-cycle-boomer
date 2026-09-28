import { NextResponse, type NextRequest } from "next/server"
import { requisicaoLocalPermitida } from "@workspace/core/seguranca"

export function proxy(request: NextRequest) {
  const permitida = requisicaoLocalPermitida({
    metodo: request.method,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  })
  if (!permitida) {
    return NextResponse.json({ erro: "Requisição recusada: só a própria interface local pode chamar esta API.", codigo: "origem_recusada" }, { status: 403 })
  }
  return NextResponse.next()
}

export const config = { matcher: "/api/:path*" }
