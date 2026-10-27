import os from "node:os"
import path from "node:path"
import { loadEnvConfig } from "@next/env"
import { FsArmazenamento } from "@workspace/core/armazenamento"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { AgentSdkExecutor } from "@workspace/core/executor/agent-sdk"
import { ClaudeCliExecutor } from "@workspace/core/executor/claude-cli"
import { criarExecutorDemo } from "@workspace/core/executor/fake"
import { NuvemArmazenamento } from "@workspace/core/nuvem/armazenamento-nuvem"
import { MemoriaSessao, type MemoriaDeSessao } from "@workspace/core/nuvem/memoria-sessao"
import { Mesa } from "@workspace/core/nuvem/mesa"
import { SupabaseArmazem, SupabaseRepositorio, criarClienteSupabase } from "@workspace/core/nuvem/supabase"
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
// A parte da nuvem (Mesa e NuvemArmazenamento, com temporizadores e fila de sincronização) fica à parte: é uma só
// por processo e sobrevive à recriação dos serviços, para nunca haver duas instâncias disputando o mesmo prospect.
interface Nuvem {
  armazenamento: NuvemArmazenamento
  memoria: MemoriaDeSessao
}
const registro = globalThis as unknown as { __planejamento?: Servidor; __planejamentoNuvem?: Nuvem }

const ERRO_SEM_SUPABASE = "PLANEJAMENTO_DADOS=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env da raiz."

/** Modo de dados escolhido por PLANEJAMENTO_DADOS (vazio = fs). Falha cedo com valor inválido ou sem variável do Supabase. */
function modoDeDados(): "fs" | "supabase" {
  const valor = (process.env.PLANEJAMENTO_DADOS ?? "").trim()
  if (valor === "" || valor === "fs") return "fs"
  if (valor !== "supabase") throw new Error(`PLANEJAMENTO_DADOS inválido: "${valor}" (use fs ou supabase).`)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error(ERRO_SEM_SUPABASE)
  return "supabase"
}

/** Pasta de configuração do Claude Code: CLAUDE_CONFIG_DIR, ou ~/.claude quando ausente ou vazio (linha vazia no .env). */
export function pastaConfigClaude(valor: string | undefined): string {
  return valor?.trim() || path.join(os.homedir(), ".claude")
}

function montarNuvem(raiz: string): Nuvem {
  if (registro.__planejamentoNuvem) return registro.__planejamentoNuvem
  const cliente = criarClienteSupabase(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const armazem = new SupabaseArmazem(cliente)
  const mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem })
  const armazenamento = new NuvemArmazenamento({ raiz, repositorio: new SupabaseRepositorio(cliente), mesa })
  const memoria = new MemoriaSessao({
    armazem,
    configDir: pastaConfigClaude(process.env.CLAUDE_CONFIG_DIR),
    cwd: raiz,
  })
  registro.__planejamentoNuvem = { armazenamento, memoria }
  return registro.__planejamentoNuvem
}

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
  const dados = modoDeDados()
  const catalogo = carregarCatalogo(raiz)
  const nuvem = dados === "supabase" ? montarNuvem(raiz) : undefined
  const armazenamento: FsArmazenamento = nuvem?.armazenamento ?? new FsArmazenamento(raiz)
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
      ` | ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? "definida" : "NÃO definida"}` +
      ` | dados: ${dados}`,
  )
  const pastaMcp = path.join(raiz, "src/packages/mcp-planejamento/src")
  const turnos = new ServicoTurnos({
    servico,
    executor,
    barramento,
    catalogo,
    memoria: nuvem?.memoria,
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
