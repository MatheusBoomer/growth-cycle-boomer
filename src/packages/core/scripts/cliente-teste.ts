// Cria o cliente de teste a partir de um fixture em clientes/_fixtures/<id>/. Em src/:
//   npm run cliente-teste                              → fixture verdeluz, começando na etapa 01
//   npm run cliente-teste -- --etapa 03                → começando na etapa 03
//   npm run cliente-teste -- --fixture verdeluz --etapa final
import path from "node:path"
import { FsArmazenamento } from "../src/armazenamento"
import { Barramento } from "../src/barramento"
import { carregarCatalogo } from "../src/catalogo"
import { ehErroDominio, ErroProspectExistente } from "../src/erros"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import { ORDEM_ETAPAS, type EtapaId } from "../src/tipos"

function falhar(mensagem: string): never {
  console.error(mensagem)
  process.exit(1)
}

let fixture = "verdeluz"
let etapa: string = "01"
const argumentos = process.argv.slice(2)
for (let i = 0; i < argumentos.length; i += 2) {
  const valor = argumentos[i + 1]
  if (argumentos[i] === "--fixture" && valor) fixture = valor
  else if (argumentos[i] === "--etapa" && valor) etapa = valor
  else falhar(`Argumento desconhecido: ${argumentos[i]}. Use --fixture <id> e --etapa <${ORDEM_ETAPAS.join("|")}>.`)
}
if (!(ORDEM_ETAPAS as readonly string[]).includes(etapa)) {
  falhar(`Etapa inválida: ${etapa}. Use uma de: ${ORDEM_ETAPAS.join(", ")}.`)
}

const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(import.meta.dirname, "../../../..")
const servico = new ServicoPlanejamento({
  armazenamento: new FsArmazenamento(raiz),
  catalogo: carregarCatalogo(raiz),
  barramento: new Barramento(),
  validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
})

try {
  const slug = await servico.criarClienteTeste(fixture, etapa as EtapaId)
  console.log(`Cliente de teste criado: clientes/${slug}/ (etapa ${etapa})`)
} catch (e) {
  if (e instanceof ErroProspectExistente) console.log("O cliente de teste já existe. Abra o app e use Reposicionar.")
  else if (ehErroDominio(e)) falhar(e.message)
  else throw e
}
