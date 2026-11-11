import type { Comentario } from "../comentarios"
import type { Acumulado, LinhaPresenca, LinhaUso } from "../metricas/tipos"
import type { NivelEsforco } from "../modelos"
import type { NotaSkill } from "../notas-skills"
import type { FiltroReports, ImagemReport, MudancaReport, NovoReport, Report } from "../reports"
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
  /** Conversa (sessão do SDK) do turno; null quando o executor não informou. */
  sessao: string | null
  /** Custo acumulado da conversa até o fim do turno, como o SDK reporta. */
  custoUsd: number | null
  /** Custo do turno em si (acumulado menos o do turno anterior da mesma sessão). */
  custoTurnoUsd: number | null
  /** Custo do turno por modelo. */
  modelos: Record<string, number> | null
  /** Custo acumulado por modelo, como o SDK reporta. */
  modelosAcumulado: Record<string, number> | null
  /** Esforço de raciocínio do turno, quando houver. */
  esforco: string | null
  tokensEntrada: number | null
  tokensSaida: number | null
  inicio: string
  fim: string
  status: "ok" | "interrompido" | "erro"
}

/** O que o `ServicoTurnos` informa; o custo do turno e por modelo o `ServicoPlanejamento` calcula antes de gravar. */
export type EntradaUsoTurno = Omit<RegistroUsoTurno, "custoTurnoUsd" | "modelos"> & {
  /**
   * Verdadeiro quando o turno rodou numa sessão que já existia (a mesma que o SDK devolveu), isto é, a conversa
   * continuou. Sem linha anterior da sessão, serve para abater o custo das linhas antigas da etapa.
   */
  retomada: boolean
}

/** Uma linha de `config_modelos`; `modelo` e `esforco` nulos valem "padrão". `esforco` vem do banco como texto. */
export interface LinhaConfigModelo {
  etapa: EtapaId
  alvo: string
  modelo: string | null
  esforco: string | null
  alteradoPor: string | null
  alteradoEm: string | null
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
  /** E-mail de quem é dono do prospect (`prospects.criado_por`), ou null sem dono. ErroNaoEncontrado se não existe ou foi excluído. */
  lerDono(slug: string): Promise<string | null>
  /** Dono de cada prospect ativo (null quando não há); excluídos ficam de fora. */
  listarDonos(): Promise<Map<string, string | null>>
  /** Passa o prospect para outro dono. ErroNaoEncontrado se não existe ou foi excluído. */
  trocarDono(slug: string, email: string): Promise<void>
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
  /** Acumulado do turno mais recente (por `fim`) dessa sessão no prospect; null se não há. */
  ultimoUsoDaSessao(slug: string, sessao: string): Promise<Acumulado | null>
  /**
   * Acumulado da linha antiga mais recente (por `fim`) da etapa no prospect: sem sessão e sem custo do turno, de
   * antes do custo por turno. `modelos` é sempre null; null se não há linha antiga.
   */
  ultimoUsoAntigo(slug: string, etapa: EtapaId): Promise<Acumulado | null>
  /**
   * Todos os turnos, paginado. Sem `slug`, só os de prospects ativos; `ativos` dá esses slugs a quem já os leu
   * (sem ele o repositório os consulta).
   */
  listarUsos(slug?: string, ativos?: ReadonlySet<string>): Promise<LinhaUso[]>
  /** `em` vem do banco (ou do relógio do repositório). */
  registrarPresenca(p: Omit<LinhaPresenca, "em">): Promise<void>
  /** Ordenado por `em`, paginado. Sem `slug`, só os de prospects ativos (`ativos` como em `listarUsos`). */
  listarPresencas(slug?: string, ativos?: ReadonlySet<string>): Promise<LinhaPresenca[]>
  marcarSincronizacao(slug: string, pendente: boolean): Promise<void>
  /** Todas as linhas de modelo e esforço por etapa e alvo; linha ausente equivale a padrão. */
  lerConfigModelos(): Promise<LinhaConfigModelo[]>
  /** Os dois campos nulos apagam a linha; senão, upsert com `alterado_em` = agora. O repositório não valida o alvo. */
  gravarConfigModelo(l: {
    etapa: EtapaId
    alvo: string
    modelo: string | null
    esforco: NivelEsforco | null
    alteradoPor: string
  }): Promise<void>
  /** Notas de melhoria das skills, as mais novas primeiro; com `item`, só as desse item do catálogo. */
  listarNotasSkills(item?: string): Promise<NotaSkill[]>
  /** O repositório não valida o item nem o texto; quem chama valida. */
  criarNotaSkill(n: { item: string; texto: string; autor: string }): Promise<NotaSkill>
  /**
   * Resolve (`resolvida` verdadeiro) ou reabre a nota. Resolver uma nota já resolvida a devolve como está, sem mexer em
   * `resolvidaEm` e `resolvidaPor`; reabrir limpa os dois. Null quando a nota não existe.
   */
  marcarNotaSkill(id: number, resolvida: boolean, autor: string): Promise<NotaSkill | null>
  /** Grava com status "aberto" e sem imagens. O repositório não valida; quem chama valida. */
  criarReport(r: NovoReport & { autor: string }): Promise<Report>
  definirImagensReport(id: number, caminhos: string[]): Promise<void>
  /** Só para desfazer um envio que falhou; id ausente é ignorado. */
  apagarReport(id: number): Promise<void>
  /** Os mais recentes primeiro. */
  listarReports(filtro?: FiltroReports): Promise<Report[]>
  lerReport(id: number): Promise<Report | null>
  /** Aplica a mudança e grava `atualizadoEm` = agora e `atualizadoPor` = `por`. Null quando não existe. */
  atualizarReport(id: number, mudanca: MudancaReport, por: string): Promise<Report | null>
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
  /** Imagem de report no bucket próprio, em `<id>/<n>.<png|jpg>`. */
  enviarImagemReport(caminho: string, imagem: ImagemReport): Promise<void>
  /** ErroNaoEncontrado se não existe. */
  baixarImagemReport(caminho: string): Promise<Uint8Array>
  /** Apaga tudo de `<id>/`; não falha quando não há nada. */
  apagarImagensReport(id: number): Promise<void>
}
