import { nomeCurto } from "@workspace/core/autenticacao"
import type { RespostaPainel } from "@/lib/api"

const BOM = "﻿"
const CABECALHO = ["Projeto", "Analista", "Custo (US$)", "Tempo útil (s)", "Última atividade (ISO)", "Custo estimado"]

/** Texto que o Excel abriria como fórmula (começa com `= + - @`, tabulação ou retorno de carro) ganha uma aspa simples na frente; depois vem o escape do CSV. */
function campo(texto: string): string {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}

/**
 * CSV do painel, uma linha por projeto (os mesmos da lista, com os filtros aplicados). Separador `;`, custo com ponto
 * decimal, tempo em segundos, data ISO e "sim" quando parte do custo veio de turno estimado; começa com BOM UTF-8 para o Excel acertar os acentos.
 */
export function painelParaCsv(r: RespostaPainel): string {
  const linhas = r.painel.porProjeto.map((p) =>
    [
      campo(p.nome),
      campo(p.dono ? nomeCurto(p.dono) : ""),
      p.usd.toFixed(4),
      String(p.tempoUtilSeg),
      campo(p.ultimaAtividade ?? ""),
      p.estimado ? "sim" : "não",
    ].join(";"),
  )
  return BOM + [CABECALHO.join(";"), ...linhas].join("\n")
}
