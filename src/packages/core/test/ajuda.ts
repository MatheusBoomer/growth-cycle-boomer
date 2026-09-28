import { fileURLToPath } from "node:url"
import { carregarCatalogo } from "../src/catalogo"

/** Raiz do projeto de planejamento (src/packages/core/test → ../../../../). */
export const RAIZ = fileURLToPath(new URL("../../../../", import.meta.url))

export function catalogoReal() {
  return carregarCatalogo(RAIZ)
}
