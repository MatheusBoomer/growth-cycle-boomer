import { describe, expect, it } from "vitest"
import type { Repositorio } from "../../src/nuvem/tipos"
import { ErroConflitoVersao, ErroNaoEncontrado, ErroProspectExistente } from "../../src/erros"
import { estadoInicial } from "../../src/maquina-estados"
import type { Comentario } from "../../src/comentarios"
import type { EventoConversa } from "../../src/tipos"
import { novoSlug } from "./suite-viva"

const EM = "2026-10-27T12:00:00.000Z"

function estadoDe(slug: string, nome = "Prospect de contrato") {
  return estadoInicial({ slug, nome, site: null }, EM)
}

function comentario(id: string, texto: string): Comentario {
  return { id, slide: 1, regiao: null, campo: null, texto, criadoEm: EM, enviadoEm: null }
}

/** Suíte compartilhada: roda igual contra a memória e contra o banco. Cada caso usa o próprio slug. */
export function contratoRepositorio(nome: string, criar: () => Promise<Repositorio>) {
  describe(`contrato do Repositorio: ${nome}`, () => {
    it("cria, lista e confere existência", async () => {
      const repo = await criar()
      const slug = novoSlug()
      expect(await repo.existe(slug)).toBe(false)
      await repo.criarProspect(slug)
      expect(await repo.listarSlugs()).toContain(slug)
      expect(await repo.existe(slug)).toBe(true)
      await expect(repo.criarProspect(slug)).rejects.toBeInstanceOf(ErroProspectExistente)
    })

    it("estado começa nulo e grava com versão", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      expect(await repo.lerEstado(slug)).toBeNull()
      const e = estadoDe(slug)
      expect(await repo.gravarEstado(slug, e, 0)).toBe(1)
      expect(await repo.lerEstado(slug)).toEqual({ estado: e, versao: 1 })
    })

    it("gravar com versão velha falha sem sobrescrever", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      const e = estadoDe(slug)
      await repo.gravarEstado(slug, e, 0)
      const e2 = estadoDe(slug, "Outro nome")
      await expect(repo.gravarEstado(slug, e2, 0)).rejects.toBeInstanceOf(ErroConflitoVersao)
      expect(await repo.lerEstado(slug)).toEqual({ estado: e, versao: 1 })
    })

    it("excluir tira da lista e de existe", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      await repo.excluirProspect(slug)
      expect(await repo.listarSlugs()).not.toContain(slug)
      expect(await repo.existe(slug)).toBe(false)
      await expect(repo.criarProspect(slug)).rejects.toBeInstanceOf(ErroProspectExistente)
      await expect(repo.excluirProspect(novoSlug())).rejects.toBeInstanceOf(
        ErroNaoEncontrado,
      )
    })

    it("conversa volta na ordem e separada por etapa", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      const a: EventoConversa = { tipo: "turno_inicio", em: EM }
      const b: EventoConversa = { tipo: "texto_agente", texto: "olá", em: EM }
      const c: EventoConversa = { tipo: "turno_fim", status: "ok", detalhe: null, em: EM }
      const outra: EventoConversa = { tipo: "texto_agente", texto: "outra etapa", em: EM }
      await repo.anexarConversa(slug, "01", a)
      await repo.anexarConversa(slug, "02", outra)
      await repo.anexarConversa(slug, "01", b)
      await repo.anexarConversa(slug, "01", c)
      expect(await repo.lerConversa(slug, "01")).toEqual([a, b, c])
      expect(await repo.lerConversa(slug, "02")).toEqual([outra])
      expect(await repo.lerConversa(slug, "03")).toEqual([])
    })

    it("comentários: vazio, grava, substitui", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      expect(await repo.lerComentarios(slug, "apresentacao")).toEqual([])
      const um = [comentario("c1", "primeiro"), comentario("c2", "segundo")]
      await repo.gravarComentarios(slug, "apresentacao", um)
      expect(await repo.lerComentarios(slug, "apresentacao")).toEqual(um)
      const dois = [comentario("c3", "só este")]
      await repo.gravarComentarios(slug, "apresentacao", dois)
      expect(await repo.lerComentarios(slug, "apresentacao")).toEqual(dois)
      expect(await repo.lerComentarios(slug, "roteiro")).toEqual([])
    })

    it("limpa conversas e comentários só do slug pedido, sem apagar o prospect", async () => {
      const repo = await criar()
      const slug = novoSlug()
      const outro = novoSlug()
      await repo.criarProspect(slug)
      await repo.criarProspect(outro)
      const evento: EventoConversa = { tipo: "texto_agente", texto: "olá", em: EM }
      await repo.anexarConversa(slug, "01", evento)
      await repo.anexarConversa(slug, "03", evento)
      await repo.gravarComentarios(slug, "apresentacao", [comentario("c1", "um")])
      await repo.anexarConversa(outro, "01", evento)
      await repo.gravarComentarios(outro, "apresentacao", [comentario("c2", "dois")])

      await repo.limparConversasEComentarios(slug)

      expect(await repo.lerConversa(slug, "01")).toEqual([])
      expect(await repo.lerConversa(slug, "03")).toEqual([])
      expect(await repo.lerComentarios(slug, "apresentacao")).toEqual([])
      expect(await repo.existe(slug)).toBe(true)
      expect(await repo.lerConversa(outro, "01")).toEqual([evento])
      expect(await repo.lerComentarios(outro, "apresentacao")).toEqual([comentario("c2", "dois")])
      // Limpar de novo, sem nada a limpar, não falha.
      await expect(repo.limparConversasEComentarios(slug)).resolves.toBeUndefined()
    })

    it("registra uso e marca sincronização", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      await expect(
        repo.registrarUso({
          slug,
          etapa: "01",
          autor: null,
          custoUsd: 0.12,
          tokensEntrada: 1000,
          tokensSaida: 200,
          inicio: EM,
          fim: EM,
          status: "ok",
        }),
      ).resolves.toBeUndefined()
      await expect(repo.marcarSincronizacao(slug, true)).resolves.toBeUndefined()
      await expect(repo.marcarSincronizacao(slug, false)).resolves.toBeUndefined()
    })
  })
}
