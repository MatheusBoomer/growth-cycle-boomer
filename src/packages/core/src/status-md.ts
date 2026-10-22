import { semAberturaDeConclusao } from "./handoff"
import { comEtapa, estadoInicial, recalcularLiberacoes } from "./maquina-estados"
import { ORDEM_ETAPAS, type Catalogo, type Estado, type StatusEtapa } from "./tipos"

const ICONE: Record<StatusEtapa, string> = {
  concluida: "✅",
  desatualizada: "⚠️",
  em_andamento: "🔄",
  pronta: "🔄",
  liberada: "⬜",
  bloqueada: "⬜",
}

const PROXIMO_PADRAO =
  "(a skill mais recente concluída reescreve este bloco com o que falta\npreparar para a etapa seguinte, com o mesmo pedido apresentado no chat)"

export function renderStatusMd(estado: Estado, catalogo: Catalogo): string {
  const linhas = [
    `# Status do Planejamento: ${estado.prospect.nome}`,
    "",
    "Gerado pela interface a partir de `.app/estado.json` a cada mudança de etapa",
    "(ver Regra 6 em `.claude/skills/_shared/regras-de-validacao.md`). Não editar manualmente.",
    "",
    "| Etapa | Status | Concluída em | Observação |",
    "|---|---|---|---|",
    `| 00 · Criar prospect | ✅ | ${estado.prospect.criadoEm.slice(0, 10)} | |`,
  ]
  for (const cat of catalogo.etapas) {
    const e = estado.etapas[cat.id]
    const obs = (e.observacao ?? "").replace(/\|/g, "/")
    linhas.push(`| ${cat.rotuloStatus} | ${ICONE[e.status]} | ${e.concluidaEm?.slice(0, 10) ?? ""} | ${obs} |`)
  }
  const ultima = [...catalogo.etapas]
    .reverse()
    .find((c) => estado.etapas[c.id].status === "concluida" && estado.etapas[c.id].handoff)
  linhas.push("", "## Próximo passo", "", ultima ? semAberturaDeConclusao(estado.etapas[ultima.id].handoff!.trim()) : PROXIMO_PADRAO, "")
  return linhas.join("\n")
}

const LINHA_TABELA = /^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/

export function importarStatusMd(
  md: string,
  catalogo: Catalogo,
  prospect: { slug: string; nome: string; site: string | null },
  em: string,
): Estado {
  let estado = estadoInicial(prospect, em)
  for (const linha of md.split("\n")) {
    const m = linha.match(LINHA_TABELA)
    if (!m) continue
    const [, rotulo, icone = "", data = "", obs = ""] = m
    if (rotulo === "00 · Criar prospect" && data) {
      estado = { ...estado, prospect: { ...estado.prospect, criadoEm: data } }
      continue
    }
    const cat = catalogo.etapas.find((c) => c.rotuloStatus === rotulo)
    if (!cat) continue
    if (icone.startsWith("✅")) {
      estado = comEtapa(
        estado,
        cat.id,
        { status: "concluida", concluidaEm: data || null, origem: "terminal", observacao: obs || null },
        em,
      )
    } else if (obs) {
      estado = comEtapa(estado, cat.id, { observacao: obs }, em)
    }
  }
  const proximo = md.split(/^## Próximo passo\s*$/m)[1]?.trim()
  const ultima = [...ORDEM_ETAPAS].reverse().find((id) => estado.etapas[id].status === "concluida")
  if (ultima && proximo && !proximo.startsWith("(a skill")) {
    estado = comEtapa(estado, ultima, { handoff: proximo }, em)
  }
  return recalcularLiberacoes(estado)
}
