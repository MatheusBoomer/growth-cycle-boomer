import type { AjusteBiblioteca, ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Comentario, MapaPrevia, Regiao } from "@workspace/core/comentarios"
import type { ConteudoItem, ItemCatalogo } from "@workspace/core/catalogo-skills-tipos"
import type { PainelMetricas } from "@workspace/core/metricas/painel"
import type { MediaEtapa, MetricasProjeto } from "@workspace/core/metricas/resumo"
import type { EscolhaModelo, ListaDeModelos, Sugestao, UsoDaEtapa } from "@workspace/core/modelos"
import type { LinhaConfigModelo } from "@workspace/core/nuvem/tipos"
import type { PessoaRegistrada } from "@workspace/core/nuvem/usuarios"
import type { NotaSkill } from "@workspace/core/notas-skills"
import type { MudancaReport, Report, StatusReport, TipoReport } from "@workspace/core/reports"
import { consultaDoFiltro } from "./filtro-reports"
import type { OpcoesPainel } from "@workspace/core/servico-planejamento"
import type { Papel } from "@workspace/core/papeis"
import type { EtapaId, ResultadoValidacao, ResumoProspect, RespostaTeste } from "@workspace/core/tipos"
import { tratarNaoAutenticado } from "@/lib/login"

export interface AjusteMensagem {
  entregavelId: string
  marcas: { forma: string; x: number; y: number; w: number; h: number }[]
  imagem?: string
}

export class ErroApi extends Error {
  readonly status: number
  readonly codigo: string | null
  readonly dados: Record<string, unknown>
  constructor(message: string, status: number, codigo: string | null, dados: Record<string, unknown>) {
    super(message)
    this.status = status
    this.codigo = codigo
    this.dados = dados
  }
}

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) {
    const codigo = typeof corpo.codigo === "string" ? corpo.codigo : null
    // Sessão expirada no meio do uso: o erro segue para quem chamou, e o navegador vai ao login.
    if (typeof window !== "undefined") tratarNaoAutenticado(r.status, codigo, window.location, (destino) => window.location.assign(destino))
    throw new ErroApi(typeof corpo.erro === "string" ? corpo.erro : `Erro ${r.status}`, r.status, codigo, corpo)
  }
  return corpo as T
}

const comJson = (metodo: string, corpo: unknown): RequestInit => ({
  method: metodo,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(corpo),
})

function multipart(arquivo: File): RequestInit {
  const dados = new FormData()
  dados.set("arquivo", arquivo)
  return { method: "POST", body: dados }
}

const base = (slug: string) => `/api/prospects/${encodeURIComponent(slug)}`
export type PessoaComProjetos = PessoaRegistrada & { projetos: number }
export type ProjetoComMetricas = ResumoProspect & { metricas: MetricasProjeto }
export type MediasPorEtapa = Partial<Record<EtapaId, MediaEtapa>>
export interface EtapaConfiguravel {
  id: EtapaId
  rotulo: string
  alvos: string[]
}
/** Resposta de GET /api/admin/modelos: etapas e alvos, o que está gravado, as sugestões da agência, os modelos disponíveis, o modelo padrão e o uso por etapa. */
export interface ConfigModelos {
  etapas: EtapaConfiguravel[]
  config: LinhaConfigModelo[]
  sugestoes: Sugestao[]
  lista: ListaDeModelos
  padrao: string | null
  uso: Partial<Record<EtapaId, UsoDaEtapa>>
}
export type ItemSkill = ItemCatalogo & { notasAbertas: number }
/** Resposta de GET /api/admin/skills: os itens do catálogo e o texto das notas abertas, pronto para copiar. `notasDisponiveis` é falso no modo fs. */
export interface CatalogoSkills {
  itens: ItemSkill[]
  textoExportacao: string
  notasDisponiveis: boolean
}
export type DetalheItemSkill = ConteudoItem & { notas: NotaSkill[]; notasDisponiveis: boolean }
/** Resposta do detalhe de um projeto; `medias` só vem quando pedidas (`medias: true`), senão é null. */
export interface DetalheProjeto {
  projeto: ResumoProspect
  metricas: MetricasProjeto
  medias: MediasPorEtapa | null
}
/** Resposta de GET /api/admin/painel: o painel filtrado, as opções dos filtros e a foto de cada dono (e-mail para URL). */
export interface RespostaPainel {
  painel: PainelMetricas
  opcoes: OpcoesPainel
  avatares: Record<string, string>
}
export interface CorpoPresenca {
  etapa: EtapaId
  visivel: boolean
  segundosSemInteracao: number
}
export type AcaoEtapa = "iniciar" | "concluir" | "reabrir" | "confirmar" | "revisar" | "parar"

