// Servidor MCP "planejamento": as ferramentas que viram cards na interface.
// Só repassa cada chamada ao app local, que valida e grava. Roda com `node servidor.ts`.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const URL_APP = process.env.PLANEJAMENTO_APP_URL
const TOKEN = process.env.PLANEJAMENTO_TOKEN
if (!URL_APP || !TOKEN) {
  process.stderr.write("mcp-planejamento: PLANEJAMENTO_APP_URL e PLANEJAMENTO_TOKEN são obrigatórios.\n")
  process.exit(1)
}

async function chamarApp(ferramenta: string, entrada: unknown) {
  try {
    const resposta = await fetch(`${URL_APP}/api/interno/ferramentas`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ ferramenta, entrada }),
    })
    const corpo = (await resposta.json()) as { ok?: boolean; mensagem?: string; erro?: string }
    const texto = corpo.mensagem ?? corpo.erro ?? `Resposta inesperada da interface (HTTP ${resposta.status}).`
    return { content: [{ type: "text" as const, text: texto }], isError: corpo.ok !== true }
  } catch (e) {
    return {
      content: [{ type: "text" as const, text: `Não consegui falar com a interface (${String(e)}). Avise o analista.` }],
      isError: true,
    }
  }
}

const servidor = new McpServer({ name: "planejamento", version: "0.1.0" })

servidor.registerTool(
  "propor_entregavel",
  {
    title: "Propor entregável para aprovação",
    description:
      "Mostra ao analista um card com Aprovar / Pedir ajuste para um gráfico, tabela, seção de texto, planilha, documento, HTML, roteiro ou apresentação já salvo em clientes/<slug>/.app/rascunhos/. Substitui pedir 'ok' no chat. Depois de chamar, encerre a resposta e espere a decisão, que chega como nova mensagem.",
    inputSchema: {
      tipo: z
        .enum(["grafico", "tabela", "secao", "planilha", "documento", "html", "roteiro", "apresentacao"])
        .describe("grafico/tabela = PNG; secao = .md; planilha = .xlsx; documento = .docx; html = .html; roteiro = .json (roteiro da apresentação); apresentacao = .pptx"),
      titulo: z.string().describe("Título curto que o analista vê no card"),
      arquivo_rascunho: z.string().describe("Caminho do arquivo em clientes/<slug>/.app/rascunhos/"),
      nome_final: z
        .string()
        .describe("Nome estável, em kebab-case e sem versão (ex.: investimento-total-mensal). Seções recebem o prefixo da etapa automaticamente."),
      etapa_origem: z
        .enum(["03", "04"])
        .optional()
        .describe(
          'Só na conversa da etapa 04, na correção depois da validação do cliente: "03" propõe um gráfico, tabela ou seção da 03 já concluída (o card aparece na 04). Omita nos demais casos.',
        ),
    },
  },
  async (args) => chamarApp("propor_entregavel", args),
)

servidor.registerTool(
  "solicitar_insumo",
  {
    title: "Pedir um arquivo ao analista",
    description:
      "Mostra ao analista o card de envio de um insumo do catálogo (com o modelo para baixar, quando existir). Use em vez de descrever caminhos de pasta. Ids: kickoff-transcricao, formulario-cliente, site, historico-mensal, produtos-curva-abc, clientes-historico, prints-campanhas. Na etapa 04, durante a correção da validação do cliente, também dá para pedir historico-mensal e produtos-curva-abc (insumos da 03).",
    inputSchema: { insumo_id: z.string().describe("Id do insumo no catálogo da etapa atual") },
  },
  async (args) => chamarApp("solicitar_insumo", args),
)

servidor.registerTool(
  "registrar_insumo_anexado",
  {
    title: "Registrar um anexo do chat como insumo da etapa",
    description:
      "Use quando o analista anexou pelo clipe do chat um arquivo que, conferido o conteúdo, é um insumo do catálogo da etapa atual (ex.: a transcrição do kickoff). O app valida o arquivo como se tivesse sido enviado pelo card e passa a considerar o insumo entregue. Confira o conteúdo antes de chamar: só registre se for mesmo o documento esperado. Na etapa 04, durante a correção da validação do cliente, também dá para registrar historico-mensal e produtos-curva-abc (insumos da 03).",
    inputSchema: {
      insumo_id: z.string().describe("Id do insumo no catálogo da etapa atual"),
      arquivo: z.string().describe("Caminho do anexo em clientes/<slug>/.app/anexos/<etapa>/"),
    },
  },
  async (args) => chamarApp("registrar_insumo_anexado", args),
)

servidor.registerTool(
  "propor_validacao_cliente",
  {
    title: "Entregar o documento de validação do cliente",
    description:
      "Só na etapa 04. Entrega ao analista o PDF de validação (gráficos e tabelas aprovados das etapas 03 e 04) já salvo em clientes/<slug>/.app/rascunhos/. O app guarda o arquivo, o analista baixa, leva ao cliente e confirma a validação na interface. Gere de novo o PDF sempre que algo aprovado mudar. Depois de chamar, encerre a resposta e espere.",
    inputSchema: {
      arquivo_rascunho: z.string().describe("Caminho do PDF em clientes/<slug>/.app/rascunhos/"),
    },
  },
  async (args) => chamarApp("propor_validacao_cliente", args),
)

servidor.registerTool(
  "sinalizar_etapa_pronta",
  {
    title: "Sinalizar que a etapa atingiu o critério de conclusão",
    description:
      "Chame quando o critério de conclusão da skill for atingido. O app guarda o resumo (vira o dossiê das próximas etapas) e o handoff, e libera o botão Concluir se não faltar nada.",
    inputSchema: {
      resumo_decisoes: z.string().describe("Markdown com as decisões e números aprovados nesta etapa"),
      handoff_proxima: z
        .string()
        .describe("Texto ao analista dizendo o que preparar para a próxima etapa, sem citar caminhos de arquivo"),
      resumo_decisoes_03: z
        .string()
        .optional()
        .describe(
          "Só na etapa 04, quando a 03 foi refeita depois do PDF de validação: markdown com o resumo corrigido das decisões e números da 03. Obrigatório nesse caso; omita nos demais.",
        ),
    },
  },
  async (args) => chamarApp("sinalizar_etapa_pronta", args),
)

await servidor.connect(new StdioServerTransport())
