#!/usr/bin/env bash
# Bateria de verificações da imagem do servidor.
# Uso: bash docker/testar-conteiner.sh [imagem]   (padrão: planejamento:local)
# Constrói a imagem, sobe um contêiner com ambiente FALSO (nenhum segredo real) e um volume
# temporário vazio, confere cada item e sai com código diferente de zero se algum falhar.
# SEM_BUILD=1 pula o build e testa a imagem já existente.
set -u

IMAGEM="${1:-planejamento:local}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUFIXO="$$-$(date +%s)"
NOME="planejamento-teste-$SUFIXO"
VOLUME="planejamento-teste-$SUFIXO"
TMP_LOCAL="$(mktemp -d)"
FALHAS=0

ok() { echo "OK: $*"; }
falha() { echo "FALHA: $*"; FALHAS=$((FALHAS + 1)); }

limpar() {
  docker rm -f "$NOME" >/dev/null 2>&1 || true
  docker volume rm -f "$VOLUME" >/dev/null 2>&1 || true
  rm -rf "$TMP_LOCAL"
}
trap limpar EXIT
trap 'exit 130' INT TERM

encerrar() {
  echo
  if [ "$FALHAS" -eq 0 ]; then echo "Todas as verificações passaram."; exit 0; fi
  echo "$FALHAS verificação(ões) falharam."
  exit 1
}

# Porta local livre (o sistema escolhe uma porta efêmera).
PORTA="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
URL="http://127.0.0.1:$PORTA"

# ---------------------------------------------------------------- 1. build e usuário
if [ "${SEM_BUILD:-0}" != "1" ]; then
  if [ ! -f "$RAIZ/Dockerfile" ]; then
    falha "a imagem constrói (não há Dockerfile em $RAIZ)"
    encerrar
  fi
  inicio=$(date +%s)
  if docker build -t "$IMAGEM" "$RAIZ" >"$TMP_LOCAL/build.log" 2>&1; then
    ok "a imagem constrói ($IMAGEM, $(($(date +%s) - inicio))s)"
  else
    tail -40 "$TMP_LOCAL/build.log"
    falha "a imagem constrói"
    encerrar
  fi
fi

docker volume create "$VOLUME" >/dev/null

subir() {
  docker run -d --name "$NOME" \
    -p "127.0.0.1:$PORTA:3000" \
    -v "$VOLUME:/data" \
    -e PLANEJAMENTO_AUTH=google \
    -e SUPABASE_URL=https://exemplo.invalid \
    -e SUPABASE_PUBLISHABLE_KEY=sb_publishable_falsa \
    -e "PLANEJAMENTO_APP_URL=$URL" \
    -e ANTHROPIC_API_KEY=falsa \
    "$IMAGEM" >/dev/null
}

# Espera /api/saude responder 200 (até 90 s).
esperar_pronto() {
  for _ in $(seq 1 90); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/saude" 2>/dev/null)" = "200" ]; then return 0; fi
    if [ "$(docker inspect -f '{{.State.Running}}' "$NOME" 2>/dev/null)" != "true" ]; then return 1; fi
    sleep 1
  done
  return 1
}

no_conteiner() { docker exec -u app "$NOME" bash -c "$1"; }

if ! subir; then falha "o contêiner sobe"; encerrar; fi
if esperar_pronto; then
  ok "o contêiner sobe e responde em $URL"
else
  docker logs --tail 60 "$NOME" 2>&1
  falha "o contêiner sobe e responde em $URL"
  encerrar
fi

