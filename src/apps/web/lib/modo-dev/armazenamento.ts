// Comentários do modo dev em arquivo: comentarios.json + capturas/<id>.png, numa pasta injetada.
// Usado pelas rotas (next dev) e pelo script de terminal (Node puro): só imports relativos com .ts.
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  type ArquivoComentarios,
  type ComentarioDev,
  ErroComentarioNaoEncontrado,
  ErroValidacaoDev,
  LIMITE_PNG_BYTES,
  type NovoComentario,
} from "./nucleo.ts"

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function decodificarPng(base64: string): Buffer {
  const limpo = base64.replace(/^data:image\/png;base64,/, "")
  // Checa o tamanho antes de decodificar, para não alocar um buffer enorme à toa.
  if (limpo.length > Math.ceil(LIMITE_PNG_BYTES / 3) * 4 + 4) throw new ErroValidacaoDev("O recorte passa de 5 MB.")
  const bytes = Buffer.from(limpo, "base64")
  if (bytes.length > LIMITE_PNG_BYTES) throw new ErroValidacaoDev("O recorte passa de 5 MB.")
  if (!ASSINATURA_PNG.every((byte, i) => bytes[i] === byte)) throw new ErroValidacaoDev("O recorte não é um PNG válido.")
  return bytes
}

export interface ResultadoLimpeza {
  apagados: number[]
  inexistentes: number[]
}

export interface ArmazenamentoDev {
  pasta: string
  listar(pagina?: string): Promise<ComentarioDev[]>
  criar(novo: NovoComentario, png: Buffer | null): Promise<ComentarioDev>
  editar(id: string, comentario: string): Promise<ComentarioDev>
  apagar(id: string): Promise<void>
  /** Sem números: apaga tudo e o próximo comentário volta a ser o #1. Com números: só esses. */
  limpar(numeros?: number[] | null): Promise<ResultadoLimpeza>
}

const vazio = (): ArquivoComentarios => ({ versao: 1, proximoNumero: 1, comentarios: [] })
const crescente = (a: number, b: number) => a - b

export function criarArmazenamentoDev(pasta: string): ArmazenamentoDev {
  const arquivo = path.join(pasta, "comentarios.json")
  const pastaCapturas = path.join(pasta, "capturas")
  let fila: Promise<unknown> = Promise.resolve()

  // Uma escrita por vez: dois salvamentos seguidos não podem ler o mesmo proximoNumero.
  function emSerie<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa, tarefa)
    fila = resultado.catch(() => undefined)
    return resultado
  }

  async function ler(): Promise<ArquivoComentarios> {
    try {
      const dados = JSON.parse(await readFile(arquivo, "utf-8")) as Partial<ArquivoComentarios> | null
      if (!dados || !Array.isArray(dados.comentarios) || !Number.isInteger(dados.proximoNumero)) return vazio()
      return { versao: 1, proximoNumero: dados.proximoNumero as number, comentarios: dados.comentarios }
    } catch {
      return vazio()
    }
  }

  async function gravar(dados: ArquivoComentarios): Promise<void> {
    await mkdir(pasta, { recursive: true })
    const temporario = `${arquivo}.${process.pid}.tmp`
    await writeFile(temporario, `${JSON.stringify(dados, null, 2)}\n`)
    await rename(temporario, arquivo)
  }

  async function apagarCaptura(comentario: ComentarioDev): Promise<void> {
    if (comentario.captura) await rm(path.join(pasta, comentario.captura), { force: true })
  }

  function buscar(dados: ArquivoComentarios, id: string): ComentarioDev {
    const comentario = dados.comentarios.find((c) => c.id === id)
    if (!comentario) throw new ErroComentarioNaoEncontrado(`Comentário ${id} não encontrado.`)
    return comentario
  }

  return {
    pasta,

    async listar(pagina) {
      const { comentarios } = await ler()
      return comentarios.filter((c) => pagina === undefined || c.pagina === pagina).sort((a, b) => a.numero - b.numero)
    },

    criar: (novo, png) =>
      emSerie(async () => {
        const dados = await ler()
        const id = randomUUID()
        let captura: string | null = null
        if (png) {
          await mkdir(pastaCapturas, { recursive: true })
          await writeFile(path.join(pastaCapturas, `${id}.png`), png)
          captura = `capturas/${id}.png`
        }
        const comentario: ComentarioDev = {
          id,
          numero: dados.proximoNumero,
          criadoEm: new Date().toISOString(),
          editadoEm: null,
          ...novo,
          captura,
        }
        await gravar({ ...dados, proximoNumero: dados.proximoNumero + 1, comentarios: [...dados.comentarios, comentario] })
        return comentario
      }),

    editar: (id, texto) =>
      emSerie(async () => {
        const dados = await ler()
        const editado = { ...buscar(dados, id), comentario: texto, editadoEm: new Date().toISOString() }
        await gravar({ ...dados, comentarios: dados.comentarios.map((c) => (c.id === id ? editado : c)) })
        return editado
      }),

    apagar: (id) =>
      emSerie(async () => {
        const dados = await ler()
        const comentario = buscar(dados, id)
        await gravar({ ...dados, comentarios: dados.comentarios.filter((c) => c.id !== id) })
        await apagarCaptura(comentario)
      }),

    limpar: (numeros) =>
      emSerie(async () => {
        const dados = await ler()
        if (!numeros) {
          await gravar(vazio())
          await rm(pastaCapturas, { recursive: true, force: true })
          return { apagados: dados.comentarios.map((c) => c.numero).sort(crescente), inexistentes: [] }
        }
        const pedidos = new Set(numeros)
        const apagados = dados.comentarios.filter((c) => pedidos.has(c.numero))
        const existentes = new Set(apagados.map((c) => c.numero))
        await gravar({ ...dados, comentarios: dados.comentarios.filter((c) => !pedidos.has(c.numero)) })
        await Promise.all(apagados.map(apagarCaptura))
        return {
          apagados: [...existentes].sort(crescente),
          inexistentes: [...pedidos].filter((n) => !existentes.has(n)).sort(crescente),
        }
      }),
  }
}
