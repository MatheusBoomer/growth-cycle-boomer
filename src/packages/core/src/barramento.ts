import type { EventoTempoReal } from "./tipos"

type Ouvinte = (evento: EventoTempoReal) => void

/** Pub/sub em memória por prospect. Alimenta o SSE da interface. */
export class Barramento {
  private readonly ouvintes = new Map<string, Set<Ouvinte>>()

  assinar(slug: string, ouvinte: Ouvinte): () => void {
    const conjunto = this.ouvintes.get(slug) ?? new Set<Ouvinte>()
    conjunto.add(ouvinte)
    this.ouvintes.set(slug, conjunto)
    return () => {
      conjunto.delete(ouvinte)
    }
  }

  publicar(slug: string, evento: EventoTempoReal): void {
    for (const ouvinte of this.ouvintes.get(slug) ?? []) {
      try {
        ouvinte(evento)
      } catch {
        // conexão SSE já fechada: ignorar
      }
    }
  }
}
