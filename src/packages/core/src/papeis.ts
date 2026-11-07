/** Regras puras de papel: quem é admin e quem vê qual prospect. Sem I/O, para ser testável sem banco. */

export type Papel = "admin" | "usuario"

export interface UsuarioComPapel {
  /** Nulo só no modo sem login, e só para admin. Usuário comum sem e-mail não vê nada. */
  email: string | null
  papel: Papel
}

export interface DadosDeAcesso {
  criadoPor: string | null
  teste: boolean
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function ehAdmin(u: UsuarioComPapel): boolean {
  return u.papel === "admin"
}

/** Ordem: admin vê tudo; cliente de teste é só de admin; sem dono gravado ninguém comum vê; senão, o dono é o usuário. */
export function podeVerProspect(u: UsuarioComPapel, p: DadosDeAcesso): boolean {
  if (ehAdmin(u)) return true
  if (p.teste) return false
  if (p.criadoPor === null) return false
  if (u.email === null) return false
  return normalizarEmail(p.criadoPor) === normalizarEmail(u.email)
}
