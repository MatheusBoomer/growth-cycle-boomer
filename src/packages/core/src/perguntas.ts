import { ErroEntrada, ErroNaoEncontrado, TransicaoInvalida } from "./erros"
import type { ConjuntoPerguntas, Estado, EtapaId, Pergunta, RespostaPergunta } from "./tipos"

const MIN_PERGUNTAS = 1
const MAX_PERGUNTAS = 4
const MIN_OPCOES = 2
const MAX_OPCOES = 6

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}

function textoObrigatorio(v: unknown, campo: string): string {
  if (typeof v !== "string" || !v.trim()) throw new ErroEntrada(`${campo} é obrigatório.`)
  return v.trim()
}

function textoOpcional(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

/** Converte a entrada da ferramenta fazer_perguntas em perguntas válidas. */
export function lerPerguntas(entrada: unknown): Pergunta[] {
  if (!Array.isArray(entrada) || entrada.length < MIN_PERGUNTAS || entrada.length > MAX_PERGUNTAS) {
    throw new ErroEntrada(`Envie de ${MIN_PERGUNTAS} a ${MAX_PERGUNTAS} perguntas em "perguntas".`)
  }
  return entrada.map((bruta, i) => {
    const p = objeto(bruta)
    const n = i + 1
    const enunciado = textoObrigatorio(p.enunciado, `Pergunta ${n}: enunciado`)
    const brutas = Array.isArray(p.opcoes) ? p.opcoes : []
    if (brutas.length < MIN_OPCOES || brutas.length > MAX_OPCOES) {
      throw new ErroEntrada(`A pergunta ${n} precisa de ${MIN_OPCOES} a ${MAX_OPCOES} opções.`)
    }
    const opcoes = brutas.map((o, j) => {
      const r = objeto(o)
      return { rotulo: textoObrigatorio(r.rotulo, `Pergunta ${n}, opção ${j + 1}: rotulo`), descricao: textoOpcional(r.descricao) }
    })
    const chaves = opcoes.map((o) => o.rotulo.toLowerCase())
    if (new Set(chaves).size !== chaves.length) throw new ErroEntrada(`A pergunta ${n} tem opções com o mesmo rótulo.`)
    return { enunciado, descricao: textoOpcional(p.descricao), multipla: p.multipla === true, opcoes }
  })
}

/** Novo card pendente; os pendentes da mesma etapa ficam sem resposta. */
export function criarConjunto(estado: Estado, etapa: EtapaId, perguntas: Pergunta[], id: string, em: string): Estado {
  const conjuntos: ConjuntoPerguntas[] = estado.perguntas.map((c) =>
    c.etapa === etapa && c.status === "pendente" ? { ...c, status: "sem_resposta" } : c,
  )
  conjuntos.push({ id, etapa, perguntas, status: "pendente", respostas: null, criadoEm: em, respondidoEm: null })
  return { ...estado, perguntas: conjuntos, atualizadoEm: em }
}

export function encontrarConjunto(estado: Estado, id: string): ConjuntoPerguntas {
  const c = estado.perguntas.find((x) => x.id === id)
  if (!c) throw new ErroNaoEncontrado(`Perguntas ${id} não encontradas.`)
  return c
}

function lerRespostas(conjunto: ConjuntoPerguntas, entrada: unknown): RespostaPergunta[] {
  if (!Array.isArray(entrada) || entrada.length !== conjunto.perguntas.length) {
    throw new ErroEntrada("Responda todas as perguntas.")
  }
  return conjunto.perguntas.map((p, i) => {
    const r = objeto(entrada[i])
    const n = i + 1
    const marcadas = Array.isArray(r.selecionadas) ? r.selecionadas.filter((s): s is string => typeof s === "string") : []
    const selecionadas = [...new Set(marcadas)]
    const outra = textoOpcional(r.outra)
    const validos = new Set(p.opcoes.map((o) => o.rotulo))
    const invalida = selecionadas.find((s) => !validos.has(s))
    if (invalida !== undefined) throw new ErroEntrada(`"${invalida}" não é uma opção da pergunta ${n}.`)
    if (selecionadas.length === 0 && !outra) throw new ErroEntrada(`Responda a pergunta ${n}.`)
    if (!p.multipla && selecionadas.length + (outra ? 1 : 0) > 1) {
      throw new ErroEntrada(`A pergunta ${n} aceita só uma resposta.`)
    }
    return { selecionadas, outra }
  })
}

export function responderConjunto(estado: Estado, id: string, entrada: unknown, em: string): Estado {
  const alvo = encontrarConjunto(estado, id)
  if (alvo.status !== "pendente") {
    throw new TransicaoInvalida(
      alvo.status === "respondida"
        ? "Estas perguntas já foram respondidas."
        : "Estas perguntas foram substituídas por outras mais recentes.",
    )
  }
  const respostas = lerRespostas(alvo, entrada)
  return {
    ...estado,
    perguntas: estado.perguntas.map((c) => (c.id === id ? { ...c, status: "respondida", respostas, respondidoEm: em } : c)),
    atualizadoEm: em,
  }
}
