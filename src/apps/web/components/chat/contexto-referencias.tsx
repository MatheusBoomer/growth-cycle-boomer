"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { EtapaId } from "@workspace/core/tipos"
import type { Marca } from "@/lib/anotacoes"
import { adicionarReferencia, removerReferencia, type Referencia } from "@/lib/referencias"

interface Estado {
  porEtapa: Partial<Record<EtapaId, Referencia[]>>
  /** Entregável que está em modo de marcar (a imagem do card vira o marcador). */
  marcando: string | null
}

interface Controle extends Estado {
  adicionar: (etapa: EtapaId, ref: Referencia) => void
  mudarMarcas: (etapa: EtapaId, entregavelId: string, marcas: Marca[]) => void
  remover: (etapa: EtapaId, entregavelId: string) => void
  substituir: (etapa: EtapaId, lista: Referencia[]) => void
  limpar: (etapa: EtapaId) => void
  iniciarMarcacao: (entregavelId: string) => void
  terminarMarcacao: () => void
}

const vazio: Controle = {
  porEtapa: {},
  marcando: null,
  adicionar: () => {},
  mudarMarcas: () => {},
  remover: () => {},
  substituir: () => {},
  limpar: () => {},
  iniciarMarcacao: () => {},
  terminarMarcacao: () => {},
}

const Contexto = createContext<Controle>(vazio)

/**
 * Referências de ajuste por etapa, em memória. Ficam acima do chat e dos cards, então sobrevivem à troca de
 * card e de etapa durante a sessão; recarregar a página as perde (o navegador avisa antes de sair).
 */
export function ProvedorReferencias({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ porEtapa: {}, marcando: null })

  const trocar = useCallback((etapa: EtapaId, f: (lista: Referencia[]) => Referencia[]) => {
    setEstado((e) => ({ ...e, porEtapa: { ...e.porEtapa, [etapa]: f(e.porEtapa[etapa] ?? []) } }))
  }, [])

  const controle = useMemo<Controle>(
    () => ({
      ...estado,
      adicionar: (etapa, ref) => trocar(etapa, (l) => adicionarReferencia(l, ref)),
      mudarMarcas: (etapa, id, marcas) => trocar(etapa, (l) => l.map((r) => (r.entregavelId === id ? { ...r, marcas } : r))),
      remover: (etapa, id) => {
        trocar(etapa, (l) => removerReferencia(l, id))
        setEstado((e) => (e.marcando === id ? { ...e, marcando: null } : e))
      },
      substituir: (etapa, lista) => trocar(etapa, () => lista),
      limpar: (etapa) => {
        trocar(etapa, () => [])
        setEstado((e) => ({ ...e, marcando: null }))
      },
      iniciarMarcacao: (id) => setEstado((e) => ({ ...e, marcando: id })),
      terminarMarcacao: () => setEstado((e) => ({ ...e, marcando: null })),
    }),
    [estado, trocar],
  )

  return <Contexto.Provider value={controle}>{children}</Contexto.Provider>
}

export function useReferencias(etapa: EtapaId) {
  const c = useContext(Contexto)
  return {
    referencias: c.porEtapa[etapa] ?? [],
    marcando: c.marcando,
    adicionar: (ref: Referencia) => c.adicionar(etapa, ref),
    mudarMarcas: (id: string, marcas: Marca[]) => c.mudarMarcas(etapa, id, marcas),
    remover: (id: string) => c.remover(etapa, id),
    substituir: (lista: Referencia[]) => c.substituir(etapa, lista),
    limpar: () => c.limpar(etapa),
    iniciarMarcacao: c.iniciarMarcacao,
    terminarMarcacao: c.terminarMarcacao,
  }
}
