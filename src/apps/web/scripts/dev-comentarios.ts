// Lista e limpa os comentários do modo dev. Roda no Node puro (sem build). Em src/:
//   npm run dev:comentarios                    → resumo em texto
//   npm run dev:comentarios -- --limpar        → apaga todos
//   npm run dev:comentarios -- --limpar 3,5    → apaga os números indicados
import path from "node:path"
import { criarArmazenamentoDev } from "../lib/modo-dev/armazenamento.ts"
import { ErroValidacaoDev, interpretarArgumentos, resumoEmTexto } from "../lib/modo-dev/nucleo.ts"

const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(import.meta.dirname, "../../../..")
const armazenamento = criarArmazenamentoDev(path.join(raiz, ".dev-comentarios"))
const numerados = (numeros: number[]) => numeros.map((n) => `#${n}`).join(", ")

try {
  const comando = interpretarArgumentos(process.argv.slice(2))
  if (comando.acao === "listar") {
    console.log(resumoEmTexto(await armazenamento.listar(), armazenamento.pasta))
  } else if (comando.numeros === null) {
    const { apagados } = await armazenamento.limpar()
    console.log(apagados.length ? `Todos os comentários foram apagados (${apagados.length}).` : "Nada para apagar.")
  } else {
    const { apagados, inexistentes } = await armazenamento.limpar(comando.numeros)
    console.log(apagados.length ? `Apagados: ${numerados(apagados)}.` : "Nenhum dos números existia.")
    if (inexistentes.length) console.log(`Não existiam: ${numerados(inexistentes)}.`)
  }
} catch (e) {
  if (!(e instanceof ErroValidacaoDev)) throw e
  console.error(e.message)
  process.exitCode = 1
}
