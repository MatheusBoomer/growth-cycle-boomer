import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Partes da tela de trabalho do redesign (protótipo aprovado 9-tela-de-trabalho-partes.html).
const ler = (f: string) => readFileSync(path.resolve(import.meta.dirname, f), "utf-8")

describe("1 · início da etapa", () => {
  const s = ler("trabalho/etapa-liberada.tsx")
  it("não repete o título do cabeçalho; mostra 'O que esperar desta etapa' em passos", () => {
    expect(s).not.toContain("{etapaCat.titulo}</h2>")
    expect(s).toMatch(/O que esperar <em[^>]*>desta etapa<\/em>/)
    expect(s).toContain("passosDoQueEsperar(")
    expect(s).toContain("Antes de começar")
  })
  it("uma coluna só: o que esperar, depois os arquivos (envio e kit) e por último o botão grande com play", () => {
    const esperar = s.indexOf("O que esperar")
    const arquivos = s.indexOf("Arquivos desta etapa")
    const kit = s.indexOf("<PainelKit")
    const botao = s.indexOf("Iniciar etapa")
    expect(esperar).toBeLessThan(arquivos)
    expect(arquivos).toBeLessThan(kit)
    expect(kit).toBeLessThan(botao)
    expect(s).not.toMatch(/grid-cols-\[minmax/)
    expect(s).toContain("PlayIcon")
  })
  it("bloqueada e agente ocupado no novo desenho", () => {
    expect(s).toMatch(/Etapa <em[^>]*>bloqueada<\/em>/)
    expect(s).toMatch(/Assim que terminar, dá para iniciar/)
  })
})

describe("2 · card de arquivo", () => {
  const s = ler("cards/card-insumo.tsx")
  it("ícone em quadrado colorido pelo estado, formatos em mono", () => {
    expect(s).toContain("rounded-xl")
    expect(s).toMatch(/font-mono[^"]*text-\[11px\]|text-\[11px\][^"]*font-mono/)
  })
  it("área de soltar tracejada que fica laranja ao arrastar, com 'Arraste o arquivo'", () => {
    expect(s).toContain("border-dashed")
    expect(s).toMatch(/arrastando && "[^"]*border-primary/)
    expect(s).toContain("Solte para enviar")
    expect(s).toContain("Enviar a versão corrigida")
  })
  it("resultado em faixa verde ou vermelha, sem o Alert cinza", () => {
    expect(s).not.toMatch(/<Alert[ >]/)
    expect(s).toContain("bg-sucesso-fundo")
    expect(s).toContain("bg-perigo-fundo")
  })
})

describe("3 · visualizadores", () => {
  const arquivos = ["apresentacao", "arquivo", "html", "planilha", "secao"].map((n) => `trabalho/visualizador-${n}.tsx`)
  it("todos usam a barra única com título de destaque serifado", () => {
    for (const f of arquivos) expect(ler(f), f).toContain("<BarraVisualizador")
  })
  it("vazio e carregando no padrão do protótipo", () => {
    for (const f of arquivos) {
      const s = ler(f)
      expect(s, f).not.toContain("<Empty ")
      expect(s, f).not.toContain("<Empty>")
    }
  })
  it("pinos de comentário da apresentação em laranja com contorno de papel", () => {
    expect(ler("trabalho/visualizador-apresentacao.tsx")).toContain("ring-papel")
  })
  it("a seleção na seção abre a pílula escura com 'Pedir ajuste'", () => {
    expect(ler("trabalho/visualizador-secao.tsx")).toMatch(/bg-foreground[^"]*text-background|text-background[^"]*bg-foreground/)
  })
})

describe("4 · dentro do chat", () => {
  it("imagem com o botão 'Ampliar' em vidro escuro", () => {
    const s = ler("cards/previa-arquivo.tsx")
    expect(s).toContain("Ampliar")
    expect(s).toContain(`variant="midia"`)
  })
  it("anexos com ícone em quadrado colorido", () => expect(ler("cards/previa-arquivo.tsx")).toContain("bg-aviso-fundo"))
  it("etiqueta de referência em pílula com o número em laranja", () => {
    const s = ler("chat/etiqueta-anexo.tsx")
    expect(s).toContain("rounded-full")
    expect(s).toContain("bg-primary")
  })
  it("histórico de perguntas: rótulo em caixa alta e resposta com fio à esquerda", () => {
    const s = ler("cards/historico-perguntas.tsx")
    expect(s).toContain("uppercase")
    expect(s).toContain("border-l-2")
  })
})

describe("5 · roteiro", () => {
  it("card: slides em cartões de 16 px, o novo realçado em verde e o antigo riscado", () => {
    expect(ler("cards/previa-roteiro.tsx")).toContain("rounded-2xl")
    const m = ler("cards/mudancas-roteiro.tsx")
    expect(m).toContain("<del")
    expect(m).toContain("<ins")
  })
  it("modal: 'Roteiro slide a slide' com o destaque serifado", () => expect(ler("cards/modal-roteiro.tsx")).toMatch(/Roteiro <em>slide a slide<\/em>/))
})

describe("6 · marcador de imagem", () => {
  const s = ler("cards/marcador-imagem.tsx")
  it("pinos e áreas em laranja, não em vermelho", () => {
    expect(s).not.toContain("bg-destructive")
    expect(s).toContain("bg-primary")
  })
  it("Ponto e Área num segmentado em pílula", () => expect(s).toContain('role="radiogroup"'))
})
