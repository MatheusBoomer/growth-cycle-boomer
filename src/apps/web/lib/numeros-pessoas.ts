const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

/** Cor da variação: subiu o que é ruim (custo, tempo) é "ruim"; caiu é "bom"; sem anterior válido ou sem mudança, "neutro". */
export function tomDaVariacao(atual: number, anterior: number, subirEhRuim: boolean): "ruim" | "bom" | "neutro" {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior) || anterior <= 0) return "neutro"
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  if (pct === 0) return "neutro"
  return pct > 0 === subirEhRuim ? "ruim" : "bom"
}

/** Números do topo de Pessoas: quantas têm acesso, quantas são admins e quantas entraram nos últimos 7 dias. */
export function numerosDePessoas(pessoas: { papel: string; ultimoAcesso: string | null }[], agora: Date): { total: number; admins: number; ativas7d: number } {
  const limite = agora.getTime() - SETE_DIAS_MS
  return {
    total: pessoas.length,
    admins: pessoas.filter((p) => p.papel === "admin").length,
    ativas7d: pessoas.filter((p) => {
      const t = p.ultimoAcesso === null ? Number.NaN : Date.parse(p.ultimoAcesso)
      return !Number.isNaN(t) && t >= limite
    }).length,
  }
}
