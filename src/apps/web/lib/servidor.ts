import path from "node:path"
import { FsArmazenamento } from "@workspace/core/armazenamento"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { ClaudeCliExecutor } from "@workspace/core/executor/claude-cli"
import { criarExecutorDemo } from "@workspace/core/executor/fake"
import { criarPreviaPython } from "@workspace/core/previa"
import { ServicoComentarios } from "@workspace/core/servico-comentarios"
import { ServicoPlanejamento } from "@workspace/core/servico-planejamento"
import { ServicoTurnos } from "@workspace/core/servico-turnos"
import type { Catalogo } from "@workspace/core/tipos"
import { criarValidadorPython } from "@workspace/core/validador"

interface Servidor {
  raiz: string
  catalogo: Catalogo
  armazenamento: FsArmazenamento
  barramento: Barramento
  servico: ServicoPlanejamento
  turnos: ServicoTurnos
  comentarios: ServicoComentarios
}

// Um só conjunto de serviços por processo, mesmo que o Next carregue este módulo em mais de uma rota.
const registro = globalThis as unknown as { __planejamento?: Servidor }

/** Só para código de servidor (rotas e páginas). Nunca importar em componente "use client". */
export function servidor(): Servidor {
  const atual = registro.__planejamento
  if (atual) {
    // Processo do next dev que já rodava antes do serviço de comentários existir: completa sem recriar os demais.
    atual.comentarios ??= new ServicoComentarios({ armazenamento: atual.armazenamento, planejamento: atual.servico, previa: criarPreviaPython(atual.raiz) })
    return atual
  }
  // `next dev` roda em src/apps/web → a raiz do projeto de planejamento fica três níveis acima.
  const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")
  const catalogo = carregarCatalogo(raiz)
  const armazenamento = new FsArmazenamento(raiz)
  const barramento = new Barramento()
  const servico = new ServicoPlanejamento({ armazenamento, catalogo, barramento, validar: criarValidadorPython(raiz) })
  const comentarios = new ServicoComentarios({ armazenamento, planejamento: servico, previa: criarPreviaPython(raiz) })
  const executor = process.env.PLANEJAMENTO_EXECUTOR === "demo" ? criarExecutorDemo() : new ClaudeCliExecutor()
  const pastaMcp = path.join(raiz, "src/packages/mcp-planejamento/src")
  const turnos = new ServicoTurnos({
    servico,
    executor,
    barramento,
    catalogo,
    config: {
      raiz,
      urlApp: process.env.PLANEJAMENTO_APP_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`,
      caminhoServidorMcp: path.join(pastaMcp, "servidor.ts"),
      caminhoHook: path.join(pastaMcp, "hook-escrita.ts"),
      comandoNode: process.execPath,
    },
  })
  registro.__planejamento = { raiz, catalogo, armazenamento, barramento, servico, turnos, comentarios }
  return registro.__planejamento
}
