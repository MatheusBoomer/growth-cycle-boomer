import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { ArmazemArquivos } from "../../src/nuvem/tipos"
import { novoSlug } from "./suite-viva"

const bytes = (texto: string) => new TextEncoder().encode(texto)
const sha = (dados: Uint8Array) => createHash("sha256").update(dados).digest("hex")

/** Suíte compartilhada: roda igual contra a memória e contra o Storage. Cada caso usa o próprio slug. */
export function contratoArmazem(nome: string, criar: () => Promise<ArmazemArquivos>) {
  describe(`contrato do ArmazemArquivos: ${nome}`, () => {
    it("envia, lista e baixa pelo hash", async () => {
      const armazem = await criar()
      const slug = novoSlug()
      const dados = bytes("conteúdo do arquivo")
      const entrada = await armazem.enviar(slug, "dados/historico.csv", dados)
      expect(entrada).toEqual({ caminho: "dados/historico.csv", sha256: sha(dados), tamanho: dados.byteLength })
      expect(await armazem.listarManifesto(slug)).toEqual([entrada])
      expect(Array.from(await armazem.baixar(slug, entrada.sha256))).toEqual(Array.from(dados))
    })

    it("preserva nome com acento e espaço", async () => {
      const armazem = await criar()
      const slug = novoSlug()
      const caminho = "dados/Relatório de clientes.xlsx"
      const entrada = await armazem.enviar(slug, caminho, bytes("planilha"))
      expect(entrada.caminho).toBe(caminho)
      const manifesto = await armazem.listarManifesto(slug)
      expect(manifesto.map((m) => m.caminho)).toEqual([caminho])
    })

    it("reenviar o mesmo caminho troca a entrada do manifesto", async () => {
      const armazem = await criar()
      const slug = novoSlug()
      await armazem.enviar(slug, "dados/a.txt", bytes("versão 1"))
      const nova = await armazem.enviar(slug, "dados/a.txt", bytes("versão 2, maior"))
      const manifesto = await armazem.listarManifesto(slug)
      expect(manifesto).toEqual([nova])
      expect(nova.sha256).toBe(sha(bytes("versão 2, maior")))
    })

    it("remover tira do manifesto e mantém o conteúdo baixável pelo hash", async () => {
      const armazem = await criar()
      const slug = novoSlug()
      const dados = bytes("a guardar")
      const entrada = await armazem.enviar(slug, "dados/b.txt", dados)
      await armazem.remover(slug, "dados/b.txt")
      expect(await armazem.listarManifesto(slug)).toEqual([])
      expect(Array.from(await armazem.baixar(slug, entrada.sha256))).toEqual(Array.from(dados))
      await expect(armazem.remover(slug, "dados/inexistente.txt")).resolves.toBeUndefined()
    })

    it("sessão: ausente é null; enviada volta igual", async () => {
      const armazem = await criar()
      const slug = novoSlug()
      const sessionId = "5b1d8f3e-0000-4000-8000-000000000001"
      expect(await armazem.baixarSessao(slug, sessionId)).toBeNull()
      const dados = bytes('{"tipo":"user"}\n{"tipo":"assistant"}\n')
      await armazem.enviarSessao(slug, sessionId, dados)
      const volta = await armazem.baixarSessao(slug, sessionId)
      expect(volta).not.toBeNull()
      expect(Array.from(volta!)).toEqual(Array.from(dados))
    })
  })
}
