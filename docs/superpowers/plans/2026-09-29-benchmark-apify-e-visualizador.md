# Benchmark via Apify + Visualizador lateral redimensionável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Skill 06 coleta os anúncios da Biblioteca do Meta pela API da Apify (sem navegador) e segue integralmente as regras da skill `benchmark-meta-ads`; na interface web, o relatório HTML abre num painel lateral e todas as colunas da área de trabalho são redimensionáveis.

**Architecture:** Parte A é um script Python (`scripts/coleta_meta_ads.py`, com três módulos auxiliares) que chama a Apify, aplica as regras mecânicas e grava um `resumo.md` + mídia na pasta do prospect; a Skill 06 e as regras compartilhadas passam a orientar o Claude a rodar o script e analisar imagens e quadros. Parte B troca o grid fixo de `AreaDeTrabalho` por `react-resizable-panels` (shadcn `resizable`) e acrescenta um visualizador de HTML controlado por um contexto React.

**Tech Stack:** Python 3.9 (requests, Pillow, pytest), ffmpeg/ffprobe; TypeScript, Next 16, React 19, shadcn (`base-nova`), `react-resizable-panels@^4`, vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-benchmark-apify-e-visualizador-design.md`

## Global Constraints

- Python 3.9: usar `from __future__ import annotations` e `typing` (`List`, `Dict`, `Optional`); nada de `match`, nada de `X | Y` fora de anotações.
- Nenhuma dependência nova de Python (só `requests`, `Pillow`, stdlib). `ffmpeg` e `ffprobe` vêm do sistema.
- Token só em `Authorization: Bearer`; nunca na URL, em log, em stdout ou em arquivo gerado.
- Toda mensagem ao analista em português do Brasil, sem travessão no meio de frase nos textos do app (commit a0e1b85).
- Limites da coleta: amostra de descoberta 30, amostra de coleta 40, seleção final até 10, no máximo 1 catálogo (DPA), distância de Hamming ≤ 5 para "mesma imagem", tempo máximo por execução na Apify 10 min.
- Saída da coleta em `clientes/<slug>/dados/benchmark-meta/<marca-normalizada>/`; relatório aprovado em `entrega/ativos-aprovados/benchmark/benchmark.html`.
- Iframe do visualizador: `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"`, nunca `allow-same-origin`.
- Layout persistido no `localStorage` via `useDefaultLayout`, um layout por combinação de painéis (com e sem visualizador).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Formato real da resposta da Apify diferente do fixture** (camelCase vs. snake_case, `body` como texto ou objeto): a normalização deve aceitar as duas formas; coberto na Task 2 com um anúncio em snake_case no fixture, e confirmado com dado real na Task 13.
2. **Saída do `onlyTotal` com chave desconhecida**: `extrair_total` devolve `None` e o resumo avisa que o ranking usa o número coletado; coberto na Task 5 (`[{}]` → `None`) e na Task 6 (nota no resumo).
3. **Nomes de marca com acento, apóstrofo ou só símbolos** ("Água de Cheiro", "L'Occitane", "!!!"): slug estável e comparação de nome tolerante; testes na Task 2.
4. **URL de mídia do fbcdn expirada ou que devolve página de erro com status 200**: nova tentativa, conteúdo que não é imagem é rejeitado e o anúncio é substituído pelo próximo; testes na Task 4 e na Task 3.
5. **Visualizador apontando para um entregável que sumiu** (etapa reaberta, nome trocado): `entregavelVisivel` devolve `null` e o painel mostra estado vazio com botão de fechar, sem quebrar; teste na Task 10.

---

## Mapa de arquivos

**Parte A (Python e skills)**

| Arquivo | Responsabilidade |
|---|---|
| `docs/referencias/benchmark-meta-ads/**` (novo) | Cópia literal da skill original, fonte das regras e do template |
| `scripts/meta_ads_selecao.py` (novo) | Modelos (`Anuncio`, `Midia`, `Candidata`, `Selecionado`), normalização, descoberta, seleção. Sem rede, sem disco |
| `scripts/meta_ads_midia.py` (novo) | Download de mídia, conversão para JPEG, hash visual, quadros de vídeo |
| `scripts/meta_ads_apify.py` (novo) | Token, URLs da Biblioteca, entrada do ator, cliente HTTP da Apify, `ErroColeta` |
| `scripts/coleta_meta_ads.py` (novo) | CLI `descobrir` / `coletar`, notas de coleta, `resumo.md` |
| `scripts/tests/fixtures/apify_anuncios.json` (novo) | Resposta de exemplo da Apify |
| `scripts/tests/test_meta_ads_*.py`, `scripts/tests/test_coleta_meta_ads.py` (novos) | Testes |
| `.claude/skills/_shared/benchmark-coleta-e-analise.md` (novo) | Regras de análise (Claude) |
| `.claude/skills/_shared/relatorio-benchmark.md` | Regras do relatório (substituído) |
| `.claude/skills/_shared/benchmark-template.html` | Template (substituído) |
| `.claude/skills/06-briefing-e-benchmark/SKILL.md` | Fase 2 reescrita |
| `.claude/agents/pesquisador-benchmark.md`, `CLAUDE.md`, `README.md`, `clientes/_template/dados/README.md`, `.env.example`, `.gitignore` | Documentação e configuração |

**Parte A (integração com o app)**

| Arquivo | Responsabilidade |
|---|---|
| `src/packages/core/src/sistema.ts` (novo) | `tokenApifyConfigurado` (pura) |
| `src/packages/core/src/atividade.ts` | Rótulo da coleta |
| `src/apps/web/app/api/sistema/route.ts`, `src/apps/web/components/sistema/verificacao-sistema.tsx` | Itens ffmpeg e Apify |

**Parte B (interface)**

| Arquivo | Responsabilidade |
|---|---|
| `src/packages/core/src/entregaveis.ts` | `entregavelVisivel`, `htmlParaAbrir` (puras) |
| `src/packages/ui/src/components/resizable.tsx` (novo) | Componente shadcn + reexport de hooks |
| `src/apps/web/components/trabalho/contexto-visualizador.tsx` (novo) | Contexto `abrir(etapa, nomeFinal)` |
| `src/apps/web/components/trabalho/visualizador-html.tsx` (novo) | Painel do HTML |
| `src/apps/web/components/trabalho/area-de-trabalho.tsx` | Layout redimensionável, estado do visualizador, abertura automática, tela cheia |
| `src/apps/web/components/cards/previa-arquivo.tsx`, `card-entregavel.tsx`, `components/trabalho/painel-etapa.tsx` | Botão Abrir e itens clicáveis |

---

## Parte A — Benchmark via Apify

### Task 1: Importar a skill de referência e preparar o `.env`

**Files:**
- Create: `docs/referencias/benchmark-meta-ads/` (cópia do zip)
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `docs/referencias/benchmark-meta-ads/assets/template.html`, `references/coleta-e-analise.md`, `references/geracao-relatorio.md`, `references/briefing.md`, usados nas Tasks 7 e 8.

- [ ] **Step 1: Copiar a skill original, sem os arquivos `__MACOSX`**

```bash
TMP="$(mktemp -d)"
unzip -q "/Users/matheus/Downloads/Benchmark meta ads-Atual (1).zip" -d "$TMP"
mkdir -p docs/referencias
cp -R "$TMP/benchmark-meta-ads" docs/referencias/benchmark-meta-ads
find docs/referencias/benchmark-meta-ads -name ".DS_Store" -delete
ls -R docs/referencias/benchmark-meta-ads
```

Expected: `SKILL.md`, `references/{briefing,coleta-e-analise,geracao-relatorio}.md`, `scripts/extract_ad_ids.js`, `assets/template.html`.

- [ ] **Step 2: Acrescentar um aviso no topo da cópia**

Criar `docs/referencias/benchmark-meta-ads/LEIA-ME.md`:

```markdown
# Referência: skill `benchmark-meta-ads` (versão com navegador)

Cópia literal da skill usada pela agência na extensão do Claude no Chrome.
Não é carregada pelo Claude Code: está aqui só como fonte das regras e do
template que a Skill 06 adotou.

As regras vivas estão em:
- `.claude/skills/_shared/benchmark-coleta-e-analise.md`
- `.claude/skills/_shared/relatorio-benchmark.md`
- `.claude/skills/_shared/benchmark-template.html`

A coleta pelo navegador foi substituída por `scripts/coleta_meta_ads.py`
(Apify). Ver `docs/superpowers/specs/2026-09-29-benchmark-apify-e-visualizador-design.md`.
```

- [ ] **Step 3: Liberar o `.env.example` no git**

Em `.gitignore`, logo abaixo da linha `.env*`, acrescentar:

```
!.env.example
```

- [ ] **Step 4: Criar `.env.example`**

```
# Token da Apify, usado pela Skill 06 (benchmark de anúncios).
# Gere em console.apify.com → Settings → API & Integrations.
# Copie este arquivo para .env e preencha. O .env nunca vai para o git.
APIFY_TOKEN=
```

- [ ] **Step 5: Conferir que `.env` continua ignorado e `.env.example` não**

Run: `git check-ignore -v .env; git check-ignore -v .env.example || echo "exemplo versionado"`
Expected: primeira linha mostra a regra `.env*`; segunda imprime `exemplo versionado`.

- [ ] **Step 6: Commit**

```bash
git add docs/referencias .env.example .gitignore
git commit -m "chore: importa a skill benchmark-meta-ads como referência e cria .env.example

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Normalização de anúncios e descoberta de páginas

**Files:**
- Create: `scripts/meta_ads_selecao.py`
- Create: `scripts/tests/fixtures/apify_anuncios.json`
- Test: `scripts/tests/test_meta_ads_selecao.py`

**Interfaces:**
- Produces (em `meta_ads_selecao`):
  - constantes `FORMATO_VIDEO = "Vídeo"`, `FORMATO_IMAGEM = "Imagem estática"`, `FORMATO_CARROSSEL = "Carrossel"`, `FORMATO_DPA = "Catálogo (DPA)"`
  - `@dataclass Anuncio(ad_id: str, page_id: str, pagina: str, formato: str, texto: str = "", titulo: str = "", cta: str = "", dominio: Optional[str] = None, plataformas: List[str], inicio: Optional[str], versoes: Optional[int], impressoes: Optional[str], collation_id: Optional[str], imagens: List[str], videos: List[Dict[str, Optional[str]]], curtidas_pagina: Optional[int], categorias_pagina: List[str])` com propriedade `link -> str`
  - `@dataclass Midia(arquivos: List[str], hash: Optional[int] = None, quadros_falharam: bool = False)`
  - `@dataclass Candidata(page_id: str, nome: str, curtidas: Optional[int], categorias: List[str], dominios: List[str], anuncios: int)`
  - `@dataclass Selecionado(anuncio: Anuncio, midia: Midia)`
  - `slug_marca(nome: str) -> str`, `normalizar_texto(texto: Optional[str]) -> str`, `nome_compativel(marca: str, pagina: str) -> bool`, `dominio_base(valor: Optional[str]) -> Optional[str]`
  - `normalizar_anuncio(bruto: Dict[str, Any]) -> Optional[Anuncio]`
  - `agrupar_paginas(anuncios: List[Anuncio]) -> List[Candidata]`
  - `classificar_descoberta(marca: str, site: Optional[str], candidatas: List[Candidata]) -> Dict[str, Any]` com chaves `status` (`"confirmada" | "ambigua" | "nao_encontrada"`), `page_id`, `motivo`

- [ ] **Step 1: Criar o fixture `scripts/tests/fixtures/apify_anuncios.json`**

Página 111 tem 8 anúncios (um em snake_case, o `107`); página 222 tem 1.

```json
[
  {
    "adArchiveID": "101", "pageID": "111", "pageName": "Marca Teste Oficial",
    "collationID": "c1", "collationCount": 3, "isActive": true,
    "publisherPlatform": ["FACEBOOK", "INSTAGRAM"],
    "startDateFormatted": "2026-09-20T07:00:00.000Z",
    "impressionsWithIndex": {"impressionsText": null, "impressionsIndex": -1},
    "snapshot": {
      "pageName": "Marca Teste Oficial", "pageLikeCount": 50000, "pageCategories": ["Loja de roupas"],
      "body": {"text": "Vídeo novo da coleção"}, "title": "Coleção Primavera", "caption": "MARCATESTE.COM.BR",
      "ctaText": "Comprar agora", "linkUrl": "https://www.marcateste.com.br/colecao", "displayFormat": "VIDEO",
      "images": [], "cards": [],
      "videos": [{"videoHdUrl": "https://cdn.test/v101.mp4", "videoSdUrl": "https://cdn.test/v101-sd.mp4", "videoPreviewImageUrl": "https://cdn.test/v101.jpg"}]
    }
  },
  {
    "adArchiveID": "102", "pageID": "111", "pageName": "Marca Teste Oficial",
    "collationID": "c1", "collationCount": 3, "isActive": true,
    "publisherPlatform": ["FACEBOOK"],
    "startDateFormatted": "2026-09-19T07:00:00.000Z",
    "snapshot": {
      "body": {"text": "Vídeo novo da coleção"}, "ctaText": "Comprar agora", "linkUrl": "https://www.marcateste.com.br/colecao",
      "displayFormat": "VIDEO", "images": [], "cards": [],
      "videos": [{"videoHdUrl": "https://cdn.test/v102.mp4", "videoPreviewImageUrl": "https://cdn.test/v102.jpg"}]
    }
  },
  {
    "adArchiveID": "103", "pageID": "111", "pageName": "Marca Teste Oficial",
    "collationID": "c3", "collationCount": 1,
    "publisherPlatform": ["INSTAGRAM"],
    "startDateFormatted": "2026-09-18T07:00:00.000Z",
    "snapshot": {
      "body": {"text": "Promo de primavera"}, "ctaText": "Saiba mais", "linkUrl": "https://marcateste.com.br/promo",
      "displayFormat": "IMAGE", "cards": [], "videos": [],
      "images": [{"originalImageUrl": "https://cdn.test/i103.jpg", "resizedImageUrl": "https://cdn.test/i103-p.jpg"}]
    }
  },
  {
    "adArchiveID": "104", "pageID": "111", "pageName": "Marca Teste Oficial",
    "collationID": "c4", "collationCount": 1,
    "publisherPlatform": ["FACEBOOK", "INSTAGRAM"],
    "startDateFormatted": "2026-09-17T07:00:00.000Z",
    "snapshot": {
      "body": {"text": "{{product.name}}"}, "ctaText": "Comprar agora", "displayFormat": "DPA", "images": [], "videos": [],
      "cards": [
        {"title": "Camisa", "linkUrl": "https://marcateste.com.br/p/1", "originalImageUrl": "https://cdn.test/c104a.jpg"},
        {"title": "Calça", "linkUrl": "https://marcateste.com.br/p/2", "originalImageUrl": "https://cdn.test/c104b.jpg"},
        {"title": "Saia", "linkUrl": "https://marcateste.com.br/p/3", "originalImageUrl": "https://cdn.test/c104c.jpg"},
        {"title": "Bota", "linkUrl": "https://marcateste.com.br/p/4", "originalImageUrl": "https://cdn.test/c104d.jpg"}
      ]
    }
  },
  {
    "adArchiveID": "105", "pageID": "111", "pageName": "Marca Teste Oficial",
    "collationID": "c5",
    "startDateFormatted": "2026-09-16T07:00:00.000Z",
    "snapshot": {
      "body": {"text": "{{product.name}}"}, "displayFormat": "DPA", "images": [], "videos": [],
      "cards": [{"title": "Tênis", "originalImageUrl": "https://cdn.test/c105a.jpg"}, {"title": "Meia", "originalImageUrl": "https://cdn.test/c105b.jpg"}]
    }
  },
  {
    "adArchiveID": "106", "pageID": "111", "pageName": "Marca Teste Oficial",
    "collationID": "c6",
    "startDateFormatted": "2026-09-15T07:00:00.000Z",
    "snapshot": {"body": {"text": "Sem mídia"}, "displayFormat": "IMAGE", "images": [], "videos": [], "cards": []}
  },
  {
    "ad_archive_id": "107", "page_id": "111", "page_name": "Marca Teste Oficial",
    "collation_id": "c7", "collation_count": 2,
    "publisher_platform": ["facebook", "threads"],
    "start_date": 1789387200,
    "snapshot": {
      "body": "Carrossel de looks", "cta_text": "Ver mais", "link_url": "https://loja.marcateste.com.br/looks",
      "display_format": "CAROUSEL", "images": [], "videos": [],
      "cards": [
        {"body": "Look 1", "original_image_url": "https://cdn.test/c107a.jpg"},
        {"body": "Look 2", "resized_image_url": "https://cdn.test/c107b.jpg"}
      ]
    }
  },
  {
    "adArchiveID": "108", "pageID": "111", "pageName": "Marca Teste Oficial",
    "collationID": "c8",
    "startDateFormatted": "2026-09-13T07:00:00.000Z",
    "snapshot": {
      "body": {"text": "Promo de Primavera!"}, "ctaText": "Saiba mais", "linkUrl": "https://marcateste.com.br/promo",
      "displayFormat": "IMAGE", "cards": [], "videos": [],
      "images": [{"originalImageUrl": "https://cdn.test/i108.jpg"}]
    }
  },
  {
    "adArchiveID": "201", "pageID": "222", "pageName": "Marca Teste Revenda",
    "collationID": "c201",
    "startDateFormatted": "2026-09-12T07:00:00.000Z",
    "snapshot": {
      "pageLikeCount": 900, "pageCategories": ["Atacado"],
      "body": {"text": "Revenda"}, "linkUrl": "https://revenda.example.com/", "displayFormat": "IMAGE",
      "videos": [], "cards": [], "images": [{"originalImageUrl": "https://cdn.test/i201.jpg"}]
    }
  }
]
```

- [ ] **Step 2: Escrever os testes que falham — `scripts/tests/test_meta_ads_selecao.py`**

```python
from __future__ import annotations

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
from meta_ads_selecao import (  # noqa: E402
    FORMATO_CARROSSEL,
    FORMATO_DPA,
    FORMATO_IMAGEM,
    FORMATO_VIDEO,
    agrupar_paginas,
    classificar_descoberta,
    dominio_base,
    nome_compativel,
    normalizar_anuncio,
    slug_marca,
)

