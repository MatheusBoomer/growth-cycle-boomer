import { describe, expect, it } from "vitest"
import { nomeDeDownload } from "./nome-download"

describe("nome do arquivo baixado", () => {
  it("usa o nome pedido com a extensão do arquivo", () => {
    expect(nomeDeDownload("Planejamento Estratégico - ADDA", "/x/entrega/apresentacao-final.pptx")).toBe("Planejamento Estratégico - ADDA.pptx")
  })
  it("tira caracteres que não podem ir em nome de arquivo e caminhos", () => {
    expect(nomeDeDownload('../a/b:c*"d', "/x/f.pptx")).toBe("..-a-b-c--d.pptx")
  })
  it("sem nome, ou só com espaços, mantém o nome original", () => {
    expect(nomeDeDownload(null, "/x/apresentacao-final.pptx")).toBe("apresentacao-final.pptx")
    expect(nomeDeDownload("   ", "/x/apresentacao-final.pptx")).toBe("apresentacao-final.pptx")
  })
})
