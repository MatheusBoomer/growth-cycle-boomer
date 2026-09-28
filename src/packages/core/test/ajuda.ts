import { cp, mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { carregarCatalogo } from "../src/catalogo"

/** Raiz do projeto de planejamento (src/packages/core/test → ../../../../). */
export const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url))

export function catalogoReal() {
  return carregarCatalogo(RAIZ)
}

/** Raiz descartável com o _template real — o nome tem espaço, como a raiz de verdade. */
export async function raizTemporaria(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "planejamento com espaço-"))
  await cp(path.join(RAIZ, "clientes/_template"), path.join(dir, "clientes/_template"), { recursive: true })
  await mkdir(path.join(dir, ".claude/skills/_shared/modelos-insumo"), { recursive: true })
  return dir
}
