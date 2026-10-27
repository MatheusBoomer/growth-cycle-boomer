import path from "node:path"
import { loadEnvConfig } from "@next/env"
import { FsArmazenamento } from "@workspace/core/armazenamento"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { AgentSdkExecutor } from "@workspace/core/executor/agent-sdk"
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

/** Algum agente rodando? (lê o mapa interno: a instância pode ser de uma versão anterior da classe) */
function turnoEmAndamento(s: Servidor): boolean {
  return ((s.turnos as unknown as { ativos?: Map<string, unknown> }).ativos?.size ?? 0) > 0
}

/** Só para código de servidor (rotas e páginas). Nunca importar em componente "use client". */
export function servidor(): Servidor {
  const atual = registro.__planejamento
  // No next dev, a instância sobrevive às recargas e manteria o código antigo do serviço (ex.: regras
  // de pedirAjuste). Com o código mudado e nenhum agente rodando, os serviços são recriados.
  const desatualizado = atual !== undefined && !(atual.servico instanceof ServicoPlanejamento) && !turnoEmAndamento(atual)
  if (atual && !desatualizado) {
    // Processo do next dev que já rodava antes do serviço de comentários existir (ou antes de um método novo dele,
    // como a prévia de planilha): completa sem recriar os demais.
    if (typeof atual.comentarios?.previaPlanilha !== "function") atual.comentarios = new ServicoComentarios({ armazenamento: atual.armazenamento, planejamento: atual.servico, previa: criarPreviaPython(atual.raiz) })
    return atual
  }
  // `next dev` roda em src/apps/web → a raiz do projeto de planejamento fica três níveis acima.
  const raiz = process.env.PLANEJAMENTO_ROOT ?? path.resolve(process.cwd(), "../../..")
  // O .env fica na raiz do projeto, não na pasta do app (a única que o Next lê sozinho). Carregado aqui, no
  // processo que de fato escolhe o executor: ANTHROPIC_API_KEY e PLANEJAMENTO_EXECUTOR dependem disto.
  loadEnvConfig(raiz, process.env.NODE_ENV !== "production", undefined, true)
  const catalogo = carregarCatalogo(raiz)
  const armazenamento = new FsArmazenamento(raiz)
  // Recriando: o barramento antigo continua, para as abas abertas seguirem recebendo os eventos.
  const barramento = atual?.barramento ?? new Barramento()
  const servico = new ServicoPlanejamento({ armazenamento, catalogo, barramento, validar: criarValidadorPython(raiz) })
  const comentarios = new ServicoComentarios({ armazenamento, planejamento: servico, previa: criarPreviaPython(raiz) })
  // "demo" = respostas de mentira; "sdk" = Agent SDK com ANTHROPIC_API_KEY (cobrança por uso); padrão = CLI com a assinatura.
  const executor =
    process.env.PLANEJAMENTO_EXECUTOR === "demo"
      ? criarExecutorDemo()
      : process.env.PLANEJAMENTO_EXECUTOR === "sdk"
        ? new AgentSdkExecutor()
        : new ClaudeCliExecutor()
  console.info(
    `[planejamento] executor: ${process.env.PLANEJAMENTO_EXECUTOR || "cli (assinatura)"}` +
      ` | ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? "definida" : "NÃO definida"}`,
  )
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