export const api = {
  criarProspect: (nome: string, site: string) => chamar<{ slug: string }>("/api/prospects", comJson("POST", { nome, site })),
  /** Cria o cliente de teste (modelo Verdeluz) já no início de `etapa`. */
  criarClienteTeste: (etapa: EtapaId) => chamar<{ slug: string }>("/api/cliente-teste", comJson("POST", { etapa })),
  excluirProspect: (slug: string, confirmacao: string) => chamar(base(slug), comJson("DELETE", { confirmacao })),
  abrirPasta: (slug: string) => chamar(`${base(slug)}/abrir-pasta`, { method: "POST" }),
  mostrarNoFinder: (slug: string, caminho: string) => chamar(`${base(slug)}/abrir-pasta`, comJson("POST", { caminho })),
  /** Kit do analista no cliente de teste; sem `etapa`, o da etapa de partida. */
  kitTeste: (slug: string, etapa?: EtapaId) => chamar<RespostaTeste>(`${base(slug)}/teste${etapa ? `?etapa=${etapa}` : ""}`),
  reposicionarTeste: (slug: string, etapa: EtapaId) => chamar<{ ok: true }>(`${base(slug)}/teste/reposicionar`, comJson("POST", { etapa })),
  acaoEtapa: (slug: string, etapa: EtapaId, acao: AcaoEtapa) => chamar(`${base(slug)}/etapas/${etapa}/acoes`, comJson("POST", { acao })),
  /** `ajustes`: entregáveis pendentes citados na mensagem; `imagem` é o PNG em base64 do gráfico com as marcações numeradas. */
  enviarMensagem: (slug: string, etapa: EtapaId, texto: string, ajustes?: AjusteMensagem[]) =>
    chamar(`${base(slug)}/etapas/${etapa}/mensagens`, comJson("POST", { texto, ajustes })),
  aprovar: (slug: string, id: string) => chamar(`${base(slug)}/entregaveis/${id}`, comJson("POST", { acao: "aprovar" })),
  editarEntregavel: (slug: string, id: string, conteudo: string) =>
    chamar(`${base(slug)}/entregaveis/${id}`, comJson("POST", { acao: "editar", conteudo })),
  previa: (slug: string, id: string) =>
    chamar<{ disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }>(`${base(slug)}/entregaveis/${id}/previa`),
  previaPlanilha: (slug: string, id: string) =>
    chamar<{ disponivel: boolean; caminho: string | null; erro: string | null }>(`${base(slug)}/entregaveis/${id}/previa-planilha`),
  comentarios: (slug: string, id: string) => chamar<{ comentarios: Comentario[] }>(`${base(slug)}/entregaveis/${id}/comentarios`),
  comentar: (slug: string, id: string, d: { slide: number; regiao: Regiao | null; texto: string }) =>
    chamar<{ comentario: Comentario }>(`${base(slug)}/entregaveis/${id}/comentarios`, comJson("POST", d)),
  editarComentario: (slug: string, id: string, cid: string, texto: string) =>
    chamar(`${base(slug)}/entregaveis/${id}/comentarios/${cid}`, comJson("PATCH", { texto })),
  apagarComentario: (slug: string, id: string, cid: string) => chamar(`${base(slug)}/entregaveis/${id}/comentarios/${cid}`, { method: "DELETE" }),
  enviarComentarios: (slug: string, id: string) => chamar<{ enviados: number }>(`${base(slug)}/entregaveis/${id}/comentarios/enviar`, { method: "POST" }),
  enviarInsumo: (slug: string, etapa: EtapaId, insumoId: string, arquivo: File) =>
    chamar<ResultadoValidacao>(`${base(slug)}/etapas/${etapa}/insumos/${insumoId}`, multipart(arquivo)),
  removerInsumo: (slug: string, etapa: EtapaId, insumoId: string) =>
    chamar(`${base(slug)}/etapas/${etapa}/insumos/${insumoId}`, { method: "DELETE" }),
  enviarLink: (slug: string, etapa: EtapaId, insumoId: string, url: string) =>
    chamar<ResultadoValidacao>(`${base(slug)}/etapas/${etapa}/insumos/${insumoId}`, comJson("POST", { url })),
  listarArquivos: (slug: string) => chamar<{ arquivos: { caminho: string; modificadoEm: string }[] }>(`${base(slug)}/arquivos`),
  enviarAnexo: (slug: string, etapa: EtapaId, arquivo: File) =>
    chamar<{ caminho: string }>(`${base(slug)}/etapas/${etapa}/anexos`, multipart(arquivo)),
  biblioteca: (slug: string) => chamar<{ itens: ItemBiblioteca[] }>(`${base(slug)}/biblioteca`, { cache: "no-store" }),
  ajustarBiblioteca: (slug: string, caminho: string, mudanca: AjusteBiblioteca) =>
    chamar<{ item: ItemBiblioteca }>(`${base(slug)}/biblioteca`, comJson("PATCH", { caminho, ...mudanca })),
  /** Só admin: quem já entrou no app, com o papel e quantos projetos ativos cada um tem. */
  listarPessoas: () => chamar<{ pessoas: PessoaComProjetos[]; admins: number }>("/api/admin/pessoas", { cache: "no-store" }),
  alterarPapel: (email: string, papel: Papel) => chamar<{ ok: true }>("/api/admin/pessoas/papel", comJson("POST", { email, papel })),
  /** Só admin: modelo e esforço de cada alvo das etapas, com as sugestões e os modelos que a conta enxerga. */
  configModelos: () => chamar<ConfigModelos>("/api/admin/modelos", { cache: "no-store" }),
  /** Só admin: grava o modelo e o esforço de um alvo da etapa; nulo é "padrão", e os dois nulos apagam a linha. */
  salvarModelo: (etapa: EtapaId, alvo: string, escolha: EscolhaModelo) =>
    chamar<{ ok: true }>(`/api/admin/modelos/${encodeURIComponent(etapa)}/${encodeURIComponent(alvo)}`, comJson("PUT", escolha)),
  /** Só admin: o catálogo de skills com a contagem de notas abertas e o texto de exportação das notas. */
  itensSkills: () => chamar<CatalogoSkills>("/api/admin/skills", { cache: "no-store" }),
  /** Só admin: texto, fluxo e notas de um item do catálogo (`id` como `etapa:03`). */
  itemSkill: (id: string) => chamar<DetalheItemSkill>(`/api/admin/skills/${encodeURIComponent(id)}`, { cache: "no-store" }),
  /** Só admin: anota uma melhoria no item do catálogo. */
  criarNotaSkill: (id: string, texto: string) =>
    chamar<{ nota: NotaSkill }>(`/api/admin/skills/${encodeURIComponent(id)}/notas`, comJson("POST", { texto })),
  /** Só admin: resolve (`true`) ou reabre (`false`) uma nota. */
  marcarNotaSkill: (notaId: number, resolvida: boolean) =>
    chamar<{ nota: NotaSkill }>(`/api/admin/skills/notas/${notaId}`, comJson("PATCH", { resolvida })),
  /** Qualquer usuário logado: envia um report de bug ou melhoria (formulário de `montarFormularioReport`). */
  enviarReport: (form: FormData) => chamar<{ id: number }>("/api/reports", { method: "POST", body: form }),
  /** Só admin: reports filtrados, os mais recentes primeiro. */
  listarReports: (f: { status: StatusReport[]; tipo: TipoReport | null }) =>
    chamar<{ reports: Report[] }>(`/api/admin/reports${consultaDoFiltro(f)}`, { cache: "no-store" }),
  /** Só admin: muda status e/ou nota interna. */
  atualizarReport: (id: number, mudanca: MudancaReport) =>
    chamar<{ report: Report }>(`/api/admin/reports/${id}`, comJson("PATCH", mudanca)),
  /** Só admin: endereço da n-ésima imagem do report (0 é o print da tela, quando existe). */
  urlImagemReport: (id: number, n: number) => `/api/admin/reports/${id}/imagens/${n}`,
  /** Só admin: custo e tempo de cada projeto ativo e a média por etapa concluída. */
  metricasGerais: () => chamar<{ projetos: ProjetoComMetricas[]; medias: MediasPorEtapa }>("/api/admin/projetos", { cache: "no-store" }),
  /** Só admin: o resumo e as métricas de um projeto. As médias por etapa (mais caras) só vêm com `{ medias: true }`. */
  metricasDoProjeto: (slug: string, { medias }: { medias?: boolean } = {}) =>
    chamar<DetalheProjeto>(`/api/admin/projetos/${encodeURIComponent(slug)}${medias ? "?medias=1" : ""}`, { cache: "no-store" }),
  /** Só admin: o painel de métricas com os filtros em `params` (ver `parametrosDeFiltro`); `atualizar=1` força a releitura. */
  painelMetricas: (params: URLSearchParams) => chamar<RespostaPainel>("/api/admin/painel?" + params.toString(), { cache: "no-store" }),
  /** Aviso de presença: nunca lança (falha é ignorada em silêncio) e `keepalive` deixa o último sair ao fechar a aba. */
  enviarPresenca: async (slug: string, corpo: CorpoPresenca): Promise<void> => {
    try {
      await fetch(`${base(slug)}/presenca`, { ...comJson("POST", corpo), keepalive: true })
    } catch {
      // Sem rede ou aba fechando: o próximo aviso cobre.
    }
  },
  trocarDono: (slug: string, email: string) => chamar<{ ok: true }>(`/api/admin/prospects/${encodeURIComponent(slug)}/dono`, comJson("POST", { email })),
}

/** `nome` (só com download): nome do arquivo baixado, sem extensão. */
export function urlArquivo(slug: string, caminho: string, download = false, nome?: string): string {
  return `${base(slug)}/arquivo?caminho=${encodeURIComponent(caminho)}${download ? "&download=1" : ""}${download && nome ? `&nome=${encodeURIComponent(nome)}` : ""}`
}

export function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado."
}
