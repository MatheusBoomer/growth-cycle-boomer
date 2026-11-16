// Monta o roteiro.json de uma etapa a partir da gravação feita com PLANEJAMENTO_GRAVAR_ENSAIO=1. Em src/:
//   npx tsx packages/core/scripts/ensaio-montar.ts <fixture> <etapa>
// Lê clientes/_fixtures/<fixture>/ensaio/<etapa>/gravacao.jsonl e grava o roteiro.json ao lado, sem mexer em arquivos/.
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { lerLinhasGravacao, montarRoteiro } from "../src/ensaio/montar"
import { pastaEnsaio } from "../src/ensaio/roteiro"
import { ORDEM_ETAPAS, type EtapaId } from "../src/tipos"

function falhar(mensagem: string): never {
  console.error(mensagem)
  process.exit(1)
}

const [fixture, etapa, ...sobra] = process.argv.slice(2)
if (!fixture || !etapa || sobra.length > 0) falhar("Uso: npx tsx scripts/ensaio-montar.ts <fixture> <etapa>")
if (!(ORDEM_ETAPAS as readonly string[]).includes(etapa)) {
  falhar(`Etapa inválida: ${etapa}. Use uma de: ${ORDEM_ETAPAS.join(", ")}.`)
}

const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(import.meta.dirname, "../../../..")
const pasta = pastaEnsaio(raiz, fixture, etapa as EtapaId)

let conteudo: string
try {
  conteudo = await readFile(path.join(pasta, "gravacao.jsonl"), "utf8")
} catch {
  falhar(`Não encontrei ${path.join(pasta, "gravacao.jsonl")}. Grave a etapa com PLANEJAMENTO_GRAVAR_ENSAIO=1 antes.`)
}

const roteiro = montarRoteiro(etapa as EtapaId, lerLinhasGravacao(conteudo))
await writeFile(path.join(pasta, "roteiro.json"), `${JSON.stringify(roteiro, null, 2)}\n`, "utf8")
console.info(`Roteiro da etapa ${etapa} do fixture ${fixture}: ${roteiro.trechos.length} trecho(s) em ${path.join(pasta, "roteiro.json")}.`)
