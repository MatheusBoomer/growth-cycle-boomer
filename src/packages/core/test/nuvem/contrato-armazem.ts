import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { ErroNaoEncontrado } from "../../src/erros"
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

    it("apagarTudo limpa manifesto, objetos e sessões do slug e é idempotente", async () => {
      const armazem = await criar()
      const slug = novoSlug()
      const outro = novoSlug()
      const sessionId = "5b1d8f3e-0000-4000-8000-000000000002"
      const entrada = await armazem.enviar(slug, "dados/a.txt", bytes("conteúdo a"))
      const removida = await armazem.enviar(slug, "dados/b.txt", bytes("conteúdo b"))
      await armazem.remover(slug, "dados/b.txt")
      await armazem.enviarSessao(slug, sessionId, bytes('{"tipo":"user"}\n'))
      const doOutro = await armazem.enviar(outro, "dados/c.txt", bytes("conteúdo c"))

      await armazem.apagarTudo(slug)

      expect(await armazem.listarManifesto(slug)).toEqual([])
      await expect(armazem.baixar(slug, entrada.sha256)).rejects.toBeInstanceOf(ErroNaoEncontrado)
      await expect(armazem.baixar(slug, removida.sha256)).rejects.toBeInstanceOf(ErroNaoEncontrado)
      expect(await armazem.baixarSessao(slug, sessionId)).toBeNull()
      // Outro slug não é tocado.
      expect(await armazem.listarManifesto(outro)).toEqual([doOutro])
      await expect(armazem.apagarTudo(slug)).resolves.toBeUndefined()
      await expect(armazem.apagarTudo(novoSlug())).resolves.toBeUndefined()
    })
    it("envia, baixa e apaga imagens de report", async () => {
      const armazem = await criar()
      const novoId = () => 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000)
      const png = bytes("png falso")
      const jpg = bytes("jpg falso")
      const id = novoId()
      await armazem.enviarImagemReport(`${id}/0.png`, { bytes: png, formato: "png" })
      await armazem.enviarImagemReport(`${id}/1.jpg`, { bytes: jpg, formato: "jpg" })
      expect(Array.from(await armazem.baixarImagemReport(`${id}/0.png`))).toEqual(Array.from(png))
      expect(Array.from(await armazem.baixarImagemReport(`${id}/1.jpg`))).toEqual(Array.from(jpg))
      await armazem.apagarImagensReport(id)

      // O Storage serve de cache, por alguns segundos, um objeto já baixado mesmo depois de apagado. A remoção é
      // conferida num report cujas imagens nunca foram baixadas (o caso real: desfazer um envio que falhou).
      const outro = novoId()
      await armazem.enviarImagemReport(`${outro}/0.png`, { bytes: png, formato: "png" })
      await armazem.apagarImagensReport(outro)
      await expect(armazem.baixarImagemReport(`${outro}/0.png`)).rejects.toBeInstanceOf(ErroNaoEncontrado)
      await expect(armazem.apagarImagensReport(outro)).resolves.toBeUndefined()
    })
  })
}
