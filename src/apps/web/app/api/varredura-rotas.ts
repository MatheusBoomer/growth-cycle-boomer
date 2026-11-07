/**
 * Varredura estática das rotas e páginas do app: confere, olhando só o código-fonte, que nenhuma leitura ou
 * escrita de dados acontece antes da checagem de acesso (`exigirUsuario()`, `exigirAdmin()` ou
 * `exigirAcessoAoProspect()`). Só funções puras (o teste faz a leitura dos arquivos).
 * Este arquivo não se chama `route.ts`, então o Next não o trata como rota e a varredura também o ignora.
 *
 * Limite conhecido: literais de expressão regular com aspas ou chaves dentro enganam o leitor de literais; as
 * rotas escritas hoje não os usam antes do primeiro comando.
 */

export const METODOS_HTTP = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const
const METODOS = METODOS_HTTP.join("|")

/** Posição logo depois do `}` que fecha a `${` aberta (`i` aponta para o primeiro caractere de dentro). */
function fimDeExpressao(f: string, i: number): number {
  let n = 1
  while (i < f.length) {
    const c = f[i]!
    if (c === "{") n++
    else if (c === "}") {
      n--
      if (n === 0) return i + 1
    } else if (c === '"' || c === "'") i = fimDeAspas(f, i + 1, c) - 1
    else if (c === "`") i = fimDeTemplate(f, i + 1) - 1
    i++
  }
  return f.length
}

function fimDeAspas(f: string, i: number, aspa: string): number {
  while (i < f.length) {
    if (f[i] === "\\") i += 2
    else if (f[i] === aspa || f[i] === "\n") return i + 1
    else i++
  }
  return f.length
}

function fimDeTemplate(f: string, i: number): number {
  while (i < f.length) {
    if (f[i] === "\\") i += 2
    else if (f[i] === "`") return i + 1
    else if (f[i] === "$" && f[i + 1] === "{") i = fimDeExpressao(f, i + 2)
    else i++
  }
  return f.length
}

/**
 * Tira os comentários (viram um espaço, mantendo as quebras de linha) e, com `esvaziarLiterais`, deixa as aspas e
 * os templates vazios (`""`, ` `` `), para que o que estiver dentro de texto não conte como código.
 */
export function limparFonte(f: string, esvaziarLiterais: boolean): string {
  let saida = ""
  let i = 0
  while (i < f.length) {
    const c = f[i]!
    const d = f[i + 1]
    if (c === "/" && d === "/") {
      while (i < f.length && f[i] !== "\n") i++
      saida += " "
    } else if (c === "/" && d === "*") {
      const fim = f.indexOf("*/", i + 2)
      const bloco = f.slice(i, fim === -1 ? f.length : fim + 2)
      saida += bloco.replace(/[^\n]/g, " ")
      i += bloco.length
    } else if (c === '"' || c === "'" || c === "`") {
      const fim = c === "`" ? fimDeTemplate(f, i + 1) : fimDeAspas(f, i + 1, c)
      saida += esvaziarLiterais ? c + c : f.slice(i, fim)
      i = fim
    } else {
      saida += c
      i++
    }
  }
  return saida
}

/** Posição do delimitador que fecha o que abre em `i` (`(` ou `{`), contando aninhamento; -1 se não fecha. */
function fechamento(f: string, i: number): number {
  const abre = f[i]!
  const fecha = abre === "(" ? ")" : "}"
  let n = 0
  for (let k = i; k < f.length; k++) {
    if (f[k] === abre) n++
    else if (f[k] === fecha) {
      n--
      if (n === 0) return k
    }
  }
  return -1
}

/** Quem a rota exige: qualquer usuário logado, só admin, ou acesso ao prospect da URL (dono ou admin). */
export type Exigencia = "usuario" | "admin" | "prospect"

const FUNCAO_DA_EXIGENCIA: Record<Exigencia, string> = {
  usuario: "exigirUsuario",
  admin: "exigirAdmin",
  prospect: "exigirAcessoAoProspect",
}
const TODAS_AS_FUNCOES = Object.values(FUNCAO_DA_EXIGENCIA)

/** Funções aceitas para a exigência dada; sem exigência, qualquer uma das três. */
const funcoesAceitas = (exigida?: Exigencia): string[] => (exigida ? [FUNCAO_DA_EXIGENCIA[exigida]] : TODAS_AS_FUNCOES)

const importaExigir = (funcoes: string[]) => new RegExp(`import\\s*\\{[^}]*\\b(?:${funcoes.join("|")})\\b[^}]*\\}\\s*from\\s*"@\\/lib\\/sessao"`)
const CONTINUA_A_EXPRESSAO = /^\s*[.?&|,)+\-*/=<>]/

/** Corpo (entre as chaves, sem elas) de cada handler exportado, no fonte já limpo; `null` no corpo = não fechou. */
function handlers(limpo: string): { metodo: string; corpo: string | null }[] {
  const achados: { metodo: string; corpo: string | null }[] = []
  for (const m of limpo.matchAll(new RegExp(`export\\s+(?:async\\s+)?function\\s+(${METODOS})\\b\\s*\\(`, "g"))) {
    const abreParametros = m.index + m[0].length - 1
    const fechaParametros = fechamento(limpo, abreParametros)
    const abreCorpo = fechaParametros === -1 ? -1 : limpo.indexOf("{", fechaParametros)
    const fechaCorpo = abreCorpo === -1 ? -1 : fechamento(limpo, abreCorpo)
    achados.push({ metodo: m[1]!, corpo: fechaCorpo === -1 ? null : limpo.slice(abreCorpo + 1, fechaCorpo) })
  }
  return achados
}

