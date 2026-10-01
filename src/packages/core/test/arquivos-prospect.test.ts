import { describe, expect, it } from "vitest"
import { arquivoVisivel } from "../src/armazenamento"

describe("arquivos do prospect que podem ser abertos e mencionados", () => {
  it("entrega, dados, contexto e o que o agente produz entram", () => {
    expect(arquivoVisivel("entrega/ativos-aprovados/graficos/roas.png")).toBe(true)
    expect(arquivoVisivel("dados/historico-mensal.xlsx")).toBe(true)
    expect(arquivoVisivel("dados/benchmark-meta/insider/resumo.md")).toBe(true)
    expect(arquivoVisivel("contexto/decisoes/03.md")).toBe(true)
  })
  it("rascunhos, propostas e anexos da interface entram", () => {
    expect(arquivoVisivel(".app/propostas/abc.png")).toBe(true)
    expect(arquivoVisivel(".app/rascunhos/benchmark.html")).toBe(true)
    expect(arquivoVisivel(".app/anexos/1-print.png")).toBe(true)
  })
  it("estado interno do app, conversas e arquivos de sistema ficam de fora", () => {
    expect(arquivoVisivel(".app/estado.json")).toBe(false)
    expect(arquivoVisivel(".app/conversas/06.jsonl")).toBe(false)
    expect(arquivoVisivel("entrega/.DS_Store")).toBe(false)
    expect(arquivoVisivel("dados/~$planilha.xlsx")).toBe(false)
  })
})
