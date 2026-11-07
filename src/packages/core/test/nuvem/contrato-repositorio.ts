import { describe, expect, it } from "vitest"
import type { RegistroUsoTurno, Repositorio } from "../../src/nuvem/tipos"
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
export function contratoRepositorio(
  nome: string,
  criar: () => Promise<Repositorio>,
  /** Lê `prospects.criado_por`, que o Repositorio não expõe; sem ela, só se confere que a criação aceita o criador. */
  lerCriadoPor?: (repo: Repositorio, slug: string) => Promise<string | null>,
) {
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

    it("criar prospect grava o criador (ou null) e recriar um excluído troca o criador", async () => {
      const repo = await criar()
      const com = novoSlug()
      const sem = novoSlug()
      await repo.criarProspect(com, "ana.souza@boomer.com.br")
      await repo.criarProspect(sem)
      if (lerCriadoPor) {
        expect(await lerCriadoPor(repo, com)).toBe("ana.souza@boomer.com.br")
        expect(await lerCriadoPor(repo, sem)).toBeNull()
      }
      await expect(repo.criarProspect(com, "bia@gestaoboomer.com")).rejects.toBeInstanceOf(ErroProspectExistente)
      await repo.excluirProspect(com)
      await repo.criarProspect(com, "bia@gestaoboomer.com")
      if (lerCriadoPor) expect(await lerCriadoPor(repo, com)).toBe("bia@gestaoboomer.com")
      await repo.excluirProspect(com)
      await repo.criarProspect(com)
      if (lerCriadoPor) expect(await lerCriadoPor(repo, com)).toBeNull()
    })

    it("lê o dono, troca o dono e não lista nem lê o dono de um excluído", async () => {
      const repo = await criar()
      const dela = novoSlug()
      const sem = novoSlug()
      const excluido = novoSlug()
      await repo.criarProspect(dela, "ana.souza@boomer.com.br")
      await repo.criarProspect(sem)
      await repo.criarProspect(excluido, "bia@gestaoboomer.com")

      expect(await repo.lerDono(dela)).toBe("ana.souza@boomer.com.br")
      expect(await repo.lerDono(sem)).toBeNull()

      await repo.trocarDono(dela, "carla@boomer.com.br")
      expect(await repo.lerDono(dela)).toBe("carla@boomer.com.br")

      await repo.excluirProspect(excluido)
      const donos = await repo.listarDonos()
      expect(donos.get(dela)).toBe("carla@boomer.com.br")
      expect(donos.get(sem)).toBeNull()
      expect(donos.has(sem)).toBe(true)
      expect(donos.has(excluido)).toBe(false)
      await expect(repo.lerDono(excluido)).rejects.toBeInstanceOf(ErroNaoEncontrado)
      await expect(repo.trocarDono(excluido, "x@boomer.com.br")).rejects.toBeInstanceOf(ErroNaoEncontrado)
      await expect(repo.trocarDono(novoSlug(), "x@boomer.com.br")).rejects.toBeInstanceOf(ErroNaoEncontrado)
      await expect(repo.lerDono(novoSlug())).rejects.toBeInstanceOf(ErroNaoEncontrado)
    })

    it("mensagem do analista volta com o autor; sem autor, sem o campo", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      const com: EventoConversa = { tipo: "mensagem_analista", texto: "oi", automatica: false, autor: "ana.souza@boomer.com.br", em: EM }
      const sem: EventoConversa = { tipo: "mensagem_analista", texto: "auto", automatica: true, em: EM }
      await repo.anexarConversa(slug, "01", com)
      await repo.anexarConversa(slug, "01", sem)
      const lida = await repo.lerConversa(slug, "01")
      expect(lida).toEqual([com, sem])
      expect(lida[1]).not.toHaveProperty("autor")
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
      await expect(repo.excluirProspect(novoSlug())).rejects.toBeInstanceOf(
        ErroNaoEncontrado,
      )
    })

    it("criar um slug excluído recomeça do zero; criar um ativo continua falhando", async () => {
      const repo = await criar()
      const slug = novoSlug()
      await repo.criarProspect(slug)
      await repo.gravarEstado(slug, estadoDe(slug), 0)
      await repo.anexarConversa(slug, "01", { tipo: "turno_inicio", em: EM })
      await repo.gravarComentarios(slug, "apresentacao", [comentario("c1", "velho")])
      await repo.marcarSincronizacao(slug, true)
      await expect(repo.criarProspect(slug)).rejects.toBeInstanceOf(ErroProspectExistente)

      await repo.excluirProspect(slug)
      await repo.criarProspect(slug)

      expect(await repo.listarSlugs()).toContain(slug)
      expect(await repo.existe(slug)).toBe(true)
      expect(await repo.lerEstado(slug)).toBeNull()
      expect(await repo.lerConversa(slug, "01")).toEqual([])
      expect(await repo.lerComentarios(slug, "apresentacao")).toEqual([])
      // A versão volta a zero: gravar com 0 passa.
      expect(await repo.gravarEstado(slug, estadoDe(slug, "Novo"), 0)).toBe(1)
      await expect(repo.criarProspect(slug)).rejects.toBeInstanceOf(ErroProspectExistente)
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
          sessao: null,
          custoUsd: 0.12,
          custoTurnoUsd: 0.12,
          modelos: null,
          modelosAcumulado: null,
          esforco: null,
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

    describe("custo por turno e presença", () => {
      const T1 = "2026-10-27T12:00:00.000Z"
      const T2 = "2026-10-27T12:05:00.000Z"

      function turno(slug: string, parcial: Partial<RegistroUsoTurno>): RegistroUsoTurno {
        return {
          slug,
          etapa: "03",
          autor: "ana@x.com",
          sessao: "s1",
          custoUsd: 0.3,
          custoTurnoUsd: 0.3,
          modelos: { opus: 0.3 },
          modelosAcumulado: { opus: 0.3 },
          esforco: null,
          tokensEntrada: 10,
          tokensSaida: 2,
          inicio: T1,
          fim: T1,
          status: "ok",
          ...parcial,
        }
      }

      it("ultimoUsoDaSessao devolve o último acumulado da sessão, por fim", async () => {
        const repo = await criar()
        const slug = novoSlug()
        await repo.criarProspect(slug)
        expect(await repo.ultimoUsoDaSessao(slug, "s1")).toBeNull()
        // Gravado fora de ordem: vale o de maior `fim`, não o último inserido.
        await repo.registrarUso(
          turno(slug, { custoUsd: 0.5, custoTurnoUsd: 0.2, modelos: { opus: 0.2 }, modelosAcumulado: { opus: 0.5 }, fim: T2 }),
        )
        await repo.registrarUso(turno(slug, { fim: T1 }))
        await repo.registrarUso(turno(slug, { sessao: "s2", custoUsd: 9, custoTurnoUsd: 9, fim: T2 }))
        expect(await repo.ultimoUsoDaSessao(slug, "s1")).toEqual({ custoUsd: 0.5, modelos: { opus: 0.5 } })
        expect(await repo.ultimoUsoDaSessao(slug, "inexistente")).toBeNull()
      })

      it("listarUsos traz as colunas novas, por slug", async () => {
        const repo = await criar()
        const slug = novoSlug()
        await repo.criarProspect(slug)
        await repo.registrarUso(turno(slug, { custoUsd: 0.5, custoTurnoUsd: 0.2, modelos: { opus: 0.2 }, fim: T2 }))
        await repo.registrarUso(turno(slug, { sessao: null, custoUsd: null, custoTurnoUsd: null, modelos: null }))
        const usos = await repo.listarUsos(slug)
        expect(usos).toHaveLength(2)
        expect(usos).toContainEqual({
          slug,
          etapa: "03",
          autor: "ana@x.com",
          sessao: "s1",
          custoUsd: 0.5,
          custoTurnoUsd: 0.2,
          modelos: { opus: 0.2 },
          inicio: T1,
          fim: T2,
        })
        expect(usos).toContainEqual(expect.objectContaining({ sessao: null, custoUsd: null, custoTurnoUsd: null, modelos: null }))
      })

      it("registrarPresenca seguido de listarPresencas(slug) devolve em ordem", async () => {
        const repo = await criar()
        const slug = novoSlug()
        await repo.criarProspect(slug)
        await repo.registrarPresenca({ slug, email: "ana@x.com", etapa: "03", visivel: true, segundosSemInteracao: 3 })
        await repo.registrarPresenca({ slug, email: "bia@x.com", etapa: "04", visivel: false, segundosSemInteracao: 70 })
        const lista = await repo.listarPresencas(slug)
        expect(lista.map((p) => [p.email, p.etapa, p.visivel, p.segundosSemInteracao])).toEqual([
          ["ana@x.com", "03", true, 3],
          ["bia@x.com", "04", false, 70],
        ])
        expect(lista.every((p) => typeof p.em === "string" && !Number.isNaN(Date.parse(p.em)))).toBe(true)
        expect([...lista].sort((a, b) => Date.parse(a.em) - Date.parse(b.em))).toEqual(lista)
      })

      it("prospect excluído não aparece nas listas gerais de uso e presença", async () => {
        const repo = await criar()
        const ativo = novoSlug()
        const excluido = novoSlug()
        await repo.criarProspect(ativo)
        await repo.criarProspect(excluido)
        for (const slug of [ativo, excluido]) {
          await repo.registrarUso(turno(slug, {}))
          await repo.registrarPresenca({ slug, email: "ana@x.com", etapa: "03", visivel: true, segundosSemInteracao: 0 })
        }
        await repo.excluirProspect(excluido)
        const usos = (await repo.listarUsos()).map((u) => u.slug)
        const presencas = (await repo.listarPresencas()).map((p) => p.slug)
        expect(usos).toContain(ativo)
        expect(usos).not.toContain(excluido)
        expect(presencas).toContain(ativo)
        expect(presencas).not.toContain(excluido)
      })

      it("recriar um prospect excluído apaga o uso e a presença do antigo", async () => {
        const repo = await criar()
        const slug = novoSlug()
        await repo.criarProspect(slug)
        await repo.registrarUso(turno(slug, {}))
        await repo.registrarPresenca({ slug, email: "ana@x.com", etapa: "03", visivel: true, segundosSemInteracao: 0 })
        await repo.excluirProspect(slug)
        await repo.criarProspect(slug)
        expect(await repo.listarUsos(slug)).toEqual([])
        expect(await repo.listarPresencas(slug)).toEqual([])
      })
    })
  })
}