/**
 * Regra positiva: a PRIMEIRA instrução do handler é um `try {` cuja primeira instrução é `await exigirUsuario()`,
 * `await exigirAdmin()` ou `await exigirAcessoAoProspect(<contexto>.params)` (com ou sem `const|let usuario =`; só as
 * funções aceitas para a exigência dada), e o `catch` desse try devolve `respostaDeErro(e)` ou relança (nunca vazio).
 * Nada antes dela (nem comentário, nem `if`, nem leitura de corpo ou de arquivo) é aceito.
 */
function problemaDoHandler(metodo: string, corpo: string | null, exigida?: Exigencia): string | null {
  if (corpo === null) return `${metodo}: não consegui achar o fim do handler`
  const funcoes = funcoesAceitas(exigida)
  const chamadas = funcoes.map((f) => (f === FUNCAO_DA_EXIGENCIA.prospect ? `${f}\\(\\s*[A-Za-z_$][\\w$]*\\.params\\s*\\)` : `${f}\\(\\)`)).join("|")
  const nao = `${metodo}: a primeira instrução não é try { await ${funcoes.join(" ou ")}(...) ... }`
  const t = new RegExp(`^\\s*try\\s*\\{\\s*(?:(?:const|let)\\s+usuario\\s*=\\s*)?await\\s+(?:${chamadas})`).exec(corpo)
  if (!t) return nao
  const resto = corpo.slice(t[0].length)
  if (CONTINUA_A_EXPRESSAO.test(resto)) return `${metodo}: o resultado da checagem de acesso é encadeado ou combinado, o erro pode se perder`
  // O `{` do try é o último de t[0] antes do await; acha o fechamento dele.
  const abreTry = corpo.indexOf("{", corpo.indexOf("try"))
  const fechaTry = fechamento(corpo, abreTry)
  if (fechaTry === -1) return nao
  const c = /^\s*catch\s*(?:\(\s*([A-Za-z_$][\w$]*)\s*\))?\s*\{/.exec(corpo.slice(fechaTry + 1))
  if (!c) return `${metodo}: o try da checagem de acesso não tem catch`
  const abreCatch = fechaTry + 1 + c[0].length - 1
  const fechaCatch = fechamento(corpo, abreCatch)
  const dentro = fechaCatch === -1 ? "" : corpo.slice(abreCatch + 1, fechaCatch)
  const e = c[1]
  const trata = e !== undefined && (new RegExp(`\\breturn\\s+respostaDeErro\\(\\s*${e.replace(/\$/g, "\\$")}\\s*\\)`).test(dentro) || new RegExp(`\\bthrow\\s+${e.replace(/\$/g, "\\$")}\\b`).test(dentro))
  if (!trata) return `${metodo}: o catch da checagem de acesso não devolve respostaDeErro(e) nem relança`
  return null
}

/**
 * Motivos pelos quais o fonte de uma `route.ts` não passa. Lista vazia = ok. Com `exigida`, só vale a checagem
 * correspondente; sem ela, vale qualquer uma das três.
 */
export function problemasDeRota(fonte: string, exigida?: Exigencia): string[] {
  const problemas: string[] = []
  if (!importaExigir(funcoesAceitas(exigida)).test(limparFonte(fonte, false))) {
    problemas.push(`não importa ${exigida ? FUNCAO_DA_EXIGENCIA[exigida] : "exigirUsuario"} de @/lib/sessao`)
  }
  const limpo = limparFonte(fonte, true)
  if (new RegExp(`export\\s+(?:const|let|var)\\s+(?:${METODOS})\\b|export\\s*\\{|export\\s+default\\b`).test(limpo)) {
    problemas.push("handler declarado de um jeito que a varredura não entende")
  }
  const lista = handlers(limpo)
  if (lista.length === 0) problemas.push("nenhum handler HTTP encontrado")
  for (const h of lista) {
    const p = problemaDoHandler(h.metodo, h.corpo, exigida)
    if (p) problemas.push(p)
  }
  return problemas
}

/**
 * Página ou layout que lê dados (chama `servidor()`) precisa checar a sessão antes: `usuarioDaRequisicao()` ou
 * `exigirUsuario()` tem de aparecer no arquivo antes da primeira chamada a `servidor(`. Sem `servidor(` não há o que conferir.
 */
export function problemasDePagina(fonte: string): string[] {
  const limpo = limparFonte(fonte, true)
  const leitura = limpo.search(/\bservidor\s*\(/)
  if (leitura === -1) return []
  const sessao = limpo.search(/\b(?:usuarioDaRequisicao|exigirUsuario)\s*\(/)
  if (sessao === -1 || sessao > leitura) return ["chama servidor() sem checar a sessão (usuarioDaRequisicao ou exigirUsuario) antes"]
  return []
}
