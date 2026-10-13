import path from "node:path"
import { type ArmazenamentoDev, criarArmazenamentoDev } from "./armazenamento.ts"

const registro = globalThis as unknown as { __modoDev?: ArmazenamentoDev }

/** Pasta .dev-comentarios na raiz do repositório, pelo mesmo critério de lib/servidor.ts. */
export function armazenamentoDev(): ArmazenamentoDev {
  const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")
  const pasta = path.join(raiz, ".dev-comentarios")
  let atual = registro.__modoDev
  // Uma instância por pasta, para a fila de escrita valer entre requisições.
  if (atual?.pasta !== pasta) {
    atual = criarArmazenamentoDev(pasta)
    registro.__modoDev = atual
  }
  return atual
}

/** As rotas do modo dev só existem no next dev; fora dele respondem como rota inexistente. */
export function foraDoDesenvolvimento(): Response | null {
  return process.env.NODE_ENV === "development" ? null : Response.json({ erro: "Não encontrado." }, { status: 404 })
}
