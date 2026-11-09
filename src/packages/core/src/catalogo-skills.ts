import { readFileSync } from "node:fs"
import path from "node:path"
import {
  ID_VISAO_GERAL,
  REGRAS_DO_CATALOGO,
  SUBAGENTES_DO_CATALOGO,
  type ConteudoItem,
  type GrupoSkill,
  type ItemCatalogo,
} from "./catalogo-skills-tipos"
import type { Catalogo } from "./tipos"

/** Lê um arquivo em texto; `null` quando não existe. Injetável para teste. */
export type LeitorArquivo = (caminho: string) => string | null

const lerDoDisco: LeitorArquivo = (caminho) => {
  try {
    return readFileSync(caminho, "utf8")
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
    throw e
  }
}

const RESUMO_VISAO_GERAL =
  "Como as 9 etapas se encadeiam, o que cada uma entrega para a seguinte e onde entram os subagentes."
const RESUMO_REGRA: Record<string, string> = {
  "regra:padrao-visual": "Cores, tipografia e formato de gráficos e tabelas que toda etapa segue.",
  "regra:regras-de-validacao": "Rituais de checagem, checkpoints e handoff que toda etapa cumpre.",
  "regra:repertorio-solucoes": "Banco de soluções de referência usado para abrir cada problema do diagnóstico.",
}

/** Uma linha da tabela fixa. Os caminhos são relativos à raiz e só eles são lidos. */
interface EntradaTabela {
  id: string
  grupo: GrupoSkill
  /** Título e resumo usados quando não há o que ler (ou o arquivo não traz o dado). */
  titulo: string
  resumo: string
  texto: string | null
  fluxo: string | null
  subagente: boolean
}

/** Monta a tabela só com texto fixo e o catálogo: nenhum id de fora entra aqui, e nada é lido. */
function tabelaFixa(catalogo: Catalogo): Map<string, EntradaTabela> {
  const mapa = new Map<string, EntradaTabela>()
  const add = (e: EntradaTabela): void => {
    mapa.set(e.id, e)
  }

  add({
    id: ID_VISAO_GERAL,
    grupo: "Processo",
    titulo: "Visão geral do processo",
    resumo: RESUMO_VISAO_GERAL,
    texto: null,
    fluxo: ".claude/skills/_shared/fluxo-geral.mmd",
    subagente: false,
  })

  for (const e of catalogo.etapas) {
    const pasta = e.skill ? `.claude/skills/${e.skill}` : null
    add({
      id: `etapa:${e.id}`,
      grupo: "Etapas",
      titulo: e.rotuloStatus,
      resumo: e.descricao,
      texto: pasta ? `${pasta}/SKILL.md` : null,
      fluxo: pasta ? `${pasta}/fluxo.mmd` : null,
      subagente: false,
    })
  }

  for (const nome of SUBAGENTES_DO_CATALOGO) {
    add({
      id: `subagente:${nome}`,
      grupo: "Subagentes",
      titulo: nome,
      resumo: "",
      texto: `.claude/agents/${nome}.md`,
      fluxo: `.claude/agents/${nome}.fluxo.mmd`,
      subagente: true,
    })
  }

  for (const r of REGRAS_DO_CATALOGO) {
    add({
      id: r.id,
      grupo: "Regras compartilhadas",
      titulo: r.titulo,
      resumo: RESUMO_REGRA[r.id] ?? "",
      texto: `.claude/skills/_shared/${r.arquivo}.md`,
      fluxo: null,
      subagente: false,
    })
  }
  return mapa
}

function valorDoCabecalho(texto: string, chave: string): string {
  const achado = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)
  const linha = new RegExp(`^${chave}:[ \\t]*(.*)$`, "m").exec(achado?.[1] ?? "")
  return (linha?.[1] ?? "").trim()
}

function montarItem(e: EntradaTabela, texto: string | null): ItemCatalogo {
  let titulo = e.titulo
  let resumo = e.resumo
  if (e.subagente && texto !== null) {
    titulo = valorDoCabecalho(texto, "name") || titulo
    resumo = valorDoCabecalho(texto, "description") || resumo
  }
  return { id: e.id, grupo: e.grupo, titulo, resumo, temFluxo: e.fluxo !== null }
}

/** Itens na ordem: visão geral, etapas (ordem do catálogo), subagentes, regras. */
export function itensDoCatalogo(raiz: string, catalogo: Catalogo, ler: LeitorArquivo = lerDoDisco): ItemCatalogo[] {
  return [...tabelaFixa(catalogo).values()].map((e) => {
    const texto = e.subagente && e.texto ? ler(path.join(raiz, e.texto)) : null
    return montarItem(e, texto)
  })
}

/** `null` quando o id não está na tabela fixa; nesse caso nenhum arquivo é lido. */
export function lerItemDoCatalogo(
  raiz: string,
  catalogo: Catalogo,
  id: string,
  ler: LeitorArquivo = lerDoDisco,
): ConteudoItem | null {
  const e = tabelaFixa(catalogo).get(id)
  if (!e) return null
  const texto = e.texto ? ler(path.join(raiz, e.texto)) : null
  const fluxo = e.fluxo ? ler(path.join(raiz, e.fluxo)) : null
  return { ...montarItem(e, texto), texto, fluxo }
}