FIXTURE = Path(__file__).parent / "fixtures" / "apify_anuncios.json"


def anuncios():
    return {a.ad_id: a for a in (normalizar_anuncio(b) for b in json.loads(FIXTURE.read_text(encoding="utf-8"))) if a}


def test_normaliza_video_em_camel_case():
    a = anuncios()["101"]
    assert a.page_id == "111"
    assert a.pagina == "Marca Teste Oficial"
    assert a.formato == FORMATO_VIDEO
    assert a.texto == "Vídeo novo da coleção"
    assert a.titulo == "Coleção Primavera"
    assert a.cta == "Comprar agora"
    assert a.dominio == "marcateste.com.br"
    assert a.plataformas == ["Facebook", "Instagram"]
    assert a.inicio == "2026-09-20"
    assert a.versoes == 3
    assert a.collation_id == "c1"
    assert a.videos == [{"url": "https://cdn.test/v101.mp4", "capa": "https://cdn.test/v101.jpg"}]
    assert a.curtidas_pagina == 50000
    assert a.categorias_pagina == ["Loja de roupas"]
    assert a.link == "https://www.facebook.com/ads/library/?id=101"


def test_normaliza_carrossel_em_snake_case():
    a = anuncios()["107"]
    assert a.page_id == "111"
    assert a.formato == FORMATO_CARROSSEL
    assert a.texto == "Carrossel de looks"
    assert a.cta == "Ver mais"
    assert a.dominio == "marcateste.com.br"
    assert a.plataformas == ["Facebook", "Threads"]
    assert a.inicio == "2026-09-14"
    assert a.versoes == 2
    assert a.imagens == ["https://cdn.test/c107a.jpg", "https://cdn.test/c107b.jpg"]


def test_catalogo_imagem_e_limite_de_tres_cards():
    todos = anuncios()
    assert todos["104"].formato == FORMATO_DPA
    assert todos["104"].imagens == ["https://cdn.test/c104a.jpg", "https://cdn.test/c104b.jpg", "https://cdn.test/c104c.jpg"]
    assert todos["104"].dominio == "marcateste.com.br"
    assert todos["103"].formato == FORMATO_IMAGEM
    assert todos["103"].imagens == ["https://cdn.test/i103.jpg"]
    assert todos["106"].imagens == [] and todos["106"].videos == []


def test_anuncio_sem_id_e_descartado():
    assert normalizar_anuncio({"pageID": "1", "snapshot": {}}) is None


def test_dominio_base():
    assert dominio_base("https://loja.marca.com.br/x?y=1") == "marca.com.br"
    assert dominio_base("MARCA.COM.BR") == "marca.com.br"
    assert dominio_base("www.marca.com") == "marca.com"
    assert dominio_base("https://shop.brand.co.uk") == "brand.co.uk" or dominio_base("https://shop.brand.co.uk") == "co.uk"
    assert dominio_base("Loja Oficial") is None
    assert dominio_base(None) is None


def test_nome_compativel_tolera_acento_apostrofo_e_sufixo():
    assert nome_compativel("Água de Cheiro", "Agua de Cheiro Oficial")
    assert nome_compativel("L'Occitane", "L'OCCITANE en Provence")
    assert nome_compativel("Marca Teste", "MarcaTeste")
    assert not nome_compativel("Nike", "Adidas Brasil")
    assert not nome_compativel("!!!", "Qualquer")


def test_slug_marca():
    assert slug_marca("Água de Cheiro") == "agua-de-cheiro"
    assert slug_marca("L'Occitane en Provence") == "l-occitane-en-provence"
    assert slug_marca("!!!") == "marca"


def test_agrupar_paginas_ordena_por_volume():
    candidatas = agrupar_paginas(list(anuncios().values()))
    assert [c.page_id for c in candidatas] == ["111", "222"]
    assert candidatas[0].anuncios == 8
    assert candidatas[0].curtidas == 50000
    assert candidatas[0].dominios == ["marcateste.com.br"]
    assert candidatas[1].dominios == ["example.com"]


def test_descoberta_confirmada_com_nome_e_dominio():
    r = classificar_descoberta("Marca Teste", "https://www.marcateste.com.br", agrupar_paginas(list(anuncios().values())))
    assert r["status"] == "confirmada"
    assert r["page_id"] == "111"


def test_descoberta_ambigua_por_dominio_nome_ou_sem_site():
    candidatas = agrupar_paginas(list(anuncios().values()))
    outro = classificar_descoberta("Marca Teste", "outra.com.br", candidatas)
    assert outro["status"] == "ambigua" and "outra.com.br" in outro["motivo"] and outro["page_id"] is None
    assert classificar_descoberta("Outra Coisa", "marcateste.com.br", candidatas)["status"] == "ambigua"
    assert classificar_descoberta("Marca Teste", None, candidatas)["status"] == "ambigua"


def test_descoberta_nao_encontrada():
    assert classificar_descoberta("Marca Teste", "marcateste.com.br", [])["status"] == "nao_encontrada"
```

Obs.: a linha de `co.uk` aceita as duas respostas de propósito: domínios estrangeiros de segundo nível não são o foco (prospects são brasileiros), e o teste só garante que não quebra.

- [ ] **Step 3: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_selecao.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'meta_ads_selecao'`.

- [ ] **Step 4: Implementar `scripts/meta_ads_selecao.py` (parte de normalização e descoberta)**

```python
#!/usr/bin/env python3
"""
scripts/meta_ads_selecao.py: normaliza os anúncios devolvidos pela Apify
(ator apify/facebook-ads-scraper), agrupa páginas na descoberta e aplica as
regras mecânicas de seleção da Skill 06 (até 10 criativos, no máximo 1
catálogo, sem duplicados, sem anúncio sem mídia).

Sem rede e sem disco: o download entra por uma função injetada, o que deixa
tudo testável. Usado por scripts/coleta_meta_ads.py.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlparse

FORMATO_VIDEO = "Vídeo"
FORMATO_IMAGEM = "Imagem estática"
FORMATO_CARROSSEL = "Carrossel"
FORMATO_DPA = "Catálogo (DPA)"

PLATAFORMAS = {
    "FACEBOOK": "Facebook",
    "INSTAGRAM": "Instagram",
    "MESSENGER": "Messenger",
    "AUDIENCE_NETWORK": "Audience Network",
    "THREADS": "Threads",
    "WHATSAPP": "WhatsApp",
}
SEGUNDO_NIVEL = {"com", "net", "org", "gov", "edu", "art", "blog", "ind", "eco", "app", "co"}
LIMITE_HAMMING = 5


@dataclass
class Anuncio:
    ad_id: str
    page_id: str
    pagina: str
    formato: str
    texto: str = ""
    titulo: str = ""
    cta: str = ""
    dominio: Optional[str] = None
    plataformas: List[str] = field(default_factory=list)
    inicio: Optional[str] = None
    versoes: Optional[int] = None
    impressoes: Optional[str] = None
    collation_id: Optional[str] = None
    imagens: List[str] = field(default_factory=list)
    videos: List[Dict[str, Optional[str]]] = field(default_factory=list)
    curtidas_pagina: Optional[int] = None
    categorias_pagina: List[str] = field(default_factory=list)

    @property
    def link(self) -> str:
        return f"https://www.facebook.com/ads/library/?id={self.ad_id}"


@dataclass
class Midia:
    arquivos: List[str]
    hash: Optional[int] = None
    quadros_falharam: bool = False


@dataclass
class Candidata:
    page_id: str
    nome: str
    curtidas: Optional[int]
    categorias: List[str]
    dominios: List[str]
    anuncios: int


@dataclass
class Selecionado:
    anuncio: Anuncio
    midia: Midia


def campo(d: Any, *nomes: str) -> Any:
    """Primeiro valor não vazio entre as chaves (a Apify já usou camelCase e snake_case)."""
    if not isinstance(d, dict):
        return None
    for nome in nomes:
        valor = d.get(nome)
        if valor not in (None, "", [], {}):
            return valor
    return None


def sem_acento(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")


def slug_marca(nome: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", sem_acento(nome).lower()).strip("-")
    return s or "marca"


def normalizar_texto(texto: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]+", " ", sem_acento(texto or "").lower()).strip()


def nome_compativel(marca: str, pagina: str) -> bool:
    a = normalizar_texto(marca).replace(" ", "")
    b = normalizar_texto(pagina).replace(" ", "")
    return bool(a) and bool(b) and (a in b or b in a)


def dominio_base(valor: Optional[str]) -> Optional[str]:
    if not valor or not isinstance(valor, str):
        return None
    v = valor.strip().lower()
    if "://" not in v:
        v = "http://" + v
    try:
        host = urlparse(v).hostname or ""
    except ValueError:
        return None
    if host.startswith("www."):
        host = host[4:]
    partes = [p for p in host.split(".") if p]
    if len(partes) < 2 or " " in host:
        return None
    if len(partes) >= 3 and len(partes[-1]) == 2 and partes[-2] in SEGUNDO_NIVEL:
        return ".".join(partes[-3:])
    return ".".join(partes[-2:])


def _texto(valor: Any) -> str:
    if isinstance(valor, dict):
        valor = campo(valor, "text", "markup")
    return valor.strip() if isinstance(valor, str) else ""


def _url_imagem(d: Any) -> Optional[str]:
    return campo(d, "originalImageUrl", "original_image_url", "resizedImageUrl", "resized_image_url")


def _video(d: Any) -> Optional[Dict[str, Optional[str]]]:
    url = campo(d, "videoHdUrl", "video_hd_url", "videoSdUrl", "video_sd_url")
    if not url:
        return None
    return {"url": url, "capa": campo(d, "videoPreviewImageUrl", "video_preview_image_url")}


def _data_inicio(bruto: Dict[str, Any]) -> Optional[str]:
    formatada = campo(bruto, "startDateFormatted", "start_date_formatted")
    if isinstance(formatada, str) and len(formatada) >= 10:
        return formatada[:10]
    epoch = campo(bruto, "startDate", "start_date")
    if isinstance(epoch, (int, float)):
        return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%d")
    return None


def _inteiro(valor: Any) -> Optional[int]:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def normalizar_anuncio(bruto: Dict[str, Any]) -> Optional[Anuncio]:
    ad_id = campo(bruto, "adArchiveID", "ad_archive_id", "adArchiveId")
    if not ad_id:
        return None
    snap = campo(bruto, "snapshot") or {}
    cards = [c for c in (campo(snap, "cards") or []) if isinstance(c, dict)]
    imagens = [u for u in (_url_imagem(i) for i in (campo(snap, "images") or [])) if u]
    videos = [v for v in (_video(i) for i in (campo(snap, "videos") or [])) if v]
    for card in cards[:3]:
        v = _video(card)
        if v:
            videos.append(v)
        else:
            u = _url_imagem(card)
            if u:
                imagens.append(u)

    exibicao = str(campo(snap, "displayFormat", "display_format") or "").upper()
    if exibicao == "DPA":
        formato = FORMATO_DPA
    elif exibicao == "CAROUSEL" or (exibicao != "VIDEO" and len(cards) >= 2):
        formato = FORMATO_CARROSSEL
    elif exibicao == "VIDEO" or videos:
        formato = FORMATO_VIDEO
    else:
        formato = FORMATO_IMAGEM

    primeiro_card = cards[0] if cards else {}
    dominio = (
        dominio_base(campo(snap, "linkUrl", "link_url"))
        or dominio_base(campo(snap, "caption"))
        or dominio_base(campo(primeiro_card, "linkUrl", "link_url"))
    )
    impressoes = campo(bruto, "impressionsWithIndex", "impressions_with_index")
    plataformas = [
        PLATAFORMAS.get(str(p).upper(), str(p).title())
        for p in (campo(bruto, "publisherPlatform", "publisher_platform") or [])
    ]
    categorias = [c for c in (campo(snap, "pageCategories", "page_categories") or []) if isinstance(c, str)]
    collation = campo(bruto, "collationID", "collation_id", "collationId")
    return Anuncio(
        ad_id=str(ad_id),
        page_id=str(campo(bruto, "pageID", "page_id", "pageId") or campo(snap, "pageId", "page_id") or ""),
        pagina=str(campo(bruto, "pageName", "page_name") or campo(snap, "pageName", "page_name") or ""),
        formato=formato,
        texto=_texto(campo(snap, "body")) or _texto(campo(primeiro_card, "body")),
        titulo=_texto(campo(snap, "title")) or _texto(campo(primeiro_card, "title")),
        cta=_texto(campo(snap, "ctaText", "cta_text")) or _texto(campo(primeiro_card, "ctaText", "cta_text")),
        dominio=dominio,
        plataformas=plataformas,
        inicio=_data_inicio(bruto),
        versoes=_inteiro(campo(bruto, "collationCount", "collation_count")),
        impressoes=campo(impressoes, "impressionsText", "impressions_text"),
        collation_id=str(collation) if collation else None,
        imagens=imagens,
        videos=videos,
        curtidas_pagina=_inteiro(campo(snap, "pageLikeCount", "page_like_count")),
        categorias_pagina=categorias,
    )


def agrupar_paginas(anuncios: List[Anuncio]) -> List[Candidata]:
    grupos: Dict[str, Candidata] = {}
    for a in anuncios:
        if not a.page_id:
            continue
        c = grupos.get(a.page_id)
        if c is None:
            c = grupos[a.page_id] = Candidata(a.page_id, a.pagina, a.curtidas_pagina, list(a.categorias_pagina), [], 0)
        c.anuncios += 1
        if a.dominio and a.dominio not in c.dominios:
            c.dominios.append(a.dominio)
        if c.curtidas is None and a.curtidas_pagina is not None:
            c.curtidas = a.curtidas_pagina
        if not c.categorias and a.categorias_pagina:
            c.categorias = list(a.categorias_pagina)
    return sorted(grupos.values(), key=lambda c: (c.anuncios, c.curtidas or 0), reverse=True)


def classificar_descoberta(marca: str, site: Optional[str], candidatas: List[Candidata]) -> Dict[str, Any]:
    if not candidatas:
        return {"status": "nao_encontrada", "page_id": None, "motivo": "Nenhuma página anunciando com esse nome."}
    topo = candidatas[0]
    alvo = dominio_base(site)
    if not alvo:
        motivo = "Site da marca não informado: não dá para confirmar pelo domínio."
    elif not nome_compativel(marca, topo.nome):
        motivo = f'A página com mais anúncios ("{topo.nome}") não tem o nome da marca.'
    elif alvo not in topo.dominios:
        motivo = f"A página com mais anúncios não anuncia para {alvo}."
    else:
        return {"status": "confirmada", "page_id": topo.page_id, "motivo": f"Nome compatível e anuncia para {alvo}."}
    return {"status": "ambigua", "page_id": None, "motivo": motivo}
```

Obs.: `SEGUNDO_NIVEL` inclui `"co"`, então `shop.brand.co.uk` vira `brand.co.uk` (o teste aceita as duas formas).

- [ ] **Step 5: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_selecao.py -q`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/meta_ads_selecao.py scripts/tests/test_meta_ads_selecao.py scripts/tests/fixtures/apify_anuncios.json
git commit -m "feat(benchmark): normaliza anúncios da Apify e classifica a página oficial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Seleção dos criativos (limites, DPA, duplicados, sem mídia)

**Files:**
- Modify: `scripts/meta_ads_selecao.py` (acrescentar ao final)
- Test: `scripts/tests/test_meta_ads_selecao.py` (acrescentar)

**Interfaces:**
- Consumes: `Anuncio`, `Midia`, `Selecionado`, `normalizar_texto`, `FORMATO_DPA` (Task 2)
- Produces: `distancia_hamming(a: int, b: int) -> int`; `selecionar(anuncios: List[Anuncio], limite: int, baixar: Callable[[Anuncio], Optional[Midia]], descartar: Optional[Callable[[Anuncio, Midia], None]] = None) -> Tuple[List[Selecionado], Dict[str, int]]` com contagem nas chaves `duplicados`, `catalogos_pulados`, `sem_midia`

- [ ] **Step 1: Escrever os testes que falham (acrescentar em `test_meta_ads_selecao.py`)**

```python
from meta_ads_selecao import Midia, distancia_hamming, selecionar  # noqa: E402

HASHES = {"103": 0b0, "108": 0b1}


def da_pagina_111():
    return [a for a in anuncios().values() if a.page_id == "111"]


def baixar_falso(falhas=()):
    chamados = []

    def baixar(a):
        chamados.append(a.ad_id)
        if a.ad_id in falhas:
            return None
        return Midia(arquivos=[f"midia/{a.ad_id}/imagem-1.jpg"], hash=HASHES.get(a.ad_id))

    return baixar, chamados


def test_distancia_hamming():
    assert distancia_hamming(0b1010, 0b1010) == 0
    assert distancia_hamming(0b1010, 0b0101) == 4


def test_selecao_aplica_todas_as_regras():
    baixar, chamados = baixar_falso()
    descartados = []
    escolhidos, contagem = selecionar(da_pagina_111(), 10, baixar, lambda a, m: descartados.append(a.ad_id))
    assert [s.anuncio.ad_id for s in escolhidos] == ["101", "103", "104", "107"]
    assert contagem == {"duplicados": 2, "catalogos_pulados": 1, "sem_midia": 1}
    assert "102" not in chamados  # duplicado pelo collationID nem é baixado
    assert "105" not in chamados  # segundo catálogo nem é baixado
    assert "106" not in chamados  # sem URL de mídia nem é baixado
    assert descartados == ["108"]  # mesmo texto e mesma imagem que o 103


