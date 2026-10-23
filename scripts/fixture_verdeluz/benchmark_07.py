#!/usr/bin/env python3
"""
Benchmark ilustrativo da etapa 07 da Verdeluz (cliente de teste).

Não houve coleta na Biblioteca de Anúncios do Meta (sem APIFY_TOKEN neste ambiente). O relatório traz só o que é público e foi
observado em 22/10/2026 nos sites e perfis oficiais das três marcas reais, sem inventar contagem de anúncios nem criativos. Gera o
relatório HTML no template da agência e o arquivo de análise.

    python3 scripts/fixture_verdeluz/benchmark_07.py --cliente clientes/verdeluz-producao
"""

from __future__ import annotations

import argparse
import html
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DATA = "22/10/2026"

CONCORRENTES = [
    {
        "nome": "Sallve",
        "site": "https://www.sallve.com.br/",
        "instagram": "https://www.instagram.com/sallve/",
        "outros": [("Blog: ordem de uso dos produtos", "https://www.sallve.com.br/blogs/sallve/todos-os-produtos-da-sallve")],
        "observacoes": [
            ("Mecânica de oferta", "Banner da home: \"Monte seu Kit com até 15% OFF\" (página de montar kit). Desconto progressivo e limitado, ligado ao kit."),
            ("Navegação", "Coleções por necessidade e por época: loja, proteção solar, seleção de verão, tratamento e prevenção."),
            ("Produtos em destaque", "Creme retexturizador noturno e protetor solar em bastão FPS 60 (15 g, com vitamina E e carnosina)."),
            ("Educação", "Conteúdo de rotina no blog: \"Qual é a ordem de uso dos produtos da Sallve?\" (guia de passo a passo)."),
            ("Perfil no Instagram", "São Paulo, SP. Descrição de produto no perfil com ativos citados (niacinamida, zinco, spirulina)."),
        ],
        "sintese": "Sallve vende a rotina como sistema: monta o kit pelo cliente, com desconto limitado, e ensina a ordem de uso. Comunica o ativo no nome e na descrição do produto. A oferta é de kit e não de desconto profundo em um item. Para a Verdeluz, a leitura útil é a de que kit com desconto controlado e conteúdo de rotina convivem com marca forte.",
    },
    {
        "nome": "Simple Organic",
        "site": "https://simpleorganic.com.br/",
        "instagram": "https://www.instagram.com/simpleorganic/",
        "outros": [("Página da marca no varejista Beleza na Web", "https://www.belezanaweb.com.br/simple-organic/")],
        "observacoes": [
            ("Posicionamento", "Site: \"marca vegana e cruelty-free de produtos de beleza sustentável: skincare, maquiagem vegana e cosméticos naturais\" (autodeclarado)."),
            ("Navegação", "Menu com Skincare, Makeup, Quem somos e Best-sellers (vitrine do que mais vende)."),
            ("Programa de comunidade", "Perfil no Instagram convida a se inscrever no programa \"Simple me escolhe\" (inscrições por link)."),
            ("Canal de revenda", "Marca presente em varejista online (Beleza na Web), que a descreve como \"primeira marca de clean beauty do Brasil\" (afirmação do varejista)."),
            ("Tom", "Perfil: \"Beleza limpa, acessível, vegana e sustentável!\"."),
        ],
        "sintese": "Simple Organic apoia o crescimento em comunidade (programa de inscrição) e em revenda, além do site próprio, e comunica valores (vegana, acessível, sustentável) antes do ativo. A vitrine de best-sellers reduz a escolha. Para a Verdeluz, o ponto relevante é o programa estruturado de embaixadoras com inscrição aberta, que dá o que a Verdeluz não tem: medição por pessoa.",
    },
    {
        "nome": "Care Natural Beauty",
        "site": "https://carenb.com/",
        "instagram": "https://www.instagram.com/carenaturalbeauty/",
        "outros": [],
        "observacoes": [
            ("Posicionamento", "Site: \"skincare e maquiagem livre sem toxinas\", com cosméticos veganos e cruelty free."),
            ("Selo de confiança", "Perfil: \"primeira marca de beleza brasileira com o selo EWG Verified Sustentável\" e o lema \"só é beleza se for limpa\" (afirmações autodeclaradas pela marca, não conferidas aqui)."),
            ("Mecânica de oferta", "Publicação no Instagram associada à marca fala em cupom e em brinde (\"ganha uma nécessaire\") em promoção. A origem exata da publicação deve ser confirmada na coleta real."),
            ("Tom", "Beleza limpa como argumento central, com um selo de terceiros citado como prova (autodeclarado no perfil)."),
        ],
        "sintese": "Care Natural Beauty sustenta a confiança com um selo de terceiros e com a promessa de fórmula limpa (ambos autodeclarados pela marca), e uma publicação associada a ela fala em brinde e cupom. É a referência mais próxima do argumento de transparência da Verdeluz, mas com prova externa. Para a Verdeluz, a lição é transformar o selo vegano e as avaliações em prova visível e testar brinde no lugar de desconto profundo.",
    },
]

