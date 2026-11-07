#!/usr/bin/env node
// Backup do planejamento: copia o schema `planejamento` e os buckets `planejamento-*` do Supabase
// para uma pasta local. Só lê do Supabase; nunca escreve lá.
//
// Uso: node scripts/backup/backup.mjs <pasta-vazia-de-destino>
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
//
// O que sai na pasta:
//   tabelas/<tabela>.json            todas as linhas de cada tabela
//   objetos/<bucket>/<caminho>       cópia exata de cada objeto (é o que a restauração usa)
//   prospects/<slug>/<caminho>       os arquivos de cada prospect com o nome de verdade (para abrir à mão)
//   manifesto.json                   contagens, tamanhos e problemas encontrados
// Termina com código 1 se algum objeto não bater com o hash ou faltar.
import { mkdir, readdir, writeFile, copyFile } from "node:fs/promises"
import path from "node:path"
import {
  BUCKETS,
  BUCKET_PROSPECTS,
  TABELAS,
  criarCliente,
  dentroDe,
  ehHash,
  lerTabela,
  limpar,
  listarObjetos,
  sha256,
} from "./comum.mjs"

async function principal() {
  const destinoArg = process.argv[2]
  if (!destinoArg) throw new Error("Uso: node scripts/backup/backup.mjs <pasta-vazia-de-destino>")
  const destino = path.resolve(destinoArg)
  await mkdir(destino, { recursive: true })
  if ((await readdir(destino)).length > 0) throw new Error(`A pasta de destino não está vazia: ${destino}`)

  const cliente = criarCliente()
  const problemas = []
  const manifesto = { criado_em: new Date().toISOString(), tabelas: {}, buckets: {}, prospects: {}, problemas }

  // 1. Tabelas
  await mkdir(path.join(destino, "tabelas"))
  const dados = {}
  for (const tabela of TABELAS) {
    const linhas = await lerTabela(cliente, tabela)
    dados[tabela.nome] = linhas
    await writeFile(path.join(destino, "tabelas", `${tabela.nome}.json`), JSON.stringify(linhas, null, 2))
    manifesto.tabelas[tabela.nome] = linhas.length
  }

  // 2. Objetos dos buckets, conferindo o hash dos arquivos de prospect
  for (const bucket of BUCKETS) {
    const objetos = await listarObjetos(cliente, bucket)
    let bytes = 0
    for (const objeto of objetos) {
      const { data, error } = await cliente.storage.from(bucket).download(objeto.caminho)
      if (error) {
        problemas.push(`${bucket}/${objeto.caminho}: não baixou (${limpar(error)})`)
        continue
      }
      const conteudo = Buffer.from(await data.arrayBuffer())
      const nome = path.posix.basename(objeto.caminho)
      if (bucket === BUCKET_PROSPECTS && ehHash(nome) && sha256(conteudo) !== nome) {
        problemas.push(`${bucket}/${objeto.caminho}: conteúdo não bate com o hash`)
      }
      const arquivo = dentroDe(path.join(destino, "objetos", bucket), objeto.caminho)
      await mkdir(path.dirname(arquivo), { recursive: true })
      await writeFile(arquivo, conteudo)
      bytes += conteudo.length
    }
    manifesto.buckets[bucket] = { objetos: objetos.length, bytes }
  }

  // 3. Pasta legível: cada linha de `arquivos` vira o arquivo com o nome de verdade
  const pastaObjetos = path.join(destino, "objetos", BUCKET_PROSPECTS)
  for (const linha of dados.arquivos) {
    const origem = dentroDe(pastaObjetos, `${linha.slug}/${linha.sha256}`)
    const alvo = dentroDe(path.join(destino, "prospects"), `${linha.slug}/${linha.caminho}`)
    try {
      await mkdir(path.dirname(alvo), { recursive: true })
      await copyFile(origem, alvo)
      manifesto.prospects[linha.slug] = (manifesto.prospects[linha.slug] ?? 0) + 1
    } catch {
      problemas.push(`${linha.slug}/${linha.caminho}: o objeto ${linha.sha256} não está no bucket`)
    }
  }

  await writeFile(path.join(destino, "manifesto.json"), JSON.stringify(manifesto, null, 2))

  const resumoTabelas = Object.entries(manifesto.tabelas).map(([t, n]) => `${t}=${n}`).join(" ")
  const resumoBuckets = Object.entries(manifesto.buckets)
    .map(([b, i]) => `${b}=${i.objetos} (${(i.bytes / 1024 / 1024).toFixed(1)} MB)`)
    .join(" ")
  console.log(`Backup concluído em ${destino}`)
  console.log(`Tabelas: ${resumoTabelas}`)
  console.log(`Buckets: ${resumoBuckets}`)
  console.log(`Prospects: ${Object.keys(manifesto.prospects).length}`)
  if (problemas.length > 0) {
    console.error(`ATENÇÃO, ${problemas.length} problema(s):`)
    for (const p of problemas) console.error(`  - ${p}`)
    process.exitCode = 1
  }
}

principal().catch((erro) => {
  console.error(`Backup falhou: ${limpar(erro)}`)
  process.exitCode = 1
})
