import type { AjusteBiblioteca, ItemBiblioteca } from "@workspace/core/biblioteca"
import type { Comentario, MapaPrevia, Regiao } from "@workspace/core/comentarios"
import type { EtapaId, RespostaPergunta, ResultadoValidacao } from "@workspace/core/tipos"

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
    throw new ErroApi(
      typeof corpo.erro === "string" ? corpo.erro : `Erro ${r.status}`,
      r.status,
      typeof corpo.codigo === "string" ? corpo.codigo : null,
      corpo,
    )
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
export type AcaoEtapa = "iniciar" | "concluir" | "reabrir" | "confirmar" | "revisar" | "parar"

export const api = {
  criarProspect: (nome: string, site: string) => chamar<{ slug: string }>("/api/prospects", comJson("POST", { nome, site })),
  excluirProspect: (slug: string, confirmacao: string) => chamar(base(slug), comJson("DELETE", { confirmacao })),
  abrirPasta: (slug: string) => chamar(`${base(slug)}/abrir-pasta`, { method: "POST" }),
  mostrarNoFinder: (slug: string, caminho: string) => chamar(`${base(slug)}/abrir-pasta`, comJson("POST", { caminho })),
  acaoEtapa: (slug: string, etapa: EtapaId, acao: AcaoEtapa) => chamar(`${base(slug)}/etapas/${etapa}/acoes`, comJson("POST", { acao })),
  enviarMensagem: (slug: string, etapa: EtapaId, texto: string) =>
    chamar(`${base(slug)}/etapas/${etapa}/mensagens`, comJson("POST", { texto })),
  aprovar: (slug: string, id: string) => chamar(`${base(slug)}/entregaveis/${id}`, comJson("POST", { acao: "aprovar" })),
  editarEntregavel: (slug: string, id: string, conteudo: string) =>
    chamar(`${base(slug)}/entregaveis/${id}`, comJson("POST", { acao: "editar", conteudo })),
  /** `imagem`: PNG em base64 do gráfico com as marcações numeradas. */
  pedirAjuste: (slug: string, id: string, texto: string, imagem?: string) =>
    chamar(`${base(slug)}/entregaveis/${id}`, comJson("POST", { acao: "ajuste", texto, imagem })),
  responderPerguntas: (slug: string, id: string, respostas: RespostaPergunta[]) =>
    chamar(`${base(slug)}/perguntas/${encodeURIComponent(id)}`, comJson("POST", { respostas })),
  previa: (slug: string, id: string) =>
    chamar<{ disponivel: boolean; slides: string[]; mapa: MapaPrevia | null; erro: string | null }>(`${base(slug)}/entregaveis/${id}/previa`),
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
}

/** `nome` (só com download): nome do arquivo baixado, sem extensão. */
export function urlArquivo(slug: string, caminho: string, download = false, nome?: string): string {
  return `${base(slug)}/arquivo?caminho=${encodeURIComponent(caminho)}${download ? "&download=1" : ""}${download && nome ? `&nome=${encodeURIComponent(nome)}` : ""}`
}

export function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado."
}