PERGUNTAS = [
    ("1. Como os concorrentes comunicam autenticidade e confiança?",
     "Care apoia a confiança em selo de terceiros (EWG Verified) e no lema da fórmula limpa, ambos autodeclarados. Sallve nomeia os ativos nos produtos e ensina a rotina no blog. Simple Organic comunica valores (vegana, acessível, sustentável) e comunidade. A Verdeluz declara a concentração do ativo na embalagem e tem mais de 900 avaliações no sérum, mas não mostra isso como prova em destaque."),
    ("2. Quais concorrentes têm campanhas separadas para buyers e sellers?",
     "Não se aplica: o setor vende ao consumidor final. A relevância é a revenda: Simple Organic aparece em varejista online, o que sugere um canal de revenda além do site próprio. Sallve e Care não mostram revenda nas páginas observadas. A Verdeluz vende só no site."),
    ("3. Quem usa posicionamento de valor vs. promoção de preço?",
     "Sallve promove kit com desconto limitado (até 15% no kit montado) e posiciona por necessidade da pele. Care posiciona por fórmula limpa e, em uma publicação associada à marca, aparece com cupom e brinde. Simple Organic posiciona por valores e acessibilidade. A Verdeluz usa desconto profundo na Black Friday (35%) e cupom de primeira compra."),
    ("4. Quais formatos predominam no mercado?",
     "Sem coleta de anúncios, esta resposta não é possível. O que se observa nos sites e perfis é uso de kit (Sallve), vitrine de best-sellers (Simple Organic) e publicações com promoção (Care). A coleta real da Biblioteca deve responder esta pergunta."),
    ("5. Há uso de figura pública, fundador ou influenciador?",
     "Simple Organic estrutura um programa de comunidade com inscrição aberta. Care tem publicação promocional no Instagram associada à marca. Sallve tem perfil ativo com descrição de produto. A Verdeluz usa microinfluenciadoras sem medição por pessoa."),
    ("6. Como cada marca distribui seus anúncios pelo funil?",
     "Sem coleta de anúncios, esta resposta não é possível. Nos sites, Sallve cobre topo (blog de rotina), meio (coleções por necessidade) e fundo (kit com desconto). A coleta real deve classificar os anúncios por etapa."),
    ("7. Quem está investindo mais intensamente?",
     "Sem coleta de anúncios, o ranking de intensidade fica para a coleta real. O ranking abaixo registra a ausência de dado e não ordena as marcas."),
]


def esc(texto: str) -> str:
    return html.escape(texto, quote=True)