# Processo filho direto do PID 1 (tini): deve ser o Next, com usuário sem privilégio.
PID_APP="$(docker exec "$NOME" bash -c 'for s in /proc/[0-9]*/status; do if grep -q "^PPid:[[:space:]]*1$" "$s" 2>/dev/null; then basename "$(dirname "$s")"; fi; done | head -1')"
UID_APP="$(docker exec "$NOME" bash -c "awk '/^Uid:/{print \$2}' /proc/$PID_APP/status" 2>/dev/null)"
CMD_APP="$(docker exec "$NOME" bash -c "tr '\0' ' ' </proc/$PID_APP/cmdline" 2>/dev/null)"
CMD_PID1="$(docker exec "$NOME" bash -c "tr '\0' ' ' </proc/1/cmdline" 2>/dev/null)"
if [ -n "$UID_APP" ] && [ "$UID_APP" != "0" ] && [[ "$CMD_APP" == *next* ]] && [[ "$CMD_PID1" == *tini* ]]; then
  ok "processo 1 é o tini e o filho (next, pid $PID_APP) roda com uid $UID_APP"
else
  falha "processo do app sem root (pid1='$CMD_PID1', filho='$CMD_APP', uid='$UID_APP')"
fi

# ---------------------------------------------------------------- 2. rotas
pedir() { # pedir <saida> <caminho> [args do curl] -> imprime o status
  local saida="$1" caminho="$2"; shift 2
  curl -s -o "$saida" -D "$saida.cab" -w '%{http_code}' "$@" "$URL$caminho"
}

st="$(pedir "$TMP_LOCAL/saude" /api/saude)"
corpo="$(tr -d ' \n' <"$TMP_LOCAL/saude")"
if [ "$st" = "200" ] && [ "$corpo" = '{"ok":true}' ]; then ok "GET /api/saude 200 {\"ok\":true}"; else falha "GET /api/saude ($st $corpo)"; fi

st="$(pedir "$TMP_LOCAL/saude-evil" /api/saude -H 'Host: evil.example.com')"
corpo="$(tr -d ' \n' <"$TMP_LOCAL/saude-evil")"
if [ "$st" = "200" ] && [ "$corpo" = '{"ok":true}' ]; then ok "GET /api/saude com Host: evil.example.com 200"; else falha "GET /api/saude com Host estranho ($st $corpo)"; fi

st="$(pedir "$TMP_LOCAL/prospects" /api/prospects)"
if [ "$st" = "401" ] && grep -q '"nao_autenticado"' "$TMP_LOCAL/prospects"; then ok "GET /api/prospects 401 nao_autenticado"; else falha "GET /api/prospects ($st $(head -c 200 "$TMP_LOCAL/prospects"))"; fi

st="$(pedir "$TMP_LOCAL/raiz" /)"
destino="$(grep -i '^location:' "$TMP_LOCAL/raiz.cab" | tr -d '\r' | awk '{print $2}')"
if [ "$st" = "307" ] && [[ "$destino" == */login* ]]; then ok "GET / 307 para $destino"; else falha "GET / ($st, location='$destino')"; fi

st="$(pedir "$TMP_LOCAL/login" /login)"
if [ "$st" = "200" ] && grep -q "Entrar com Google" "$TMP_LOCAL/login"; then ok "GET /login traz \"Entrar com Google\""; else falha "GET /login ($st)"; fi

# ---------------------------------------------------------------- 3. ferramentas
if no_conteiner 'python3 -c "import pptx, openpyxl, PIL, pandas, numpy, matplotlib, requests, docx"' >"$TMP_LOCAL/py.log" 2>&1; then
  ok "python3 importa pptx, openpyxl, PIL, pandas, numpy, matplotlib, requests, docx ($(no_conteiner 'command -v python3'))"
else
  falha "imports do Python: $(tail -3 "$TMP_LOCAL/py.log")"
fi

if no_conteiner '
  set -e
  d=$(mktemp -d); cd "$d"
  python3 - <<PY
