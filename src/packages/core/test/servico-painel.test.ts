import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Barramento } from "../src/barramento"
import { NuvemArmazenamento } from "../src/nuvem/armazenamento-nuvem"
import { MemoriaArmazem, MemoriaRepositorio } from "../src/nuvem/memoria"
import { Mesa } from "../src/nuvem/mesa"
import type { EntradaUsoTurno } from "../src/nuvem/tipos"
import { ServicoPlanejamento } from "../src/servico-planejamento"
import { pastaDoFixture } from "../src/fixture"
import { ORDEM_ETAPAS } from "../src/tipos"
import { catalogoReal, raizTemporaria } from "./ajuda"
import { criarFixtureMinimo } from "./fixture-minimo"

const LIMITES = { ociosoMin: 5, descarteMin: 30 }
const ANA = "ana.souza@boomer.com.br"
const FILTRO = { de: "2026-10-01", ate: "2026-10-31", donos: [], projetos: [], etapas: [], modelos: [], incluirTestes: false }

let repositorio: MemoriaRepositorio
let nuvem: ServicoPlanejamento

beforeEach(async () => {
  const raiz = await raizTemporaria()
  await criarFixtureMinimo(pastaDoFixture(raiz, "mini"))
  repositorio = new MemoriaRepositorio()
  const armazem = new MemoriaArmazem()
  const mesa = new Mesa({ pastaClientes: path.join(raiz, "clientes"), armazem, esperar: async () => {} })
  nuvem = new ServicoPlanejamento({
    armazenamento: new NuvemArmazenamento({ raiz, repositorio, armazem, mesa, atrasoAgendamentoMs: 0 }),
    catalogo: catalogoReal(),
    barramento: new Barramento(),
    validar: async () => ({ ok: true, problemas: [], avisos: [], resumo: null }),
    agora: () => "2026-10-30T10:00:00.000Z",
  })
  nuvem.conectarTurnos({ aoEnfileirar: () => {}, estaOcupado: () => false })
})

function uso(slug: string, parcial: Partial<EntradaUsoTurno> = {}): EntradaUsoTurno {
  return {
    slug,
    etapa: "03",
    autor: ANA,
    sessao: `s-${slug}`,
    retomada: false,
    custoUsd: 2,
    modelosAcumulado: { "claude-opus": 2 },
    esforco: null,
    tokensEntrada: 10,
    tokensSaida: 2,
    inicio: "2026-10-27T12:00:00.000Z",
    fim: "2026-10-27T12:01:00.000Z",
    status: "ok",
    ...parcial,
  }
}

