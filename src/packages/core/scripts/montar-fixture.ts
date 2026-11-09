// Colhe o cliente de produção (clientes/verdeluz-producao) e grava o fixture clientes/_fixtures/verdeluz. Em src/:
//   npm run montar-fixture
//   npm run montar-fixture -- --producao ../clientes/verdeluz-producao --saida ../clientes/_fixtures/verdeluz
import { createHash } from "node:crypto"
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { carregarCatalogo } from "../src/catalogo"
import { destinoAprovado, EXTENSAO_POR_TIPO } from "../src/entregaveis"
import { estadoInicial } from "../src/maquina-estados"
import { ORDEM_ETAPAS, type Entregavel, type Estado, type EstadoInsumo, type EtapaId, type TipoEntregavel } from "../src/tipos"
import { caminhoSaidaSeguro, type EtapaManifesto, type Manifesto } from "../src/fixture"

const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(import.meta.dirname, "../../../..")
const argumentos = process.argv.slice(2)
const argumento = (nome: string, padrao: string) => {
  const i = argumentos.indexOf(nome)
  if (i < 0) return padrao
  const valor = argumentos[i + 1]
  if (!valor || valor.startsWith("--")) throw new Error(`${nome} precisa de um valor`)
  return valor
}
const producao = path.resolve(argumento("--producao", path.join(raiz, "clientes/verdeluz-producao")))
const saida = caminhoSaidaSeguro(raiz, argumento("--saida", path.join(raiz, "clientes/_fixtures/verdeluz")))
const catalogo = carregarCatalogo(raiz)

const NOME_DO_CLIENTE = "Verdeluz Teste"
const SITE = "https://www.verdeluz.example"
const IGNORADOS = new Set(["README.md", "CLAUDE.md", "status-planejamento.md", ".DS_Store"])
const PRIMEIRO = "2026-10-22T10:00:00.000Z"
/** O benchmark de anúncios pertencia à antiga etapa 07, hoje desativada: o que o cliente de produção tiver dele não entra no fixture. */
const NAO_COLHIDOS = ["dados/benchmark-meta/", "entrega/ativos-aprovados/benchmark/"]

/** Etapa que produz cada gráfico ou tabela PNG, com o tipo e o título do entregável. */
const GRAFICOS: Record<string, [EtapaId, "grafico" | "tabela", string]> = {
  "investimento-midia-mensal": ["03", "grafico", "Investimento em mídia paga mês a mês"],
  "receita-captada-vs-aprovada": ["03", "grafico", "Receita captada vs. aprovada, mês a mês"],
  "taxa-quebra-mensal": ["03", "grafico", "Taxa de quebra mensal vs. benchmark de 5%"],
  "quebra-por-meio-pagamento": ["03", "grafico", "Taxa de quebra por meio de pagamento"],
  "roas-global": ["03", "grafico", "ROAS global"],
  "roas-plataformas": ["03", "grafico", "ROAS por plataforma (GA4)"],
  "sessoes-por-plataforma": ["03", "grafico", "Sessões totais e por plataforma"],
  "dependencia-midia-paga": ["03", "grafico", "Dependência de mídia paga"],
  "conversao-global": ["03", "grafico", "Taxa de conversão global"],
  "conversao-google": ["03", "grafico", "Taxa de conversão do Google"],
  "conversao-meta": ["03", "grafico", "Taxa de conversão do Meta"],
  "curva-abc-faturamento": ["03", "grafico", "Faturamento por Curva ABC"],
  "top10-produtos": ["03", "grafico", "Top 10 produtos por faturamento"],
  "tabela-curva-abc-a": ["03", "tabela", "Curva ABC: curva A"],
  "tabela-curva-abc-b": ["03", "tabela", "Curva ABC: curva B"],
  "tabela-curva-abc-c": ["03", "tabela", "Curva ABC: curva C"],
  "cac-mensal": ["04", "grafico", "CAC mensal"],
  "novos-vs-recorrentes": ["04", "grafico", "Pedidos de clientes novos vs. recorrentes"],
  "meta-realista-vs-ano-atual": ["06", "grafico", "Receita do ano atual vs. cenário Realista"],
  "cenarios-pessimista-realista-otimista": ["06", "grafico", "Cenários Pessimista, Realista e Otimista"],
  "tabela-cenarios-projecao": ["06", "tabela", "Tabela dos cenários de projeção"],
  "alocacao-verba-plataforma": ["07", "grafico", "Alocação de verba por plataforma"],
  "tabela-alocacao-verba-plataforma": ["07", "tabela", "Tabela de alocação de verba por plataforma"],
  "tabela-curva-abc-estrategia": ["07", "tabela", "Estratégia de mídia por Curva ABC"],
  "tabela-calendario-estrategico": ["07", "tabela", "Calendário estratégico de mídia"],
  "roas-esperado-plataforma": ["07", "grafico", "ROAS esperado por plataforma"],
}