from pptx import Presentation
from pptx.util import Inches
import openpyxl
p = Presentation()
s = p.slides.add_slide(p.slide_layouts[5])
s.shapes.title.text = "Teste da imagem"
p.save("teste.pptx")
w = openpyxl.Workbook(); w.active["A1"] = "Teste"; w.active["B1"] = 42; w.save("teste.xlsx")
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.plot([1, 2, 3]); plt.savefig("grafico.png")
PY
  # Cada arquivo vai para a própria pasta de saída: um PDF nunca sobrescreve o outro.
  for f in teste.pptx teste.xlsx; do
    n="${f%.*}"
    mkdir -p "$d/pdf-$n"
    timeout 180 soffice -env:UserInstallation=file://$d/perfil --headless --convert-to pdf --outdir "$d/pdf-$n" "$f" >/dev/null 2>&1
    test -s "$d/pdf-$n/$n.pdf"
    pdftoppm -png -r 50 "$d/pdf-$n/$n.pdf" "$d/png-$n"
    ls "$d"/png-"$n"*.png >/dev/null
  done
  test -s grafico.png
  rm -rf "$d"
' >"$TMP_LOCAL/office.log" 2>&1; then
  ok "gera .pptx/.xlsx com Python, converte para PDF com soffice e para PNG com pdftoppm; matplotlib grava PNG"
else
  falha "conversão LibreOffice/poppler: $(tail -5 "$TMP_LOCAL/office.log")"
fi

# O teste do .xlsx em separado, para a mensagem dizer qual dos dois falhou.
if no_conteiner '
  set -e; d=$(mktemp -d); cd "$d"
  python3 -c "import openpyxl; w=openpyxl.Workbook(); w.active[\"A1\"]=1; w.save(\"p.xlsx\")"
  timeout 180 soffice -env:UserInstallation=file://$d/perfil --headless --convert-to pdf --outdir "$d" p.xlsx >/dev/null 2>&1
  pdftoppm -png -r 50 p.pdf p; ls p*.png >/dev/null; rm -rf "$d"
' >"$TMP_LOCAL/xlsx.log" 2>&1; then
  ok ".xlsx convertido para PDF e PNG"
else
  falha "conversão do .xlsx: $(tail -5 "$TMP_LOCAL/xlsx.log")"
fi

