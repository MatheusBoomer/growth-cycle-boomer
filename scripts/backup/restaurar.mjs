#!/usr/bin/env node
// Restauração do planejamento a partir de uma pasta feita por backup.mjs (já extraída do .tar.gz).
//
// Uso: node scripts/backup/restaurar.mjs <pasta-do-backup> [--prospect <slug>] [--como <novo-slug>] [--aplicar]
//
// Sem --aplicar, só mostra o que faria (nada é escrito no Supabase).
// Regra: a restauração só REPÕE o que falta, nunca sobrescreve o que existe.
//   - Prospect que não existe mais no Supabase: é recriado inteiro (linha, arquivos, conversa, uso,
//     comentários e objetos dos buckets).
//   - Prospect que existe: só voltam as linhas de `arquivos` e os objetos que sumiram.
//   - --como <novo-slug>: recria o prospect do backup com outro slug, ao lado do original (para
//     conferir um backup sem mexer no prospect de verdade). O novo slug não pode existir.
//   - Usuários (tabela global): só na restauração completa (sem --prospect e sem --como). Entram
//     só os e-mails que ainda não existem; papéis já cadastrados nunca são alterados.
import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  BUCKETS,
  BUCKET_PROSPECTS,
  TABELAS,
  criarCliente,
  dentroDe,
  limpar,
  listarObjetos,
} from "./comum.mjs"

const LOTE = 500

function lerArgumentos(argv) {
  const opcoes = { pasta: null, prospect: null, como: null, aplicar: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--aplicar") opcoes.aplicar = true
    else if (a === "--prospect") opcoes.prospect = argv[++i]
    else if (a === "--como") opcoes.como = argv[++i]
    else if (!opcoes.pasta) opcoes.pasta = a
    else throw new Error(`Argumento desconhecido: ${a}`)
  }
  if (!opcoes.pasta) {
    throw new Error("Uso: node scripts/backup/restaurar.mjs <pasta-do-backup> [--prospect <slug>] [--como <novo-slug>] [--aplicar]")
  }
  if (opcoes.como && !opcoes.prospect) throw new Error("--como exige --prospect.")
  if (opcoes.como && !/^[a-z0-9][a-z0-9-]*$/.test(opcoes.como)) throw new Error("--como: use só letras minúsculas, números e hífen.")
  return opcoes
}

async function inserir(cliente, tabela, linhas) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await cliente.from(tabela).insert(linhas.slice(i, i + LOTE))
    if (error) throw new Error(`inserir em ${tabela}: ${limpar(error)}`)
  }
}