def montar_html() -> str:
    modelo = (RAIZ / ".claude/skills/_shared/benchmark-template.html").read_text(encoding="utf-8")
    inicio = modelo.index("<style>")
    fim = modelo.index("</style>") + len("</style>")
    estilo = modelo[inicio:fim]
    partes = [
        '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        "<title>Benchmark Meta Ads · VERDELUZ (FICTÍCIO)</title>\n" + estilo + "\n</head>\n<body>",
        '<div class="bm-header">\n  <div class="bm-title">Benchmark Meta Ads · VERDELUZ COSMÉTICOS VEGANOS (FICTÍCIO)</div>\n'
        f'  <div class="bm-subtitle">Data da pesquisa: {DATA} &nbsp;·&nbsp; Concorrentes analisados: {len(CONCORRENTES)} &nbsp;·&nbsp; Fonte: sites e perfis públicos das marcas (benchmark ilustrativo, sem coleta de anúncios na Biblioteca do Meta)</div>\n</div>',
        '<div class="bm-section-label">Concorrentes analisados</div>',
    ]
    for c in CONCORRENTES:
        links = [(c["site"], f"Site: {c['site']}"), (c["instagram"], f"Instagram: {c['instagram']}")] + [(u, f"{r}: {u}") for r, u in c["outros"]]
        partes.append('<div class="bm-concorrente">')
        partes.append(f'  <div class="bm-concorrente-name">{esc(c["nome"])}</div>')
        partes.append(f'  <div class="bm-concorrente-meta">página na Biblioteca: a obter na coleta real &nbsp;·&nbsp; anúncios ativos: não coletados &nbsp;·&nbsp; observado em {DATA}</div>')
        partes.append('  <div class="bm-links">\n    <div class="bm-links-label">Fontes públicas observadas</div>')
        for url, rotulo in links:
            partes.append(f'    <a href="{esc(url)}" target="_blank" rel="noopener noreferrer">{esc(rotulo)}</a>')
        partes.append('    <div class="bm-nota">Nota de coleta: não houve coleta de anúncios (sem token da Apify neste ambiente). Esta análise é ilustrativa e usa só o que é público nas páginas acima.</div>\n  </div>')
        partes.append('  <div class="bm-ad-card">\n    <div class="bm-ad-card-header"><span class="bm-ad-id">Observações públicas</span></div>\n    <table class="bm-table">')
        for rotulo, texto in c["observacoes"]:
            partes.append(f"      <tr><td>{esc(rotulo)}</td><td>{esc(texto)}</td></tr>")
        partes.append("    </table>\n  </div>")
        partes.append(f'  <div class="bm-sintese">\n    <div class="bm-sintese-label">Síntese {esc(c["nome"])}</div>\n    <p>{esc(c["sintese"])}</p>\n  </div>\n</div>')
    partes.append('<div class="bm-section-label">Análise do cliente</div>')
    partes.append('<div class="bm-cliente">\n  <div class="bm-concorrente-name">Verdeluz Cosméticos Veganos (Cliente)</div>')
    partes.append('  <div class="bm-sem-anuncios">Marca fictícia: não tem página na Biblioteca de Anúncios do Meta. Registrada sem anúncios, só para completar o relatório.</div>\n</div>')
    partes.append('<hr class="bm-divider">\n<div class="bm-section-label">Síntese Estratégica Geral</div>\n<div class="bm-sintese-geral">')
    for pergunta, resposta in PERGUNTAS:
        partes.append(f'  <div class="bm-sq">{esc(pergunta)}</div>\n  <p class="bm-sa">{esc(resposta)}</p>')
    partes.append('  <hr class="bm-divider">\n  <div class="bm-section-label">Ranking de intensidade de mídia</div>\n  <div class="bm-ranking">')
    for i, nome in enumerate([c["nome"] for c in CONCORRENTES] + ["Verdeluz (cliente)"], start=1):
        partes.append(f'    <div class="bm-rank-row">\n      <span class="bm-rank-num">{i}</span>\n      <span class="bm-rank-name">{esc(nome)}</span>\n'
                      '      <div class="bm-rank-bar-wrap"><div class="bm-rank-bar" style="width:0%"></div></div>\n      <span class="bm-rank-count">sem coleta</span>\n    </div>')
    partes.append("  </div>\n</div>")
    partes.append(f'<div class="bm-footer">boomer · benchmark ilustrativo gerado em {DATA} · cliente de teste, sem dados de anúncios · FICTÍCIO</div>\n</body>\n</html>')
    return "\n".join(partes) + "\n"


def montar_analise() -> str:
    linhas = ["# Análise de benchmark: Verdeluz Cosméticos Veganos (FICTÍCIO)", "",
              f"Data: {DATA}. Benchmark ilustrativo: sem coleta de anúncios na Biblioteca do Meta (sem token da Apify neste ambiente). Só informação pública observada nos sites e perfis das marcas. Nenhuma contagem de anúncios nem criativo foi inventado.", ""]
    for c in CONCORRENTES:
        linhas += [f"## {c['nome']}", "", f"Fontes: {c['site']} e {c['instagram']}", "", "Anúncios ativos: não coletados.", ""]
        linhas += [f"- **{r}:** {t}" for r, t in c["observacoes"]]
        linhas += ["", f"**Síntese:** {c['sintese']}", ""]
    linhas += ["## Verdeluz (cliente)", "", "Marca fictícia, sem página na Biblioteca de Anúncios. Registrada sem anúncios.", ""]
    return "\n".join(linhas)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cliente", required=True, type=Path)
    args = parser.parse_args()
    destino = args.cliente / "entrega/ativos-aprovados/benchmark/benchmark.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(montar_html(), encoding="utf-8")
    analise = args.cliente / "dados/benchmark-meta/analise-benchmark.md"
    analise.parent.mkdir(parents=True, exist_ok=True)
    analise.write_text(montar_analise(), encoding="utf-8")
    print(f"gravado: {destino} e {analise}")
