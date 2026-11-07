import type { SupabaseClient } from "@supabase/supabase-js"
import { ErroEntrada, ErroNaoEncontrado, ErroSemPermissao, ErroUltimoAdmin } from "../erros"
import { normalizarEmail, type Papel } from "../papeis"
import { falha, paginar } from "./supabase"
import { INTERVALO_ULTIMO_ACESSO_MS, porEmail, type PessoaRegistrada, type RepositorioUsuarios } from "./usuarios"

interface LinhaUsuario {
  email: string
  papel: Papel
  primeiro_acesso: string
  ultimo_acesso: string
}

/** Repositório de usuários na tabela planejamento.usuarios, com a troca de papel feita pela função alterar_papel. */
export class SupabaseUsuarios implements RepositorioUsuarios {
  constructor(
    private readonly cliente: SupabaseClient,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async registrarAcesso(email: string): Promise<Papel> {
    const chave = normalizarEmail(email)
    let linha = await this.lerAcesso(chave)
    if (!linha) {
      // Cria com a hora do relógio injetado (e não a do banco), para o intervalo de 1 h valer sobre a mesma hora.
      const em = this.agora().toISOString()
      const { error } = await this.cliente
        .from("usuarios")
        .upsert(
          { email: chave, primeiro_acesso: em, ultimo_acesso: em },
          { onConflict: "email", ignoreDuplicates: true },
        )
      if (error) throw falha(error)
      linha = await this.lerAcesso(chave)
      if (!linha) throw new Error("Não foi possível registrar o acesso.")
    }
    const agora = this.agora()
    if (agora.getTime() - new Date(linha.ultimo_acesso).getTime() > INTERVALO_ULTIMO_ACESSO_MS) {
      const { error } = await this.cliente
        .from("usuarios")
        .update({ ultimo_acesso: agora.toISOString() })
        .eq("email", chave)
      if (error) throw falha(error)
    }
    return linha.papel
  }

  private async lerAcesso(email: string): Promise<Pick<LinhaUsuario, "papel" | "ultimo_acesso"> | null> {
    const { data, error } = await this.cliente
      .from("usuarios")
      .select("papel, ultimo_acesso")
      .eq("email", email)
      .maybeSingle()
    if (error) throw falha(error)
    return (data as Pick<LinhaUsuario, "papel" | "ultimo_acesso"> | null) ?? null
  }

  async listar(): Promise<PessoaRegistrada[]> {
    const linhas = await paginar<LinhaUsuario>((de, ate) =>
      this.cliente
        .from("usuarios")
        .select("email, papel, primeiro_acesso, ultimo_acesso")
        .order("email")
        .range(de, ate),
    )
    return linhas
      .map((l) => ({
        email: l.email,
        papel: l.papel,
        primeiroAcesso: new Date(l.primeiro_acesso).toISOString(),
        ultimoAcesso: new Date(l.ultimo_acesso).toISOString(),
      }))
      .sort(porEmail)
  }

  async existe(email: string): Promise<boolean> {
    const { data, error } = await this.cliente
      .from("usuarios")
      .select("email")
      .eq("email", normalizarEmail(email))
      .maybeSingle()
    if (error) throw falha(error)
    return !!data
  }

  async alterarPapel(alvo: string, papel: Papel, autor: string): Promise<void> {
    const { error } = await this.cliente.rpc("alterar_papel", {
      alvo: normalizarEmail(alvo),
      novo_papel: papel,
      autor: normalizarEmail(autor),
    })
    if (!error) return
    switch ((error.message ?? "").trim()) {
      case "autor_nao_admin":
        throw new ErroSemPermissao()
      case "alvo_inexistente":
        throw new ErroNaoEncontrado("Pessoa não encontrada.")
      case "ultimo_admin":
        throw new ErroUltimoAdmin()
      case "papel_invalido":
        throw new ErroEntrada(`Papel inválido: "${String(papel)}".`)
      default:
        throw falha(error)
    }
  }
}
