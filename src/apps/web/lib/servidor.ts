import { carregarAmbiente, raizDoProjeto } from "./ambiente"
import os from "node:os"
import path from "node:path"
import { FsArmazenamento } from "@workspace/core/armazenamento"
import { Barramento } from "@workspace/core/barramento"
import { carregarCatalogo } from "@workspace/core/catalogo"
import { AgentSdkExecutor } from "@workspace/core/executor/agent-sdk"
import { ambienteDoAgente } from "@workspace/core/executor/ambiente-agente"
import { ClaudeCliExecutor } from "@workspace/core/executor/claude-cli"
import { criarExecutorEnsaio } from "@workspace/core/executor/ensaio"
import { criarExecutorDemo } from "@workspace/core/executor/fake"
import { GravadorExecutor } from "@workspace/core/executor/gravador"
import { consultarModelosSdk } from "@workspace/core/executor/modelos-sdk"
import { criarCacheDeModelos, type ListaDeModelos } from "@workspace/core/modelos"
import { NuvemArmazenamento } from "@workspace/core/nuvem/armazenamento-nuvem"
import { MemoriaSessao, type MemoriaDeSessao } from "@workspace/core/nuvem/memoria-sessao"
import { Mesa } from "@workspace/core/nuvem/mesa"
import { SupabaseArmazem, SupabaseRepositorio, criarClienteSupabase } from "@workspace/core/nuvem/supabase"
import type { RepositorioUsuarios } from "@workspace/core/nuvem/usuarios"
import { SupabaseUsuarios } from "@workspace/core/nuvem/usuarios-supabase"
import { criarPreviaPython } from "@workspace/core/previa"
import { ServicoComentarios } from "@workspace/core/servico-comentarios"
import { ServicoPlanejamento } from "@workspace/core/servico-planejamento"
import { ServicoTurnos } from "@workspace/core/servico-turnos"
import { executorDoAmbiente } from "@workspace/core/sistema"
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
  /** Quem já entrou e com qual papel. Null no modo fs (sem banco): toda sessão válida vale como admin. */
  usuarios: RepositorioUsuarios | null
  /** Modelos que a conta enxerga, com cache de uma hora. Nunca lança: sem resposta do SDK, só os apelidos. */
  modelosDisponiveis: () => Promise<ListaDeModelos>
}

// Um só conjunto de serviços por processo, mesmo que o Next carregue este módulo em mais de uma rota.
// A parte da nuvem (Mesa e NuvemArmazenamento, com temporizadores e fila de sincronização) fica à parte: é uma só
// por processo e sobrevive à recriação dos serviços, para nunca haver duas instâncias disputando o mesmo prospect.
interface Nuvem {
  armazenamento: NuvemArmazenamento
  memoria: MemoriaDeSessao
  usuarios: RepositorioUsuarios
}
const registro = globalThis as unknown as {
  __planejamento?: Servidor
  __planejamentoNuvem?: Nuvem
  __planejamentoModelos?: () => Promise<ListaDeModelos>
}

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
  const existente = registro.__planejamentoNuvem
  if (existente) {
    // Instância criada por uma versão anterior do código (next dev de longa duração) não tem `usuarios`. Sem completar,
    // o servidor trataria a falta como "sem banco" e daria admin a todos. O cliente novo só serve ao repositório de usuários.
    if (!existente.usuarios) {
      existente.usuarios = new SupabaseUsuarios(criarClienteSupabase(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string))
    }
    return existente
  }
  const cliente = criarClienteSupabase(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const armazem = new SupabaseArmazem(cliente)
  const mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem })
  const armazenamento = new NuvemArmazenamento({ raiz, repositorio: new SupabaseRepositorio(cliente), armazem, mesa })
  const memoria = new MemoriaSessao({
    armazem,
    configDir: pastaConfigClaude(process.env.CLAUDE_CONFIG_DIR),
    cwd: raiz,
  })
  registro.__planejamentoNuvem = { armazenamento, memoria, usuarios: new SupabaseUsuarios(cliente) }
  return registro.__planejamentoNuvem
}

/**
 * Lista de modelos com cache, uma só por processo (sobrevive à recriação dos serviços, para não consultar o SDK de novo).
 * Usa o mesmo ambiente do subprocesso do agente, para o CLI achar o PATH e a credencial.
 */
function modelosDisponiveisDoProcesso(raiz: string): () => Promise<ListaDeModelos> {
  registro.__planejamentoModelos ??= criarCacheDeModelos(() => consultarModelosSdk(ambienteDoAgente(process.env), undefined, undefined, raiz))
  return registro.__planejamentoModelos
}