async function principal() {
  const op = lerArgumentos(process.argv.slice(2))
  const pasta = path.resolve(op.pasta)
  const manifesto = JSON.parse(await readFile(path.join(pasta, "manifesto.json"), "utf8"))
  const backup = {}
  for (const t of TABELAS) backup[t.nome] = await lerTabelaDoBackup(pasta, t.nome)

  const cliente = criarCliente()
  console.log(`Backup de ${manifesto.criado_em} · ${op.aplicar ? "APLICANDO" : "simulação (nada é escrito; use --aplicar)"}`)

  let slugs = backup.prospects.map((p) => p.slug)
  if (op.prospect) {
    if (!slugs.includes(op.prospect)) throw new Error(`O prospect ${op.prospect} não está neste backup.`)
    slugs = [op.prospect]
  }

  const { data: existentes, error: erroExistentes } = await cliente.from("prospects").select("slug")
  if (erroExistentes) throw new Error(limpar(erroExistentes))
  const noSupabase = new Set((existentes ?? []).map((p) => p.slug))
  if (op.como && noSupabase.has(op.como)) throw new Error(`O slug ${op.como} já existe no Supabase; escolha outro.`)

  let pendencias = 0
  for (const origem of slugs) {
    // (o laço por prospect cuida só das tabelas com slug; as globais vêm depois)
    const destino = op.como ?? origem
    const recriar = !noSupabase.has(destino)
    const doProspect = (nome) => backup[nome].filter((l) => l.slug === origem)

    // Linhas a inserir
    const linhas = {}
    if (recriar) {
      for (const t of TABELAS.filter((t) => !t.global)) {
        linhas[t.nome] = doProspect(t.nome).map((l) => {
          const nova = { ...l, slug: destino }
          if (t.identidade) delete nova[t.identidade] // o banco gera um id novo (coluna GENERATED ALWAYS)
          return nova
        })
      }
    } else {
      const { data, error } = await cliente.from("arquivos").select("caminho").eq("slug", destino)
      if (error) throw new Error(limpar(error))
      const temos = new Set((data ?? []).map((l) => l.caminho))
      linhas.arquivos = doProspect("arquivos").filter((l) => !temos.has(l.caminho))
    }

    // Objetos a subir (os que faltam no bucket)
    const objetos = []
    for (const bucket of BUCKETS) {
      const doBackup = (manifesto.buckets[bucket] ? await listarDoBackup(pasta, bucket, origem) : [])
      const noBucket = new Set((await listarObjetos(cliente, bucket, destino)).map((o) => o.caminho))
      for (const nome of doBackup) {
        const caminhoDestino = `${destino}/${nome}`
        if (!noBucket.has(caminhoDestino)) objetos.push({ bucket, origem: `${origem}/${nome}`, destino: caminhoDestino })
      }
    }

    const resumoLinhas = Object.entries(linhas).filter(([, l]) => l.length > 0).map(([t, l]) => `${t}=${l.length}`)
    const total = resumoLinhas.length + objetos.length
    pendencias += total
    const titulo = op.como ? `${origem} → ${destino}` : origem
    if (total === 0) {
      console.log(`· ${titulo}: nada faltando`)
      continue
    }
    console.log(`· ${titulo}: ${recriar ? "recriar prospect" : "repor o que falta"} · linhas: ${resumoLinhas.join(" ") || "nenhuma"} · objetos: ${objetos.length}`)
    if (!op.aplicar) continue

    // Objetos primeiro: assim nenhuma linha de `arquivos` aponta para um objeto que ainda não subiu.
    for (const o of objetos) {
      const conteudo = await readFile(dentroDe(path.join(pasta, "objetos", o.bucket), o.origem))
      const { error } = await cliente.storage
        .from(o.bucket)
        .upload(o.destino, conteudo, { upsert: false, contentType: "application/octet-stream" })
      if (error && !/exists|duplicate/i.test(error.message ?? "")) throw new Error(`subir ${o.bucket}/${o.destino}: ${limpar(error)}`)
    }
    for (const t of TABELAS) if (linhas[t.nome]?.length) await inserir(cliente, t.nome, linhas[t.nome])
    console.log(`  ✓ restaurado`)
  }

  // Tabelas globais (usuários): só na restauração completa, e só insere o que falta
  if (!op.prospect && !op.como) {
    for (const t of TABELAS.filter((t) => t.global)) {
      const { data: existentes, error } = await cliente.from(t.nome).select(t.chave.join(","))
      if (error) throw new Error(limpar(error))
      const chaveDe = (l) => t.chave.map((c) => l[c]).join("|")
      const jaTem = new Set((existentes ?? []).map(chaveDe))
      const faltam = backup[t.nome].filter((l) => !jaTem.has(chaveDe(l)))
      pendencias += faltam.length
      if (faltam.length === 0) {
        console.log(`· ${t.nome}: nada faltando`)
        continue
      }
      console.log(`· ${t.nome}: repor o que falta · linhas: ${faltam.length}`)
      if (!op.aplicar) continue
      await inserir(cliente, t.nome, faltam)
      console.log(`  ✓ ${faltam.length} restaurado(s)`)
    }
  }

  if (pendencias === 0) console.log("Nada a restaurar: o Supabase já tem tudo o que está neste backup.")
  else if (!op.aplicar) console.log("Simulação concluída. Para executar, rode de novo com --aplicar.")
}

/** Linhas de uma tabela do backup. Backup feito antes da tabela existir não tem o arquivo: conta como vazio. */
async function lerTabelaDoBackup(pasta, nome) {
  try {
    return JSON.parse(await readFile(path.join(pasta, "tabelas", `${nome}.json`), "utf8"))
  } catch (erro) {
    // Só tabela global (ex.: usuarios) ou opcional (ex.: presenca) pode faltar: backup anterior à tabela.
    // Qualquer outra ausente é backup danificado.
    const tabela = TABELAS.find((t) => t.nome === nome)
    if (erro.code === "ENOENT" && (tabela?.global || tabela?.opcional)) return []
    throw erro
  }
}

/** Nomes dos objetos de um prospect no backup (relativos à pasta do slug). */
async function listarDoBackup(pasta, bucket, slug) {
  const { readdir } = await import("node:fs/promises")
  const base = dentroDe(path.join(pasta, "objetos", bucket), slug)
  const nomes = []
  async function andar(dir, prefixo) {
    let itens
    try {
      itens = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const item of itens) {
      const rel = prefixo ? `${prefixo}/${item.name}` : item.name
      if (item.isDirectory()) await andar(path.join(dir, item.name), rel)
      else nomes.push(rel)
    }
  }
  await andar(base, "")
  return nomes
}

principal().catch((erro) => {
  console.error(`Restauração falhou: ${limpar(erro)}`)
  process.exitCode = 1
})
