/**
 * Roda uma vez quando o servidor do Next sobe, e termina antes da primeira requisição (inclusive a do proxy).
 * Carrega o .env da raiz e confere a configuração do login: um valor inválido derruba a subida, em vez de
 * aparecer só na primeira requisição. Os avisos nunca imprimem URL, chave nem valor de variável.
 */

const AVISO_DADOS_EM_DISCO = "[planejamento] login ligado com dados em disco (PLANEJAMENTO_DADOS=fs): útil só para testar o login."
const AVISO_URL_PUBLICA =
  "[planejamento] PLANEJAMENTO_APP_URL não é uma URL http ou https: nenhum host público é aceito (só o local) e o login não monta o endereço de volta."

export async function register(): Promise<void> {
  // O ambiente da raiz e as regras do login só existem no servidor Node (o proxy do Next 16 também roda nele).
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { carregarAmbiente } = await import("./lib/ambiente")
  carregarAmbiente()
  const { modoDeAutenticacao } = await import("@workspace/core/autenticacao")
  const { urlPublicaMalformada } = await import("./lib/origem-publica")

  const env = process.env
  if (modoDeAutenticacao(env) !== "google") return
  // Mesma leitura do modo de dados do servidor(): vazio vale como fs.
  const dados = (env.PLANEJAMENTO_DADOS ?? "").trim()
  if (dados === "" || dados === "fs") console.warn(AVISO_DADOS_EM_DISCO)
  if (urlPublicaMalformada(env)) console.warn(AVISO_URL_PUBLICA)
}
