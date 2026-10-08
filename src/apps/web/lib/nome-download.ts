import path from "node:path"

/** Nome do arquivo no download: o pedido (sem caracteres proibidos) com a extensão do original. */
export function nomeDeDownload(nome: string | null, caminhoAbs: string): string {
  // eslint-disable-next-line no-control-regex -- caracteres de controle não podem ir em nome de arquivo
  const limpo = (nome ?? "").replace(/[/\\:*?"<>|\u0000-\u001f]/g, "-").trim().slice(0, 120)
  return limpo ? `${limpo}${path.extname(caminhoAbs)}` : path.basename(caminhoAbs)
}