def test_selecao_respeita_o_limite():
    baixar, _ = baixar_falso()
    escolhidos, _ = selecionar(da_pagina_111(), 2, baixar)
    assert [s.anuncio.ad_id for s in escolhidos] == ["101", "103"]


def test_download_que_falha_e_substituido_pelo_proximo():
    baixar, _ = baixar_falso(falhas={"103"})
    escolhidos, contagem = selecionar(da_pagina_111(), 10, baixar)
    assert [s.anuncio.ad_id for s in escolhidos] == ["101", "104", "107", "108"]
    assert contagem["sem_midia"] == 2


def test_texto_igual_com_imagem_diferente_nao_e_duplicado():
    HASHES["108"] = (1 << 64) - 1
    try:
        baixar, _ = baixar_falso()
        escolhidos, _ = selecionar(da_pagina_111(), 10, baixar)
        assert "108" in [s.anuncio.ad_id for s in escolhidos]
    finally:
        HASHES["108"] = 0b1


def test_menos_anuncios_que_o_limite():
    baixar, _ = baixar_falso()
    escolhidos, _ = selecionar(da_pagina_111()[:1], 10, baixar)
    assert len(escolhidos) == 1


def test_lista_vazia():
    baixar, _ = baixar_falso()
    assert selecionar([], 10, baixar) == ([], {"duplicados": 0, "catalogos_pulados": 0, "sem_midia": 0})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_selecao.py -q`
Expected: FAIL com `ImportError: cannot import name 'distancia_hamming'`.

- [ ] **Step 3: Implementar (acrescentar ao final de `scripts/meta_ads_selecao.py`)**

```python
def distancia_hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _duplicado(anuncio: Anuncio, midia: Midia, escolhidos: List[Selecionado]) -> bool:
    texto = normalizar_texto(anuncio.texto)
    for s in escolhidos:
        if texto != normalizar_texto(s.anuncio.texto):
            continue
        if midia.hash is None or s.midia.hash is None:
            continue
        if distancia_hamming(midia.hash, s.midia.hash) <= LIMITE_HAMMING:
            return True
    return False


def selecionar(
    anuncios: List[Anuncio],
    limite: int,
    baixar: Callable[[Anuncio], Optional[Midia]],
    descartar: Optional[Callable[[Anuncio, Midia], None]] = None,
) -> Tuple[List[Selecionado], Dict[str, int]]:
    """Mais recentes primeiro; pula duplicados, o 2º catálogo e anúncio sem mídia; para em `limite`."""
    contagem = {"duplicados": 0, "catalogos_pulados": 0, "sem_midia": 0}
    escolhidos: List[Selecionado] = []
    colacoes = set()
    tem_dpa = False
    for a in sorted(anuncios, key=lambda x: x.inicio or "", reverse=True):
        if len(escolhidos) >= limite:
            break
        if a.collation_id and a.collation_id in colacoes:
            contagem["duplicados"] += 1
            continue
        if a.formato == FORMATO_DPA and tem_dpa:
            contagem["catalogos_pulados"] += 1
            continue
        if not a.imagens and not a.videos:
            contagem["sem_midia"] += 1
            continue
        midia = baixar(a)
        if midia is None:
            contagem["sem_midia"] += 1
            continue
        if _duplicado(a, midia, escolhidos):
            contagem["duplicados"] += 1
            if descartar:
                descartar(a, midia)
            continue
        if a.collation_id:
            colacoes.add(a.collation_id)
        tem_dpa = tem_dpa or a.formato == FORMATO_DPA
        escolhidos.append(Selecionado(a, midia))
    return escolhidos, contagem
```

Obs.: `normalizar_texto("Promo de Primavera!") == normalizar_texto("Promo de primavera")`, por isso o 108 cai como duplicado do 103.

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_selecao.py -q`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/meta_ads_selecao.py scripts/tests/test_meta_ads_selecao.py
git commit -m "feat(benchmark): seleção de até 10 criativos distintos com no máximo 1 catálogo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mídia — download, JPEG, hash visual e quadros de vídeo

**Files:**
- Create: `scripts/meta_ads_midia.py`
- Test: `scripts/tests/test_meta_ads_midia.py`

**Interfaces:**
- Consumes: `Anuncio`, `Midia`, `FORMATO_*` (Task 2)
- Produces (em `meta_ads_midia`): `baixar_arquivo(sessao, url: str, destino: Path, tentativas: int = 2) -> bool`; `baixar_imagem(sessao, url: str, destino: Path) -> bool`; `ahash(caminho: Path) -> Optional[int]`; `tempos_quadros(duracao: Optional[float]) -> List[float]`; `extrair_quadros(video: Path, pasta: Path, prefixo: str) -> List[Path]`; `ffmpeg_disponivel() -> bool`; `baixar_midia(anuncio: Anuncio, pasta_marca: Path, sessao) -> Optional[Midia]`; `apagar_midia(pasta_marca: Path, anuncio: Anuncio) -> None`. `sessao` é qualquer objeto com `.get(url, timeout=...)` que devolve algo com `.status_code` e `.content` (ex.: `requests.Session`).

- [ ] **Step 1: Escrever os testes que falham — `scripts/tests/test_meta_ads_midia.py`**

```python
from __future__ import annotations

import io
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
from meta_ads_midia import ahash, baixar_imagem, baixar_midia, extrair_quadros, tempos_quadros  # noqa: E402
from meta_ads_selecao import FORMATO_IMAGEM, FORMATO_VIDEO, Anuncio  # noqa: E402

TEM_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def jpeg(cor=(200, 30, 30), metade=None) -> bytes:
    img = Image.new("RGB", (64, 64), cor)
    if metade:
        for x in range(32):
            for y in range(64):
                img.putpixel((x, y), metade)
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


def video_sintetico(pasta: Path, segundos: int) -> Path:
    saida = pasta / f"sintetico-{segundos}s.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc=duration={segundos}:size=160x120:rate=10",
         "-pix_fmt", "yuv420p", str(saida)],
        check=True,
    )
    return saida


class Resposta:
    def __init__(self, status_code, content):
        self.status_code = status_code
        self.content = content


class SessaoFalsa:
    def __init__(self, respostas):
        self.respostas = respostas  # url -> lista de (status, bytes), consumida em ordem
        self.chamadas = []

    def get(self, url, timeout=None):
        self.chamadas.append(url)
        fila = self.respostas.get(url, [(404, b"")])
        status, conteudo = fila.pop(0) if len(fila) > 1 else fila[0]
        return Resposta(status, conteudo)


def test_tempos_quadros():
    assert tempos_quadros(6.0) == [1.5, 2.0, 3.0, 4.5, 5.5]
    assert tempos_quadros(2.0) == [0.0, 1.0, 1.75]
    assert tempos_quadros(None) == [0.0]
    assert len(tempos_quadros(30.0)) == 5


def test_ahash_igual_para_imagens_iguais_e_diferente_para_distintas(tmp_path):
    a, b, c = tmp_path / "a.jpg", tmp_path / "b.jpg", tmp_path / "c.jpg"
    a.write_bytes(jpeg())
    b.write_bytes(jpeg())
    c.write_bytes(jpeg((255, 255, 255), metade=(0, 0, 0)))
    assert ahash(a) == ahash(b)
    assert bin(ahash(a) ^ ahash(c)).count("1") > 5
    assert ahash(tmp_path / "nao-existe.jpg") is None


def test_baixar_imagem_tenta_de_novo_e_rejeita_conteudo_que_nao_e_imagem(tmp_path):
    sessao = SessaoFalsa({
        "https://cdn.test/ok.jpg": [(500, b""), (200, jpeg())],
        "https://cdn.test/html.jpg": [(200, b"<html>erro</html>")],
    })
    assert baixar_imagem(sessao, "https://cdn.test/ok.jpg", tmp_path / "ok.jpg")
    assert sessao.chamadas.count("https://cdn.test/ok.jpg") == 2
    assert not baixar_imagem(sessao, "https://cdn.test/html.jpg", tmp_path / "html.jpg")
    assert not (tmp_path / "html.jpg").exists()


def test_baixar_midia_de_imagem_que_falha_remove_a_pasta(tmp_path):
    anuncio = Anuncio(ad_id="9", page_id="1", pagina="P", formato=FORMATO_IMAGEM, imagens=["https://cdn.test/x.jpg"])
    assert baixar_midia(anuncio, tmp_path, SessaoFalsa({})) is None
    assert not (tmp_path / "midia" / "9").exists()


def test_baixar_midia_de_imagem(tmp_path):
    anuncio = Anuncio(ad_id="8", page_id="1", pagina="P", formato=FORMATO_IMAGEM, imagens=["https://cdn.test/i.jpg"])
    midia = baixar_midia(anuncio, tmp_path, SessaoFalsa({"https://cdn.test/i.jpg": [(200, jpeg())]}))
    assert midia is not None
    assert midia.arquivos == ["midia/8/imagem-1.jpg"]
    assert midia.hash is not None


@pytest.mark.skipif(not TEM_FFMPEG, reason="ffmpeg não instalado")
def test_extrair_quadros_de_video_longo_e_curto(tmp_path):
    assert len(extrair_quadros(video_sintetico(tmp_path, 6), tmp_path, "longo")) == 5
    assert len(extrair_quadros(video_sintetico(tmp_path, 2), tmp_path, "curto")) == 3


@pytest.mark.skipif(not TEM_FFMPEG, reason="ffmpeg não instalado")
def test_baixar_midia_de_video_gera_capa_e_quadros_e_apaga_o_video(tmp_path):
    video = video_sintetico(tmp_path, 6).read_bytes()
    anuncio = Anuncio(ad_id="7", page_id="1", pagina="P", formato=FORMATO_VIDEO,
                      videos=[{"url": "https://cdn.test/v.mp4", "capa": "https://cdn.test/v.jpg"}])
    sessao = SessaoFalsa({"https://cdn.test/v.mp4": [(200, video)], "https://cdn.test/v.jpg": [(200, jpeg())]})
    midia = baixar_midia(anuncio, tmp_path / "marca", sessao)
    assert midia is not None
    assert midia.arquivos[0] == "midia/7/video-1-capa.jpg"
    assert [a for a in midia.arquivos if "quadro" in a] == [f"midia/7/video-1-quadro-{i}.jpg" for i in range(1, 6)]
    assert not (tmp_path / "marca" / "midia" / "7" / "video-1.mp4").exists()
    assert midia.quadros_falharam is False


def test_video_que_nao_baixa_fica_so_com_a_capa(tmp_path):
    anuncio = Anuncio(ad_id="6", page_id="1", pagina="P", formato=FORMATO_VIDEO,
                      videos=[{"url": "https://cdn.test/sumiu.mp4", "capa": "https://cdn.test/c.jpg"}])
    midia = baixar_midia(anuncio, tmp_path, SessaoFalsa({"https://cdn.test/c.jpg": [(200, jpeg())]}))
    assert midia is not None
    assert midia.arquivos == ["midia/6/video-1-capa.jpg"]
    assert midia.quadros_falharam is True
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_midia.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'meta_ads_midia'`.

- [ ] **Step 3: Implementar `scripts/meta_ads_midia.py`**

```python
#!/usr/bin/env python3
"""
scripts/meta_ads_midia.py: baixa a mídia de um anúncio (imagens, capas e
vídeos), converte imagens para JPEG, extrai quadros de vídeo com ffmpeg e
calcula o hash visual usado na deduplicação. Usado por
scripts/coleta_meta_ads.py.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any, List, Optional

from PIL import Image

from meta_ads_selecao import Anuncio, Midia

TIMEOUT_DOWNLOAD = 60


def baixar_arquivo(sessao: Any, url: str, destino: Path, tentativas: int = 2) -> bool:
    for _ in range(tentativas):
        try:
            r = sessao.get(url, timeout=TIMEOUT_DOWNLOAD)
        except Exception:  # noqa: BLE001 (qualquer falha de rede conta como tentativa perdida)
            continue
        if r.status_code == 200 and r.content:
            destino.write_bytes(r.content)
            return True
    return False


def baixar_imagem(sessao: Any, url: str, destino: Path) -> bool:
    """Baixa e regrava como JPEG; conteúdo que não é imagem (ex.: página de erro) é rejeitado."""
    if not baixar_arquivo(sessao, url, destino):
        return False
    try:
        img = Image.open(destino)
        img.load()
        rgb = img.convert("RGB")
        img.close()
        rgb.save(destino, "JPEG", quality=90)
        return True
    except Exception:  # noqa: BLE001
        destino.unlink(missing_ok=True)
        return False


def ahash(caminho: Path) -> Optional[int]:
    try:
        with Image.open(caminho) as img:
            pixels = list(img.convert("L").resize((8, 8)).getdata())
    except Exception:  # noqa: BLE001
        return None
    media = sum(pixels) / len(pixels)
    valor = 0
    for p in pixels:
        valor = (valor << 1) | (1 if p >= media else 0)
    return valor


def duracao_video(video: Path) -> Optional[float]:
    try:
        saida = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
            capture_output=True, text=True, timeout=60, check=True,
        ).stdout
        return float(saida.strip())
    except (subprocess.SubprocessError, ValueError, OSError):
        return None


def tempos_quadros(duracao: Optional[float]) -> List[float]:
    if not duracao or duracao <= 0:
        return [0.0]
    if duracao < 3:
        return [0.0, round(duracao / 2, 2), round(max(duracao - 0.25, 0.0), 2)]
    brutos = [2.0, duracao * 0.25, duracao * 0.5, duracao * 0.75, duracao - 0.5]
    return sorted({round(t, 2) for t in brutos})


def extrair_quadros(video: Path, pasta: Path, prefixo: str) -> List[Path]:
    quadros: List[Path] = []
    for i, t in enumerate(tempos_quadros(duracao_video(video)), start=1):
        saida = pasta / f"{prefixo}-quadro-{i}.jpg"
        try:
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", str(video),
                 "-frames:v", "1", "-q:v", "3", str(saida)],
                capture_output=True, timeout=120, check=True,
            )
        except (subprocess.SubprocessError, OSError):
            continue
        if saida.exists() and saida.stat().st_size > 0:
            quadros.append(saida)
    return quadros


def ffmpeg_disponivel() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def baixar_midia(anuncio: Anuncio, pasta_marca: Path, sessao: Any) -> Optional[Midia]:
    """Grava em <pasta_marca>/midia/<ad_id>/. None se nada pôde ser baixado."""
    pasta = pasta_marca / "midia" / anuncio.ad_id
    pasta.mkdir(parents=True, exist_ok=True)
    salvos: List[Path] = []
    para_hash: List[Path] = []
    quadros_falharam = False

    for i, url in enumerate(anuncio.imagens[:3], start=1):
        destino = pasta / f"imagem-{i}.jpg"
        if baixar_imagem(sessao, url, destino):
            salvos.append(destino)
            para_hash.append(destino)

    for i, video in enumerate(anuncio.videos[:3], start=1):
        capa: Optional[Path] = None
        if video.get("capa"):
            destino = pasta / f"video-{i}-capa.jpg"
            if baixar_imagem(sessao, str(video["capa"]), destino):
                capa = destino
                salvos.append(destino)
                para_hash.append(destino)
        arquivo = pasta / f"video-{i}.mp4"
        quadros: List[Path] = []
        if baixar_arquivo(sessao, str(video["url"]), arquivo):
            quadros = extrair_quadros(arquivo, pasta, f"video-{i}")
            arquivo.unlink(missing_ok=True)
        if not quadros:
            quadros_falharam = True
        salvos.extend(quadros)
        if capa is None:
            para_hash.extend(quadros[:1])

    if not salvos:
        shutil.rmtree(pasta, ignore_errors=True)
        return None
    h = next((v for v in (ahash(c) for c in para_hash) if v is not None), None)
    return Midia(
        arquivos=[str(p.relative_to(pasta_marca)) for p in salvos],
        hash=h,
        quadros_falharam=quadros_falharam,
    )


def apagar_midia(pasta_marca: Path, anuncio: Anuncio) -> None:
    shutil.rmtree(pasta_marca / "midia" / anuncio.ad_id, ignore_errors=True)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_midia.py -q`
Expected: todos PASS (os de ffmpeg rodam nesta máquina, que tem `/opt/homebrew/bin/ffmpeg`).

- [ ] **Step 5: Commit**

```bash
git add scripts/meta_ads_midia.py scripts/tests/test_meta_ads_midia.py
git commit -m "feat(benchmark): download de mídia, hash visual e quadros de vídeo com ffmpeg

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cliente da Apify

**Files:**
- Create: `scripts/meta_ads_apify.py`
- Test: `scripts/tests/test_meta_ads_apify.py`

**Interfaces:**
- Produces (em `meta_ads_apify`): `class ErroColeta(Exception)`; `ler_token(ambiente: Mapping[str, str] = os.environ, arquivo_env: Path = RAIZ / ".env") -> str`; `url_busca(marca: str) -> str`; `url_pagina(page_id: str) -> str`; `entrada_ator(url: str, limite: int, apenas_total: bool = False) -> Dict[str, Any]`; `extrair_total(itens: List[Any]) -> Optional[int]`; `class ClienteApify(token: str, sessao=None, limite_segundos: float = 600.0, dormir=time.sleep, relogio=time.monotonic)` com `executar(entrada: Dict[str, Any]) -> List[Dict[str, Any]]`

- [ ] **Step 1: Escrever os testes que falham — `scripts/tests/test_meta_ads_apify.py`**

```python
from __future__ import annotations

import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
from meta_ads_apify import (  # noqa: E402
    ClienteApify,
    ErroColeta,
    entrada_ator,
    extrair_total,
    ler_token,
    url_busca,
    url_pagina,
)


class Resposta:
    def __init__(self, status_code, corpo):
        self.status_code = status_code
        self._corpo = corpo

    def json(self):
        return self._corpo


