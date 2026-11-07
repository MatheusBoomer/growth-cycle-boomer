// Partes comuns do backup e da restauração do planejamento (schema `planejamento` e buckets
// `planejamento-*` do Supabase). Só toca nesses dois: o projeto Supabase é compartilhado com o `pit`.
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

// No Mac, o .env da raiz vence o que vier do terminal (como no app: ver src/apps/web/lib/ambiente.ts).
// Na VPS o contêiner não tem .env na raiz; as variáveis chegam pelo docker compose.
const envDaRaiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env")
if (existsSync(envDaRaiz)) Object.assign(process.env, parseEnv(readFileSync(envDaRaiz, "utf8")))

// O supabase-js vem do node_modules do app (em `src/`), tanto no Mac quanto na imagem (/app/src).
const exigir = createRequire(new URL("../../src/package.json", import.meta.url))
const { createClient } = exigir("@supabase/supabase-js")

export const BUCKET_PROSPECTS = "planejamento-prospects"
export const BUCKET_SESSOES = "planejamento-sessoes"
export const BUCKETS = [BUCKET_PROSPECTS, BUCKET_SESSOES]

/**
 * Tabelas na ordem de restauração (prospects primeiro, por causa das chaves estrangeiras).
 * `global: true` marca tabelas que não pertencem a um prospect: a restauração as trata à parte.
 * `opcional: true` marca tabelas criadas depois dos primeiros backups: se o arquivo não existir
 * no backup, a restauração conta a tabela como vazia.
 */
export const TABELAS = [
  { nome: "prospects", chave: ["slug"] },
  { nome: "usuarios", chave: ["email"], global: true },
  { nome: "arquivos", chave: ["slug", "caminho"] },
  { nome: "arquivos_lixeira", chave: ["id"], identidade: "id" },
  { nome: "comentarios", chave: ["slug", "entregavel_id"] },
  { nome: "eventos_conversa", chave: ["id"], identidade: "id" },
  { nome: "uso_turnos", chave: ["id"], identidade: "id" },
  { nome: "presenca", chave: ["id"], identidade: "id", opcional: true },
]

const PAGINA = 1000

export function criarCliente() {
  const url = process.env.SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new Error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.")
  return createClient(url, chave, {
    db: { schema: "planejamento" },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Mensagem de erro sem endereço nem chave. */
export function limpar(erro) {
  const texto = typeof erro === "string" ? erro : erro?.message || String(erro)
  return texto
    .replace(/https?:\/\/\S+/gi, "[endereço omitido]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[chave omitida]")
    .replace(/sb_secret_[\w-]+/g, "[chave omitida]")
}

export function sha256(dados) {
  return createHash("sha256").update(dados).digest("hex")
}

/** Todas as linhas de uma tabela, em ordem estável pela chave primária. */
export async function lerTabela(cliente, tabela) {
  const linhas = []
  for (let de = 0; ; de += PAGINA) {
    let consulta = cliente.from(tabela.nome).select("*")
    for (const coluna of tabela.chave) consulta = consulta.order(coluna, { ascending: true })
    const { data, error } = await consulta.range(de, de + PAGINA - 1)
    if (error) throw new Error(`tabela ${tabela.nome}: ${limpar(error)}`)
    linhas.push(...(data ?? []))
    if ((data ?? []).length < PAGINA) return linhas
  }
}

/** Todos os objetos de um bucket (percorre as pastas), com caminho e tamanho. */
export async function listarObjetos(cliente, bucket, prefixo = "") {
  const objetos = []
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await cliente.storage
      .from(bucket)
      .list(prefixo, { limit: PAGINA, offset, sortBy: { column: "name", order: "asc" } })
    if (error) throw new Error(`bucket ${bucket}: ${limpar(error)}`)
    const pagina = data ?? []
    for (const item of pagina) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name
      if (item.id === null) objetos.push(...(await listarObjetos(cliente, bucket, caminho)))
      else objetos.push({ caminho, tamanho: Number(item.metadata?.size ?? 0) })
    }
    if (pagina.length < PAGINA) return objetos
  }
}

/** Junta `base` e um caminho relativo vindo de dado, recusando qualquer saída da pasta. */
export function dentroDe(base, relativo) {
  const destino = path.resolve(base, relativo)
  if (destino !== base && !destino.startsWith(base + path.sep)) {
    throw new Error(`caminho fora da pasta do backup: ${relativo}`)
  }
  return destino
}

/** Um hash sha256 em hexadecimal (nome dos objetos do bucket de prospects). */
export function ehHash(nome) {
  return /^[0-9a-f]{64}$/.test(nome)
}
