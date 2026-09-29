import { describe, expect, it } from "vitest"
import { descreverAtividade } from "../src/atividade"

describe("atividade", () => {
  it("rotula a coleta de anúncios", () => {
    const r = descreverAtividade("Bash", { command: 'python3 scripts/coleta_meta_ads.py coletar --page-id 1 --marca "X" --saida y' }, "/raiz")
    expect(r).toEqual({ nome: "Bash", detalhe: "Coletando anúncios na Biblioteca do Meta" })
  })
  it("mantém o rótulo genérico dos outros comandos", () => {
    expect(descreverAtividade("Bash", { command: "ls dados" }, "/raiz")?.detalhe).toBe("Rodando: ls dados")
  })
})
