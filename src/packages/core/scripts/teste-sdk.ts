// Teste isolado do Claude Agent SDK: confirma que a chave, os créditos e a instalação funcionam.
// Não toca em nenhum prospect nem usa ferramenta alguma (maxTurns 1, sem tools).
// Rodar a partir de src/: npm run teste-sdk -w @workspace/core
import { query } from "@anthropic-ai/claude-agent-sdk"

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY não está definida. Preencha o .env da raiz do projeto.")
  process.exit(1)
}

for await (const mensagem of query({
  prompt: "Responda apenas com a frase: SDK funcionando.",
  options: { maxTurns: 1, allowedTools: [] },
})) {
  if (mensagem.type === "system" && mensagem.subtype === "init") {
    // Mostra de onde veio a credencial (nunca o valor da chave).
    console.log("Origem da credencial:", (mensagem as { apiKeySource?: string }).apiKeySource ?? "não informada")
  }
  if (mensagem.type === "result") {
    console.log("Resultado:", mensagem.subtype)
    if (mensagem.subtype === "success") console.log("Resposta:", mensagem.result)
    console.log("Custo (US$):", mensagem.total_cost_usd)
  }
}