describe("painelDeMetricas (dados na nuvem)", () => {
  it("agrega custo por projeto e monta as opções de filtro (donos, projetos, modelos)", async () => {
    await nuvem.criarProspect("Zeta", null, "Ana.Souza@Boomer.com.br")
    await nuvem.criarProspect("Alfa", null, "bia@boomer.com.br")
    await nuvem.criarProspect("Sem Dono", null)
    await nuvem.registrarUso(uso("zeta"))
    await nuvem.registrarUso(uso("alfa", { modelosAcumulado: { "claude-haiku": 2 } }))

    const r = await nuvem.painelDeMetricas(FILTRO, LIMITES)

    expect(r.painel.totais.custoUsd).toBe(4)
    expect(Object.fromEntries(r.painel.porProjeto.map((p) => [p.slug, p.usd]))).toEqual({ alfa: 2, "sem-dono": 0, zeta: 2 })
    expect(r.painel.contagem.ativos).toBe(3)
    const zeta = r.painel.porProjeto.find((p) => p.slug === "zeta")
    expect(zeta).toMatchObject({ ativo: true, concluidoEm: null, pendencias: 0 })
    expect(typeof zeta?.etapaAtual).toBe("string")
    expect(r.opcoes.donos).toEqual(["ana.souza@boomer.com.br", "bia@boomer.com.br"])
    expect(r.opcoes.projetos).toEqual([
      { slug: "alfa", nome: "Alfa" },
      { slug: "sem-dono", nome: "Sem Dono" },
      { slug: "zeta", nome: "Zeta" },
    ])
    expect(r.opcoes.modelos).toEqual(["claude-haiku", "claude-opus"])
  })

  it("projeto de teste só entra no custo com incluirTestes, mas aparece nas opções", async () => {
    await nuvem.criarProspect("Real", null)
    await nuvem.criarClienteTeste("mini", "02")
    await nuvem.registrarUso(uso("real"))
    await nuvem.registrarUso(uso("cliente-teste", { custoUsd: 5, modelosAcumulado: { "claude-opus": 5 } }))

    const sem = await nuvem.painelDeMetricas(FILTRO, LIMITES)
    const com = await nuvem.painelDeMetricas({ ...FILTRO, incluirTestes: true }, LIMITES)

    expect(sem.painel.totais.custoUsd).toBe(2)
    expect(com.painel.totais.custoUsd).toBe(7)
    expect(sem.opcoes.projetos.map((p) => p.slug)).toContain("cliente-teste")
  })

  it("etapa final concluída vira concluidoEm e tira o projeto de ativos", async () => {
    await nuvem.criarProspect("Pronto", null)
    await nuvem.estado("pronto")
    const atual = (await repositorio.lerEstado("pronto"))!
    for (const id of ORDEM_ETAPAS) {
      atual.estado.etapas[id].status = "concluida"
      atual.estado.etapas[id].concluidaEm = "2026-10-20T12:00:00.000Z"
    }
    await repositorio.gravarEstado("pronto", atual.estado, atual.versao)
    await nuvem.registrarUso(uso("pronto"))

    const r = await nuvem.painelDeMetricas(FILTRO, LIMITES)

    expect(r.painel.contagem).toMatchObject({ ativos: 0, concluidos: 1 })
    expect(r.painel.concluidos.n).toBe(1)
  })

  it("lê os dados uma vez: outro filtro dentro do prazo não relê o uso, e atualizar: true relê", async () => {
    await nuvem.criarProspect("Cliente", null)
    await nuvem.registrarUso(uso("cliente"))
    const espiaUsos = vi.spyOn(repositorio, "listarUsos")
    const espiaPresencas = vi.spyOn(repositorio, "listarPresencas")

    const a = await nuvem.painelDeMetricas(FILTRO, LIMITES)
    const b = await nuvem.painelDeMetricas({ ...FILTRO, de: "2026-10-20" }, LIMITES)
    expect(espiaUsos).toHaveBeenCalledTimes(1)
    expect(espiaPresencas).toHaveBeenCalledTimes(1)
    expect(a.painel.periodo.de).toBe("2026-10-01")
    expect(b.painel.periodo.de).toBe("2026-10-20")

    await nuvem.registrarUso(uso("cliente", { sessao: "s2", inicio: "2026-10-28T12:00:00.000Z", fim: "2026-10-28T12:01:00.000Z" }))
    expect((await nuvem.painelDeMetricas(FILTRO, LIMITES)).painel.totais.custoUsd).toBe(2)

    const c = await nuvem.painelDeMetricas(FILTRO, LIMITES, { atualizar: true })
    expect(espiaUsos).toHaveBeenCalledTimes(2)
    expect(c.painel.totais.custoUsd).toBe(4)
  })

  it("um prospect ilegível é pulado e os outros seguem", async () => {
    await nuvem.criarProspect("Bom", null)
    await nuvem.criarProspect("Ruim", null)
    const original = repositorio.lerEstado.bind(repositorio)
    vi.spyOn(repositorio, "lerEstado").mockImplementation(async (slug: string) => {
      if (slug === "ruim") throw new Error("estado corrompido")
      return original(slug)
    })
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const r = await nuvem.painelDeMetricas(FILTRO, LIMITES)
      expect(r.opcoes.projetos.map((p) => p.slug)).toEqual(["bom"])
      expect(erro).toHaveBeenCalled()
    } finally {
      erro.mockRestore()
    }
  })

  it("filtro invertido propaga RangeError (a rota garante datas válidas)", async () => {
    await expect(nuvem.painelDeMetricas({ ...FILTRO, de: "2026-10-31", ate: "2026-10-01" }, LIMITES)).rejects.toBeInstanceOf(RangeError)
  })
})
