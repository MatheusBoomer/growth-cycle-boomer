import { describe, expect, it } from "vitest"
import { lerLinhasGravacao, montarRoteiro } from "../src/ensaio/montar"
import type { LinhaGravacao } from "../src/executor/gravador"

const mensagemLivre: LinhaGravacao = {
  mensagem: "Segue a planilha.",
  automatica: false,
  textoAnalista: "Segue a planilha.",
  eventos: [
    { tMs: 5, evento: { tipo: "sessao", sessionId: "s1" } },
    { tMs: 100, evento: { tipo: "texto_delta", texto: "Olá" } },
    { tMs: 400, evento: { tipo: "texto", texto: "Olá, analista" } },
    { tMs: 500, evento: { tipo: "ferramenta", id: "a", nome: "Read", entrada: { file_path: "x" } } },
    { tMs: 700, evento: { tipo: "ferramenta_resultado", id: "a", erro: false } },
    { tMs: 1000, evento: { tipo: "ferramenta", id: "b", nome: "mcp__planejamento__propor_entregavel", entrada: { tipo: "grafico", arquivo_rascunho: "clientes/acme/.app/rascunhos/g.png" } } },
    { tMs: 1900, evento: { tipo: "ferramenta_resultado", id: "b", erro: false } },
    { tMs: 1950, evento: { tipo: "uso", janelas: [] } },
    { tMs: 1960, evento: { tipo: "limite", status: "allowed", resetsAt: null } },
    { tMs: 2000, evento: { tipo: "fim", ok: true, erro: null, sessionId: "s1" } },
  ],
}

const aprovacao: LinhaGravacao = {
  mensagem: "O analista APROVOU o entregável “G” (g). Siga.",
  automatica: false,
  textoAnalista: "isto não deve aparecer",
  eventos: [
    { tMs: 0, evento: { tipo: "sessao", sessionId: "s1" } },
    { tMs: 300, evento: { tipo: "texto", texto: "Certo." } },
    { tMs: 310, evento: { tipo: "fim", ok: true, erro: null, sessionId: "s1" } },
  ],
}

describe("montarRoteiro", () => {
  const roteiro = montarRoteiro("03", [mensagemLivre, aprovacao])

  it("gera um trecho por linha, com versão e etapa", () => {
    expect(roteiro.versao).toBe(1)
    expect(roteiro.etapa).toBe("03")
    expect(roteiro.trechos.map((t) => t.gatilho)).toEqual(["mensagem", "aprovar"])
  })

  it("só preenche o texto quando o gatilho é mensagem ou ajuste", () => {
    expect(roteiro.trechos.map((t) => t.textoPreenchido)).toEqual(["Segue a planilha.", null])
    const ajuste = montarRoteiro("03", [{ ...aprovacao, mensagem: "AJUSTE no entregável “G”: troque a cor", textoAnalista: "troque a cor", eventos: [] }])
    expect(ajuste.trechos[0]).toMatchObject({ gatilho: "ajuste", textoPreenchido: "troque a cor" })
  })

  it("mensagem vazia e automática vira gatilho automatica, sem texto", () => {
    const aberta = montarRoteiro("01", [{ mensagem: "", automatica: true, textoAnalista: null, eventos: [] }])
    expect(aberta.trechos[0]).toEqual({ gatilho: "automatica", textoPreenchido: null, passos: [] })
  })

  it("descarta sessao, uso, limite, fim e ferramenta_resultado e mantém as demais ferramentas como eventos", () => {
    const passos = roteiro.trechos[0]!.passos
    expect(passos).toHaveLength(4)
    expect(passos.map((p) => ("evento" in p ? p.evento.tipo : p.ferramenta))).toEqual(["texto_delta", "texto", "ferramenta", "propor_entregavel"])
    expect(JSON.stringify(roteiro)).not.toMatch(/"(sessao|fim|uso|limite|ferramenta_resultado)"/)
  })

  it("dtMs é a diferença para o evento gravado anterior", () => {
    expect(roteiro.trechos[0]!.passos.map((p) => p.dtMs)).toEqual([95, 300, 100, 300])
    expect(roteiro.trechos[1]!.passos.map((p) => p.dtMs)).toEqual([300])
  })

  it("chamada do MCP planejamento perde o prefixo e reduz arquivo_rascunho ao basename", () => {
    expect(roteiro.trechos[0]!.passos[3]).toEqual({ dtMs: 300, ferramenta: "propor_entregavel", entrada: { tipo: "grafico", arquivo_rascunho: "g.png" } })
  })
})

describe("lerLinhasGravacao", () => {
  it("lê o jsonl ignorando linhas em branco", () => {
    const texto = `${JSON.stringify(aprovacao)}\n\n${JSON.stringify(mensagemLivre)}\n`
    expect(lerLinhasGravacao(texto)).toEqual([aprovacao, mensagemLivre])
  })
})
