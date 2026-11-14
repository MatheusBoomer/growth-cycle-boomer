/** O "o que esperar" do catálogo em passos numerados: uma frase por passo (quebra só antes de maiúscula). */
export function passosDoQueEsperar(texto: string): string[] {
  return texto
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/)
    .map((f) => f.trim())
    .filter((f) => f !== "")
}
