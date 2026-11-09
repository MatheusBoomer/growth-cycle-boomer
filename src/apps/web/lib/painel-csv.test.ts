import { describe, expect, it } from "vitest"
import type { RespostaPainel } from "@/lib/api"
import { painelParaCsv } from "./painel-csv"

type Linha = RespostaPainel["painel"]["porProjeto"][number]

function linha(parcial: Partial<Linha>): Linha {
  return {
    slug: "verdeluz",
    nome: "Verdeluz",
    dono: "ana.souza@boomer.com.br",
    usd: 1.5,
    porFase: {},
    tempoUtilSeg: 90,
    ultimaAtividade: "2026-11-05T12:00:00.000Z",
    etapaAtual: "03",
    ativo: true,
    concluidoEm: null,
    pendencias: 0,
    teste: false,
    ...parcial,
  }
}

function resposta(linhas: Linha[]): RespostaPainel {
  return { painel: { porProjeto: linhas } as RespostaPainel["painel"], opcoes: { donos: [], projetos: [], modelos: [] }, avatares: {} }
}

const BOM = "﻿"
const CABECALHO = "Projeto;Analista;Custo (US$);Tempo útil (s);Última atividade (ISO)"

describe("painelParaCsv", () => {
  it("começa com BOM UTF-8 e o cabeçalho; painel vazio devolve só o cabeçalho", () => {
    expect(painelParaCsv(resposta([]))).toBe(BOM + CABECALHO)
  })

  it("uma linha por projeto: nome, analista pelo nome, custo com ponto, segundos e data ISO", () => {
    const csv = painelParaCsv(resposta([linha({}), linha({ nome: "Casa Azul", dono: null, usd: 0, tempoUtilSeg: 0, ultimaAtividade: null })]))
    expect(csv.split("\n")).toEqual([
      BOM + CABECALHO,
      "Verdeluz;Ana Souza;1.5000;90;2026-11-05T12:00:00.000Z",
      "Casa Azul;;0.0000;0;",
    ])
  })

  it("envolve em aspas o campo com ponto e vírgula, aspas ou quebra de linha, dobrando as aspas", () => {
    const csv = painelParaCsv(resposta([linha({ nome: 'Loja "Sol"; Mar' }), linha({ nome: "Duas\nlinhas" })]))
    expect(csv).toContain('\n"Loja ""Sol""; Mar";Ana Souza;1.5000;90;2026-11-05T12:00:00.000Z')
    expect(csv).toContain('\n"Duas\nlinhas";Ana Souza')
  })

  it("não deixa o Excel interpretar o nome como fórmula", () => {
    const csv = painelParaCsv(resposta([linha({ nome: "=SOMA(A1)" })]))
    expect(csv.split("\n")[1]).toMatch(/^'=SOMA\(A1\);/)
  })

  it("também neutraliza nome que começa com tabulação ou retorno de carro", () => {
    const tab = painelParaCsv(resposta([linha({ nome: "\t=SOMA(A1)" })]))
    expect(tab.split("\n")[1]).toMatch(/^'\t=SOMA\(A1\);/)
    const cr = painelParaCsv(resposta([linha({ nome: "\r=SOMA(A1)" })]))
    expect(cr).toContain("\n\"'\r=SOMA(A1)\";Ana Souza")
  })
})