/** Insumos recebidos em cada etapa e o arquivo de destino de cada um. */
const INSUMOS: { etapa: EtapaId; id: string; arquivo: string; resumo: string }[] = [
  { etapa: "01", id: "kickoff-transcricao", arquivo: "contexto/brutos/kickoff-transcricao-bruta.docx", resumo: "Transcrição bruta do kickoff" },
  { etapa: "01", id: "formulario-cliente", arquivo: "contexto/brutos/formulario-cliente.docx", resumo: "Formulário pré-kickoff" },
  { etapa: "01", id: "site", arquivo: "contexto/site-referencia.md", resumo: SITE },
  { etapa: "03", id: "historico-mensal", arquivo: "dados/historico-mensal.xlsx", resumo: "12 meses (OUTUBRO a SETEMBRO)" },
  { etapa: "03", id: "produtos-curva-abc", arquivo: "dados/produtos-curva-abc.xlsx", resumo: "58 linhas de dados" },
  { etapa: "03", id: "quebra-pagamento", arquivo: "dados/quebra-pagamento.xlsx", resumo: "36 linhas de dados" },
  { etapa: "04", id: "clientes-historico", arquivo: "dados/clientes-historico.xlsx", resumo: "10400 linhas de dados" },
  { etapa: "07", id: "prints-campanhas", arquivo: "contexto/brutos/prints-campanhas/print-01.png", resumo: "4 prints de campanha" },
]

/** Arquivos que o analista envia (kit de cada etapa). */
const KIT: Partial<Record<EtapaId, string[]>> = {
  "01": ["contexto/brutos/kickoff-transcricao-bruta.docx", "contexto/brutos/formulario-cliente.docx"],
  "03": ["dados/historico-mensal.xlsx", "dados/produtos-curva-abc.xlsx", "dados/quebra-pagamento.xlsx"],
  "04": ["dados/clientes-historico.xlsx"],
  "07": [1, 2, 3, 4].map((n) => `contexto/brutos/prints-campanhas/print-0${n}.png`),
}

const emBarras = (p: string) => p.split(path.sep).join("/")
const idDeterministico = (texto: string) => {
  const h = createHash("sha1").update(texto).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}
const momento = (etapa: EtapaId, minutos = 0) => {
  const i = ORDEM_ETAPAS.indexOf(etapa)
  return new Date(Date.parse(PRIMEIRO) + i * 3_600_000 + minutos * 60_000).toISOString()
}

function etapaDoArquivo(rel: string): EtapaManifesto {
  if (rel === "contexto/site-referencia.md" || rel === "contexto/brutos/site-simulado.md") return "00"
  const decisao = rel.match(/^contexto\/decisoes\/(\d\d)-/)
  if (decisao) return decisao[1] === "09" ? "final" : (decisao[1] as EtapaId)
  const secao = rel.match(/^entrega\/ativos-aprovados\/secoes\/(\d\d)-/)
  if (secao) return secao[1] as EtapaId
  const grafico = rel.match(/^entrega\/ativos-aprovados\/graficos\/(.+)\.png$/)
  if (grafico && GRAFICOS[grafico[1]!]) return GRAFICOS[grafico[1]!]![0]
  const tabela: Record<string, EtapaManifesto> = {
    "contexto/brutos/kickoff-transcricao-bruta.docx": "01", "contexto/brutos/formulario-cliente.docx": "01", "contexto/kickoff-transcricao.md": "01",
    "contexto/contextualizacao-estrategica.md": "02",
    "dados/historico-mensal.xlsx": "03", "dados/produtos-curva-abc.xlsx": "03", "dados/quebra-pagamento.xlsx": "03",
    "dados/clientes-historico.xlsx": "04", "contexto/solucoes.json": "05",
    "entrega/ativos-aprovados/projecao/projecao-de-cenarios.xlsx": "06",
    "entrega/ativos-aprovados/plano-de-acao/plano-de-acao-estrategico.docx": "08",
    "entrega/ativos-aprovados/apresentacao/roteiro-apresentacao.json": "final", "entrega/apresentacao-final.pptx": "final",
  }
  if (tabela[rel]) return tabela[rel]!
  if (rel.startsWith("contexto/brutos/prints-campanhas/")) return "07"
  throw new Error(`Arquivo do cliente de produção sem etapa definida: ${rel}`)
}

