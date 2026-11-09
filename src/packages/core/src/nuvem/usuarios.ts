import { ErroEntrada, ErroNaoEncontrado, ErroSemPermissao, ErroUltimoAdmin } from "../erros"
import { normalizarEmail, type Papel } from "../papeis"

export interface PessoaRegistrada {
  email: string
  papel: Papel
  primeiroAcesso: string
  ultimoAcesso: string
}

export interface RepositorioUsuarios {
  /** Registra como "usuario" se faltar; atualiza ultimo_acesso se tiver mais de 1 h; devolve o papel. */
  registrarAcesso(email: string): Promise<Papel>
  /** Ordenado por e-mail. */
  listar(): Promise<PessoaRegistrada[]>
  existe(email: string): Promise<boolean>
  /** ErroSemPermissao (autor não admin), ErroNaoEncontrado (alvo), ErroUltimoAdmin, ErroEntrada (papel inválido). */
  alterarPapel(alvo: string, papel: Papel, autor: string): Promise<void>
  /** Grava (ou, com null, apaga) a foto de quem já está registrado; e-mail desconhecido não cria linha. A URL já deve ter passado por avatarSeguro. */
  registrarAvatar(email: string, url: string | null): Promise<void>
  /** E-mail normalizado para a URL da foto, só de quem tem foto. */
  avatares(): Promise<Map<string, string>>
}

/** Intervalo mínimo entre duas atualizações de ultimo_acesso da mesma pessoa. */
export const INTERVALO_ULTIMO_ACESSO_MS = 60 * 60 * 1000

export function papelValido(papel: unknown): papel is Papel {
  return papel === "admin" || papel === "usuario"
}

/** Ordem por código de caractere, igual nos dois repositórios (o `order by` do Postgres depende da collation). */
export function porEmail(a: PessoaRegistrada, b: PessoaRegistrada): number {
  return a.email < b.email ? -1 : a.email > b.email ? 1 : 0
}

/** Repositório em memória (modo sem Supabase e testes). As regras de alterarPapel espelham planejamento.alterar_papel. */
export class MemoriaUsuarios implements RepositorioUsuarios {
  private readonly pessoas = new Map<string, PessoaRegistrada>()
  private readonly fotos = new Map<string, string>()

  constructor(
    admins: string[] = [],
    private readonly agora: () => Date = () => new Date(),
  ) {
    for (const email of admins) this.semearAdmin(email)
  }

  /** Cadastra (ou promove) um admin direto, sem passar pelas regras de alterarPapel. */
  semearAdmin(email: string): void {
    const chave = normalizarEmail(email)
    const atual = this.pessoas.get(chave)
    if (atual) {
      atual.papel = "admin"
      return
    }
    const em = this.agora().toISOString()
    this.pessoas.set(chave, { email: chave, papel: "admin", primeiroAcesso: em, ultimoAcesso: em })
  }

  async registrarAcesso(email: string): Promise<Papel> {
    const chave = normalizarEmail(email)
    const agora = this.agora()
    const atual = this.pessoas.get(chave)
    if (!atual) {
      const em = agora.toISOString()
      this.pessoas.set(chave, { email: chave, papel: "usuario", primeiroAcesso: em, ultimoAcesso: em })
      return "usuario"
    }
    if (agora.getTime() - new Date(atual.ultimoAcesso).getTime() > INTERVALO_ULTIMO_ACESSO_MS) {
      atual.ultimoAcesso = agora.toISOString()
    }
    return atual.papel
  }

  async listar(): Promise<PessoaRegistrada[]> {
    return [...this.pessoas.values()].map((p) => ({ ...p })).sort(porEmail)
  }

  async existe(email: string): Promise<boolean> {
    return this.pessoas.has(normalizarEmail(email))
  }

  async alterarPapel(alvo: string, papel: Papel, autor: string): Promise<void> {
    if (!papelValido(papel)) throw new ErroEntrada(`Papel inválido: "${String(papel)}".`)
    const quemAltera = this.pessoas.get(normalizarEmail(autor))
    if (!quemAltera || quemAltera.papel !== "admin") throw new ErroSemPermissao()
    const pessoa = this.pessoas.get(normalizarEmail(alvo))
    if (!pessoa) throw new ErroNaoEncontrado("Pessoa não encontrada.")
    if (pessoa.papel === papel) return
    if (papel === "usuario" && [...this.pessoas.values()].filter((p) => p.papel === "admin").length <= 1) {
      throw new ErroUltimoAdmin()
    }
    pessoa.papel = papel
  }

  async registrarAvatar(email: string, url: string | null): Promise<void> {
    const chave = normalizarEmail(email)
    if (!this.pessoas.has(chave)) return
    if (url === null) this.fotos.delete(chave)
    else this.fotos.set(chave, url)
  }

  async avatares(): Promise<Map<string, string>> {
    return new Map(this.fotos)
  }
}