# Os próprios scripts de prévia do projeto, com o molde da apresentação e o modelo da projeção.
if no_conteiner '
  set -e; d=$(mktemp -d); cd /app
  python3 scripts/previa_apresentacao.py gerar --pptx .claude/skills/_shared/modelos-apresentacao/molde-apresentacao.pptx --saida "$d/ap" | grep -q "\"slides\""
  ls "$d"/ap/*.png >/dev/null
  python3 scripts/previa_planilha.py gerar --xlsx ".claude/skills/_shared/[MODELO] Projeção de Cenários.xlsx" --saida "$d/pl" | grep -q "\"abas\""
  test -s "$d/pl/planilha.html"; rm -rf "$d"
' >"$TMP_LOCAL/previas.log" 2>&1; then
  ok "scripts/previa_apresentacao.py e scripts/previa_planilha.py rodam com o molde e o modelo do projeto"
else
  falha "scripts de prévia do projeto: $(tail -5 "$TMP_LOCAL/previas.log")"
fi

for cmd in "ffmpeg -version" "ffprobe -version" "pandoc --version" "convert -version"; do
  if no_conteiner "$cmd" >/dev/null 2>&1; then ok "$cmd ($(no_conteiner "$cmd" 2>/dev/null | head -1))"; else falha "$cmd"; fi
done

# firecrawl-mcp pode ficar esperando o stdin: roda com timeout e confere a versão pelo npm.
VERSAO_FC="$(no_conteiner 'npm ls -g --depth=0 firecrawl-mcp 2>/dev/null' | grep -o 'firecrawl-mcp@[0-9][^ ]*' || true)"
no_conteiner 'timeout 10 firecrawl-mcp --help </dev/null' >/dev/null 2>&1; rc_fc=$?
if no_conteiner 'command -v firecrawl-mcp' >/dev/null 2>&1 && [ -n "$VERSAO_FC" ] && { [ "$rc_fc" = "0" ] || [ "$rc_fc" = "124" ]; }; then
  ok "firecrawl-mcp no PATH ($VERSAO_FC, --help saiu com $rc_fc)"
else
  falha "firecrawl-mcp (versão='$VERSAO_FC', --help=$rc_fc)"
fi

fonte="$(no_conteiner 'fc-match Arial' 2>/dev/null)"
if [[ "$fonte" == *Liberation* ]]; then ok "fc-match Arial: $fonte"; else falha "fc-match Arial: '$fonte'"; fi

# ---------------------------------------------------------------- 4. volume /data
if no_conteiner 'test -d /data/clientes/_template && test -d /data/clientes/_fixtures && [ "$(readlink /app/clientes)" = /data/clientes ]'; then
  ok "/data/clientes tem _template e _fixtures; /app/clientes -> /data/clientes"
else
  falha "/data/clientes ou link /app/clientes ($(no_conteiner 'ls -la /app/clientes /data/clientes' 2>&1 | head -5))"
fi

if no_conteiner 'for d in /data/clientes /data/claude /data/home; do [ "$(stat -c %U "$d")" = app ] || exit 1; done'; then
  ok "/data/{clientes,claude,home} pertencem ao usuário app"
else
  falha "dono de /data/{clientes,claude,home}"
fi

no_conteiner 'mkdir -p /data/clientes/ja-existe && echo conteudo > /data/clientes/ja-existe/arquivo.txt'
docker stop -t 30 "$NOME" >/dev/null
docker start "$NOME" >/dev/null
if esperar_pronto && no_conteiner 'grep -q conteudo /data/clientes/ja-existe/arquivo.txt && test -d /data/clientes/_template && test -d /data/clientes/_fixtures'; then
  ok "segunda subida mantém /data/clientes/ja-existe e repõe _template/_fixtures"
else
  docker logs --tail 30 "$NOME" 2>&1
  falha "segunda subida com o volume já preenchido"
fi

# ---------------------------------------------------------------- 5. sem segredos nem dados de prospect
# 5a. Nenhuma camada da imagem: varre cada camada do `docker save` sem gravar em disco.
if docker save "$IMAGEM" | python3 -c '
import re, sys, tarfile
ruim = re.compile(r"(^|/)\.env[^/]*$|(^|/)\.superpowers(/|$)|(^|/)\.git/|^app/clientes/|^app/clientes-base/(?!_template(/|$)|_fixtures(/|$))[^/]+")
achados = []
camadas = 0
viu_codigo = False
with tarfile.open(fileobj=sys.stdin.buffer, mode="r|") as externo:
    for m in externo:
        if not m.isfile() or m.size < 1024:
            continue
        f = externo.extractfile(m)
        try:
            with tarfile.open(fileobj=f, mode="r|*") as camada:
                camadas += 1
                for e in camada:
                    nome = e.name.lstrip("./")
                    if nome == "app/CLAUDE.md":
                        viu_codigo = True
                    # Pacotes de terceiros às vezes trazem um .env de exemplo: só o código do projeto importa aqui.
                    if "/node_modules/" in nome or nome.startswith("usr/") or nome.startswith("opt/venv/"):
                        continue
                    if ruim.search(nome):
                        achados.append(nome)
        except tarfile.ReadError:
            continue
print(f"{camadas} camadas varridas", file=sys.stderr)
if not viu_codigo:
    print("a varredura não encontrou app/CLAUDE.md: formato do docker save não reconhecido")
    sys.exit(1)
if achados:
    print("\n".join(sorted(set(achados))[:20]))
    sys.exit(1)
' >"$TMP_LOCAL/camadas.log" 2>&1; then
  ok "nenhuma camada tem .env*, .superpowers, .git nem clientes/<prospect> ($(tail -1 "$TMP_LOCAL/camadas.log"))"
else
  falha "arquivos proibidos nas camadas: $(head -20 "$TMP_LOCAL/camadas.log")"
fi

if docker history --no-trunc "$IMAGEM" | grep -Eqi 'APIFY_TOKEN=|FIRECRAWL_API_KEY=|ANTHROPIC_API_KEY=|SERVICE_ROLE_KEY=|\.env'; then
  falha "docker history menciona segredo ou .env"
else
  ok "docker history sem segredo nem .env"
fi

if [ -z "$(no_conteiner 'find /app -path /app/src/node_modules -prune -o \( -name ".env*" -o -name ".superpowers" -o -name ".git" \) -print' 2>/dev/null)" ]; then
  ok "nenhum .env*, .superpowers ou .git em /app"
else
  falha "arquivos proibidos em /app: $(no_conteiner 'find /app -path /app/src/node_modules -prune -o \( -name ".env*" -o -name ".superpowers" -o -name ".git" \) -print' | head -5)"
fi

# 5b. Ambiente do processo do app: só nomes esperados (os valores nunca são impressos).
PID_APP="$(docker exec "$NOME" bash -c 'for s in /proc/[0-9]*/status; do if grep -q "^PPid:[[:space:]]*1$" "$s" 2>/dev/null; then basename "$(dirname "$s")"; fi; done | head -1')"
# Lido como o próprio usuário app: o root do contêiner não tem permissão de ler o environ de outro usuário.
NOMES_ENV="$(docker exec -u app "$NOME" bash -c "tr '\0' '\n' </proc/$PID_APP/environ | cut -d= -f1 | sort")"
ESPERADOS=" PATH PWD OLDPWD SHLVL HOSTNAME HOME NODE_VERSION YARN_VERSION LANG LC_ALL TZ VIRTUAL_ENV PYTHONUNBUFFERED PYTHONDONTWRITEBYTECODE NODE_ENV NEXT_TELEMETRY_DISABLED PORT PLANEJAMENTO_ROOT CLAUDE_CONFIG_DIR PLANEJAMENTO_EXECUTOR PLANEJAMENTO_DADOS PLANEJAMENTO_AUTH NEXT_MANUAL_SIG_HANDLE PLANEJAMENTO_URL_INTERNA SUPABASE_URL SUPABASE_PUBLISHABLE_KEY PLANEJAMENTO_APP_URL ANTHROPIC_API_KEY "
estranhos=""
for n in $NOMES_ENV; do [[ "$ESPERADOS" == *" $n "* ]] || estranhos="$estranhos $n"; done
if [ -n "$NOMES_ENV" ] && [ -z "$estranhos" ]; then
  ok "ambiente do app só com as variáveis esperadas (sem SUPABASE_SERVICE_ROLE_KEY, APIFY_TOKEN, FIRECRAWL_API_KEY)"
else
  falha "variáveis inesperadas no ambiente do app:${estranhos:- (nenhuma lida)}"
fi

# ---------------------------------------------------------------- 6. desligamento
# `docker logs` guarda a saída entre reinícios: a linha de desligamento da parada da verificação 4
# ainda está lá. Só vale o que nasceu depois desta parada, então conta antes e depois.
antes="$(docker logs "$NOME" 2>&1 | grep -c "desligamento")"
inicio=$(date +%s)
docker stop -t 30 "$NOME" >/dev/null
duracao=$(($(date +%s) - inicio))
codigo="$(docker inspect -f '{{.State.ExitCode}}' "$NOME")"
depois="$(docker logs "$NOME" 2>&1 | grep -c "desligamento")"
if [ "$codigo" = "0" ] && [ "$duracao" -lt 15 ] && [ "$depois" -gt "$antes" ]; then
  ok "docker stop -t 30 ocioso: código 0 em ${duracao}s e log com a linha de desligamento"
else
  docker logs --tail 20 "$NOME" 2>&1
  falha "desligamento (código=$codigo, ${duracao}s, linhas de desligamento $antes -> $depois)"
fi

encerrar
