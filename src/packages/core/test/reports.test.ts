import { describe, expect, it } from "vitest"
import { ErroEntrada } from "../src/erros"
import {
  LIMITE_IMAGEM_BYTES,
  type Report,
  textoReports,
  tipoDaImagem,
  validarImagensReport,
  validarMudancaReport,
  validarNovoReport,
} from "../src/reports"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

const contexto = { url: "/prospects/acme?x=1", prospect: "acme", navegador: "UA", tela: { largura: 1440, altura: 900 } }

function erro(f: () => unknown): string {
  try {
    f()
  } catch (e) {
    expect(e).toBeInstanceOf(ErroEntrada)
    return (e as Error).message
  }
  throw new Error("não lançou")
}

describe("validarNovoReport", () => {
  it("aceita um report válido e apara o comentário", () => {
    expect(validarNovoReport({ tipo: "bug", comentario: "  Botão não salva  ", contexto })).toEqual({
      tipo: "bug",
      comentario: "Botão não salva",
      contexto,
    })
  })

  it("recusa tipo ausente ou desconhecido", () => {
    expect(erro(() => validarNovoReport({ comentario: "x", contexto }))).toBe("Escolha se é um bug ou uma melhoria.")
    expect(erro(() => validarNovoReport({ tipo: "outro", comentario: "x", contexto }))).toBe("Escolha se é um bug ou uma melhoria.")
  })

  it("recusa comentário vazio ou longo demais", () => {
    expect(erro(() => validarNovoReport({ tipo: "bug", comentario: "   ", contexto }))).toBe("Escreva o que aconteceu ou o que sugere.")
    expect(erro(() => validarNovoReport({ tipo: "bug", comentario: "a".repeat(2001), contexto }))).toBe(
      "O comentário passa de 2000 caracteres.",
    )
  })

  it("ignora o autor que vier na entrada", () => {
    const r = validarNovoReport({ tipo: "melhoria", comentario: "x", contexto, autor: "intruso@x.com" })
    expect(r).not.toHaveProperty("autor")
  })

  it("normaliza o contexto", () => {
    const r = validarNovoReport({
      tipo: "bug",
      comentario: "x",
      contexto: { url: "https://x.com/a?b=1", prospect: "../etc", navegador: "u".repeat(5000), tela: { largura: -1, altura: 2 } },
    })
    expect(r.contexto).toEqual({ url: "/a?b=1", prospect: null, navegador: "u".repeat(300), tela: null })
    expect(validarNovoReport({ tipo: "bug", comentario: "x", contexto: { url: "/" + "p".repeat(900) } }).contexto.url).toHaveLength(500)
    expect(validarNovoReport({ tipo: "bug", comentario: "x", contexto: { prospect: "Acme Ltda" } }).contexto.prospect).toBeNull()
    expect(validarNovoReport({ tipo: "bug", comentario: "x", contexto: { tela: { largura: 1.5, altura: 2 } } }).contexto.tela).toBeNull()
    expect(validarNovoReport({ tipo: "bug", comentario: "x", contexto: { url: "http://a//evil.com/x" } }).contexto.url).toBe("/evil.com/x")
    expect(validarNovoReport({ tipo: "bug", comentario: "x", contexto: { url: "///evil.com" } }).contexto.url).toBe("/")
    expect(validarNovoReport({ tipo: "bug", comentario: "x" }).contexto).toEqual({ url: "", prospect: null, navegador: "", tela: null })
  })
})

describe("validarMudancaReport", () => {
  it("aceita status e nota, e nota vazia vira null", () => {
    expect(validarMudancaReport({ status: "resolvido" })).toEqual({ status: "resolvido" })
    expect(validarMudancaReport({ notaAdmin: "  " })).toEqual({ notaAdmin: null })
    expect(validarMudancaReport({ notaAdmin: " ok " })).toEqual({ notaAdmin: "ok" })
  })

  it("recusa status inválido, nota longa e mudança vazia", () => {
    expect(erro(() => validarMudancaReport({ status: "fechado" }))).toBe("Status inválido.")
    expect(erro(() => validarMudancaReport({ notaAdmin: "a".repeat(2001) }))).toBe("A nota passa de 2000 caracteres.")
    expect(erro(() => validarMudancaReport({}))).toBe("Nada para alterar.")
  })
})

describe("tipoDaImagem", () => {
  it("reconhece PNG e JPEG pela assinatura", () => {
    expect(tipoDaImagem(PNG)).toBe("png")
    expect(tipoDaImagem(JPG)).toBe("jpg")
    expect(tipoDaImagem(GIF)).toBeNull()
    expect(tipoDaImagem(new Uint8Array())).toBeNull()
  })
})

describe("validarImagensReport", () => {
  it("põe a tela primeiro", () => {
    expect(validarImagensReport(PNG, [JPG, PNG]).map((i) => i.formato)).toEqual(["png", "jpg", "png"])
    expect(validarImagensReport(null, [])).toEqual([])
  })

  it("recusa tela que não é PNG, extras demais, imagem grande e formato estranho", () => {
    expect(erro(() => validarImagensReport(JPG, []))).toBe("O print da tela precisa ser PNG.")
    expect(erro(() => validarImagensReport(null, [PNG, PNG, PNG, PNG]))).toBe("Envie no máximo 3 imagens além do print.")
    const grande = new Uint8Array(LIMITE_IMAGEM_BYTES + 1)
    grande.set(PNG)
    expect(erro(() => validarImagensReport(null, [grande]))).toBe("Cada imagem pode ter no máximo 5 MB.")
    expect(erro(() => validarImagensReport(null, [GIF]))).toBe("Imagem em formato não aceito. Use PNG ou JPEG.")
  })
})

describe("textoReports", () => {
  const report: Report = {
    id: 7,
    tipo: "bug",
    comentario: "Botão não salva",
    contexto: { url: "/prospects/acme", prospect: "acme", navegador: "UA", tela: null },
    status: "aberto",
    autor: "ana@boomer.com.br",
    imagens: ["7/0.png", "7/1.jpg"],
    notaAdmin: null,
    criadoEm: "2026-11-05T15:00:00.000Z",
    atualizadoEm: null,
    atualizadoPor: null,
  }
  const url = (id: number, n: number) => `https://app/api/admin/reports/${id}/imagens/${n}`

  it("sem reports", () => {
    expect(textoReports([], url)).toBe("Nenhum report.")
  })

  it("um bloco por report, na ordem recebida", () => {
    const texto = textoReports([report, { ...report, id: 8, tipo: "melhoria", contexto: { ...report.contexto, prospect: null }, imagens: [] }], url)
    const [primeiro, segundo] = texto.split("\n\n## ")
    expect(primeiro!.startsWith("## #7 · Bug · Aberto")).toBe(true)
    expect(primeiro).toContain("Botão não salva")
    expect(primeiro).toContain("Autor: Ana (05/11)")
    expect(primeiro).toContain("Página: /prospects/acme")
    expect(primeiro).toContain("Prospect: acme")
    expect(primeiro).toContain(`- ${url(7, 0)}`)
    expect(primeiro).toContain(`- ${url(7, 1)}`)
    expect(segundo!.startsWith("#8 · Melhoria · Aberto")).toBe(true)
    expect(segundo).not.toContain("Prospect:")
  })
})
