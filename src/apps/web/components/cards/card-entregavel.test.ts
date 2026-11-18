import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const fonte = readFileSync(path.resolve(import.meta.dirname, "card-entregavel.tsx"), "utf-8")

describe("card de entregável", () => {
  it("pendente ganha a borda sutil correndo", () => expect(fonte).toMatch(/e\.status === "pendente" && "borda-correndo"/))
  it("aprovado ganha um contorno verde fino, parado", () => expect(fonte).toMatch(/e\.status === "aprovado" && "ring-1 ring-sucesso\/30"/))
  it("título em serifada", () => expect(fonte).toMatch(/<CardTitle className="[^"]*font-serif/))
  it("botão Aprovar com o brilho que passa", () => expect(fonte).toMatch(/<Button\s+className="brilho-passa"\s+onClick=\{aprovar\}/))
  it("aprovar não solta confete (o confete é só ao concluir a etapa)", () => expect(fonte).not.toMatch(/confete|celebrar/))
  it("gráfico e tabela ampliam num modal, só quando são imagem", () => {
    expect(fonte).toMatch(/aoAmpliar=\{ehImagem \? \(\) => setAmpliado\(true\) : undefined\}/)
    expect(fonte).toMatch(/\{ehImagem && \(\s*<ModalGrafico/)
  })
  it("não sobrou o atalho que abria gráfico e tabela na coluna 3 (agora é o modal)", () => {
    expect(fonte).not.toContain("abrirArquivo")
  })
  it("o modal usa as mesmas regras do card: aprovar devolve se deu certo e o ajuste pendente trava o Aprovar", () => {
    expect(fonte).toMatch(/async function aprovar\(\): Promise<boolean>/)
    expect(fonte).toMatch(/aprovarDesabilitado=\{aguardandoNovaVersao\}/)
    expect(fonte).toContain("Disponível quando o agente gerar a nova versão com o ajuste")
    expect(fonte).toMatch(/aoAprovar=\{aprovar\}/)
    expect(fonte).toMatch(/aoPedirAjuste=\{pedirAjuste\}/)
    expect(fonte).toMatch(/focoAoPedirAjuste=\{\(\) => document\.querySelector<HTMLElement>\(`textarea\[aria-label="\$\{ROTULO_CAMPO_MENSAGEM\}"\]`\)\}/)
  })
})