async function listar(pasta: string, base = pasta): Promise<string[]> {
  const itens = await readdir(pasta, { withFileTypes: true })
  const arquivos: string[] = []
  for (const i of itens) {
    if (IGNORADOS.has(i.name) || i.name === ".app") continue
    const abs = path.join(pasta, i.name)
    if (i.isDirectory()) arquivos.push(...(await listar(abs, base)))
    else arquivos.push(emBarras(path.relative(base, abs)))
  }
  return arquivos.filter((rel) => !NAO_COLHIDOS.some((p) => rel.startsWith(p))).sort()
}

async function copiar(origem: string, destino: string) {
  await mkdir(path.dirname(destino), { recursive: true })
  await copyFile(origem, destino)
}

const naBase = (rel: string) => path.join(saida, "base", rel.startsWith(".app/") ? `app/${rel.slice(5)}` : rel)

function tipoDoAprovado(rel: string): { tipo: TipoEntregavel; etapa: EtapaId; nomeFinal: string; titulo: string } | null {
  const base = path.posix.basename(rel)
  const secao = rel.match(/^entrega\/ativos-aprovados\/secoes\/(\d\d)-(.+)\.md$/)
  if (secao) return { tipo: "secao", etapa: secao[1] as EtapaId, nomeFinal: secao[2]!, titulo: "" }
  const grafico = rel.match(/^entrega\/ativos-aprovados\/graficos\/(.+)\.png$/)
  if (grafico) {
    const [etapa, tipo, titulo] = GRAFICOS[grafico[1]!]!
    return { tipo, etapa, nomeFinal: grafico[1]!, titulo }
  }
  const unicos: Record<string, { tipo: TipoEntregavel; etapa: EtapaId; nomeFinal: string; titulo: string }> = {
    "projecao-de-cenarios.xlsx": { tipo: "planilha", etapa: "06", nomeFinal: "projecao-de-cenarios", titulo: "Planilha de projeção de cenários" },
    "plano-de-acao-estrategico.docx": { tipo: "documento", etapa: "08", nomeFinal: "plano-de-acao-estrategico", titulo: "Plano de ação estratégico" },
    "roteiro-apresentacao.json": { tipo: "roteiro", etapa: "final", nomeFinal: "roteiro-apresentacao", titulo: "Roteiro da apresentação final (55 slides)" },
    "apresentacao-final.pptx": { tipo: "apresentacao", etapa: "final", nomeFinal: "apresentacao", titulo: "Apresentação final (55 slides)" },
  }
  return rel.startsWith("entrega/") ? (unicos[base] ?? null) : null
}

function secao(texto: string, titulo: string): string {
  const m = texto.match(new RegExp(`^### ${titulo}\\s*\\n([\\s\\S]*?)(?=^### |^## |(?![\\s\\S]))`, "m"))
  if (!m) throw new Error(`producao.md: falta a subseção "${titulo}"`)
  return m[1]!.trim()
}

