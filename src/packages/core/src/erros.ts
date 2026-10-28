import { nomeCurto } from "./autenticacao"

export class ErroDominio extends Error {
  readonly codigo: string
  readonly status: number
  constructor(message: string, codigo: string, status: number) {
    super(message)
    this.name = new.target.name
    this.codigo = codigo
    this.status = status
  }
}

export class TransicaoInvalida extends ErroDominio {
  constructor(message: string) {
    super(message, "transicao_invalida", 409)
  }
}

export class ErroProspectExistente extends ErroDominio {
  readonly slug: string
  constructor(slug: string) {
    super(`Já existe um prospect "${slug}".`, "prospect_existente", 409)
    this.slug = slug
  }
}

export class ErroTurnoAtivo extends ErroDominio {
  /** `autor` = e-mail de quem está com o turno rodando; sem ele (modo off, fila automática) vale a mensagem genérica. */
  constructor(autor?: string | null) {
    super(
      autor
        ? `${nomeCurto(autor)} está com o agente rodando nesta etapa.`
        : "O agente ainda está respondendo neste prospect. Aguarde ou clique em Parar.",
      "turno_ativo",
      409,
    )
  }
}

/** Turno recusado porque o servidor recebeu o sinal de desligamento e está esperando os turnos em andamento. */
export class ErroReiniciando extends ErroDominio {
  constructor() {
    super("O servidor está reiniciando. Tente de novo em instantes.", "reiniciando", 503)
  }
}

export class ErroNaoAutenticado extends ErroDominio {
  constructor() {
    super("Você precisa entrar para continuar.", "nao_autenticado", 401)
  }
}

export class ErroFixture extends ErroDominio {
  constructor(message: string) {
    super(message, "fixture_invalido", 409)
  }
}

export class ErroNaoEhTeste extends ErroDominio {
  constructor() {
    super("Este prospect não é um cliente de teste.", "nao_eh_teste", 409)
  }
}

export class ErroEntrada extends ErroDominio {
  constructor(message: string) {
    super(message, "entrada_invalida", 400)
  }
}

export class ErroCaminhoForaDoProspect extends ErroDominio {
  constructor(caminho: string) {
    super(`Caminho fora da pasta do prospect: ${caminho}`, "caminho_fora", 400)
  }
}

export class ErroNaoEncontrado extends ErroDominio {
  constructor(message: string) {
    super(message, "nao_encontrado", 404)
  }
}

export class ErroConflitoVersao extends ErroDominio {
  readonly slug: string
  constructor(slug: string) {
    super(
      `O estado do prospect "${slug}" mudou por fora do app. Recarregue a página.`,
      "conflito_versao",
      409,
    )
    this.slug = slug
  }
}

export class ErroSincronizacao extends ErroDominio {
  readonly caminho: string | null
  constructor(message: string, caminho: string | null = null) {
    super(caminho ? `${message} (arquivo: ${caminho})` : message, "sincronizacao_falhou", 502)
    this.caminho = caminho
  }
}

/** Checagem por forma, não por instanceof: o Next pode carregar este módulo mais de uma vez. */
export function ehErroDominio(e: unknown): e is ErroDominio {
  return (
    e instanceof Error &&
    typeof (e as ErroDominio).codigo === "string" &&
    typeof (e as ErroDominio).status === "number"
  )
}