class SessaoFalsa:
    def __init__(self, post, gets):
        self._post = post
        self._gets = list(gets)
        self.chamadas = []

    def post(self, url, json=None, headers=None, timeout=None):
        self.chamadas.append(("POST", url, headers, None))
        return self._post

    def get(self, url, params=None, headers=None, timeout=None):
        self.chamadas.append(("GET", url, headers, params))
        return self._gets.pop(0)


def criado(status="READY"):
    return Resposta(201, {"data": {"id": "run1", "defaultDatasetId": "ds1", "status": status}})


def rodando(status):
    return Resposta(200, {"data": {"id": "run1", "status": status}})


def cliente(sessao, relogio=None):
    tempo = {"t": 0.0}

    def relogio_padrao():
        return tempo["t"]

    return ClienteApify("segredo123", sessao=sessao, dormir=lambda s: None, relogio=relogio or relogio_padrao)


def test_ler_token_do_ambiente_e_do_env(tmp_path):
    assert ler_token({"APIFY_TOKEN": " abc "}, tmp_path / ".env") == "abc"
    env = tmp_path / ".env"
    env.write_text('OUTRA=1\nAPIFY_TOKEN="xyz"\n', encoding="utf-8")
    assert ler_token({}, env) == "xyz"


def test_ler_token_ausente(tmp_path):
    with pytest.raises(ErroColeta, match="APIFY_TOKEN"):
        ler_token({}, tmp_path / ".env")


def test_urls_e_entrada():
    busca = url_busca("Marca Teste")
    assert busca.startswith("https://www.facebook.com/ads/library/?")
    assert "q=Marca+Teste" in busca and "country=BR" in busca and "search_type=keyword_unordered" in busca
    assert "view_all_page_id=111" in url_pagina("111")
    e = entrada_ator(url_pagina("111"), 40)
    assert e["startUrls"] == [{"url": url_pagina("111")}]
    assert e["resultsLimit"] == 40 and e["onlyTotal"] is False
    assert entrada_ator("u", 1, apenas_total=True)["onlyTotal"] is True


def test_extrair_total():
    assert extrair_total([{"totalCount": 57}]) == 57
    assert extrair_total([{"total": "12"}]) == 12
    assert extrair_total([{}]) is None
    assert extrair_total([]) is None


def test_executar_espera_terminar_e_le_o_dataset():
    sessao = SessaoFalsa(criado(), [rodando("RUNNING"), rodando("SUCCEEDED"), Resposta(200, [{"adArchiveID": "1"}])])
    itens = cliente(sessao).executar({"startUrls": []})
    assert itens == [{"adArchiveID": "1"}]
    assert sessao.chamadas[0][1] == "https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs"
    assert sessao.chamadas[-1][1] == "https://api.apify.com/v2/datasets/ds1/items"
    for _, url, headers, params in sessao.chamadas:
        assert headers == {"Authorization": "Bearer segredo123"}
        assert "segredo123" not in url
        assert "segredo123" not in str(params)


@pytest.mark.parametrize("status,trecho", [(401, "token"), (402, "créditos"), (403, "plano"), (500, "500")])
def test_erros_http(status, trecho):
    sessao = SessaoFalsa(Resposta(status, {}), [])
    with pytest.raises(ErroColeta, match=trecho):
        cliente(sessao).executar({})


def test_execucao_que_falha():
    sessao = SessaoFalsa(criado(), [rodando("FAILED")])
    with pytest.raises(ErroColeta, match="FAILED"):
        cliente(sessao).executar({})


def test_tempo_esgotado():
    tempo = {"t": 0.0}

    def relogio():
        tempo["t"] += 400.0
        return tempo["t"]

    sessao = SessaoFalsa(criado(), [rodando("RUNNING")] * 5)
    with pytest.raises(ErroColeta, match="10 minutos"):
        cliente(sessao, relogio).executar({})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_apify.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'meta_ads_apify'`.

- [ ] **Step 3: Implementar `scripts/meta_ads_apify.py`**

```python
#!/usr/bin/env python3
"""
scripts/meta_ads_apify.py: cliente mínimo da API da Apify para o ator
apify/facebook-ads-scraper. O token vai só no cabeçalho Authorization, nunca
na URL nem em log. Usado por scripts/coleta_meta_ads.py.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Mapping, Optional
from urllib.parse import urlencode

import requests

RAIZ = Path(__file__).resolve().parent.parent
BASE = "https://api.apify.com/v2"
ATOR = "apify~facebook-ads-scraper"
BIBLIOTECA = "https://www.facebook.com/ads/library/"
STATUS_FINAIS = {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT", "TIMED_OUT"}


class ErroColeta(Exception):
    """Erro com mensagem pronta para o analista, em português."""


def ler_token(ambiente: Mapping[str, str] = os.environ, arquivo_env: Path = RAIZ / ".env") -> str:
    token = (ambiente.get("APIFY_TOKEN") or "").strip()
    if not token and arquivo_env.exists():
        for linha in arquivo_env.read_text(encoding="utf-8").splitlines():
            chave, sep, valor = linha.partition("=")
            if sep and chave.strip() == "APIFY_TOKEN":
                token = valor.strip().strip('"').strip("'")
    if not token:
        raise ErroColeta(
            "APIFY_TOKEN não configurado. Gere um token em console.apify.com (Settings → API & Integrations) "
            "e coloque no arquivo .env da raiz do projeto: APIFY_TOKEN=seu_token"
        )
    return token


def url_busca(marca: str) -> str:
    return BIBLIOTECA + "?" + urlencode({
        "active_status": "active", "ad_type": "all", "country": "BR", "media_type": "all",
        "q": marca, "search_type": "keyword_unordered",
    })


def url_pagina(page_id: str) -> str:
    return BIBLIOTECA + "?" + urlencode({
        "active_status": "active", "ad_type": "all", "country": "BR", "media_type": "all",
        "search_type": "page", "view_all_page_id": page_id,
    })


def entrada_ator(url: str, limite: int, apenas_total: bool = False) -> Dict[str, Any]:
    return {
        "startUrls": [{"url": url}],
        "resultsLimit": limite,
        "activeStatus": "active",
        "isDetailsPerAd": False,
        "onlyTotal": apenas_total,
    }


def extrair_total(itens: List[Any]) -> Optional[int]:
    for item in itens:
        if not isinstance(item, dict):
            continue
        for chave in ("totalCount", "total_count", "total", "count", "adsCount", "ads_count"):
            valor = item.get(chave)
            if isinstance(valor, bool):
                continue
            if isinstance(valor, (int, float)) or (isinstance(valor, str) and valor.isdigit()):
                return int(valor)
    return None


class ClienteApify:
    def __init__(
        self,
        token: str,
        sessao: Any = None,
        limite_segundos: float = 600.0,
        dormir: Callable[[float], None] = time.sleep,
        relogio: Callable[[], float] = time.monotonic,
    ) -> None:
        self.sessao = sessao or requests.Session()
        self.limite_segundos = limite_segundos
        self.dormir = dormir
        self.relogio = relogio
        self._cabecalhos = {"Authorization": f"Bearer {token}"}

    def _checar(self, r: Any) -> None:
        if r.status_code < 400:
            return
        if r.status_code == 401:
            raise ErroColeta("A Apify recusou o token (401). Confira o APIFY_TOKEN no .env.")
        if r.status_code == 402:
            raise ErroColeta("Sem créditos na Apify (402). Verifique o saldo e o plano em console.apify.com.")
        if r.status_code == 403:
            raise ErroColeta("A Apify recusou a execução pelo limite do plano (403). Verifique o plano em console.apify.com.")
        raise ErroColeta(f"A Apify respondeu com erro {r.status_code}. Tente de novo em alguns minutos.")

    def _pedir(self, metodo: str, url: str, **kwargs: Any) -> Any:
        try:
            r = getattr(self.sessao, metodo)(url, headers=self._cabecalhos, **kwargs)
        except requests.RequestException as e:
            raise ErroColeta(f"Não consegui falar com a Apify ({type(e).__name__}). Confira a internet e tente de novo.")
        self._checar(r)
        return r.json()

    def executar(self, entrada: Dict[str, Any]) -> List[Dict[str, Any]]:
        dados = self._pedir("post", f"{BASE}/acts/{ATOR}/runs", json=entrada, timeout=60)["data"]
        run_id, dataset = dados["id"], dados["defaultDatasetId"]
        status = dados.get("status")
        inicio = self.relogio()
        espera = 2.0
        while status not in STATUS_FINAIS:
            if self.relogio() - inicio > self.limite_segundos:
                raise ErroColeta(
                    f"A coleta passou de {int(self.limite_segundos // 60)} minutos. A execução {run_id} "
                    "continua visível em console.apify.com; tente de novo."
                )
            self.dormir(espera)
            espera = min(espera * 1.5, 15.0)
            status = self._pedir("get", f"{BASE}/actor-runs/{run_id}", timeout=60)["data"]["status"]
        if status != "SUCCEEDED":
            raise ErroColeta(f"A execução {run_id} na Apify terminou com status {status}. Tente de novo.")
        itens = self._pedir("get", f"{BASE}/datasets/{dataset}/items", params={"clean": "true", "format": "json"}, timeout=120)
        return itens if isinstance(itens, list) else []
```

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests/test_meta_ads_apify.py -q`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/meta_ads_apify.py scripts/tests/test_meta_ads_apify.py
git commit -m "feat(benchmark): cliente da API da Apify com token só no cabeçalho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: CLI `coleta_meta_ads.py` (descobrir, coletar, resumo)

**Files:**
- Create: `scripts/coleta_meta_ads.py`
- Test: `scripts/tests/test_coleta_meta_ads.py`

**Interfaces:**
- Consumes: tudo das Tasks 2 a 5.
- Produces: CLI `python3 scripts/coleta_meta_ads.py descobrir --marca M [--site S] --saida P` e `coletar --page-id N --marca M --saida P [--limite 10]`; funções `descobrir(marca: str, site: Optional[str], saida: Path, cliente) -> Dict[str, Any]`, `texto_descoberta(r: Dict[str, Any]) -> str`, `coletar(page_id: str, marca: str, saida: Path, limite: int, cliente, sessao, hoje: date) -> Dict[str, Any]`, `notas_de_coleta(total, anuncios, selecionados, contagem) -> List[str]`, `escrever_resumo(marca, pagina, page_id, total, hoje, selecionados, notas, pasta) -> str`, `main(argv: Optional[List[str]] = None) -> int`. Arquivos gerados em `<saida>/<slug_marca(marca)>/`: `descoberta.json`, `bruto.json`, `anuncios.json`, `resumo.md`, `midia/`.

- [ ] **Step 1: Escrever os testes que falham — `scripts/tests/test_coleta_meta_ads.py`**

```python
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "scripts"))
import coleta_meta_ads  # noqa: E402
from meta_ads_apify import ErroColeta  # noqa: E402
from meta_ads_selecao import Midia  # noqa: E402

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "apify_anuncios.json").read_text(encoding="utf-8"))
HOJE = date(2026, 9, 29)


class ClienteFalso:
    def __init__(self, busca=None, pagina=None, total=57):
        self.busca = busca if busca is not None else {"Marca Teste": FIXTURE}
        self.pagina = FIXTURE if pagina is None else pagina
        self.total = total
        self.entradas = []

    def executar(self, entrada):
        self.entradas.append(entrada)
        url = entrada["startUrls"][0]["url"]
        if entrada["onlyTotal"]:
            return [{"totalCount": self.total}] if self.total is not None else [{}]
        if "view_all_page_id" in url:
            return self.pagina
        for termo, itens in self.busca.items():
            if "q=" + termo.replace(" ", "+") + "&" in url + "&":
                return itens
        return []


@pytest.fixture(autouse=True)
def sem_rede(monkeypatch):
    def baixar(anuncio, pasta_marca, sessao):
        pasta = pasta_marca / "midia" / anuncio.ad_id
        pasta.mkdir(parents=True, exist_ok=True)
        (pasta / "imagem-1.jpg").write_bytes(b"x")
        return Midia(arquivos=[f"midia/{anuncio.ad_id}/imagem-1.jpg"], hash={"103": 0, "108": 1}.get(anuncio.ad_id),
                     quadros_falharam=anuncio.ad_id == "101")

    monkeypatch.setattr(coleta_meta_ads, "baixar_midia", baixar)
    monkeypatch.setattr(coleta_meta_ads, "ffmpeg_disponivel", lambda: True)


def test_descobrir_confirma_e_grava(tmp_path):
    r = coleta_meta_ads.descobrir("Marca Teste", "marcateste.com.br", tmp_path, ClienteFalso())
    assert r["status"] == "confirmada" and r["page_id"] == "111"
    salvo = json.loads((tmp_path / "marca-teste" / "descoberta.json").read_text(encoding="utf-8"))
    assert salvo["candidatas"][0]["page_id"] == "111"
    texto = coleta_meta_ads.texto_descoberta(r)
    assert "confirmada" in texto and "| Marca Teste Oficial | 111 |" in texto


def test_descobrir_tenta_sem_espaco(tmp_path):
    cliente = ClienteFalso(busca={"MarcaTeste": FIXTURE})
    r = coleta_meta_ads.descobrir("Marca Teste", "marcateste.com.br", tmp_path, cliente)
    assert r["termo_buscado"] == "MarcaTeste"
    assert r["status"] == "confirmada"
    assert len(cliente.entradas) == 2


def test_descobrir_nao_encontrada(tmp_path):
    r = coleta_meta_ads.descobrir("Inexistente", None, tmp_path, ClienteFalso(busca={}))
    assert r["status"] == "nao_encontrada"


def test_coletar_grava_resumo_json_e_notas(tmp_path):
    r = coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(), None, HOJE)
    pasta = tmp_path / "marca-teste"
    assert r["selecionados"] == 4 and r["total"] == 57
    resumo = (pasta / "resumo.md").read_text(encoding="utf-8")
    assert "- Anúncios ativos (total): 57" in resumo
    assert "- Coletado em: 29/09/2026" in resumo
    assert "### 1. 101 · Vídeo" in resumo
    assert "- Link: https://www.facebook.com/ads/library/?id=101" in resumo
    assert "- Início: 20/09/2026 · Versões: 3 · Impressões: —" in resumo
    assert "  - midia/101/imagem-1.jpg" in resumo
    assert "descreva a partir da capa" in resumo
    assert "anúncios repetiam um criativo" in resumo
    assert "limite de 1 por anunciante" in resumo
    assert "mídia indisponível" in resumo
    assert "?id=201" not in resumo  # anúncio de outra página fica de fora
    anuncios = json.loads((pasta / "anuncios.json").read_text(encoding="utf-8"))
    assert [a["ad_id"] for a in anuncios] == ["101", "103", "104", "107"]
    assert anuncios[0]["link"] == "https://www.facebook.com/ads/library/?id=101"
    assert anuncios[0]["midia"] == ["midia/101/imagem-1.jpg"]
    assert json.loads((pasta / "bruto.json").read_text(encoding="utf-8")) == FIXTURE
    assert not (pasta / "midia" / "108").exists()  # duplicado descartado não deixa arquivo


def test_coletar_sem_total_avisa_no_resumo(tmp_path):
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(total=None), None, HOJE)
    resumo = (tmp_path / "marca-teste" / "resumo.md").read_text(encoding="utf-8")
    assert "não informado pela Apify" in resumo
    assert "use o número de anúncios coletados como mínimo" in resumo


def test_coletar_pagina_sem_anuncios(tmp_path):
    r = coleta_meta_ads.coletar("999", "Vazia", tmp_path, 10, ClienteFalso(pagina=[], total=0), None, HOJE)
    assert r["selecionados"] == 0
    resumo = (tmp_path / "vazia" / "resumo.md").read_text(encoding="utf-8")
    assert "Nenhum anúncio ativo encontrado no momento da coleta." in resumo


def test_coletar_limpa_midia_de_coleta_anterior(tmp_path):
    velho = tmp_path / "marca-teste" / "midia" / "antigo"
    velho.mkdir(parents=True)
    coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(), None, HOJE)
    assert not velho.exists()


def test_coletar_sem_ffmpeg(tmp_path, monkeypatch):
    monkeypatch.setattr(coleta_meta_ads, "ffmpeg_disponivel", lambda: False)
    with pytest.raises(ErroColeta, match="brew install ffmpeg"):
        coleta_meta_ads.coletar("111", "Marca Teste", tmp_path, 10, ClienteFalso(), None, HOJE)


def test_main_erro_sai_com_codigo_1_e_mensagem(tmp_path, monkeypatch, capsys):
    def sem_token():
        raise ErroColeta("APIFY_TOKEN não configurado.")

    monkeypatch.setattr(coleta_meta_ads, "ler_token", sem_token)
    codigo = coleta_meta_ads.main(["descobrir", "--marca", "X", "--saida", str(tmp_path)])
    assert codigo == 1
    assert "APIFY_TOKEN não configurado." in capsys.readouterr().err
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python3 -m pytest scripts/tests/test_coleta_meta_ads.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'coleta_meta_ads'`.

- [ ] **Step 3: Implementar `scripts/coleta_meta_ads.py`**

```python
#!/usr/bin/env python3
"""
scripts/coleta_meta_ads.py: coleta de anúncios da Biblioteca de Anúncios do
Meta via Apify, para o benchmark da Skill 06.

    python3 scripts/coleta_meta_ads.py descobrir --marca "Nome" [--site dominio.com.br] --saida clientes/<slug>/dados/benchmark-meta
    python3 scripts/coleta_meta_ads.py coletar --page-id N --marca "Nome" --saida clientes/<slug>/dados/benchmark-meta [--limite 10]

descobrir: lista as páginas que anunciam com o nome da marca e diz se a
oficial ficou "confirmada" (nome + domínio do site) ou se é preciso perguntar
ao analista ("ambigua" / "nao_encontrada").