/** Algum agente rodando? (lê o mapa interno: a instância pode ser de uma versão anterior da classe) */
function turnoEmAndamento(s: Servidor): boolean {
  return ((s.turnos as unknown as { ativos?: Map<string, unknown> }).ativos?.size ?? 0) > 0
}

/**
 * Endereço pelo qual o servidor MCP (processo filho do agente) chama este app: PLANEJAMENTO_URL_INTERNA, ou a porta
 * local. Não usa PLANEJAMENTO_APP_URL, que é o endereço público (o das rotas de login). Vazio ou só espaços
 * (linha vazia do .env) vale como ausente.
 */
export function urlInternaDoApp(env: Record<string, string | undefined>): string {
  return env.PLANEJAMENTO_URL_INTERNA?.trim() || `http://127.0.0.1:${env.PORT?.trim() || 3000}`
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
    // Idem para o repositório de usuários: null só no modo fs; no supabase ele sempre existe (ver montarNuvem).
    if (atual.usuarios === undefined) atual.usuarios = modoDeDados() === "fs" ? null : montarNuvem(atual.raiz).usuarios
    // Idem para a lista de modelos, que veio depois das demais partes.
    if (typeof atual.modelosDisponiveis !== "function") atual.modelosDisponiveis = modelosDisponiveisDoProcesso(atual.raiz)
    return atual
  }
  // `next dev` roda em src/apps/web → a raiz do projeto de planejamento fica três níveis acima.
  const raiz = raizDoProjeto()
  // O .env da raiz (ANTHROPIC_API_KEY, PLANEJAMENTO_EXECUTOR, PLANEJAMENTO_DADOS) já foi carregado ao importar
  // lib/ambiente; a chamada aqui não carrega de novo, só deixa explícito que o servidor depende dele.
  carregarAmbiente()
  const dados = modoDeDados()
  const catalogo = carregarCatalogo(raiz)
  const nuvem = dados === "supabase" ? montarNuvem(raiz) : undefined
  const armazenamento: FsArmazenamento = nuvem?.armazenamento ?? new FsArmazenamento(raiz)
  // Recriando: o barramento antigo continua, para as abas abertas seguirem recebendo os eventos.
  const barramento = atual?.barramento ?? new Barramento()
  const servico = new ServicoPlanejamento({ armazenamento, catalogo, barramento, validar: criarValidadorPython(raiz) })
  const comentarios = new ServicoComentarios({ armazenamento, planejamento: servico, previa: criarPreviaPython(raiz) })
  // "demo" = respostas de mentira; "sdk" = Agent SDK com ANTHROPIC_API_KEY (cobrança por uso); padrão = CLI com a assinatura.
  const modoExecutor = executorDoAmbiente(process.env)
  const executorReal = modoExecutor === "demo" ? criarExecutorDemo() : modoExecutor === "sdk" ? new AgentSdkExecutor() : new ClaudeCliExecutor()
  // PLANEJAMENTO_GRAVAR_ENSAIO=1: embrulha só o executor real para gravar os turnos de um cliente de teste comum (nunca o de ensaio).
  const gravarEnsaio = process.env.PLANEJAMENTO_GRAVAR_ENSAIO === "1"
  const executor = gravarEnsaio ? new GravadorExecutor(executorReal, { raiz }) : executorReal
  console.info(
    `[planejamento] executor: ${process.env.PLANEJAMENTO_EXECUTOR || "cli (assinatura)"}` +
      ` | ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? "definida" : "NÃO definida"}` +
      ` | dados: ${dados}` +
      (gravarEnsaio ? " | gravando turnos de ensaio" : ""),
  )
  const pastaMcp = path.join(raiz, "src/packages/mcp-planejamento/src")
  const turnos = new ServicoTurnos({
    servico,
    executor,
    // Cliente de teste com Modo ensaiado reproduz o roteiro gravado, sem chamar o Claude.
    executorEnsaio: criarExecutorEnsaio({}),
    barramento,
    catalogo,
    memoria: nuvem?.memoria,
    config: {
      raiz,
      urlApp: urlInternaDoApp(process.env),
      caminhoServidorMcp: path.join(pastaMcp, "servidor.ts"),
      caminhoHook: path.join(pastaMcp, "hook-escrita.ts"),
      comandoNode: process.execPath,
      firecrawlNoMcp: modoExecutor === "sdk",
    },
  })
  registro.__planejamento = { raiz, catalogo, armazenamento, barramento, servico, turnos, comentarios, usuarios: nuvem ? nuvem.usuarios : null, modelosDisponiveis: modelosDisponiveisDoProcesso(raiz) }
  return registro.__planejamento
}
