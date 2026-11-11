/**
 * Dados fictícios do painel de Projetos, para os testes dos gráficos e para conferir a tela à mão.
 * "cheio": 12 projetos (um com custo estimado), 3 modelos mais "outros", 90 dias em semanas, todas as fases e 4 pessoas;
 * "poucos": 1 projeto e 2 buckets; "vazio": tudo zerado.
 */
import type { PainelMetricas } from "@workspace/core/metricas/painel"

type Projeto = PainelMetricas["porProjeto"][number]

const MODELOS = ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"] as const

/** Início de cada semana (meia-noite de Brasília em UTC), a partir de 2026-08-10. */
function semanas(n: number): string[] {
  const base = Date.UTC(2026, 7, 10, 3)
  return Array.from({ length: n }, (_, i) => new Date(base + i * 7 * 86_400_000).toISOString())
}

function arred(v: number): number {
  return Math.round(v * 10000) / 10000
}

function projeto(parcial: Partial<Projeto> & Pick<Projeto, "slug" | "nome" | "porFase">): Projeto {
  const usd = arred(Object.values(parcial.porFase).reduce((a, b) => a + b, 0))
  return {
    dono: "ana.souza@boomer.com.br",
    tempoUtilSeg: 3600,
    ultimaAtividade: "2026-11-05T15:00:00.000Z",
    etapaAtual: "03",
    ativo: true,
    concluidoEm: null,
    pendencias: 0,
    teste: false,
    estimado: false,
    ...parcial,
    usd,
  }
}

function cheio(): PainelMetricas {
  const inicios = semanas(13)
  const serie = inicios.map((inicio, i) => {
    const porModelo: Record<string, number> = {
      [MODELOS[0]]: arred(4 + (i % 4) * 1.7 + i * 0.3),
      [MODELOS[1]]: arred(2.5 + ((i * 7) % 5) * 0.9),
      [MODELOS[2]]: arred(0.4 + (i % 3) * 0.25),
      outros: i < 4 ? arred(1.2 - i * 0.2) : 0,
    }
    const total = arred(Object.values(porModelo).reduce((a, b) => a + b, 0))
    return { inicio, total, porModelo }
  })
  const porEtapa = [
    { etapa: "01", fase: "Contexto", usd: 6.8 },
    { etapa: "02", fase: "Contexto", usd: 9.1 },
    { etapa: "03", fase: "Diagnóstico", usd: 31.4 },
    { etapa: "04", fase: "Diagnóstico", usd: 12.2 },
    { etapa: "05", fase: "Soluções e metas", usd: 14.7 },
    { etapa: "06", fase: "Soluções e metas", usd: 10.3 },
    { etapa: "07", fase: "Mídia e ação", usd: 7.9 },
    { etapa: "08", fase: "Mídia e ação", usd: 1.1 },
    { etapa: "final", fase: "Apresentação", usd: 5.6 },
    { etapa: "10", fase: "Pós-apresentação", usd: 2.3 },
    { etapa: "briefing-benchmark", fase: "Arquivada", usd: 1.4 },
  ]
  const porProjeto: Projeto[] = [
    projeto({ slug: "verdeluz", nome: "Verdeluz Cosméticos", porFase: { Contexto: 3.1, Diagnóstico: 9.8, "Soluções e metas": 6.2, "Mídia e ação": 2.4, Apresentação: 1.9 }, etapaAtual: null, ativo: false, concluidoEm: "2026-10-30T18:00:00.000Z", estimado: true }),
    projeto({ slug: "casa-norte", nome: "Casa Norte Móveis", porFase: { Contexto: 2.2, Diagnóstico: 8.4, "Soluções e metas": 5.1, "Mídia e ação": 1.7 }, etapaAtual: "08", dono: "bruno.lima@boomer.com.br" }),
    projeto({
      slug: "nome-longo",
      nome: "Distribuidora Paulista de Suplementos Alimentares e Produtos Naturais Integrados do Vale do Paraíba Ltda",
      porFase: { Contexto: 2.4, Diagnóstico: 7.6, "Soluções e metas": 4.9, Arquivada: 1.4 },
      etapaAtual: "06",
      dono: "carla.mendes@boomer.com.br",
    }),
    projeto({ slug: "pet-amigo", nome: "Pet Amigo", porFase: { Contexto: 1.9, Diagnóstico: 6.2, "Soluções e metas": 3.8 }, etapaAtual: "05" }),
    projeto({ slug: "aurora-joias", nome: "Aurora Joias", porFase: { Contexto: 1.5, Diagnóstico: 5.1, "Soluções e metas": 2.6, "Mídia e ação": 2.2, Apresentação: 3.7 }, etapaAtual: null, ativo: false, concluidoEm: "2026-11-02T12:00:00.000Z", dono: "bruno.lima@boomer.com.br" }),
    projeto({ slug: "ferro-forte", nome: "Ferro Forte Ferramentas", porFase: { Contexto: 1.4, Diagnóstico: 4.3, "Soluções e metas": 2.4 }, etapaAtual: "05", dono: "diego.rocha@boomer.com.br", pendencias: 2 }),
    projeto({ slug: "bela-vista", nome: "Bela Vista Imóveis", porFase: { Contexto: 1.2, Diagnóstico: 1.9, "Mídia e ação": 1.6 }, etapaAtual: "07" }),
    projeto({ slug: "cafe-serra", nome: "Café da Serra", porFase: { Contexto: 0.9, Diagnóstico: 0.3 }, etapaAtual: "03", dono: "carla.mendes@boomer.com.br" }),
    projeto({ slug: "zen-yoga", nome: "Zen Yoga Studio", porFase: { Contexto: 0.8 }, etapaAtual: "02" }),
    projeto({ slug: "oficina-sol", nome: "Oficina do Sol", porFase: { Contexto: 0.4 }, etapaAtual: "02", dono: "diego.rocha@boomer.com.br" }),
    projeto({ slug: "teste-interno", nome: "Teste interno", porFase: { Contexto: 0.2 }, etapaAtual: "01", teste: true }),
    projeto({ slug: "sem-uso", nome: "Mercado Bom Preço", porFase: {}, etapaAtual: "01", tempoUtilSeg: 0, ultimaAtividade: null, dono: null }),
  ]
  const custoUsd = arred(serie.reduce((a, p) => a + p.total, 0))
  return {
    periodo: { de: "2026-08-11", ate: "2026-11-08", granularidade: "semana" },
    totais: { custoUsd, estimado: true, tempoUtilSeg: 162_000, custoAnteriorUsd: 80, tempoUtilAnteriorSeg: 120_000 },
    concluidos: { media: 24.6, mediana: 23.4, n: 2 },
    contagem: { ativos: 10, concluidos: 2, comPendencia: 1 },
    serie,
    porEtapa,
    porProjeto,
    tempoPorPessoa: [
      { email: "ana.souza@boomer.com.br", agenteSeg: 32_400, ativoSeg: 21_600, ociosoSeg: 7_200 },
      { email: "bruno.lima@boomer.com.br", agenteSeg: 25_200, ativoSeg: 14_400, ociosoSeg: 10_800 },
      { email: "carla.mendes@boomer.com.br", agenteSeg: 14_400, ativoSeg: 18_000, ociosoSeg: 3_600 },
      { email: "diego.rocha@boomer.com.br", agenteSeg: 7_200, ativoSeg: 5_400, ociosoSeg: 1_800 },
    ],
    tempoIgnoraModelo: false,
  }
}

