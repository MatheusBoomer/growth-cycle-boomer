import { describe, expect, it } from "vitest"
import { ErroNaoEncontrado, ErroSemPermissao } from "../../src/erros"
import type { RepositorioUsuarios } from "../../src/nuvem/usuarios"
import { novoEmail } from "./suite-viva"

const INICIO = new Date("2026-11-07T12:00:00.000Z")
const MINUTO = 60 * 1000

/**
 * Suíte compartilhada: roda igual contra a memória e contra o banco. Cada caso usa os próprios e-mails.
 * O caso "último admin" fica de fora porque, na suíte viva, a tabela já tem o admin real.
 */
export function contratoUsuarios(
  nome: string,
  criar: (agora: () => Date) => Promise<{ repo: RepositorioUsuarios; semearAdmin(email: string): Promise<void> }>,
) {
  describe(`contrato do RepositorioUsuarios: ${nome}`, () => {
    const relogio = () => {
      let t = INICIO.getTime()
      return { agora: () => new Date(t), avancar: (minutos: number) => void (t += minutos * MINUTO) }
    }

    it("o primeiro acesso registra como usuario e a pessoa aparece em listar()", async () => {
      const { repo } = await criar(() => INICIO)
      const email = novoEmail()
      expect(await repo.existe(email)).toBe(false)
      expect(await repo.registrarAcesso(email)).toBe("usuario")
      expect(await repo.existe(email)).toBe(true)
      const pessoa = (await repo.listar()).find((p) => p.email === email)
      expect(pessoa).toEqual({
        email,
        papel: "usuario",
        primeiroAcesso: INICIO.toISOString(),
        ultimoAcesso: INICIO.toISOString(),
      })
    })

    it("normaliza o e-mail (espaços e caixa) ao registrar", async () => {
      const { repo } = await criar(() => INICIO)
      const email = novoEmail()
      await repo.registrarAcesso(`  ${email.toUpperCase()}  `)
      expect((await repo.listar()).map((p) => p.email)).toContain(email)
      expect(await repo.existe(`  ${email.toUpperCase()}  `)).toBe(true)
    })

    it("devolve a lista ordenada por e-mail", async () => {
      const { repo } = await criar(() => INICIO)
      const emails = [novoEmail(), novoEmail(), novoEmail()]
      for (const e of emails) await repo.registrarAcesso(e)
      const lista = (await repo.listar()).map((p) => p.email)
      expect(lista).toEqual([...lista].sort())
      for (const e of emails) expect(lista).toContain(e)
    })

    it("ultimo_acesso não muda 30 min depois e muda 61 min depois", async () => {
      const r = relogio()
      const { repo } = await criar(r.agora)
      const email = novoEmail()
      const ultimo = async () => (await repo.listar()).find((p) => p.email === email)!.ultimoAcesso
      await repo.registrarAcesso(email)
      const primeiro = await ultimo()
      expect(primeiro).toBe(INICIO.toISOString())
      r.avancar(30)
      await repo.registrarAcesso(email)
      expect(await ultimo()).toBe(primeiro)
      r.avancar(31)
      await repo.registrarAcesso(email)
      expect(await ultimo()).toBe(r.agora().toISOString())
    })

    it("um admin promove outra pessoa e o registrarAcesso dela passa a devolver admin", async () => {
      const { repo, semearAdmin } = await criar(() => INICIO)
      const admin = novoEmail()
      const pessoa = novoEmail()
      await semearAdmin(admin)
      await repo.registrarAcesso(pessoa)
      await repo.alterarPapel(pessoa, "admin", admin)
      expect(await repo.registrarAcesso(pessoa)).toBe("admin")
    })

    it("um admin rebaixa outro admin quando há dois ou mais", async () => {
      const { repo, semearAdmin } = await criar(() => INICIO)
      const a = novoEmail()
      const b = novoEmail()
      await semearAdmin(a)
      await semearAdmin(b)
      await repo.alterarPapel(b, "usuario", a)
      expect(await repo.registrarAcesso(b)).toBe("usuario")
      expect(await repo.registrarAcesso(a)).toBe("admin")
    })

    it("autor que não é admin leva ErroSemPermissao e nada muda", async () => {
      const { repo } = await criar(() => INICIO)
      const autor = novoEmail()
      const alvo = novoEmail()
      await repo.registrarAcesso(autor)
      await repo.registrarAcesso(alvo)
      await expect(repo.alterarPapel(alvo, "admin", autor)).rejects.toBeInstanceOf(ErroSemPermissao)
      await expect(repo.alterarPapel(alvo, "admin", novoEmail())).rejects.toBeInstanceOf(ErroSemPermissao)
      expect(await repo.registrarAcesso(alvo)).toBe("usuario")
    })

    it("alvo não registrado leva ErroNaoEncontrado", async () => {
      const { repo, semearAdmin } = await criar(() => INICIO)
      const admin = novoEmail()
      await semearAdmin(admin)
      await expect(repo.alterarPapel(novoEmail(), "admin", admin)).rejects.toBeInstanceOf(ErroNaoEncontrado)
    })

    it("registrarAvatar de e-mail existente aparece em avatares() com o e-mail normalizado", async () => {
      const { repo } = await criar(() => INICIO)
      const email = novoEmail()
      await repo.registrarAcesso(email)
      await repo.registrarAvatar(`  ${email.toUpperCase()}  `, "https://lh3.googleusercontent.com/a/abc")
      expect((await repo.avatares()).get(email)).toBe("https://lh3.googleusercontent.com/a/abc")
    })

    it("registrarAvatar(email, null) apaga a foto", async () => {
      const { repo } = await criar(() => INICIO)
      const email = novoEmail()
      await repo.registrarAcesso(email)
      await repo.registrarAvatar(email, "https://lh3.googleusercontent.com/a/abc")
      await repo.registrarAvatar(email, null)
      expect((await repo.avatares()).has(email)).toBe(false)
    })

    it("registrarAvatar de e-mail inexistente não cria linha", async () => {
      const { repo } = await criar(() => INICIO)
      const email = novoEmail()
      await repo.registrarAvatar(email, "https://lh3.googleusercontent.com/a/abc")
      expect(await repo.existe(email)).toBe(false)
      expect((await repo.avatares()).has(email)).toBe(false)
    })

    it("avatares() só traz quem tem foto", async () => {
      const { repo } = await criar(() => INICIO)
      const email = novoEmail()
      await repo.registrarAcesso(email)
      expect((await repo.avatares()).has(email)).toBe(false)
    })
  })
}
