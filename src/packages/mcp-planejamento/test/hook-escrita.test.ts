import { spawnSync } from "node:child_process"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { decidirEscrita } from "../src/hook-escrita.ts"

const HOOK = fileURLToPath(new URL("../src/hook-escrita.ts", import.meta.url))
const PASTA = "/raiz/clientes/iszi"

describe("decidirEscrita", () => {
  it.each([
    [".app/rascunhos/g.png", true],
    ["contexto/kickoff-transcricao.md", true],
    ["CLAUDE.md", true],
    ["entrega/ativos-aprovados/graficos/g.png", false],
    [".app/estado.json", false],
    [".app/propostas/x.png", false],
    ["contexto/status-planejamento.md", false],
    ["../adda/CLAUDE.md", false],
    ["/tmp/x.txt", false],
  ])("%s → permitir=%s", (caminho, permitir) => {
    expect(decidirEscrita(caminho, PASTA, PASTA).permitir).toBe(permitir)
  })

  it("resolve caminho relativo ao cwd do agente (raiz do projeto)", () => {
    expect(decidirEscrita("clientes/iszi/.app/rascunhos/a.md", "/raiz", PASTA).permitir).toBe(true)
    expect(decidirEscrita("clientes/adda/x.md", "/raiz", PASTA).permitir).toBe(false)
  })
})

describe("hook executado pelo node, com espaço no caminho", () => {
  it("bloqueia com exit 2 e explica no stderr; libera com exit 0", async () => {
    const raiz = await mkdtemp(path.join(tmpdir(), "Projetos Boomer-"))
    const pasta = path.join(raiz, "clientes", "iszi")
    const rodar = (arquivo: string) =>
      spawnSync(process.execPath, [HOOK, pasta], {
        input: JSON.stringify({ cwd: raiz, tool_name: "Write", tool_input: { file_path: arquivo } }),
        encoding: "utf8",
      })
    const bloqueado = rodar(path.join(pasta, "entrega/ativos-aprovados/graficos/g.png"))
    expect(bloqueado.status).toBe(2)
    expect(bloqueado.stderr).toContain("propor_entregavel")
    expect(rodar(path.join(pasta, ".app/rascunhos/g.png")).status).toBe(0)
  })
})