function poucos(): PainelMetricas {
  return {
    periodo: { de: "2026-11-02", ate: "2026-11-08", granularidade: "dia" },
    totais: { custoUsd: 3.75, estimado: false, tempoUtilSeg: 5400, custoAnteriorUsd: 0, tempoUtilAnteriorSeg: 0 },
    concluidos: { media: null, mediana: null, n: 0 },
    contagem: { ativos: 1, concluidos: 0, comPendencia: 0 },
    serie: [
      { inicio: "2026-11-07T03:00:00.000Z", total: 1.5, porModelo: { [MODELOS[1]]: 1.5 } },
      { inicio: "2026-11-08T03:00:00.000Z", total: 2.25, porModelo: { [MODELOS[1]]: 2, [MODELOS[0]]: 0.25 } },
    ],
    porEtapa: [
      { etapa: "01", fase: "Contexto", usd: 1.5 },
      { etapa: "02", fase: "Contexto", usd: 2.25 },
    ],
    porProjeto: [projeto({ slug: "unico", nome: "Loja Única", porFase: { Contexto: 3.75 }, etapaAtual: "02", tempoUtilSeg: 5400 })],
    tempoPorPessoa: [{ email: "ana.souza@boomer.com.br", agenteSeg: 2400, ativoSeg: 2400, ociosoSeg: 600 }],
    tempoIgnoraModelo: false,
  }
}

function vazio(): PainelMetricas {
  return {
    periodo: { de: "2026-10-10", ate: "2026-11-08", granularidade: "dia" },
    totais: { custoUsd: 0, estimado: false, tempoUtilSeg: 0, custoAnteriorUsd: 0, tempoUtilAnteriorSeg: 0 },
    concluidos: { media: null, mediana: null, n: 0 },
    contagem: { ativos: 0, concluidos: 0, comPendencia: 0 },
    serie: [],
    porEtapa: [],
    porProjeto: [],
    tempoPorPessoa: [],
    tempoIgnoraModelo: false,
  }
}

export function fixturePainel(variante: "cheio" | "vazio" | "poucos"): PainelMetricas {
  if (variante === "cheio") return cheio()
  if (variante === "poucos") return poucos()
  return vazio()
}
