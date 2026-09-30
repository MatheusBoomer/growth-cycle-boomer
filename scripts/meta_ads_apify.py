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

    def executar(self, entrada: Dict[str, Any], limite_segundos: Optional[float] = None) -> List[Dict[str, Any]]:
        limite = limite_segundos if limite_segundos is not None else self.limite_segundos
        dados = self._pedir("post", f"{BASE}/acts/{ATOR}/runs", json=entrada, timeout=60)["data"]
        run_id, dataset = dados["id"], dados["defaultDatasetId"]
        status = dados.get("status")
        inicio = self.relogio()
        espera = 2.0
        while status not in STATUS_FINAIS:
            if self.relogio() - inicio > limite:
                raise ErroColeta(
                    f"A coleta passou de {int(limite // 60)} minutos. A execução {run_id} "
                    "continua visível em console.apify.com; tente de novo."
                )
            self.dormir(espera)
            espera = min(espera * 1.5, 15.0)
            status = self._pedir("get", f"{BASE}/actor-runs/{run_id}", timeout=60)["data"]["status"]
        if status != "SUCCEEDED":
            raise ErroColeta(f"A execução {run_id} na Apify terminou com status {status}. Tente de novo.")
        itens = self._pedir("get", f"{BASE}/datasets/{dataset}/items", params={"clean": "true", "format": "json"}, timeout=120)
        return itens if isinstance(itens, list) else []
