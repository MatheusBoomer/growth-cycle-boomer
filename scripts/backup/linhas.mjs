// Comparação entre as linhas do backup e as do banco, para a restauração repor só o que falta.
// Módulo puro: sem Supabase e sem .env, para o teste rodar sem tocar em nada.

/**
 * Valor de uma coluna da chave pronto para comparar. Timestamps (colunas `*_em`) vindos em UTC
 * com `+00:00` viram `Z`, para que a forma do backup e a do banco batam. Não converte via Date:
 * Date perde os microssegundos que o Postgres guarda.
 */
export function normalizarValor(coluna, valor) {
  if (coluna.endsWith("_em") && typeof valor === "string") return valor.replace(/\+00:00$/, "Z")
  return valor
}

/** Chave de comparação de uma linha. JSON, para que valores com `|` não colidam. */
export function chaveDaLinha(linha, chave) {
  return JSON.stringify(chave.map((coluna) => normalizarValor(coluna, linha[coluna])))
}

/** Linhas do backup cuja chave ainda não existe no banco. */
export function linhasQueFaltam(linhasBackup, linhasNoBanco, chave) {
  const existentes = new Set(linhasNoBanco.map((linha) => chaveDaLinha(linha, chave)))
  return linhasBackup.filter((linha) => !existentes.has(chaveDaLinha(linha, chave)))
}
