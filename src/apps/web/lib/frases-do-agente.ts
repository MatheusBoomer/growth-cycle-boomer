import type { EventoProcesso } from "@/lib/passos"

export type PassoDeAtividade = Extract<EventoProcesso, { tipo: "atividade" }>

interface Categoria {
  casa: (passo: PassoDeAtividade) => boolean
  frases: string[]
}

const leitura = (p: PassoDeAtividade) => p.nome === "Read"

/** Em ordem de decisão: a primeira que casar vence. O texto técnico do passo nunca entra na frase. */
const CATEGORIAS: Categoria[] = [
  { casa: (p) => p.nome === "Skill", frases: ["Abrindo o manual da etapa", "Consultando o passo a passo da agência"] },
  { casa: (p) => (p.nome === "Agent" || p.nome === "Task") && p.detalhe.includes("analista-dados"), frases: ["Chamando o analista de dados"] },
  { casa: (p) => (p.nome === "Agent" || p.nome === "Task") && p.detalhe.includes("pesquisador-benchmark"), frases: ["Chamando o pesquisador de mercado"] },
  { casa: (p) => p.nome === "Agent" || p.nome === "Task", frases: ["Chamando um especialista"] },
  { casa: (p) => p.detalhe.startsWith("Coletando anúncios"), frases: ["Garimpando anúncios na Biblioteca do Meta"] },
  { casa: (p) => p.nome.includes("Canva"), frases: ["Montando no Canva"] },
  { casa: (p) => leitura(p) && p.detalhe.includes(".claude/"), frases: ["Relendo as regras da casa", "Conferindo o padrão da agência"] },
  { casa: (p) => leitura(p) && p.detalhe.includes("contexto/"), frases: ["Relembrando o que já sabemos do prospect", "Revendo as anotações do prospect"] },
  {
    casa: (p) => leitura(p) && (p.detalhe.includes("dados/") || /\.(xlsx|csv)$/i.test(p.detalhe)),
    frases: ["Folheando as planilhas do cliente", "Dando uma olhada nos números"],
  },
  { casa: leitura, frases: ["Passando os olhos num material de apoio", "Lendo um arquivo de apoio"] },
  { casa: (p) => p.nome === "Write" || p.nome === "Edit" || p.nome === "MultiEdit", frases: ["Passando a limpo", "Escrevendo o rascunho"] },
  { casa: (p) => p.nome === "Bash", frases: ["Fazendo as contas", "Rodando uma análise", "Deixando o computador suar um pouco"] },
  { casa: (p) => p.nome === "Glob" || p.nome === "Grep", frases: ["Procurando nas gavetas", "Vasculhando as pastas"] },
  {
    casa: (p) => p.nome.startsWith("mcp__firecrawl") || p.nome === "WebSearch" || p.nome === "WebFetch",
    frases: ["Dando uma volta pela web", "Pesquisando por aí"],
  },
  { casa: () => true, frases: ["Passando um café…", "Alongando as ideias…"] },
]

/**
 * Frase amigável para um passo do agente ("Fazendo as contas" no lugar de "Rodando: python3 scripts/…").
 * A variação vem da posição do passo na lista, não de sorteio: a mesma linha não troca de frase a cada render.
 */
export function fraseDoPasso(passo: PassoDeAtividade, posicao: number): string {
  const { frases } = CATEGORIAS.find((c) => c.casa(passo))!
  return frases[posicao % frases.length]!
}
