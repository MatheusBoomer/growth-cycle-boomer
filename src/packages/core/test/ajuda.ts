import { cp, mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { carregarCatalogo } from "../src/catalogo"
import { reavaliarPronta } from "../src/maquina-estados"
import type { Estado } from "../src/tipos"
import { confirmarValidacaoCliente, registrarDownloadValidacao, registrarValidacaoGerada } from "../src/validacao-cliente"

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

/**
 * Cumpre o gate de validação do cliente da etapa 04 (gera, baixa e confirma o documento) e reavalia a etapa, já que as
 * transições puras não recalculam o status. A 04 precisa estar em andamento ou pronta.
 */
export function comValidacaoConfirmada(estado: Estado, em = "2026-09-28T10:00:00.000Z"): Estado {
  let e = registrarValidacaoGerada(estado, em)
  e = registrarDownloadValidacao(e, null, em)
  e = confirmarValidacaoCliente(e, null, em)
  return reavaliarPronta(e, "04", catalogoReal(), em)
}
