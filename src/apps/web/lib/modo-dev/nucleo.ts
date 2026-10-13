// Núcleo do modo dev de comentários: tipos, validação e funções puras.
// Roda no navegador, no next dev e no Node puro (script de terminal): só imports relativos com .ts,
// nada de @/ ou @workspace/*, e nenhuma sintaxe TypeScript que o Node não saiba apagar.

export const LIMITE_COMENTARIO = 2000
export const LIMITE_TEXTO = 300
export const LIMITE_CADEIA = 8
export const LIMITE_PNG_BYTES = 5 * 1024 * 1024

export interface Caixa {
  x: number
  y: number
  largura: number
  altura: number
  larguraTela: number
  alturaTela: number
}

/** O que a interface envia ao criar; o servidor completa id, número, datas e captura. */
export interface NovoComentario {
  pagina: string
  componente: string | null
  cadeia: string[]
  seletor: string
  tag: string
  texto: string
  caixa: Caixa
  comentario: string
}

export interface ComentarioDev extends NovoComentario {
  id: string
  numero: number
  criadoEm: string
  editadoEm: string | null
  captura: string | null
}

export interface ArquivoComentarios {
  versao: 1
  proximoNumero: number
  comentarios: ComentarioDev[]
}

/** Mesma forma de ErroDominio (codigo + status): respostaDeErro de lib/http.ts responde 400 sozinho. */
export class ErroValidacaoDev extends Error {
  readonly codigo = "entrada_invalida"
  readonly status = 400
}

export class ErroComentarioNaoEncontrado extends Error {
  readonly codigo = "nao_encontrado"
  readonly status = 404
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function lerComentario(valor: unknown): string {
  if (typeof valor !== "string") throw new ErroValidacaoDev("O comentário precisa ser um texto.")
  const comentario = valor.trim()
  if (!comentario) throw new ErroValidacaoDev("O comentário está vazio.")
  if (comentario.length > LIMITE_COMENTARIO) {
    throw new ErroValidacaoDev(`O comentário passa de ${LIMITE_COMENTARIO} caracteres (${comentario.length}).`)
  }
  return comentario
}

const CAMPOS_CAIXA = ["x", "y", "largura", "altura", "larguraTela", "alturaTela"] as const

function lerCaixa(valor: unknown): Caixa {
  if (!ehObjeto(valor) || !CAMPOS_CAIXA.every((campo) => typeof valor[campo] === "number" && Number.isFinite(valor[campo]))) {
    throw new ErroValidacaoDev("Campo caixa deve ter x, y, largura, altura, larguraTela e alturaTela numéricos.")
  }
  return {
    x: valor.x as number,
    y: valor.y as number,
    largura: valor.largura as number,
    altura: valor.altura as number,
    larguraTela: valor.larguraTela as number,
    alturaTela: valor.alturaTela as number,
  }
}

export function validarNovo(entrada: unknown): NovoComentario {
  if (!ehObjeto(entrada)) throw new ErroValidacaoDev("Corpo da requisição inválido.")
  const { pagina, componente, cadeia, seletor, tag, texto } = entrada
  if (typeof pagina !== "string" || !pagina.startsWith("/")) {
    throw new ErroValidacaoDev("Campo pagina deve ser um caminho começando com /.")
  }
  if (componente !== null && typeof componente !== "string") {
    throw new ErroValidacaoDev("Campo componente deve ser texto ou null.")
  }
  if (!Array.isArray(cadeia) || cadeia.length > LIMITE_CADEIA || !cadeia.every((nome) => typeof nome === "string")) {
    throw new ErroValidacaoDev(`Campo cadeia deve ser uma lista de até ${LIMITE_CADEIA} nomes.`)
  }
  if (typeof seletor !== "string" || !seletor.trim()) throw new ErroValidacaoDev("Campo seletor é obrigatório.")
  if (typeof tag !== "string" || !tag) throw new ErroValidacaoDev("Campo tag é obrigatório.")
  if (typeof texto !== "string" || texto.length > LIMITE_TEXTO) {
    throw new ErroValidacaoDev(`Campo texto deve ser um texto de até ${LIMITE_TEXTO} caracteres.`)
  }
  return {
    pagina,
    componente: componente as string | null,
    cadeia: cadeia as string[],
    seletor,
    tag,
    texto,
    caixa: lerCaixa(entrada.caixa),
    comentario: lerComentario(entrada.comentario),
  }
}

export function validarEdicao(entrada: unknown): string {
  if (!ehObjeto(entrada)) throw new ErroValidacaoDev("Corpo da requisição inválido.")
  return lerComentario(entrada.comentario)
}
