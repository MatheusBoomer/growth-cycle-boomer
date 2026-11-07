#!/bin/sh
# Backup diário do planejamento na VPS: copia o schema `planejamento` e os buckets `planejamento-*`
# do Supabase para /opt/planejamento/backups/planejamento-AAAA-MM-DD_HHMM.tar.gz e guarda os
# últimos MANTER_DIAS dias. Roda o script dentro de um contêiner descartável da imagem do app
# (mesmas variáveis do .env), sem parar o app.
#
# Instalação (uma vez, como root na VPS):
#   chmod +x /opt/planejamento/app/docker/backup-vps.sh
#   (crontab -l 2>/dev/null; echo '0 6 * * * /opt/planejamento/app/docker/backup-vps.sh >> /opt/planejamento/backups/backup.log 2>&1') | crontab -
#   (06:00 UTC = 03:00 em Brasília)
set -u

BASE="${BASE:-/opt/planejamento}"
DESTINO="${DESTINO:-$BASE/backups}"
SERVICO="${SERVICO:-app}"
MANTER_DIAS="${MANTER_DIAS:-14}"

carimbo="$(date -u +%Y-%m-%d_%H%M)"
trabalho="$DESTINO/.em-andamento-$carimbo"
mkdir -p "$trabalho"
echo "[$(date -u +%FT%TZ)] backup $carimbo começou"

docker compose -f "$BASE/docker-compose.yml" run --rm --no-deps -T \
  --entrypoint node \
  -v "$BASE/app/scripts/backup:/app/scripts/backup:ro" \
  -v "$trabalho:/saida" \
  "$SERVICO" /app/scripts/backup/backup.mjs /saida
status=$?

if [ "$status" -ne 0 ]; then
  # A pasta parcial fica para análise; os backups antigos não são apagados.
  mv "$trabalho" "$DESTINO/FALHOU-$carimbo"
  echo "[$(date -u +%FT%TZ)] backup $carimbo FALHOU (código $status); parcial em $DESTINO/FALHOU-$carimbo"
  exit 1
fi

tar -czf "$DESTINO/planejamento-$carimbo.tar.gz" -C "$trabalho" . && rm -rf "$trabalho"
# Só apaga os antigos depois de um backup bom.
find "$DESTINO" -maxdepth 1 -name 'planejamento-*.tar.gz' -mtime +"$((MANTER_DIAS - 1))" -delete
find "$DESTINO" -maxdepth 1 -name 'FALHOU-*' -mtime +"$((MANTER_DIAS - 1))" -exec rm -rf {} +
echo "[$(date -u +%FT%TZ)] backup $carimbo ok: $(du -h "$DESTINO/planejamento-$carimbo.tar.gz" | cut -f1)"
