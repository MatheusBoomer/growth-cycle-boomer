import { describe, expect, it } from "vitest"
import { fraseDoPasso, type PassoDeAtividade } from "./frases-do-agente"

const passo = (nome: string, detalhe: string): PassoDeAtividade => ({ tipo: "atividade", nome, detalhe, em: "2026-11-12T10:00:00.000Z" })

describe("fraseDoPasso: uma frase amigável por tipo de ação", () => {
  const casos: [string, PassoDeAtividade, string[]][] = [
    ["skill", passo("Skill", "Usando a skill 03-diagnostico-performance"), ["Abrindo o manual da etapa", "Consultando o passo a passo da agência"]],
    ["subagente de dados", passo("Agent", "Acionando o subagente analista-dados"), ["Chamando o analista de dados"]],
    ["subagente de pesquisa", passo("Agent", "Acionando o subagente pesquisador-benchmark"), ["Chamando o pesquisador de mercado"]],
    ["subagente qualquer", passo("Task", "Acionando o subagente outro"), ["Chamando um especialista"]],
    ["coleta no Meta", passo("Bash", "Coletando anúncios na Biblioteca do Meta"), ["Garimpando anúncios na Biblioteca do Meta"]],
    ["Canva", passo("mcp__claude_ai_Canva__create-design", "Trabalhando no Canva"), ["Montando no Canva"]],
    ["regras da casa", passo("Read", "Lendo .claude/skills/_shared/regras-de-validacao.md"), ["Relendo as regras da casa", "Conferindo o padrão da agência"]],
    ["contexto do prospect", passo("Read", "Lendo contexto/status-planejamento.md"), ["Relembrando o que já sabemos do prospect", "Revendo as anotações do prospect"]],
    ["planilhas", passo("Read", "Lendo dados/historico-mensal.xlsx"), ["Folheando as planilhas do cliente", "Dando uma olhada nos números"]],
    ["planilha fora de dados/", passo("Read", "Lendo base.csv"), ["Folheando as planilhas do cliente", "Dando uma olhada nos números"]],
    ["leitura qualquer", passo("Read", "Lendo secoes/03-macro.md"), ["Passando os olhos num material de apoio", "Lendo um arquivo de apoio"]],
    ["escrita", passo("Write", "Escrevendo entrega/x.md"), ["Passando a limpo", "Escrevendo o rascunho"]],
    ["edição", passo("Edit", "Escrevendo entrega/x.md"), ["Passando a limpo", "Escrevendo o rascunho"]],
    ["cálculo", passo("Bash", "Rodando: python3 scripts/projecao.py"), ["Fazendo as contas", "Rodando uma análise", "Deixando o computador suar um pouco"]],
    ["busca", passo("Glob", "Procurando arquivos"), ["Procurando nas gavetas", "Vasculhando as pastas"]],
    ["web (firecrawl)", passo("mcp__firecrawl__firecrawl_search", "Pesquisando na web"), ["Dando uma volta pela web", "Pesquisando por aí"]],
    ["web (WebSearch)", passo("WebSearch", "Pesquisando na web"), ["Dando uma volta pela web", "Pesquisando por aí"]],
    ["ferramenta desconhecida", passo("mcp__coisa__faz", "mcp__coisa__faz"), ["Passando um café…", "Alongando as ideias…"]],
  ]

  it.each(casos)("%s", (_nome, p, frases) => {
    expect(fraseDoPasso(p, 0)).toBe(frases[0])
    if (frases[1]) expect(fraseDoPasso(p, 1)).toBe(frases[1])
    if (frases[2]) expect(fraseDoPasso(p, 2)).toBe(frases[2])
  })

  it("a variação depende só da posição do passo (módulo), nunca de sorteio", () => {
    const p = passo("Skill", "Usando a skill x")
    expect(fraseDoPasso(p, 2)).toBe("Abrindo o manual da etapa")
    expect(fraseDoPasso(p, 3)).toBe("Consultando o passo a passo da agência")
    expect(fraseDoPasso(p, 3)).toBe(fraseDoPasso(p, 3))
  })
})

describe("fraseDoPasso: nada técnico vaza para a frase", () => {
  const reais: [string, string][] = [
    ["Bash", 'Rodando: cd "/Users/matheus/Documents/Claude/Projetos Boomer/planejamento-estrategico-boomer-v2/clientes/x" && python3 scripts/projecao.py'],
    ["Read", "Lendo .claude/skills/_shared/regras-de-validacao.md"],
    ["Read", "Lendo contexto/status-planejamento.md"],
    ["Read", "Lendo /Users/a/clientes/x/dados/base.xlsx"],
    ["Write", "Escrevendo entrega/ativos-aprovados/graficos/roas.png"],
    ["Skill", "Usando a skill 03-diagnostico-performance"],
    ["mcp__coisa__faz", "mcp__coisa__faz"],
  ]
  it.each(reais)("%s: %s", (nome, detalhe) => {
    for (const posicao of [0, 1, 2]) {
      const frase = fraseDoPasso(passo(nome, detalhe), posicao)
      for (const proibido of ["/", ".py", ".md", ".xlsx", ".png", "clientes", ".claude", "cd ", "mcp__"]) expect(frase).not.toContain(proibido)
    }
  })

  it("detalhe vazio não derruba: cai na categoria da ferramenta", () => {
    expect(fraseDoPasso(passo("Bash", ""), 0)).toBe("Fazendo as contas")
    expect(fraseDoPasso(passo("Ferramenta nova", ""), 0)).toBe("Passando um café…")
  })
})
