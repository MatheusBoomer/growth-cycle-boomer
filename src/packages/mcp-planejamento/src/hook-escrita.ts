// Hook PreToolUse (Write/Edit) do modo interface: o agente só escreve dentro da pasta do
// prospect e nunca nas áreas que pertencem ao app. Exit 2 bloqueia e o stderr vai para o agente.
import path from "node:path"
import { fileURLToPath } from "node:url"

export interface DecisaoEscrita {
  permitir: boolean
  motivo: string | null
}

export function decidirEscrita(caminho: string, cwd: string, pastaProspect: string): DecisaoEscrita {
  const abs = path.resolve(cwd, caminho)
  const rel = path.relative(pastaProspect, abs).split(path.sep).join("/")
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return {
      permitir: false,
      motivo: `Escrita bloqueada: ${abs} fica fora da pasta do prospect (${pastaProspect}). No modo interface, grave só dentro dela; rascunhos vão em .app/rascunhos/.`,
    }
  }
  if (rel.startsWith("entrega/ativos-aprovados/")) {
    return {
      permitir: false,
      motivo: "Escrita bloqueada: entrega/ativos-aprovados/ é gravada só pelo app quando o analista aprova. Salve em .app/rascunhos/ e chame propor_entregavel.",
    }
  }
  if (rel.startsWith(".app/") && !rel.startsWith(".app/rascunhos/")) {
    return {
      permitir: false,
      motivo: "Escrita bloqueada: .app/ pertence ao app. Use só .app/rascunhos/ para seus arquivos.",
    }
  }
  if (rel === "contexto/status-planejamento.md") {
    return {
      permitir: false,
      motivo: "Escrita bloqueada: o status é gerado pelo app. Para encerrar a etapa, chame sinalizar_etapa_pronta.",
    }
  }
  return { permitir: true, motivo: null }
}

async function principal(): Promise<void> {
  const pasta = process.argv[2]
  if (!pasta) {
    process.stderr.write("hook-escrita: informe a pasta do prospect como argumento.\n")
    process.exit(2)
  }
  let bruto = ""
  for await (const parte of process.stdin) bruto += String(parte)
  const entrada = JSON.parse(bruto || "{}") as { cwd?: string; tool_input?: { file_path?: string; notebook_path?: string } }
  const caminho = entrada.tool_input?.file_path ?? entrada.tool_input?.notebook_path
  if (!caminho) return
  const decisao = decidirEscrita(caminho, entrada.cwd ?? process.cwd(), path.resolve(pasta))
  if (!decisao.permitir) {
    process.stderr.write(`${decisao.motivo}\n`)
    process.exit(2)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await principal()
}