coletar: baixa os anúncios ativos da página, aplica as regras da Skill 06
(até 10 criativos distintos, no máximo 1 catálogo, sem anúncio sem mídia),
baixa imagens, extrai quadros de vídeo e grava anuncios.json, bruto.json,
resumo.md e midia/ em <saida>/<marca>/.

Erros saem em stderr, em português, com código 1. O token da Apify vem de
APIFY_TOKEN (ambiente ou .env da raiz) e nunca é impresso.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

from meta_ads_apify import ClienteApify, ErroColeta, entrada_ator, extrair_total, ler_token, url_busca, url_pagina
from meta_ads_midia import apagar_midia, baixar_midia, ffmpeg_disponivel
from meta_ads_selecao import (
    FORMATO_DPA,
    Anuncio,
    Selecionado,
    agrupar_paginas,
    classificar_descoberta,
    normalizar_anuncio,
    selecionar,
    slug_marca,
)

AMOSTRA_DESCOBERTA = 30
AMOSTRA_COLETA = 40


def _buscar(termo: str, cliente: Any):
    itens = cliente.executar(entrada_ator(url_busca(termo), AMOSTRA_DESCOBERTA))
    return agrupar_paginas([a for a in (normalizar_anuncio(i) for i in itens if isinstance(i, dict)) if a])


def descobrir(marca: str, site: Optional[str], saida: Path, cliente: Any) -> Dict[str, Any]:
    termo = marca.strip()
    candidatas = _buscar(termo, cliente)
    if not candidatas and " " in termo:
        termo = termo.replace(" ", "")
        candidatas = _buscar(termo, cliente)
    resultado = classificar_descoberta(marca, site, candidatas)
    resultado.update({
        "marca": marca,
        "site": site,
        "termo_buscado": termo,
        "candidatas": [asdict(c) for c in candidatas],
    })
    pasta = saida / slug_marca(marca)
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "descoberta.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    return resultado


def texto_descoberta(r: Dict[str, Any]) -> str:
    linhas = [
        f'Marca: {r["marca"]} (busca: "{r["termo_buscado"]}")',
        f'Resultado: {r["status"]}. {r["motivo"]}',
    ]
    if r["page_id"]:
        linhas.append(f'Página confirmada: page_id {r["page_id"]} ({url_pagina(r["page_id"])})')
    if r["candidatas"]:
        linhas += ["", "| Página | page_id | Curtidas | Categoria | Domínios | Anúncios na amostra |", "|---|---|---|---|---|---|"]
        for c in r["candidatas"]:
            curtidas = c["curtidas"] if c["curtidas"] is not None else "—"
            linhas.append(
                f'| {c["nome"]} | {c["page_id"]} | {curtidas} | {", ".join(c["categorias"]) or "—"} '
                f'| {", ".join(c["dominios"]) or "—"} | {c["anuncios"]} |'
            )
    return "\n".join(linhas)


def notas_de_coleta(total: Optional[int], anuncios: List[Anuncio], selecionados: List[Selecionado],
                    contagem: Dict[str, int]) -> List[str]:
    if not anuncios:
        return []
    notas: List[str] = []
    if total is None:
        notas.append("A Apify não informou o total de anúncios ativos; use o número de anúncios coletados como mínimo no ranking.")
    elif total < 10:
        notas.append(f"Só {total} anúncios ativos no momento da coleta.")
    if contagem["duplicados"]:
        notas.append(f'{contagem["duplicados"]} anúncios repetiam um criativo já selecionado e foram descartados.')
    if not any(a.formato == FORMATO_DPA for a in anuncios):
        notas.append("Nenhum anúncio de catálogo (DPA) disponível.")
    if contagem["catalogos_pulados"]:
        notas.append(f'{contagem["catalogos_pulados"]} anúncios de catálogo a mais foram pulados (limite de 1 por anunciante).')
    if contagem["sem_midia"]:
        notas.append(f'{contagem["sem_midia"]} anúncios descartados por mídia indisponível.')
    return notas


def _data_br(iso: Optional[str]) -> str:
    return f"{iso[8:10]}/{iso[5:7]}/{iso[0:4]}" if iso and len(iso) >= 10 else "—"


def escrever_resumo(marca: str, pagina: str, page_id: str, total: Optional[int], hoje: date,
                    selecionados: List[Selecionado], notas: List[str], pasta: Path) -> str:
    l = [
        f"# Coleta Meta Ads — {marca}",
        "",
        f"- Página: {pagina} (page_id {page_id})",
        f"- Página na Biblioteca: {url_pagina(page_id)}",
        f"- Anúncios ativos (total): {total if total is not None else 'não informado pela Apify'}",
        f"- Coletado em: {hoje.strftime('%d/%m/%Y')}",
        f"- Anúncios selecionados: {len(selecionados)}",
        f"- Pasta da coleta (os caminhos de mídia abaixo são relativos a ela): {pasta}",
        "",
    ]
    if notas:
        l += ["## Notas de coleta", ""] + [f"- {n}" for n in notas] + [""]
    l += ["## Anúncios", ""]
    if not selecionados:
        l.append("Nenhum anúncio ativo encontrado no momento da coleta.")
        return "\n".join(l) + "\n"
    for i, s in enumerate(selecionados, start=1):
        a = s.anuncio
        l += [
            f"### {i}. {a.ad_id} · {a.formato}",
            "",
            f"- Link: {a.link}",
            f"- Início: {_data_br(a.inicio)} · Versões: {a.versoes if a.versoes is not None else '—'} · Impressões: {a.impressoes or '—'}",
            f"- Plataformas: {', '.join(a.plataformas) or '—'}",
            f"- CTA: {a.cta or '—'} · Domínio: {a.dominio or '—'}",
            f"- Título: {a.titulo or '—'}",
            f"- Copy: {a.texto or '—'}",
            "- Mídia (abra cada arquivo com Read antes de descrever):",
        ]
        l += [f"  - {arq}" for arq in s.midia.arquivos]
        if s.midia.quadros_falharam:
            l.append("- Aviso: não foi possível extrair quadros do vídeo; descreva a partir da capa.")
        l.append("")
    return "\n".join(l)


def _para_json(s: Selecionado) -> Dict[str, Any]:
    d = asdict(s.anuncio)
    d["link"] = s.anuncio.link
    d["midia"] = s.midia.arquivos
    d["quadros_falharam"] = s.midia.quadros_falharam
    return d


