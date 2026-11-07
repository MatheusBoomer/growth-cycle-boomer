import { ErroEntrada } from "@workspace/core/erros"
import type { RepositorioUsuarios } from "@workspace/core/nuvem/usuarios"
import { servidor } from "@/lib/servidor"

/** Repositório de usuários, que só existe com os dados na nuvem; no modo fs a administração de pessoas não se aplica. */
export function usuariosDaNuvem(): RepositorioUsuarios {
  const { usuarios } = servidor()
  if (usuarios === null) throw new ErroEntrada("A administração de pessoas só existe com os dados na nuvem.")
  return usuarios
}
