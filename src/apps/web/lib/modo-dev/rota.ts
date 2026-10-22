import path from "node:path"
import { type ArmazenamentoDev, criarArmazenamentoDev } from "./armazenamento.ts"

interface Registro {
  pasta: string
  /** Função que criou a instância: muda quando o next dev recarrega o módulo com código novo. */
  fabrica: typeof criarArmazenamentoDev
  armazenamento: ArmazenamentoDev
}

const registro = globalThis as unknown as { __modoDev?: Registro }

/** Pasta .dev-comentarios na raiz do repositório, pelo mesmo critério de lib/servidor.ts. */
export function armazenamentoDev(): ArmazenamentoDev {
  const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")
  const pasta = path.join(raiz, ".dev-comentarios")
  const atual = registro.__modoDev
  // Uma instância por pasta, para a fila de escrita valer entre requisições. No next dev ela sobrevive às
  // recargas e ficaria com o código antigo (sem `imagem`, sem o print da tela): código novo recria.
  if (atual?.pasta === pasta && atual.fabrica === criarArmazenamentoDev) return atual.armazenamento
  const armazenamento = criarArmazenamentoDev(pasta)
  registro.__modoDev = { pasta, fabrica: criarArmazenamentoDev, armazenamento }
  return armazenamento
}

/** As rotas do modo dev só existem no next dev; fora dele respondem como rota inexistente. */
export function foraDoDesenvolvimento(): Response | null {
  return process.env.NODE_ENV === "development" ? null : Response.json({ erro: "Não encontrado." }, { status: 404 })
}
