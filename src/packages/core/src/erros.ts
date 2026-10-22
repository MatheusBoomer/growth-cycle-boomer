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
  constructor() {
    super("O agente ainda está respondendo neste prospect. Aguarde ou clique em Parar.", "turno_ativo", 409)
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

/** Checagem por forma, não por instanceof: o Next pode carregar este módulo mais de uma vez. */
export function ehErroDominio(e: unknown): e is ErroDominio {
  return (
    e instanceof Error &&
    typeof (e as ErroDominio).codigo === "string" &&
    typeof (e as ErroDominio).status === "number"
  )
}
