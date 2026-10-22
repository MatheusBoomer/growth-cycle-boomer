// Desenha as marcações numeradas sobre a imagem original e devolve o PNG em base64.
// Só roda no navegador (canvas); a lógica testável fica em anotacoes.ts.
import type { Marca } from "./anotacoes"

export const COR_MARCA = "#be123c"

function carregar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem para anotar."))
    img.src = url
  })
}

export async function renderizarAnotada(url: string, marcas: Marca[]): Promise<string> {
  const img = await carregar(url)
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem anotada.")
  ctx.drawImage(img, 0, 0)

  // Traço e números crescem com a imagem, para continuarem legíveis em gráficos grandes.
  const escala = Math.max(1, canvas.width / 800)
  const raio = 11 * escala
  ctx.lineWidth = 3 * escala
  ctx.strokeStyle = COR_MARCA
  ctx.fillStyle = COR_MARCA

  marcas.forEach((m, i) => {
    const x = (m.x / 100) * canvas.width
    const y = (m.y / 100) * canvas.height
    const w = (m.w / 100) * canvas.width
    const h = (m.h / 100) * canvas.height
    if (m.forma !== "numero") {
      ctx.save()
      ctx.globalAlpha = 0.12
      ctx.beginPath()
      if (m.forma === "retangulo") ctx.rect(x, y, w, h)
      else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.beginPath()
      if (m.forma === "retangulo") ctx.rect(x, y, w, h)
      else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    // O número fica no canto superior esquerdo da forma, ou no próprio ponto, sempre dentro da imagem.
    const cx = Math.min(Math.max(x, raio), canvas.width - raio)
    const cy = Math.min(Math.max(y, raio), canvas.height - raio)
    ctx.beginPath()
    ctx.arc(cx, cy, raio, 0, Math.PI * 2)
    ctx.fillStyle = COR_MARCA
    ctx.fill()
    ctx.lineWidth = 2 * escala
    ctx.strokeStyle = "#ffffff"
    ctx.stroke()
    ctx.lineWidth = 3 * escala
    ctx.strokeStyle = COR_MARCA
    ctx.fillStyle = "#ffffff"
    ctx.font = `bold ${13 * escala}px sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(i + 1), cx, cy + escala * 0.5)
    ctx.fillStyle = COR_MARCA
  })

  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "")
}
