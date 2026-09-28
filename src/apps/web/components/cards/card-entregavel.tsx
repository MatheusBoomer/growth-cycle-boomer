"use client"

import type { Entregavel } from "@workspace/core/tipos"

export function CardEntregavel({ entregavel }: { slug: string; entregavel: Entregavel }) {
  return <div className="rounded-lg border p-3 text-sm">{entregavel.titulo} — {entregavel.status}</div>
}
