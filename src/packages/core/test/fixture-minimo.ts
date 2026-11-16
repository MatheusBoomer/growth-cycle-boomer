import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { comEtapa, estadoInicial } from "../src/maquina-estados"
import { ORDEM_ETAPAS, type Estado } from "../src/tipos"

const EM = "2026-10-01T12:00:00.000Z"

/** Arquivos do fixture mínimo: caminho no cliente, etapa do manifesto e conteúdo. */
export const ARQUIVOS_MINIMO: { caminho: string; etapa: string; conteudo: string }[] = [
  { caminho: "contexto/site-referencia.md", etapa: "00", conteudo: "# Referência do E-commerce\n\n**Link:** https://teste.example\n" },
  { caminho: "contexto/brutos/kickoff-transcricao-bruta.md", etapa: "01", conteudo: "kickoff bruto" },
  { caminho: "contexto/kickoff-transcricao.md", etapa: "01", conteudo: "kickoff limpo" },
  { caminho: "contexto/decisoes/01-preparacao-de-contexto.md", etapa: "01", conteudo: "decisões 01" },
  { caminho: "entrega/ativos-aprovados/secoes/01-kickoff-transcricao.md", etapa: "01", conteudo: "seção 01" },
  { caminho: ".app/propostas/p1.md", etapa: "01", conteudo: "proposta 1" },
  { caminho: ".app/propostas/p2.md", etapa: "02", conteudo: "proposta 2" },
  { caminho: "contexto/contextualizacao-estrategica.md", etapa: "02", conteudo: "contexto 02" },
  { caminho: "dados/historico-mensal.xlsx", etapa: "03", conteudo: "planilha de mentira" },
]

export function estadoCompletoMinimo(): Estado {
  let e = estadoInicial({ slug: "cliente-teste", nome: "Cliente Teste", site: "https://teste.example" }, EM)
  for (const id of ORDEM_ETAPAS) {
    e = comEtapa(
      e,
      id,
      {
        status: "concluida",
        sessionId: "sessao-antiga",
        iniciadaEm: EM,
        concluidaEm: EM,
        sinalizada: true,
        resumoDecisoes: `Resumo da etapa ${id}`,
        handoff: `Handoff da etapa ${id}`,
      },
      EM,
    )
  }
  return {
    ...e,
    entregaveis: [
      { id: "e1", etapa: "01", tipo: "secao", titulo: "Transcrição limpa", arquivoRascunho: ".app/propostas/p1.md", nomeFinal: "kickoff-transcricao", status: "aprovado", ajustePedido: null, criadoEm: EM, decididoEm: EM },
      { id: "e2", etapa: "02", tipo: "secao", titulo: "Contextualização", arquivoRascunho: ".app/propostas/p2.md", nomeFinal: "contextualizacao-estrategica", status: "aprovado", ajustePedido: null, criadoEm: EM, decididoEm: EM },
    ],
    insumos: [
      { etapa: "01", insumoId: "site", status: "valido", problemas: [], avisos: [], resumo: "https://teste.example", arquivo: "contexto/site-referencia.md", atualizadoEm: EM },
      { etapa: "01", insumoId: "kickoff-transcricao", status: "valido", problemas: [], avisos: [], resumo: null, arquivo: "contexto/brutos/kickoff-transcricao-bruta.md", atualizadoEm: EM },
      { etapa: "03", insumoId: "historico-mensal", status: "valido", problemas: [], avisos: [], resumo: null, arquivo: "dados/historico-mensal.xlsx", atualizadoEm: EM },
    ],
  }
}

/** No disco do fixture, o prefixo ".app/" do caminho do cliente vira "app/". */
function naBase(caminho: string): string {
  return path.join("base", caminho.startsWith(".app/") ? `app/${caminho.slice(5)}` : caminho)
}

async function gravar(pasta: string, rel: string, conteudo: string): Promise<void> {
  const abs = path.join(pasta, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, conteudo)
}

/** Fixture completo e pequeno (9 arquivos, 3 roteiros), para testar o mecanismo sem o conteúdo real. */
export async function criarFixtureMinimo(pasta: string): Promise<void> {
  const arquivos = ARQUIVOS_MINIMO
  for (const a of arquivos) await gravar(pasta, naBase(a.caminho), a.conteudo)
  for (const n of ["01", "02", "03"]) await gravar(pasta, `roteiros/${n}.md`, `Roteiro da etapa ${n}`)
  const manifesto = {
    fixture: "mini",
    prospect: { nome: "Cliente Teste", site: "https://teste.example" },
    overrides: "O site é simulado.",
    arquivos: arquivos.map(({ caminho, etapa }) => ({ caminho, etapa })),
    kit: { "01": ["contexto/brutos/kickoff-transcricao-bruta.md"], "03": ["dados/historico-mensal.xlsx"] },
  }
  // Roteiro de ensaio da etapa 03, com 2 trechos, para testar o índice de trechos do cliente de teste.
  const passo = (texto: string) => ({ dtMs: 0, evento: { tipo: "texto", texto } })
  const roteiro03 = {
    versao: 1,
    etapa: "03",
    trechos: [
      { gatilho: "mensagem", textoPreenchido: "Segue a planilha.", passos: [passo("Recebi a planilha.")] },
      { gatilho: "aprovar", textoPreenchido: null, passos: [passo("Aprovado.")] },
    ],
  }
  await gravar(pasta, "ensaio/03/roteiro.json", JSON.stringify(roteiro03, null, 2))
  await gravar(pasta, "manifesto.json", JSON.stringify(manifesto, null, 2))
  await gravar(pasta, "estado-completo.json", JSON.stringify(estadoCompletoMinimo(), null, 2))
}