def coletar(page_id: str, marca: str, saida: Path, limite: int, cliente: Any, sessao: Any, hoje: date) -> Dict[str, Any]:
    if not ffmpeg_disponivel():
        raise ErroColeta("ffmpeg não encontrado. Instale com: brew install ffmpeg")
    pasta = saida / slug_marca(marca)
    shutil.rmtree(pasta / "midia", ignore_errors=True)
    pasta.mkdir(parents=True, exist_ok=True)
    try:
        total = extrair_total(cliente.executar(entrada_ator(url_pagina(page_id), 1, apenas_total=True)))
    except ErroColeta:
        total = None
    brutos = cliente.executar(entrada_ator(url_pagina(page_id), AMOSTRA_COLETA))
    anuncios = [a for a in (normalizar_anuncio(b) for b in brutos if isinstance(b, dict)) if a]
    da_pagina = [a for a in anuncios if a.page_id == str(page_id)]
    if da_pagina:
        anuncios = da_pagina
    selecionados, contagem = selecionar(
        anuncios,
        limite,
        lambda a: baixar_midia(a, pasta, sessao),
        lambda a, _m: apagar_midia(pasta, a),
    )
    notas = notas_de_coleta(total, anuncios, selecionados, contagem)
    pagina = anuncios[0].pagina if anuncios else marca
    (pasta / "bruto.json").write_text(json.dumps(brutos, ensure_ascii=False, indent=2), encoding="utf-8")
    (pasta / "anuncios.json").write_text(
        json.dumps([_para_json(s) for s in selecionados], ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (pasta / "resumo.md").write_text(
        escrever_resumo(marca, pagina, str(page_id), total, hoje, selecionados, notas, pasta), encoding="utf-8"
    )
    return {"pasta": str(pasta), "total": total, "selecionados": len(selecionados), "notas": notas}


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Coleta de anúncios da Biblioteca do Meta via Apify (Skill 06).")
    sub = p.add_subparsers(dest="comando", required=True)
    d = sub.add_parser("descobrir")
    d.add_argument("--marca", required=True)
    d.add_argument("--site")
    d.add_argument("--saida", required=True, type=Path)
    c = sub.add_parser("coletar")
    c.add_argument("--page-id", required=True)
    c.add_argument("--marca", required=True)
    c.add_argument("--saida", required=True, type=Path)
    c.add_argument("--limite", type=int, default=10)
    args = p.parse_args(argv)
    try:
        sessao = requests.Session()
        cliente = ClienteApify(ler_token(), sessao=sessao)
        if args.comando == "descobrir":
            print(texto_descoberta(descobrir(args.marca, args.site, args.saida, cliente)))
        else:
            r = coletar(args.page_id, args.marca, args.saida, args.limite, cliente, sessao, date.today())
            total = r["total"] if r["total"] is not None else "não informado"
            print(f'Coleta de {args.marca}: {r["selecionados"]} anúncios selecionados (total ativo: {total}).')
            print(f'Resumo: {r["pasta"]}/resumo.md')
            for n in r["notas"]:
                print(f"- {n}")
    except ErroColeta as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

Obs.: `main` chama `ler_token()` sem argumentos; o teste troca `coleta_meta_ads.ler_token` por uma função sem parâmetros, então a assinatura com padrões funciona nos dois casos.

- [ ] **Step 4: Rodar e ver passar**

Run: `python3 -m pytest scripts/tests/test_coleta_meta_ads.py -q`
Expected: todos PASS.

- [ ] **Step 5: Rodar a suíte Python inteira**

Run: `python3 -m pytest scripts/tests -q`
Expected: todos PASS, incluindo `test_validar_insumo.py`.

- [ ] **Step 6: Conferir a ajuda do CLI**

Run: `python3 scripts/coleta_meta_ads.py coletar --help`
Expected: mostra `--page-id`, `--marca`, `--saida`, `--limite`.

- [ ] **Step 7: Commit**

```bash
git add scripts/coleta_meta_ads.py scripts/tests/test_coleta_meta_ads.py
git commit -m "feat(benchmark): CLI coleta_meta_ads com descoberta, coleta e resumo.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Regras compartilhadas e template do relatório

**Files:**
- Create: `.claude/skills/_shared/benchmark-coleta-e-analise.md`
- Modify (substituir inteiro): `.claude/skills/_shared/relatorio-benchmark.md`
- Modify (substituir inteiro): `.claude/skills/_shared/benchmark-template.html`

**Interfaces:**
- Consumes: `docs/referencias/benchmark-meta-ads/` (Task 1); o formato de `resumo.md` (Task 6).
- Produces: os três arquivos lidos pela Skill 06 (Task 8).

- [ ] **Step 1: Criar `.claude/skills/_shared/benchmark-coleta-e-analise.md`**

````markdown
# Benchmark Meta Ads — coleta e análise dos criativos

Referenciado pela Skill 06 (`briefing-e-benchmark`, Fase 2). Não copie este
conteúdo para dentro de uma skill — referencie este arquivo.

Adaptado de `docs/referencias/benchmark-meta-ads/references/coleta-e-analise.md`
(a versão original navegava a Biblioteca pelo Chrome). Aqui a coleta é feita
por `scripts/coleta_meta_ads.py`, via Apify, e o Claude analisa as imagens e
os quadros de vídeo baixados.

## Quem faz o quê

O script já garante, em código, as regras mecânicas da skill original — não
as refaça à mão:

- até 10 criativos por anunciante, os mais recentes primeiro;
- no máximo 1 catálogo (DPA) por anunciante, inclusive o próprio prospect;
- sem criativos duplicados (mesmo agrupamento de versões da Meta, ou mesmo
  texto e mesma imagem);
- anúncio cuja mídia não baixa é descartado e substituído pelo próximo;
- anunciante com menos de 10 anúncios ativos entra com todos, sem completar.

O Claude faz tudo que é interpretação: descrição visual, tom, foco, etapa de
funil, textos sobrepostos, quadro final dos vídeos e a síntese.

## Comandos

Rode sempre da raiz do projeto, com a ferramenta Bash e `timeout` de
600000 ms (a Apify leva de 1 a 3 minutos por chamada):

```bash
python3 scripts/coleta_meta_ads.py descobrir --marca "Nome" --site dominio.com.br --saida clientes/<slug>/dados/benchmark-meta
python3 scripts/coleta_meta_ads.py coletar --page-id <N> --marca "Nome" --saida clientes/<slug>/dados/benchmark-meta
```

Se o comando sair com `ERRO:`, mostre a mensagem ao analista como veio (ela já
diz o que fazer: token, créditos, ffmpeg) e pare a Fase 2 até ele resolver.
Nunca tente coletar por outro caminho (navegador, Firecrawl, WebFetch da
Biblioteca).

## Descoberta da página oficial

- `confirmada`: siga direto para a coleta com o `page_id` indicado.
- `ambigua` ou `nao_encontrada`: pare e pergunte ao analista no chat,
  mostrando a tabela de candidatas que o script imprimiu e o motivo. Aceite
  como resposta um `page_id` da tabela ou um link da Biblioteca com
  `view_all_page_id=`. Isso é uma pergunta de escolha, não um entregável:
  não use `propor_entregavel`.
- Se o analista já tiver passado um link com `view_all_page_id=`, pule a
  descoberta daquela marca.

## Análise de cada criativo

Para cada anunciante, leia `resumo.md` da pasta da coleta. Para cada anúncio,
**abra com Read cada arquivo listado em "Mídia"** antes de escrever qualquer
coisa sobre ele. Preencha:

| Campo | De onde vem |
|---|---|
| Formato | `resumo.md` (já classificado pelo script) |
| Descrição visual | Das imagens/quadros: pessoas, produtos, textos sobrepostos, ambiente |
| Copy | `resumo.md` (Copy e Título) + textos sobrepostos vistos nas imagens/quadros |
| CTA | `resumo.md` |
| Domínio | `resumo.md` |
| Tom | Aspiracional / Promocional / Educativo / Relacional |
| Foco | Buyer / Seller / Ambos |
| Etapa de funil | Critérios abaixo |
| Plataformas | `resumo.md` |
| Início | `resumo.md` |
| Versões | `resumo.md` |
| Impressões | `resumo.md` (geralmente `—` no Brasil) |

**Etapa de funil (obrigatório seguir):**
- **Topo:** CTA "See details" ou "Visit Instagram profile" + domínio
  instagram.com. Objetivo: aquisição de audiência, awareness.
- **Meio:** CTA "Learn More"/"Saiba mais" + domínio próprio da marca.
  Objetivo: consideração, educação, engajamento.
- **Fundo:** CTA "Shop Now"/"Comprar agora", "Install Now", "Send WhatsApp
  message" + domínio próprio ou app. Objetivo: conversão direta.

**Formato:** o script já distingue vídeo, imagem, carrossel e catálogo. Se a
imagem mostrar claramente o layout de catálogo (grade com nome/preço do
produto) num anúncio marcado de outro jeito, registre como Catálogo (DPA) e
mencione na nota de coleta.

**Vídeos:** os arquivos `video-N-quadro-1..5.jpg` são quadros em ordem de
tempo (~2 s, 25%, 50%, 75% e o final). Descreva a partir do primeiro quadro
com conteúdo (nunca de um quadro preto ou de transição), registre os textos
sobrepostos que aparecerem em qualquer quadro e descreva o quadro final. Se
o resumo avisar que não houve quadros, descreva a partir da capa
(`video-N-capa.jpg`) com o máximo de detalhe e diga isso na descrição. Não há
áudio: nunca descreva fala ou trilha.

**Integridade (obrigatório):** registre somente o que for visualmente
confirmado nas imagens ou que estiver no `resumo.md`. Se não der para
confirmar, use `—`. Nunca descreva ações, expressões ou conteúdos que não
estejam nas imagens.

## Síntese de cada anunciante

Ao terminar os criativos de um anunciante, escreva um parágrafo cobrindo:
formatos predominantes, tema central, posicionamento percebido, distribuição
por etapa de funil, uso de pessoas reais, e destaque comparativo frente aos
anunciantes já analisados. As "Notas de coleta" do `resumo.md` que forem
relevantes viram a "Nota de coleta" daquele anunciante no relatório.

## Arquivo de análise (checkpoint de retomada)

Ao terminar cada anunciante, acrescente o bloco dele a
`clientes/<slug>/dados/benchmark-meta/analise-benchmark.md`, em texto corrido
e sem tabelas: um parágrafo por anúncio com todos os campos, uma linha em
branco entre anúncios e entre anunciantes, e a síntese ao final de cada
anunciante. Comece o arquivo com `# ANÁLISE DE BENCHMARK - <PROSPECT>`.

Se a execução cair no meio, leia esse arquivo e retome do primeiro
anunciante que ainda não estiver nele. Não recolete quem já está.

## Ordem

Um anunciante por vez: os concorrentes na ordem do briefing, o prospect
sempre por último. Termine um (coleta, análise, síntese, arquivo de análise)
antes de começar o próximo.
````

- [ ] **Step 2: Substituir `.claude/skills/_shared/relatorio-benchmark.md` inteiro**

````markdown
# Relatório de benchmark Meta Ads

Referenciado pela Skill 06 (`briefing-e-benchmark`, Fase 2). Não copie este
conteúdo para dentro de uma skill — referencie este arquivo.

Adaptado de `docs/referencias/benchmark-meta-ads/references/geracao-relatorio.md`.
Vale **apenas para a pesquisa de concorrentes** (Skill 06). O benchmarking de
mercado da Skill 07 continua em texto livre.

## O que é

Um relatório HTML autocontido que apresenta a análise dos anúncios ativos de
cada concorrente na Biblioteca de Anúncios do Meta, do próprio prospect, as
respostas às perguntas estratégicas e o ranking de intensidade de mídia. É o
artefato visual que pode ser mostrado ao prospect; **não substitui** a camada
Lição + Evidência (`secoes/06-benchmark.md`).

## Template

Use `.claude/skills/_shared/benchmark-template.html` como esqueleto
**exato** — não modifique a estrutura HTML, as classes CSS ou as cores. Copie
o arquivo, substitua os placeholders entre colchetes pelo conteúdo real e
duplique os blocos repetíveis: um `.bm-concorrente` por concorrente, um
`.bm-cliente` para o prospect, um `.bm-ad-card` por anúncio, um par
`.bm-sq`/`.bm-sa` por pergunta e uma `.bm-rank-row` por anunciante.

Fonte do conteúdo: `dados/benchmark-meta/analise-benchmark.md` e os
`resumo.md` de cada anunciante.

## Checklist obrigatório antes de salvar

- Todo ID de anúncio é um link que abre em nova aba:
  `<a href="https://www.facebook.com/ads/library/?id=ID" target="_blank" rel="noopener noreferrer">ID</a>`.
- A análise do prospect vem depois dos concorrentes e antes da síntese
  estratégica geral.
- O prospect está incluído no ranking de intensidade de mídia.
- Toda tabela de anúncio inclui "Etapa de funil" (com justificativa breve).
- Máximo de 1 catálogo (DPA) por anunciante, inclusive o prospect; anúncios de
  catálogo usam o badge `bm-badge bm-badge-dpa`.
- Anunciante sem anúncios ativos aparece com o bloco `bm-sem-anuncios`:
  "Nenhum anúncio ativo encontrado no momento da pesquisa — confirmado pelo
  Analista."
- Quando a coleta de um anunciante tiver algo digno de nota (poucos anúncios
  ativos, sem catálogo, forte reuso de criativo, vídeo sem quadros), inclua um
  bloco `bm-nota` logo abaixo dos links daquele anunciante, em uma frase.
- Cabeçalho: data da pesquisa, número de concorrentes analisados e a fonte.

## Perguntas estratégicas

Se o briefing (seção 7) trouxe perguntas customizadas, use-as. Caso contrário,
use estas 7:

1. Como os concorrentes comunicam autenticidade e confiança?
2. Quais concorrentes têm campanhas separadas para buyers e sellers?
3. Quem usa posicionamento de valor vs. promoção de preço?
4. Quais formatos predominam no mercado? (vídeo, carrossel, estático,
   catálogo)
5. Há uso de figura pública, fundador ou influenciador?
6. Como cada marca distribui seus anúncios pelo funil? (topo, meio, fundo)
7. Quem está investindo mais intensamente? (volume de anúncios ativos)

Cada resposta compara nominalmente todos os anunciantes analisados,
concorrentes e prospect. Não é observação genérica de mercado.

## Ranking de intensidade de mídia

Uma `bm-rank-row` por anunciante, ordenado do maior para o menor número de
anúncios ativos (o "Anúncios ativos (total)" de cada `resumo.md`). A barra
(`bm-rank-bar`, `style="width:N%"`) do maior volume é 100%; as demais são
`(volume / maior volume) × 100`, arredondado. Se a Apify não informou o total
de algum anunciante, use o número de anúncios coletados e marque o valor com
"≥" (ex.: "≥ 8"). Mantenha a estrutura estética do template — é a seção mais
visual e a mais fácil de descuidar.

## Regras do planejamento

- **Nunca inventar contagem de anúncios** nem criativos.
- **Copy é evidência observada**, permitida no campo Copy e truncada com "…"
  quando longa. Descrição visual, síntese e Lição vão com suas palavras —
  nunca reaproveitar a copy de um concorrente como recomendação de criativo
  para o prospect.
- **PII** (`CLAUDE.md` raiz): protege o cliente **final** do prospect.
  Influenciadores, creators e marcas que aparecem publicamente em anúncios não
  são PII e podem ser nomeados.
- Só reportar concorrentes da lista aprovada pelo analista.

## Onde salvar

- Modo interface (Regra 7 de `regras-de-validacao.md`): salvar em
  `clientes/<slug>/.app/rascunhos/benchmark.html` e chamar
  `propor_entregavel` com tipo `html`, `nome_final` `benchmark`. O app copia
  para `entrega/ativos-aprovados/benchmark/benchmark.html` quando o analista
  aprova.
- Terminal: pedir a checagem no chat e, aprovado, salvar em
  `clientes/<slug>/entrega/ativos-aprovados/benchmark/benchmark.html`.
- Nome estável, sem versionamento: uma nova aprovação sobrescreve.
- Arquivo autocontido (CSS inline, sem dependências externas).
````

- [ ] **Step 3: Substituir `.claude/skills/_shared/benchmark-template.html` pelo template da skill original**

```bash
cp docs/referencias/benchmark-meta-ads/assets/template.html .claude/skills/_shared/benchmark-template.html
```

Depois, com Edit, trocar **só** o comentário de abertura (da linha `<!--` até o primeiro `-->`) por:

```html
<!--
  Base visual do relatório de Benchmark Meta Ads (Skill 06, Fase 2).
  Origem: docs/referencias/benchmark-meta-ads/assets/template.html.

  NÃO editar este arquivo por prospect — é só a origem. Preencher seguindo
  .claude/skills/_shared/relatorio-benchmark.md e salvar onde aquele arquivo
  indica. NÃO altere a estrutura HTML, as classes CSS ou as cores — só
  substitua os placeholders entre colchetes e duplique os blocos repetíveis.

  Blocos repetíveis:
  - .bm-concorrente  → um por concorrente (e um .bm-cliente para o prospect)
  - .bm-ad-card       → um por anúncio analisado dentro de um anunciante
  - .bm-sq / .bm-sa   → um par por pergunta estratégica
  - .bm-rank-row      → um por anunciante no ranking de intensidade
-->
```

- [ ] **Step 4: Conferir que só o comentário mudou**

Run: `diff <(sed '1,/-->/d' docs/referencias/benchmark-meta-ads/assets/template.html) <(sed '1,/-->/d' .claude/skills/_shared/benchmark-template.html) && echo "corpo idêntico"`
Expected: `corpo idêntico`.

- [ ] **Step 5: Conferir que nenhuma regra antiga ficou referenciada**

Run: `grep -rn "Não há bloco de ranking\|2 a 3 por marca\|extract_ad_ids" .claude/ || echo "limpo"`
Expected: `limpo`.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/_shared/benchmark-coleta-e-analise.md .claude/skills/_shared/relatorio-benchmark.md .claude/skills/_shared/benchmark-template.html
git commit -m "feat(skill-06): regras e template do benchmark da skill benchmark-meta-ads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Skill 06, subagente e documentação

**Files:**
- Modify: `.claude/skills/06-briefing-e-benchmark/SKILL.md`
- Modify: `.claude/agents/pesquisador-benchmark.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `clientes/_template/dados/README.md`

**Interfaces:**
- Consumes: os arquivos da Task 7 e o CLI da Task 6.

- [ ] **Step 1: Skill 06 — atualizar o checklist inicial**

Em `.claude/skills/06-briefing-e-benchmark/SKILL.md`, substituir o bloco "Antes de começar (checklist do analista)" por:

```markdown
## Antes de começar (checklist do analista)

- [ ] Skills 01 a 05 concluídas e aprovadas.
- [ ] Lista de até 4 concorrentes, com site ou @ de cada um, se já tiver
      pensado nisso (se não tiver, a skill pergunta antes da Fase 2).
- [ ] `APIFY_TOKEN` configurado no `.env` da raiz e `ffmpeg` instalado (a
      verificação do sistema da interface mostra os dois).
```

- [ ] **Step 2: Skill 06 — ampliar a seção 7 do template do briefing**

No bloco de template do briefing, substituir:

```markdown
## 7. Concorrentes para Pesquisa de Benchmark
Lista de concorrentes a pesquisar + contexto estratégico para orientar a
análise.
```

por:

```markdown
## 7. Concorrentes para Pesquisa de Benchmark
Até 4 concorrentes. Para cada um: nome, site, @ do Instagram, link da
Biblioteca de Anúncios (se o analista tiver) e por que analisar (foco de
atenção). Depois: contexto estratégico para orientar a análise, pontos de
atenção (opcional) e perguntas estratégicas customizadas (opcional —
substituem as 7 padrão do relatório).
```

E no passo 5 do "Processo" da Fase 1, acrescentar ao final: `Se a lista tiver mais de 4 concorrentes, pergunte ao analista quais 4 são prioridade (sem preferência, sugira os que provavelmente têm mais anúncios ativos).`

- [ ] **Step 3: Skill 06 — substituir a "Fase 2" inteira (da linha `## Fase 2 — Pesquisa de Benchmark` até antes de `## Restrições`)**

````markdown
## Fase 2 — Benchmark de anúncios (Meta)

Segue integralmente as regras da skill `benchmark-meta-ads` da agência,
com a coleta feita pela Apify em vez do navegador. Leia antes de começar:

- `.claude/skills/_shared/benchmark-coleta-e-analise.md` — comandos, descoberta,
  análise dos criativos, arquivo de análise;
- `.claude/skills/_shared/relatorio-benchmark.md` — relatório HTML.

Nunca use navegador, Firecrawl ou o subagente `pesquisador-benchmark` nesta
fase: a análise visual precisa acontecer nesta conversa, onde as imagens são
lidas.

Avise o analista no início que a coleta leva alguns minutos por anunciante e
que você vai trabalhar sem pausas, parando só se alguma página precisar de
confirmação.

### 2a. Anunciantes

Os concorrentes da seção 7 do briefing (até 4) + o próprio prospect, sempre
por último. Concorrente sem site informado: encontre o site oficial com
WebSearch antes da descoberta.

### 2b. Descoberta das páginas

Rode `descobrir` para cada anunciante sem link da Biblioteca. Páginas
`confirmada` seguem direto; `ambigua` ou `nao_encontrada` param para uma
pergunta ao analista no chat, com a tabela de candidatas (ver
`benchmark-coleta-e-analise.md`). Pergunte todas as ambíguas de uma vez, numa
mensagem só, antes de começar a coleta.

### 2c. Coleta e análise

Um anunciante por vez: `coletar`, ler `resumo.md`, abrir cada imagem e quadro,
preencher os campos, escrever a síntese e acrescentar o bloco ao arquivo de
análise `dados/benchmark-meta/analise-benchmark.md`. Se a execução tiver
caído antes, retome a partir desse arquivo.

Concorrente sem nenhum anúncio ativo: registre e siga — no relatório ele
aparece com o bloco `bm-sem-anuncios`. Só interrompa a Fase 2 se ela ficar
severamente comprometida (quase nenhum anunciante acessível) ou se o script
sair com `ERRO:`.

### 2d. Relatório e camada estratégica

1. Montar o HTML conforme `relatorio-benchmark.md` e passar pela checagem do
   analista (interface: `propor_entregavel` tipo `html`, `nome_final`
   `benchmark`; terminal: checagem no chat e, aprovado, salvar em
   `entrega/ativos-aprovados/benchmark/benchmark.html`).
2. Depois do HTML aprovado, escrever a camada estratégica em
   `entrega/ativos-aprovados/secoes/06-benchmark.md` (na interface, pelo
   `propor_entregavel` tipo `secao`, `nome_final` `benchmark`), um bloco por
   concorrente:
   - **Lição:** o que o concorrente faz de relevante nos anúncios,
     conectado a uma aplicação direta e específica para o prospect, amarrada
     aos gargalos do diagnóstico (Skills 02 a 05). Nunca observação genérica.
   - **Evidência:** total de anúncios ativos (do `resumo.md`, com a data da
     coleta) + 1 a 3 criativos que sustentam a lição, cada um com o link da
     Biblioteca.
   Feche com 3 a 5 destaques estratégicos para o prospect. É essa camada que
   alimenta a narrativa e a apresentação final.
````

- [ ] **Step 4: Skill 06 — atualizar "Critério de conclusão"**

Substituir a seção inteira por:

```markdown
## Critério de conclusão

- Briefing completo, sem campo em branco não justificado.
- Todos os anunciantes (concorrentes + prospect) coletados e analisados, ou
  registrados como sem anúncio ativo, com o arquivo de análise completo.
- Relatório HTML montado com o template da skill `benchmark-meta-ads`: um card
  por concorrente com os criativos (links clicáveis), a análise do prospect,
  as 7 perguntas (ou as customizadas) e o ranking de intensidade.
- Camada Lição + Evidência escrita para cada concorrente.
- Tudo aprovado pelo analista e salvo: briefing e camada estratégica em
  `entrega/ativos-aprovados/secoes/`, relatório em
  `entrega/ativos-aprovados/benchmark/benchmark.html`.
```

- [ ] **Step 5: Subagente — tirar a Skill 06 de `pesquisador-benchmark.md`**

Em `.claude/agents/pesquisador-benchmark.md`:
- no frontmatter, trocar `description:` por: `Pesquisa referências de mercado usando Firecrawl — estratégias nacionais e internacionais aplicáveis e presença online. Use para o benchmarking de mercado da Skill 07 e, pontualmente, para ler o site do prospect na Skill 02. Não é usado na Skill 06 (o benchmark de anúncios é feito por scripts/coleta_meta_ads.py).`
- na seção "Onde você é usado", remover o item 1 (Skill 06) e renumerar;
- remover as seções "Formato de saída — pesquisa de concorrentes (uso principal)", "A. Blocos estratégicos" e "B. Dados estruturados para o relatório detalhado";
- em "O que não fazer", remover o item sobre o campo Copy do relatório detalhado.

- [ ] **Step 6: `CLAUDE.md` raiz**

Trocar a linha do `pesquisador-benchmark` em "Subagentes disponíveis" por:

```markdown
- **`pesquisador-benchmark`** — pesquisa de mercado e referências via Firecrawl. Usado pela Skill 07 (e pontualmente pela 02). O benchmark de anúncios da Skill 06 não usa subagente: roda `scripts/coleta_meta_ads.py` (Apify) na própria conversa.
```

E acrescentar ao final do arquivo:

```markdown
## Pré-requisitos da Skill 06

O benchmark de anúncios coleta a Biblioteca de Anúncios do Meta pela Apify:
precisa de `APIFY_TOKEN` no `.env` da raiz (modelo em `.env.example`) e do
`ffmpeg` instalado (`brew install ffmpeg`). O token nunca aparece em arquivo
gerado nem na conversa.
```

- [ ] **Step 7: `README.md` raiz — acrescentar seção**

Acrescentar ao final do arquivo:

````markdown
## Token da Apify (Skill 06)

O benchmark de anúncios da Skill 06 coleta a Biblioteca de Anúncios do Meta
pelo ator `apify/facebook-ads-scraper`. Uma vez por máquina:

1. Crie uma conta em apify.com e gere um token em **Settings → API &
   Integrations**.
2. Na raiz do projeto: `cp .env.example .env` e preencha `APIFY_TOKEN=`.
3. Instale o ffmpeg: `brew install ffmpeg`.

Custo de referência: um benchmark completo usa por volta de 350 anúncios na
Apify (US$ 1 a 2 no plano mais caro por resultado).
````

- [ ] **Step 8: `clientes/_template/dados/README.md` — acrescentar ao final**

```markdown
## benchmark-meta/ (gerada pela Skill 06)

Não é insumo do analista. A Skill 06 cria `benchmark-meta/<marca>/` com os
anúncios coletados pela Apify (`resumo.md`, `anuncios.json`, `bruto.json`,
`midia/`) e o arquivo `analise-benchmark.md`. São anúncios públicos das
marcas, sem dado de cliente final.
```

- [ ] **Step 9: Conferir que nenhuma instrução antiga sobreviveu**

Run: `grep -rn "pesquisador-benchmark" .claude/skills/06-briefing-e-benchmark/ ; grep -n "Skill 06" .claude/agents/pesquisador-benchmark.md`
Expected: a primeira só casa com a frase "Nunca use ... o subagente `pesquisador-benchmark`"; a segunda só com a frase da `description` que diz que não é usado na Skill 06.

- [ ] **Step 10: Commit**

```bash
git add .claude/skills/06-briefing-e-benchmark/SKILL.md .claude/agents/pesquisador-benchmark.md CLAUDE.md README.md clientes/_template/dados/README.md
git commit -m "feat(skill-06): benchmark de anúncios via Apify seguindo a skill benchmark-meta-ads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Integração com o app — verificação do sistema e atividade

**Files:**
- Create: `src/packages/core/src/sistema.ts`
- Create: `src/packages/core/test/sistema.test.ts`
- Create: `src/packages/core/test/atividade.test.ts`
- Modify: `src/packages/core/src/atividade.ts`
- Modify: `src/apps/web/app/api/sistema/route.ts`
- Modify: `src/apps/web/components/sistema/verificacao-sistema.tsx`

**Interfaces:**
- Produces: `tokenApifyConfigurado(ambiente: Record<string, string | undefined>, conteudoEnv: string | null): boolean` em `@workspace/core/sistema`; resposta de `/api/sistema` passa a ser `{ claude, python, ffmpeg: boolean, apify: boolean }`.

- [ ] **Step 1: Testes que falham — `src/packages/core/test/sistema.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { tokenApifyConfigurado } from "../src/sistema"

describe("token da Apify", () => {
  it("aceita o token do ambiente", () => {
    expect(tokenApifyConfigurado({ APIFY_TOKEN: "abc" }, null)).toBe(true)
  })
  it("aceita o token do .env, com ou sem aspas", () => {
    expect(tokenApifyConfigurado({}, "OUTRA=1\nAPIFY_TOKEN=abc\n")).toBe(true)
    expect(tokenApifyConfigurado({}, 'APIFY_TOKEN="abc"')).toBe(true)
  })
  it("recusa vazio, só espaços ou ausente", () => {
    expect(tokenApifyConfigurado({ APIFY_TOKEN: "  " }, "APIFY_TOKEN=")).toBe(false)
    expect(tokenApifyConfigurado({}, null)).toBe(false)
    expect(tokenApifyConfigurado({}, "# APIFY_TOKEN=abc")).toBe(false)
  })
})
```

- [ ] **Step 2: Testes que falham — `src/packages/core/test/atividade.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { descreverAtividade } from "../src/atividade"

describe("atividade", () => {
  it("rotula a coleta de anúncios", () => {
    const r = descreverAtividade("Bash", { command: 'python3 scripts/coleta_meta_ads.py coletar --page-id 1 --marca "X" --saida y' }, "/raiz")
    expect(r).toEqual({ nome: "Bash", detalhe: "Coletando anúncios na Biblioteca do Meta" })
  })
  it("mantém o rótulo genérico dos outros comandos", () => {
    expect(descreverAtividade("Bash", { command: "ls dados" }, "/raiz")?.detalhe).toBe("Rodando: ls dados")
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/sistema.test.ts test/atividade.test.ts`
Expected: FAIL (`sistema` não existe; rótulo da coleta diferente).

- [ ] **Step 4: Implementar `src/packages/core/src/sistema.ts`**

```ts
/** Há APIFY_TOKEN não vazio no ambiente ou numa linha `APIFY_TOKEN=...` do .env? Nunca devolve o valor. */
export function tokenApifyConfigurado(ambiente: Record<string, string | undefined>, conteudoEnv: string | null): boolean {
  if ((ambiente.APIFY_TOKEN ?? "").trim()) return true
  if (!conteudoEnv) return false
  return conteudoEnv.split(/\r?\n/).some((linha) => {
    const m = /^\s*APIFY_TOKEN\s*=(.*)$/.exec(linha)
    return m !== null && m[1]!.trim().replace(/^["']|["']$/g, "").trim() !== ""
  })
}
```

- [ ] **Step 5: Rótulo da coleta em `src/packages/core/src/atividade.ts`**

Imediatamente antes da linha `if (nome === "Bash") return { nome, detalhe: \`Rodando: ...` }`, acrescentar:

```ts
  if (nome === "Bash" && String(e.command ?? "").includes("coleta_meta_ads")) {
    return { nome, detalhe: "Coletando anúncios na Biblioteca do Meta" }
  }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run`
Expected: todos PASS.

- [ ] **Step 7: Rota `/api/sistema`**

Em `src/apps/web/app/api/sistema/route.ts`, acrescentar os imports:

```ts
import { readFile } from "node:fs/promises"
import path from "node:path"
import { tokenApifyConfigurado } from "@workspace/core/sistema"
import { servidor } from "@/lib/servidor"
```

E trocar a linha `return Response.json({ claude, python })` por:

```ts
  let ffmpeg = true
  try {
    await exec("ffmpeg", ["-version"], { timeout: 10_000 })
  } catch {
    ffmpeg = false
  }
  let conteudoEnv: string | null = null
  try {
    conteudoEnv = await readFile(path.join(servidor().raiz, ".env"), "utf-8")
  } catch {
    // sem .env: vale só o ambiente
  }
  const apify = tokenApifyConfigurado(process.env, conteudoEnv)
  return Response.json({ claude, python, ffmpeg, apify })
```

- [ ] **Step 8: Aviso não bloqueante em `verificacao-sistema.tsx`**

Em `src/apps/web/components/sistema/verificacao-sistema.tsx`:

1. Em `interface Sistema`, acrescentar `ffmpeg: boolean` e `apify: boolean`.
2. Depois de `const cobrado = ...`, acrescentar:

```tsx
  const faltasBenchmark = [
    !sistema.ffmpeg && "instale o ffmpeg (brew install ffmpeg)",
    !sistema.apify && "coloque o APIFY_TOKEN no arquivo .env da raiz do projeto (modelo em .env.example)",
  ].filter(Boolean) as string[]
```

3. Trocar o bloco `{cobrado && (...)}` por um contêiner que empilha os dois avisos:

```tsx
      {(cobrado || faltasBenchmark.length > 0) && (
        <div className="fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
          {cobrado && (
            <Alert>
              <AlertDescription>
                O Claude Code desta máquina está autenticado por chave de API ({sistema.claude.metodo}), não pela assinatura. O uso vai ser cobrado na API.
              </AlertDescription>
            </Alert>
          )}
          {faltasBenchmark.length > 0 && (
            <Alert>
              <AlertDescription>
                Para o benchmark de anúncios (etapa 06): {faltasBenchmark.join("; ")}. As outras etapas funcionam normalmente.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
```

- [ ] **Step 9: Typecheck e lint**

Run: `cd src && npx turbo typecheck lint --filter=web --filter=@workspace/core`
Expected: sem erros.

- [ ] **Step 10: Conferir a rota**

Com o app rodando (`cd src && npm run dev`, porta do `next dev`), rodar `curl -s http://127.0.0.1:3000/api/sistema | python3 -m json.tool` (ajustar a porta se o Next escolher outra).
Expected: JSON com `"ffmpeg": true` e `"apify": false` (ou `true`, se o `.env` já tiver o token). O valor do token nunca aparece.

- [ ] **Step 11: Commit**

```bash
git add src/packages/core/src/sistema.ts src/packages/core/test/sistema.test.ts src/packages/core/test/atividade.test.ts src/packages/core/src/atividade.ts src/apps/web/app/api/sistema/route.ts src/apps/web/components/sistema/verificacao-sistema.tsx
git commit -m "feat(web): verificação do sistema mostra ffmpeg e token da Apify; rótulo da coleta no chat

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Parte B — Layout redimensionável e visualizador

### Task 10: Funções puras do visualizador

**Files:**
- Modify: `src/packages/core/src/entregaveis.ts` (acrescentar ao final)
- Test: `src/packages/core/test/entregaveis.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `Entregavel`, `EtapaId` de `./tipos`.
- Produces: `entregavelVisivel(entregaveis: Entregavel[], etapa: EtapaId, nomeFinal: string): Entregavel | null`; `htmlParaAbrir(antes: Entregavel[] | null, depois: Entregavel[], etapa: EtapaId): string | null`.

- [ ] **Step 1: Testes que falham (acrescentar em `entregaveis.test.ts`)**

Acrescentar `entregavelVisivel` e `htmlParaAbrir` ao import de `../src/entregaveis` e `import type { Entregavel } from "../src/tipos"` no topo; depois:

```ts
const html = (id: string, over: Partial<Entregavel> = {}): Entregavel => ({
  id,
  etapa: "06",
  tipo: "html",
  titulo: "Benchmark",
  arquivoRascunho: `.app/propostas/${id}.html`,
  nomeFinal: "benchmark",
  status: "pendente",
  ajustePedido: null,
  criadoEm: `2026-09-29T10:00:0${id.slice(-1)}.000Z`,
  decididoEm: null,
  ...over,
})

describe("entregável visível no visualizador", () => {
  it("mostra a versão não substituída mais recente", () => {
    const lista = [html("e1", { status: "substituido" }), html("e2", { status: "aprovado" }), html("e3")]
    expect(entregavelVisivel(lista, "06", "benchmark")?.id).toBe("e3")
  })
  it("mostra o aprovado quando não há pendente", () => {
    const lista = [html("e1", { status: "substituido" }), html("e2", { status: "aprovado" })]
    expect(entregavelVisivel(lista, "06", "benchmark")?.id).toBe("e2")
  })
  it("devolve null quando o entregável sumiu ou é de outra etapa", () => {
    expect(entregavelVisivel([html("e1", { status: "substituido" })], "06", "benchmark")).toBeNull()
    expect(entregavelVisivel([html("e1")], "05", "benchmark")).toBeNull()
    expect(entregavelVisivel([], "06", "outro")).toBeNull()
  })
})

describe("abertura automática do visualizador", () => {
  it("não abre na primeira carga", () => {
    expect(htmlParaAbrir(null, [html("e1")], "06")).toBeNull()
  })
  it("abre quando chega um HTML pendente novo da etapa aberta", () => {
    expect(htmlParaAbrir([], [html("e1")], "06")).toBe("benchmark")
  })
  it("ignora HTML já conhecido, de outra etapa, aprovado ou outro tipo", () => {
    expect(htmlParaAbrir([html("e1")], [html("e1")], "06")).toBeNull()
    expect(htmlParaAbrir([], [html("e1")], "05")).toBeNull()
    expect(htmlParaAbrir([], [html("e1", { status: "aprovado" })], "06")).toBeNull()
    expect(htmlParaAbrir([], [html("e1", { tipo: "secao", arquivoRascunho: ".app/propostas/e1.md" })], "06")).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src/packages/core && npx vitest run test/entregaveis.test.ts`
Expected: FAIL (`entregavelVisivel` não exportado).

- [ ] **Step 3: Implementar (acrescentar ao final de `entregaveis.ts`)**

```ts
/** O que o visualizador mostra para um nome final: a versão não substituída mais recente (pendente ou aprovada). */
export function entregavelVisivel(entregaveis: Entregavel[], etapa: EtapaId, nomeFinal: string): Entregavel | null {
  let visivel: Entregavel | null = null
  for (const e of entregaveis) {
    if (e.etapa !== etapa || e.nomeFinal !== nomeFinal || e.status === "substituido") continue
    if (!visivel || e.criadoEm > visivel.criadoEm) visivel = e
  }
  return visivel
}

/** Nome final do HTML que acabou de chegar pendente na etapa aberta. null na primeira carga (`antes` = null). */
export function htmlParaAbrir(antes: Entregavel[] | null, depois: Entregavel[], etapa: EtapaId): string | null {
  if (antes === null) return null
  const conhecidos = new Set(antes.map((e) => e.id))
  const novo = depois.find((e) => !conhecidos.has(e.id) && e.tipo === "html" && e.status === "pendente" && e.etapa === etapa)
  return novo ? novo.nomeFinal : null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src/packages/core && npx vitest run`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/packages/core/src/entregaveis.ts src/packages/core/test/entregaveis.test.ts
git commit -m "feat(core): escolha da versão exibida e abertura automática do visualizador de HTML

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Colunas redimensionáveis na área de trabalho

**Files:**
- Create: `src/packages/ui/src/components/resizable.tsx` (via shadcn)
- Modify: `src/packages/ui/package.json` (dependência adicionada pelo shadcn)
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx`

**Interfaces:**
- Produces: `@workspace/ui/components/resizable` exporta `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`, e reexporta `usePanelRef`, `useDefaultLayout` de `react-resizable-panels`. `AreaDeTrabalho` passa a ter os painéis `trilha`, `chat`, `painel` (e `visualizador` na Task 12).

- [ ] **Step 1: Instalar o componente**

Run: `cd src/apps/web && npx shadcn@latest add resizable`
Expected: cria `src/packages/ui/src/components/resizable.tsx` e acrescenta `react-resizable-panels` (^4) ao `package.json` do pacote `ui`. Conferir com `grep -n "react-resizable-panels" ../../packages/ui/package.json`.

- [ ] **Step 2: Conferir as exportações e reexportar os hooks**

Abrir `src/packages/ui/src/components/resizable.tsx` e confirmar que exporta `ResizablePanelGroup`, `ResizablePanel` e `ResizableHandle` (com a prop `withHandle`), e que o `ResizableHandle` renderiza `data-slot="resizable-handle"`. Acrescentar ao final do arquivo:

```ts
export { useDefaultLayout, usePanelRef } from "react-resizable-panels"
```

Se o arquivo gerado usar outros nomes de export, ajustar os imports dos Steps 3 e da Task 12 para esses nomes (a API por baixo é a da v4: `Group`, `Panel`, `Separator`).

- [ ] **Step 3: Reescrever o layout de `area-de-trabalho.tsx`**

Substituir os imports de ícones e do grid, e o `return` final. Arquivo completo depois da mudança:

```tsx
"use client"

import { PanelLeftCloseIcon, PanelLeftOpenIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, type PointerEvent as EventoPonteiro } from "react"
import { ORDEM_ETAPAS, type EtapaId, type Estado, type StatusEtapa } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
  usePanelRef,
} from "@workspace/ui/components/resizable"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { ChatEtapa } from "@/components/chat/chat-etapa"
import { useAreaDeTrabalho } from "@/hooks/use-area-de-trabalho"
import { EtapaLiberada } from "./etapa-liberada"
import { ROTULO_STATUS } from "./icone-status"
import { PainelEtapa } from "./painel-etapa"
import { TrilhaEtapas } from "./trilha-etapas"

export function escolherEtapaInicial(estado: Estado): EtapaId {
  const prioridades: StatusEtapa[][] = [["em_andamento", "pronta"], ["desatualizada"], ["liberada"]]
  for (const grupo of prioridades) {
    const id = ORDEM_ETAPAS.find((i) => grupo.includes(estado.etapas[i].status))
    if (id) return id
  }
  return "final"
}

const IDS_PAINEIS = ["trilha", "chat", "painel"]

export function AreaDeTrabalho({ slug }: { slug: string }) {
  const { dados, erro, conversas, deltas, carregarConversa } = useAreaDeTrabalho(slug)
  const [selecionada, setSelecionada] = useState<EtapaId | null>(null)
  const [trilhaRecolhida, setTrilhaRecolhida] = useState(false)
  const [painelRecolhido, setPainelRecolhido] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const trilhaRef = usePanelRef()
  const painelRef = usePanelRef()
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "area-de-trabalho",
    panelIds: IDS_PAINEIS,
    onlySaveAfterUserInteractions: true,
  })
  const etapa = selecionada ?? (dados ? escolherEtapaInicial(dados.estado) : null)

  useEffect(() => {
    if (etapa && dados && conversas[etapa] === undefined) void carregarConversa(etapa)
  }, [etapa, dados, conversas, carregarConversa])

  useEffect(() => {
    if (!arrastando) return
    const soltar = () => setArrastando(false)
    window.addEventListener("pointerup", soltar)
    window.addEventListener("pointercancel", soltar)
    return () => {
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
    }
  }, [arrastando])

  if (erro) {
    return (
      <Empty className="h-svh">
        <EmptyHeader>
          <EmptyTitle>Não consegui abrir este prospect</EmptyTitle>
          <EmptyDescription>{erro}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/" />} nativeButton={false}>
            Voltar para os prospects
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  if (!dados || !etapa) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const etapaCat = dados.catalogo.etapas.find((e) => e.id === etapa)!
  const estadoEtapa = dados.estado.etapas[etapa]
  const indice = ORDEM_ETAPAS.indexOf(etapa)
  const anterior = indice > 0 ? ORDEM_ETAPAS[indice - 1]! : null
  const mostrarChat = estadoEtapa.status !== "liberada" && estadoEtapa.status !== "bloqueada"

  // O iframe do visualizador captura o mouse: durante o arraste de uma alça, ele deixa de receber eventos.
  function aoApertar(ev: EventoPonteiro<HTMLDivElement>) {
    if ((ev.target as Element).closest('[data-slot="resizable-handle"]')) setArrastando(true)
  }

  return (
    <div className={cn("h-svh", arrastando && "[&_iframe]:pointer-events-none")} onPointerDownCapture={aoApertar}>
      <ResizablePanelGroup orientation="horizontal" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
        <ResizablePanel
          id="trilha"
          panelRef={trilhaRef}
          defaultSize="15%"
          minSize="10%"
          maxSize="25%"
          collapsible
          collapsedSize="0%"
          onResize={() => setTrilhaRecolhida(trilhaRef.current?.isCollapsed() ?? false)}
        >
          <TrilhaEtapas catalogo={dados.catalogo} estado={dados.estado} selecionada={etapa} aoSelecionar={setSelecionada} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="chat" minSize="25%">
          <main className="flex h-full min-h-0 flex-col">
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={trilhaRecolhida ? "Mostrar etapas" : "Recolher etapas"}
                onClick={() => (trilhaRecolhida ? trilhaRef.current?.expand() : trilhaRef.current?.collapse())}
              >
                {trilhaRecolhida ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
              </Button>
              <h1 className="font-semibold">{etapaCat.rotuloStatus}</h1>
              <Badge variant="secondary">{ROTULO_STATUS[estadoEtapa.status]}</Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={painelRecolhido ? "Mostrar painel" : "Recolher painel"}
                onClick={() => (painelRecolhido ? painelRef.current?.expand() : painelRef.current?.collapse())}
              >
                {painelRecolhido ? <PanelRightOpenIcon /> : <PanelRightCloseIcon />}
              </Button>
            </header>
            {mostrarChat ? (
              <ChatEtapa slug={slug} etapa={etapa} dados={dados} eventos={conversas[etapa] ?? []} delta={deltas[etapa] ?? ""} />
            ) : (
              <EtapaLiberada slug={slug} etapa={etapa} dados={dados} handoffAnterior={anterior ? dados.estado.etapas[anterior].handoff : null} />
            )}
          </main>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="painel"
          panelRef={painelRef}
          defaultSize="22%"
          minSize="15%"
          maxSize="40%"
          collapsible
          collapsedSize="0%"
          onResize={() => setPainelRecolhido(painelRef.current?.isCollapsed() ?? false)}
        >
          <PainelEtapa slug={slug} etapa={etapa} dados={dados} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
```

Notas para quem implementa:
- `TrilhaEtapas` e `PainelEtapa` hoje assumem ser filhos diretos de um grid de `h-svh`. Se algum deles perder a rolagem, acrescentar `h-full` na raiz do componente (`<nav>`/`<aside>`), sem outras mudanças.
- A borda que antes vinha de `border-x` no `<main>` agora vem das alças.
- Strings em `defaultSize`/`minSize`/`maxSize` são porcentagens; números seriam pixels (API v4).

- [ ] **Step 4: Typecheck e lint**

Run: `cd src && npx turbo typecheck lint --filter=web --filter=@workspace/ui`
Expected: sem erros. Se o typecheck acusar nome de prop diferente no componente gerado (ex.: `direction` em vez de `orientation`), usar o nome do arquivo gerado.

- [ ] **Step 5: Verificar no navegador**

Rodar o app (`cd src && npm run dev`), abrir um prospect e conferir, no navegador embutido:
1. arrastar as duas alças muda as larguras; o chat não fica menor que ~25%;
2. arrastar a trilha até a borda a recolhe; o botão do cabeçalho a expande de volta;
3. o botão da direita recolhe e expande o painel da etapa;
4. recarregar a página mantém as larguras;
5. trilha, chat e painel continuam rolando por dentro.

- [ ] **Step 6: Commit**

```bash
git add src/packages/ui src/apps/web/components/trabalho/area-de-trabalho.tsx src/package-lock.json
git commit -m "feat(web): colunas da área de trabalho redimensionáveis e lembradas no navegador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Visualizador lateral de HTML

**Files:**
- Create: `src/apps/web/components/trabalho/contexto-visualizador.tsx`
- Create: `src/apps/web/components/trabalho/visualizador-html.tsx`
- Modify: `src/apps/web/components/trabalho/area-de-trabalho.tsx`
- Modify: `src/apps/web/components/cards/previa-arquivo.tsx`
- Modify: `src/apps/web/components/cards/card-entregavel.tsx`
- Modify: `src/apps/web/components/trabalho/painel-etapa.tsx`

**Interfaces:**
- Consumes: `entregavelVisivel`, `htmlParaAbrir` (Task 10); layout da Task 11.
- Produces: `ContextoVisualizador` / `useVisualizador(): { abrir: (etapa: EtapaId, nomeFinal: string) => void }`; `VisualizadorHtml({ slug, entregavel, telaCheia, aoAlternarTelaCheia, aoFechar })`; `PreviaArquivo` ganha a prop opcional `aoAbrir?: () => void`; `card-entregavel.tsx` passa a exportar `ROTULO_STATUS_ENTREGAVEL`.

- [ ] **Step 1: Criar `contexto-visualizador.tsx`**

```tsx
"use client"

import { createContext, useContext } from "react"
import type { EtapaId } from "@workspace/core/tipos"

export interface ControleVisualizador {
  abrir: (etapa: EtapaId, nomeFinal: string) => void
}

export const ContextoVisualizador = createContext<ControleVisualizador>({ abrir: () => {} })

export function useVisualizador(): ControleVisualizador {
  return useContext(ContextoVisualizador)
}
```

- [ ] **Step 2: Exportar o rótulo de status em `card-entregavel.tsx`**

Trocar `const ROTULO_STATUS: Record<StatusEntregavel, string> = {` por `export const ROTULO_STATUS_ENTREGAVEL: Record<StatusEntregavel, string> = {` e atualizar o único uso no mesmo arquivo (`ROTULO_STATUS[e.status]` → `ROTULO_STATUS_ENTREGAVEL[e.status]`).

- [ ] **Step 3: Criar `visualizador-html.tsx`**

```tsx
"use client"

import { ExternalLinkIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react"
import { useEffect } from "react"
import type { Entregavel } from "@workspace/core/tipos"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { ROTULO_STATUS_ENTREGAVEL } from "@/components/cards/card-entregavel"
import { urlArquivo } from "@/lib/api"

export function VisualizadorHtml({
  slug,
  entregavel,
  telaCheia,
  aoAlternarTelaCheia,
  aoFechar,
}: {
  slug: string
  entregavel: Entregavel | null
  telaCheia: boolean
  aoAlternarTelaCheia: () => void
  aoFechar: () => void
}) {
  useEffect(() => {
    function aoTeclar(ev: KeyboardEvent) {
      if (ev.key !== "Escape") return
      if (telaCheia) aoAlternarTelaCheia()
      else aoFechar()
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [telaCheia, aoAlternarTelaCheia, aoFechar])

  const url = entregavel ? urlArquivo(slug, entregavel.arquivoRascunho) : null

  return (
    <section className="bg-background flex h-full min-h-0 flex-col" aria-label="Visualizador de relatório">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="truncate text-sm font-medium">{entregavel?.titulo ?? "Relatório"}</h2>
        {entregavel && (
          <Badge variant={entregavel.status === "aprovado" ? "default" : "outline"}>{ROTULO_STATUS_ENTREGAVEL[entregavel.status]}</Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          {entregavel && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={aoAlternarTelaCheia}>
                {telaCheia ? <Minimize2Icon /> : <Maximize2Icon />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Abrir em nova aba"
                render={<a href={url!} target="_blank" rel="noreferrer" />}
                nativeButton={false}
              >
                <ExternalLinkIcon />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
            <XIcon />
          </Button>
        </div>
      </header>
      {entregavel ? (
        <iframe
          key={entregavel.id}
          src={url!}
          title={entregavel.titulo}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          className="min-h-0 w-full flex-1 bg-white"
        />
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Relatório indisponível</EmptyTitle>
            <EmptyDescription>Este relatório não está mais entre os entregáveis da etapa.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}
```

- [ ] **Step 4: `previa-arquivo.tsx` — HTML vira anexo com botão Abrir**

1. Acrescentar `FileCode2Icon` e `PanelRightOpenIcon` ao import de `lucide-react`.
2. Trocar a assinatura por:

```tsx
export function PreviaArquivo({
  slug,
  tipo,
  caminho,
  titulo,
  aoAbrir,
}: {
  slug: string
  tipo: TipoEntregavel
  caminho: string
  titulo: string
  aoAbrir?: () => void
}) {
```

3. Trocar o bloco `if (tipo === "html") { return <iframe ... /> }` por:

```tsx
  if (tipo === "html") {
    return (
      <Attachment state="done">
        <AttachmentMedia variant="icon">
          <FileCode2Icon />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{titulo}</AttachmentTitle>
          <AttachmentDescription>Relatório HTML · abra para conferir</AttachmentDescription>
        </AttachmentContent>
        {aoAbrir && (
          <AttachmentActions>
            <Button size="sm" variant="outline" onClick={aoAbrir}>
              <PanelRightOpenIcon /> Abrir
            </Button>
          </AttachmentActions>
        )}
      </Attachment>
    )
  }
```

- [ ] **Step 5: `card-entregavel.tsx` — passar `aoAbrir`**

Importar `import { useVisualizador } from "@/components/trabalho/contexto-visualizador"`, criar `const { abrir } = useVisualizador()` no topo do componente e trocar a linha do `PreviaArquivo` por:

```tsx
        <PreviaArquivo
          slug={slug}
          tipo={e.tipo}
          caminho={e.arquivoRascunho}
          titulo={e.titulo}
          aoAbrir={e.tipo === "html" ? () => abrir(e.etapa, e.nomeFinal) : undefined}
        />
```

- [ ] **Step 6: `painel-etapa.tsx` — itens HTML clicáveis**

Importar `useVisualizador` do mesmo caminho, criar `const { abrir } = useVisualizador()` e trocar `<span className="truncate">{e.titulo}</span>` por:

```tsx
                  {e.tipo === "html" ? (
                    <button type="button" className="truncate text-left hover:underline" onClick={() => abrir(e.etapa, e.nomeFinal)}>
                      {e.titulo}
                    </button>
                  ) : (
                    <span className="truncate">{e.titulo}</span>
                  )}
```

- [ ] **Step 7: `area-de-trabalho.tsx` — estado, abertura automática, painel e tela cheia**

1. Imports a acrescentar:

```tsx
import { useCallback } from "react"
import { entregavelVisivel, htmlParaAbrir } from "@workspace/core/entregaveis"
import type { Entregavel } from "@workspace/core/tipos"
import { ContextoVisualizador } from "./contexto-visualizador"
import { VisualizadorHtml } from "./visualizador-html"
```

(juntar `useCallback` ao import existente de `react`, e `Entregavel` ao import existente de `@workspace/core/tipos`).

2. Trocar `const IDS_PAINEIS = ["trilha", "chat", "painel"]` por nada (a lista passa a depender do estado) e, dentro do componente, logo após os `useState` existentes, acrescentar:

```tsx
  const [visualizador, setVisualizador] = useState<{ etapa: EtapaId; nomeFinal: string } | null>(null)
  const [telaCheia, setTelaCheia] = useState(false)
  const [entregaveisVistos, setEntregaveisVistos] = useState<Entregavel[] | null>(null)
  const [abertosSozinhos, setAbertosSozinhos] = useState<ReadonlySet<string>>(new Set())
```

3. Antes do `useDefaultLayout`, calcular a etapa e os painéis visíveis (mover a linha `const etapa = ...` para cá):

```tsx
  const etapa = selecionada ?? (dados ? escolherEtapaInicial(dados.estado) : null)
  const visualizadorAberto = visualizador !== null && visualizador.etapa === etapa
  const idsPaineis = visualizadorAberto ? ["trilha", "chat", "visualizador", "painel"] : ["trilha", "chat", "painel"]
```

e passar `panelIds: idsPaineis` ao `useDefaultLayout`.

4. Abertura automática, ajustando estado durante a renderização (padrão do React para "reagir a mudança de dado", sem `useEffect`). Logo depois do `useDefaultLayout`:

```tsx
  if (dados && etapa && dados.estado.entregaveis !== entregaveisVistos) {
    setEntregaveisVistos(dados.estado.entregaveis)
    const nome = htmlParaAbrir(entregaveisVistos, dados.estado.entregaveis, etapa)
    if (nome && !abertosSozinhos.has(`${etapa}/${nome}`)) {
      setAbertosSozinhos(new Set(abertosSozinhos).add(`${etapa}/${nome}`))
      setVisualizador({ etapa, nomeFinal: nome })
    }
  }

  const abrir = useCallback((etapaAlvo: EtapaId, nomeFinal: string) => {
    setAbertosSozinhos((s) => new Set(s).add(`${etapaAlvo}/${nomeFinal}`))
    setVisualizador({ etapa: etapaAlvo, nomeFinal })
  }, [])
  const fechar = useCallback(() => {
    setTelaCheia(false)
    setVisualizador(null)
  }, [])
  const alternarTelaCheia = useCallback(() => setTelaCheia((v) => !v), [])
```

(`useCallback` precisa ficar antes dos `return` antecipados de erro/carregando, como os demais hooks.)

5. Depois do cálculo de `mostrarChat`, montar o visualizador:

```tsx
  const entregavelAberto = visualizadorAberto ? entregavelVisivel(dados.estado.entregaveis, etapa, visualizador!.nomeFinal) : null
  const painelVisualizador = visualizadorAberto ? (
    <VisualizadorHtml
      slug={slug}
      entregavel={entregavelAberto}
      telaCheia={telaCheia}
      aoAlternarTelaCheia={alternarTelaCheia}
      aoFechar={fechar}
    />
  ) : null
```

6. No `return`: envolver tudo em `<ContextoVisualizador.Provider value={{ abrir }}>`; dar ao `ResizablePanelGroup` a prop `key={idsPaineis.join(",")}` (remonta com o layout salvo daquela combinação); e, entre o painel `chat` e o painel `painel`, inserir:

```tsx
        {visualizadorAberto && !telaCheia && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel id="visualizador" defaultSize="50%" minSize="25%">
              {painelVisualizador}
            </ResizablePanel>
          </>
        )}
```

e, logo depois do `</ResizablePanelGroup>` (ainda dentro do Provider e do `div` externo), a tela cheia como camada por cima do layout, que fica intacto por baixo e reaparece igual ao sair:

```tsx
      {visualizadorAberto && telaCheia && <div className="fixed inset-0 z-40">{painelVisualizador}</div>}
```

Obs.: com `telaCheia` ligado, o painel `visualizador` sai do grupo; para o layout salvo não trocar de combinação por isso, `idsPaineis` continua considerando só `visualizadorAberto` (não `telaCheia`). Como o grupo é remontado pela `key` só quando `idsPaineis` muda, entrar e sair da tela cheia não altera tamanhos salvos. Se o `react-resizable-panels` reclamar de painel ausente com `panelIds` declarados, renderizar o painel `visualizador` também em tela cheia com o conteúdo `null` e manter a camada fixa por cima.

- [ ] **Step 8: Typecheck e lint**

Run: `cd src && npx turbo typecheck lint --filter=web`
Expected: sem erros. Se o lint acusar `react-hooks/set-state-in-render` ou similar no bloco do item 4, conferir que as chamadas `setX` estão dentro do `if` que compara `dados.estado.entregaveis !== entregaveisVistos` (é o padrão documentado pelo React; a condição impede laço).

- [ ] **Step 9: Verificar no navegador**

Com o app rodando e um prospect de teste na etapa 06 (ou qualquer etapa com um entregável HTML; para criar um, copiar `docs/referencias/benchmark-meta-ads/assets/template.html` para `clientes/<prospect-teste>/.app/rascunhos/benchmark.html` e pedir ao agente da etapa 06 que o proponha com `propor_entregavel`), conferir:
1. quando o HTML é proposto, o visualizador abre sozinho uma vez ao lado do chat;
2. fechar (X e Esc) volta ao layout de antes; o card no chat continua com o botão **Abrir**, que reabre;
3. arrastar a alça entre chat e visualizador; recarregar com o visualizador aberto e fechado: cada combinação mantém suas larguras;
4. arrastar uma alça passando por cima do iframe não trava;
5. **Tela cheia** cobre a janela; Esc ou o botão voltam ao layout anterior sem mudar larguras;
6. **Abrir em nova aba** abre o HTML sozinho numa aba;
7. no relatório, clicar num link de anúncio abre em nova aba;
8. **Pedir ajuste** e, quando o agente propuser a nova versão, o visualizador troca o conteúdo sem reabrir e não abre de novo sozinho se estiver fechado;
9. clicar no título do HTML na lista do painel da etapa abre o visualizador;
10. trocar de etapa na trilha esconde o visualizador; voltar à etapa mostra de novo.

- [ ] **Step 10: Commit**

```bash
git add src/apps/web/components
git commit -m "feat(web): visualizador lateral de relatório HTML com tela cheia e abertura automática

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificação ponta a ponta com a Apify real

**Files:**
- Create: `docs/superpowers/validacoes/2026-09-29-benchmark-apify.md`
- Possivelmente Modify: `scripts/meta_ads_selecao.py`, `scripts/meta_ads_apify.py`, `scripts/tests/fixtures/apify_anuncios.json` (só se o dado real divergir)

**Pré-requisito:** o analista colocou `APIFY_TOKEN` no `.env` da raiz. Sem isso, parar aqui e pedir.

- [ ] **Step 1: Suítes completas**

Run: `python3 -m pytest scripts/tests -q && (cd src && npx turbo test typecheck lint)`
Expected: tudo verde.

- [ ] **Step 2: Descoberta real com uma marca conhecida**

Run: `python3 scripts/coleta_meta_ads.py descobrir --marca "Insider Store" --site insiderstore.com.br --saida /tmp/bench-teste`
Expected: tabela de candidatas e status (`confirmada` esperado). Anotar o `page_id`.

- [ ] **Step 3: Conferir o formato real contra o fixture**

Run: `python3 -c "import json; d=json.load(open('/tmp/bench-teste/insider-store/descoberta.json')); print(json.dumps(d['candidatas'][:2], ensure_ascii=False, indent=1))"`

Se nomes, curtidas ou domínios vierem vazios: rodar a coleta do Step 4, abrir `bruto.json`, identificar os nomes reais das chaves (ex.: `page_like_count` dentro de outro objeto) e acrescentá-los às chamadas de `campo(...)` em `normalizar_anuncio`. Acrescentar ao fixture um anúncio com a forma real e um teste que o cubra (Task 2, mesmo estilo), rodar `python3 -m pytest scripts/tests -q` e commitar.

- [ ] **Step 4: Coleta real**

Run: `python3 scripts/coleta_meta_ads.py coletar --page-id <page_id do Step 2> --marca "Insider Store" --saida /tmp/bench-teste`
Expected: até 10 anúncios selecionados, total ativo informado (se vier "não informado", abrir o resultado do `onlyTotal` no console da Apify, achar a chave do total e acrescentá-la em `extrair_total`, com teste), `resumo.md` com links, mídia em `midia/<ad_id>/`, quadros `video-N-quadro-*.jpg` para os vídeos e nenhum `.mp4` sobrando (`find /tmp/bench-teste -name "*.mp4"` vazio). Abrir 2 imagens e 1 quadro com Read para confirmar que são legíveis.

- [ ] **Step 5: Conferir que o token não vazou**

Run: `grep -rl "$(grep APIFY_TOKEN .env | cut -d= -f2-)" /tmp/bench-teste || echo "token não aparece nos arquivos"`
Expected: `token não aparece nos arquivos`.

- [ ] **Step 6: Skill 06 completa pela interface**

Num prospect de teste com as etapas 01 a 05 concluídas (ex.: `teste-interface`), rodar a etapa 06 pela interface e conferir: descoberta sem pergunta para marcas confirmadas; pergunta no chat para ambíguas; rótulo "Coletando anúncios na Biblioteca do Meta" durante a coleta; `analise-benchmark.md` crescendo por anunciante; HTML proposto abre sozinho no visualizador, com ranking, 7 perguntas, prospect por último e links abrindo em nova aba; aprovar grava `entrega/ativos-aprovados/benchmark/benchmark.html`.

- [ ] **Step 7: Registrar a validação**

Criar `docs/superpowers/validacoes/2026-09-29-benchmark-apify.md` no formato dos registros existentes em `docs/superpowers/validacoes/`: data, o que foi rodado, marcas usadas, resultado de cada Step (2 a 6), divergências encontradas no formato da Apify e o que foi ajustado, custo aproximado mostrado no console da Apify.

- [ ] **Step 8: Limpar e commitar**

```bash
rm -rf /tmp/bench-teste
git add docs/superpowers/validacoes/2026-09-29-benchmark-apify.md
git commit -m "docs: validação ponta a ponta do benchmark via Apify e do visualizador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