async function main() {
  await stat(producao).catch(() => {
    throw new Error(`Cliente de produção não encontrado: ${producao}`)
  })
  // Tudo que pode faltar é lido e validado antes de apagar a saída anterior.
  const diario = await readFile(path.join(raiz, "scripts/fixture_verdeluz/producao.md"), "utf8")
  const overrides = (await readFile(path.join(raiz, "scripts/fixture_verdeluz/overrides.md"), "utf8")).trim()
  const textosDasEtapas = await Promise.all(
    catalogo.etapas.map(async (cat) => {
      const parte = diario.split(new RegExp(`^## Etapa ${cat.id}\\s*$`, "m"))[1]?.split(/^## Etapa /m)[0]
      if (!parte) throw new Error(`producao.md: falta a seção "## Etapa ${cat.id}"`)
      const decisoes = await readFile(path.join(producao, `contexto/decisoes/${cat.skill}.md`), "utf8")
      return { cat, decisoes, handoff: secao(parte, "Handoff"), enviar: secao(parte, "O que enviar"), responder: secao(parte, "O que responder ao agente") }
    }),
  )
  await rm(saida, { recursive: true, force: true })

  const arquivos: Manifesto["arquivos"] = []
  const entregaveis: Entregavel[] = []
  for (const rel of await listar(producao)) {
    await copiar(path.join(producao, rel), naBase(rel))
    arquivos.push({ caminho: rel, etapa: etapaDoArquivo(rel) })
    const ap = rel.startsWith("entrega/") ? tipoDoAprovado(rel) : null
    if (!ap) continue
    const id = idDeterministico(rel)
    const rascunho = `.app/propostas/${id}${EXTENSAO_POR_TIPO[ap.tipo]}`
    await copiar(path.join(producao, rel), naBase(rascunho))
    arquivos.push({ caminho: rascunho, etapa: ap.etapa })
    const titulo = ap.titulo || ((await readFile(path.join(producao, rel), "utf8")).match(/^#\s+(.+)$/m)?.[1] ?? ap.nomeFinal)
    const e: Entregavel = { id, etapa: ap.etapa, tipo: ap.tipo, titulo, arquivoRascunho: rascunho, nomeFinal: ap.nomeFinal, status: "aprovado", ajustePedido: null, criadoEm: momento(ap.etapa, 30), decididoEm: momento(ap.etapa, 50) }
    if (destinoAprovado(e) !== rel) throw new Error(`Entregável inconsistente: ${rel} contra ${destinoAprovado(e)}`)
    entregaveis.push(e)
  }

  const etapas = {} as Estado["etapas"]
  const roteiros: string[] = []
  for (const { cat, decisoes, handoff, enviar, responder } of textosDasEtapas) {
    const id = cat.id
    etapas[id] = {
      status: "concluida", sessionId: null, iniciadaEm: momento(id), concluidaEm: momento(id, 55), sinalizada: true,
      resumoDecisoes: decisoes.replace(/^# .*\n+/, "").trim(), handoff, origem: "app", observacao: null,
    }
    await mkdir(path.join(saida, "roteiros"), { recursive: true })
    await writeFile(
      path.join(saida, `roteiros/${id}.md`),
      `# ${cat.rotuloStatus}: roteiro do cliente de teste\n\nMaterial fictício. Use estas informações para preencher a etapa.\n\n## O que enviar\n\n${enviar}\n\n## O que responder ao agente\n\n${responder}\n`,
    )
    roteiros.push(id)
  }

  const insumos: EstadoInsumo[] = INSUMOS.map((i) => ({ etapa: i.etapa, insumoId: i.id, status: "valido", problemas: [], avisos: [], resumo: i.resumo, arquivo: i.arquivo, atualizadoEm: momento(i.etapa, 5) }))
  const base = estadoInicial({ slug: "verdeluz-teste", nome: NOME_DO_CLIENTE, site: SITE }, PRIMEIRO)
  const estado: Estado = { ...base, etapas, entregaveis, insumos, perguntas: [], filaAutomatica: [], atualizadoEm: momento("final", 55) }
  await writeFile(path.join(saida, "estado-completo.json"), JSON.stringify(estado, null, 2))

  const kit: Manifesto["kit"] = KIT
  const manifesto: Manifesto = { fixture: "verdeluz", prospect: { nome: NOME_DO_CLIENTE, site: SITE }, overrides, arquivos, kit }
  await writeFile(path.join(saida, "manifesto.json"), JSON.stringify(manifesto, null, 2))
  console.log(`Fixture gravado em ${saida}: ${arquivos.length} arquivos, ${entregaveis.length} entregáveis, ${insumos.length} insumos, ${roteiros.length} roteiros.`)
}

await main()
