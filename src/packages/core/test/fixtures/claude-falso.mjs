// Finge ser o `claude -p`: lê a mensagem do stdin e imprime as linhas de $FIXTURE.
// $DORMIR_MS faz esperar antes de imprimir (teste de "Parar"). $ARGS_SAIDA grava os argv recebidos.
import { readFileSync, writeFileSync } from "node:fs"

let entrada = ""
for await (const parte of process.stdin) entrada += parte
if (process.env.ARGS_SAIDA) writeFileSync(process.env.ARGS_SAIDA, JSON.stringify({ argv: process.argv.slice(2), entrada }))
if (process.env.DORMIR_MS) await new Promise((r) => setTimeout(r, Number(process.env.DORMIR_MS)))
if (process.env.FIXTURE) process.stdout.write(readFileSync(process.env.FIXTURE, "utf8"))
if (process.env.STDERR) process.stderr.write(process.env.STDERR)
process.exit(Number(process.env.SAIDA ?? 0))
