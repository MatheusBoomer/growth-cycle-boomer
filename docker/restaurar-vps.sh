#!/bin/sh
# Restaura o planejamento a partir de um backup da VPS. Sem --aplicar, só mostra o que faria.
#
# Uso (como root na VPS):
#   /opt/planejamento/app/docker/restaurar-vps.sh <arquivo.tar.gz> [--prospect <slug>] [--como <novo-slug>] [--aplicar]
# Ex.: conferir o backup mais recente sem mexer em nada:
#   /opt/planejamento/app/docker/restaurar-vps.sh "$(ls -t /opt/planejamento/backups/planejamento-*.tar.gz | head -1)"
# Regras da restauração: ver o cabeçalho de scripts/backup/restaurar.mjs (só repõe o que falta).
set -eu

BASE="${BASE:-/opt/planejamento}"
SERVICO="${SERVICO:-app}"
arquivo="${1:?informe o arquivo .tar.gz do backup}"
shift

pasta="$(mktemp -d)"
trap 'rm -rf "$pasta"' EXIT
tar -xzf "$arquivo" -C "$pasta"

docker compose -f "$BASE/docker-compose.yml" run --rm --no-deps -T \
  --entrypoint node \
  -v "$BASE/app/scripts/backup:/app/scripts/backup:ro" \
  -v "$pasta:/backup:ro" \
  "$SERVICO" /app/scripts/backup/restaurar.mjs /backup "$@"
