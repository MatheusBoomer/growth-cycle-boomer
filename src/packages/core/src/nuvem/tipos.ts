import type { Comentario } from "../comentarios"
import type { Estado, EtapaId, EventoConversa } from "../tipos"

export interface EstadoVersionado {
  estado: Estado
  versao: number
}

export interface EntradaManifesto {
  caminho: string
  sha256: string
  tamanho: number
}

export interface RegistroUsoTurno {
  slug: string
  etapa: EtapaId
  autor: string | null
  custoUsd: number | null
  tokensEntrada: number | null
  tokensSaida: number | null
  inicio: string
  fim: string
  status: "ok" | "interrompido" | "erro"
}

/** Dados estruturados de cada prospect (estado, conversa, comentários, uso). */
export interface Repositorio {
  /** Ordenados, sem excluídos. */
  listarSlugs(): Promise<string[]>
  /** False se o prospect foi excluído. */
  existe(slug: string): Promise<boolean>
  /**
   * Cria o prospect. ErroProspectExistente se o slug já está ativo. Um slug excluído é recriado do zero:
   * os dados do antigo (conversa, comentários, uso, manifesto, lixeira) são apagados.
   * `criadoPor` (e-mail de quem criou) vai para `prospects.criado_por`; null sem login. Ao recriar, vale o novo criador.
   */
  criarProspect(slug: string, criadoPor?: string | null): Promise<void>
  /** Marca como excluído; ErroNaoEncontrado se não existe. */
  excluirProspect(slug: string): Promise<void>
  /** Null enquanto o estado ainda não foi gravado. */
  lerEstado(slug: string): Promise<EstadoVersionado | null>
  /** Devolve a nova versão; ErroConflitoVersao se `versaoLida` não é a atual. */
  gravarEstado(slug: string, estado: Estado, versaoLida: number): Promise<number>
  /** A coluna `autor` vem de `evento.autor` quando o evento é `mensagem_analista`; nos demais fica null. */
  anexarConversa(slug: string, etapa: EtapaId, evento: EventoConversa): Promise<void>
  /** Em ordem de inclusão. */
  lerConversa(slug: string, etapa: EtapaId): Promise<EventoConversa[]>
  /** Lista vazia se não há. */
  lerComentarios(slug: string, entregavelId: string): Promise<Comentario[]>
  gravarComentarios(slug: string, entregavelId: string, lista: Comentario[]): Promise<void>
  /** Apaga toda a conversa e todos os comentários do prospect; o prospect e o uso ficam. */
  limparConversasEComentarios(slug: string): Promise<void>
  registrarUso(r: RegistroUsoTurno): Promise<void>
  marcarSincronizacao(slug: string, pendente: boolean): Promise<void>
}

/** Arquivos do prospect, endereçados pelo conteúdo (objeto `<slug>/<sha256>`) e listados por um manifesto. */
export interface ArmazemArquivos {
  listarManifesto(slug: string): Promise<EntradaManifesto[]>
  /** Grava o objeto se faltar e faz upsert da entrada no manifesto. */
  enviar(slug: string, caminho: string, dados: Uint8Array): Promise<EntradaManifesto>
  /** ErroNaoEncontrado se não há objeto com esse hash. */
  baixar(slug: string, sha256: string): Promise<Uint8Array>
  /** Tira do manifesto e registra na lixeira; caminho ausente é ignorado. */
  remover(slug: string, caminho: string): Promise<void>
  enviarSessao(slug: string, sessionId: string, dados: Uint8Array): Promise<void>
  baixarSessao(slug: string, sessionId: string): Promise<Uint8Array | null>
  /**
   * Apaga tudo do slug: manifesto, lixeira e os objetos de `<slug>/` nos dois buckets (arquivos e sessões).
   * Não falha quando não há nada a apagar.
   */
  apagarTudo(slug: string): Promise<void>
}
