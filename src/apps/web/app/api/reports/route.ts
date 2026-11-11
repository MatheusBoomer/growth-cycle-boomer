import { ErroEntrada } from "@workspace/core/erros"
import { LIMITE_CORPO_REPORT_BYTES, LIMITE_IMAGEM_BYTES, LIMITE_IMAGENS_EXTRAS } from "@workspace/core/reports"
import { json, respostaDeErro } from "@/lib/http"
import { servidor } from "@/lib/servidor"
import { exigirUsuario } from "@/lib/sessao"

async function bytesDe(arquivo: File): Promise<Uint8Array> {
  // Recusa antes de ler, para não alocar à toa; os bytes ainda passam pela validação do serviço.
  if (arquivo.size > LIMITE_IMAGEM_BYTES) throw new ErroEntrada("Cada imagem pode ter no máximo 5 MB.")
  return new Uint8Array(await arquivo.arrayBuffer())
}

/**
 * Qualquer usuário logado: envia um report de bug ou melhoria. Corpo `multipart/form-data` com `dados` (JSON com tipo,
 * comentário e contexto), `tela` (print, opcional) e `extras` (até 3 imagens). O autor é sempre o e-mail da sessão.
 */
export async function POST(req: Request) {
  try {
    const usuario = await exigirUsuario()
    if (usuario.email === null) throw new ErroEntrada("Sem e-mail na sessão, não dá para saber quem está reportando.")
    // Antes de ler o formulário, que fica inteiro na memória (o proxy do Next corta acima de proxyClientMaxBodySize).
    if (Number(req.headers.get("content-length") ?? 0) > LIMITE_CORPO_REPORT_BYTES) {
      throw new ErroEntrada("O report passa de 21 MB no total. Tire alguma imagem extra.")
    }
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      throw new ErroEntrada("Dados do report inválidos.")
    }
    let dados: unknown
    try {
      dados = JSON.parse(String(form.get("dados") ?? ""))
    } catch {
      throw new ErroEntrada("Dados do report inválidos.")
    }
    const tela = form.get("tela")
    const extras = form.getAll("extras").filter((e): e is File => e instanceof File)
    if (extras.length > LIMITE_IMAGENS_EXTRAS) throw new ErroEntrada(`Envie no máximo ${LIMITE_IMAGENS_EXTRAS} imagens além do print.`)
    const report = await servidor().servico.criarReport(
      dados,
      usuario.email,
      tela instanceof File ? await bytesDe(tela) : null,
      await Promise.all(extras.map(bytesDe)),
    )
    return json({ id: report.id }, 201)
  } catch (e) {
    return respostaDeErro(e)
  }
}
