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
