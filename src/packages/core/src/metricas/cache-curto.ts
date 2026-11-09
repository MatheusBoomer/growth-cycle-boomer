/**
 * Guarda um valor por pouco tempo. Uma carga em andamento é compartilhada por quem chamar enquanto ela dura, e um
 * erro nunca fica guardado (nem apaga o valor anterior, que segue valendo até o prazo).
 */
export class CacheCurto<T> {
  private valor: { dados: T; ate: number } | null = null
  private emAndamento: Promise<T> | null = null

  constructor(
    private readonly ttlMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  async obter(carregar: () => Promise<T>, forcar = false): Promise<T> {
    if (!forcar && this.valor !== null && this.agora() < this.valor.ate) return this.valor.dados
    if (this.emAndamento !== null) return this.emAndamento
    const carga = carregar().then((dados) => {
      this.valor = { dados, ate: this.agora() + this.ttlMs }
      return dados
    })
    this.emAndamento = carga
    try {
      return await carga
    } finally {
      this.emAndamento = null
    }
  }
}
