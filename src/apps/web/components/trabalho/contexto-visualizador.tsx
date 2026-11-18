"use client"

import { createContext, useContext } from "react"
import type { EtapaId } from "@workspace/core/tipos"

export interface ControleVisualizador {
  /** Abre o relatório HTML de um entregável na coluna larga. */
  abrir: (etapa: EtapaId, nomeFinal: string) => void
  /** Abre uma seção de texto (markdown) na coluna larga, para ler, citar trechos e editar. */
  abrirSecao: (etapa: EtapaId, nomeFinal: string) => void
  /** Abre a prévia de uma planilha (.xlsx), com todas as abas, na coluna larga. */
  abrirPlanilha: (etapa: EtapaId, nomeFinal: string) => void
  /** Abre a prévia de um documento Word (.docx), convertido em PDF, na coluna larga. */
  abrirDocumento: (etapa: EtapaId, nomeFinal: string) => void
  /** Abre um arquivo do prospect (caminho relativo à pasta dele) no visualizador embaixo do painel. */
  abrirArquivo: (caminho: string) => void
  /** Insere "@caminho" no campo de mensagem, na posição do cursor. */
  mencionar: (caminho: string) => void
  /** Insere um texto qualquer (ex.: citação) no campo de mensagem, na posição do cursor. */
  inserirNoCompositor: (texto: string) => void
  /** O campo de mensagem se registra aqui para receber as menções. */
  registrarCompositor: (inserir: ((texto: string) => void) | null) => void
  /** Abre outra etapa na área de trabalho (como clicar nela na trilha). */
  irParaEtapa: (etapa: EtapaId) => void
}

export const ContextoVisualizador = createContext<ControleVisualizador>({
  abrir: () => {},
  abrirSecao: () => {},
  abrirPlanilha: () => {},
  abrirDocumento: () => {},
  abrirArquivo: () => {},
  mencionar: () => {},
  inserirNoCompositor: () => {},
  registrarCompositor: () => {},
  irParaEtapa: () => {},
})

export function useVisualizador(): ControleVisualizador {
  return useContext(ContextoVisualizador)
}
