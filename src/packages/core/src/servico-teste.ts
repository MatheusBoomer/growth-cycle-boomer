import { copyFile, cp, mkdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import type { FsArmazenamento } from "./armazenamento"
import { ErroFixture } from "./erros"
import { antesDe, caminhoNaBase, etapaDoArquivo, type Fixture } from "./fixture"
import { estadoInicial, etapaVazia } from "./maquina-estados"
import { ORDEM_ETAPAS, type Estado, type EstadoEtapa, type EtapaId } from "./tipos"

const PASTAS_DO_MODELO = ["contexto", "dados", "entrega"]
const PASTAS_APAGADAS = [...PASTAS_DO_MODELO, ".app", "kit-de-teste"]
const PASTA_KIT = "kit-de-teste"
const ROTEIRO = "roteiro.md"

async function existe(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function copiarArquivo(origem: string, destino: string): Promise<void> {
  await mkdir(path.dirname(destino), { recursive: true })
  await copyFile(origem, destino)
}

/** Troca o corpo da seção de overrides do CLAUDE.md; sem texto ou sem a seção, devolve o CLAUDE.md como está. */
export function aplicarOverrides(claudeMd: string, texto: string | null): string {
  if (!texto) return claudeMd
  const titulo = /^## Overrides específicos deste prospect[ \t]*$/m.exec(claudeMd)
  if (!titulo) return claudeMd
  const fim = titulo.index + titulo[0].length
  const resto = claudeMd.slice(fim)
  const proxima = resto.search(/^## /m)
  const depois = proxima === -1 ? "" : `\n${resto.slice(proxima)}`
  return `${claudeMd.slice(0, fim)}\n\n${texto.trim()}\n${depois}`
}

function estadoDasEtapas(fixture: Fixture, etapa: EtapaId): Record<EtapaId, EstadoEtapa> {
  const posicao = ORDEM_ETAPAS.indexOf(etapa)
  const etapas = {} as Record<EtapaId, EstadoEtapa>
  for (const id of ORDEM_ETAPAS) {
    const i = ORDEM_ETAPAS.indexOf(id)
    if (i < posicao) {
      etapas[id] = { ...fixture.estadoCompleto.etapas[id], status: "concluida", sessionId: null, sinalizada: true, origem: "app" }
    } else {
      etapas[id] = etapaVazia(i === posicao ? "liberada" : "bloqueada")
    }
  }
  return etapas
}

/**
 * Apaga o trabalho feito no cliente de teste e o recompõe como se o planejamento tivesse ido até o fim da etapa anterior
 * a `etapa`. Devolve o novo estado; quem chama grava o estado.json e o status-planejamento.md.
 */
export async function reposicionarNoFixture(
  arm: FsArmazenamento,
  fixture: Fixture,
  atual: Estado,
  etapa: EtapaId,
  agora: string,
): Promise<Estado> {
  if (!ORDEM_ETAPAS.includes(etapa)) throw new ErroFixture(`Etapa desconhecida: ${etapa}`)
  const slug = atual.prospect.slug

  // Valida os kits antes de apagar qualquer coisa.
  const kits: { etapa: EtapaId; arquivos: { caminho: string; nome: string }[] }[] = []
  for (const k of ORDEM_ETAPAS.slice(ORDEM_ETAPAS.indexOf(etapa))) {
    const nomes = new Set<string>()
    const arquivos = (fixture.manifesto.kit[k] ?? []).map((caminho) => ({ caminho, nome: path.posix.basename(caminho) }))
    for (const a of arquivos) {
      if (nomes.has(a.nome)) throw new ErroFixture(`Fixture inválido: o kit da etapa ${k} tem dois arquivos chamados ${a.nome}.`)
      nomes.add(a.nome)
    }
    kits.push({ etapa: k, arquivos })
  }

  for (const pasta of PASTAS_APAGADAS) await rm(arm.caminhoAbsoluto(slug, pasta), { recursive: true, force: true })
  // No modo nuvem, conversa e comentários não estão em .app/: somem pelo banco.
  await arm.limparConversasEComentarios(slug)
  for (const pasta of PASTAS_DO_MODELO) {
    const modelo = path.join(arm.pastaClientes, "_template", pasta)
    if (await existe(modelo)) {
      await cp(modelo, arm.caminhoAbsoluto(slug, pasta), { recursive: true, filter: (o) => path.basename(o) !== ".DS_Store" })
    }
  }

  for (const a of fixture.manifesto.arquivos) {
    if (!antesDe(a.etapa, etapa)) continue
    await copiarArquivo(caminhoNaBase(fixture, a.caminho), arm.caminhoAbsoluto(slug, a.caminho))
  }

  for (const kit of kits) {
    for (const a of kit.arquivos) {
      await copiarArquivo(caminhoNaBase(fixture, a.caminho), arm.caminhoAbsoluto(slug, `${PASTA_KIT}/${kit.etapa}/${a.nome}`))
    }
    const roteiro = path.join(fixture.pasta, "roteiros", `${kit.etapa}.md`)
    if (await existe(roteiro)) await copiarArquivo(roteiro, arm.caminhoAbsoluto(slug, `${PASTA_KIT}/${kit.etapa}/${ROTEIRO}`))
  }

  arm.agendarSincronizacao(slug)

  const completo = fixture.estadoCompleto
  return {
    ...estadoInicial(atual.prospect, agora),
    prospect: atual.prospect,
    etapas: estadoDasEtapas(fixture, etapa),
    entregaveis: completo.entregaveis.filter((e) => antesDe(e.etapa, etapa)),
    insumos: completo.insumos.filter((i) => antesDe((i.arquivo && etapaDoArquivo(fixture, i.arquivo)) || i.etapa, etapa)),
    perguntas: [],
    filaAutomatica: [],
    teste: { fixture: fixture.id, etapaInicial: etapa },
    atualizadoEm: agora,
  }
}

/** Arquivos do kit da etapa (caminhos relativos ao cliente, sem o roteiro) e o roteiro de respostas. */
export async function lerKit(
  arm: FsArmazenamento,
  slug: string,
  etapa: EtapaId,
): Promise<{ arquivos: string[]; roteiro: string | null }> {
  const pasta = `${PASTA_KIT}/${etapa}`
  const nomes = await arm.listarArquivos(slug, pasta)
  return {
    arquivos: nomes.filter((n) => n !== ROTEIRO).map((n) => `${pasta}/${n}`),
    roteiro: await arm.lerTexto(slug, `${pasta}/${ROTEIRO}`),
  }
}
