import { describe, expect, it } from "vitest"
import { ErroNaoEncontrado } from "../../src/erros"
import { MemoriaArmazem, MemoriaRepositorio } from "../../src/nuvem/memoria"
import { estadoInicial } from "../../src/maquina-estados"
import { contratoArmazem } from "./contrato-armazem"
import { contratoRepositorio } from "./contrato-repositorio"

contratoRepositorio("memória", async () => new MemoriaRepositorio())
contratoArmazem("memória", async () => new MemoriaArmazem())

describe("MemoriaRepositorio", () => {
  it("não compartilha referência do estado com quem leu ou gravou", async () => {
    const repo = new MemoriaRepositorio()
    await repo.criarProspect("x")
    const e = estadoInicial({ slug: "x", nome: "X", site: null }, "2026-10-27T12:00:00.000Z")
    await repo.gravarEstado("x", e, 0)
    e.prospect.nome = "mutado na entrada"
    const lido = await repo.lerEstado("x")
    expect(lido!.estado.prospect.nome).toBe("X")
    lido!.estado.prospect.nome = "mutado na saída"
    expect((await repo.lerEstado("x"))!.estado.prospect.nome).toBe("X")
  })

  it("estado de prospect inexistente é ErroNaoEncontrado ao gravar", async () => {
    const repo = new MemoriaRepositorio()
    const e = estadoInicial({ slug: "y", nome: "Y", site: null }, "2026-10-27T12:00:00.000Z")
    await expect(repo.gravarEstado("y", e, 0)).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })
})

describe("MemoriaArmazem", () => {
  it("falharEm simula falha por operação e caminho", async () => {
    const armazem = new MemoriaArmazem()
    armazem.falharEm = (operacao, caminho) => operacao === "enviar" && caminho === "dados/ruim.txt"
    await expect(armazem.enviar("s", "dados/ruim.txt", new Uint8Array([1]))).rejects.toThrow(/dados\/ruim\.txt/)
    await expect(armazem.enviar("s", "dados/boa.txt", new Uint8Array([1]))).resolves.toBeDefined()
  })

  it("baixar hash desconhecido é ErroNaoEncontrado", async () => {
    const armazem = new MemoriaArmazem()
    await expect(armazem.baixar("s", "0".repeat(64))).rejects.toBeInstanceOf(ErroNaoEncontrado)
  })
})
