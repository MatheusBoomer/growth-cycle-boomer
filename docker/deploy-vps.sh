#!/bin/sh
# Deploy do app na VPS por uma chave SSH restrita: a chave só consegue rodar este script, que aceita
# três pedidos (vindos em SSH_ORIGINAL_COMMAND, ou no primeiro argumento quando rodado à mão):
#
#   status  commit no ar, idade da imagem, estado do contêiner, saúde do app e o último deploy
#   deploy  pull da main, build da imagem e troca do contêiner, em segundo plano; acompanhe com status
#   log     as últimas 60 linhas do log do último deploy
#
# Qualquer outro pedido é recusado. O contêiner só é trocado se o build terminar bem, e a imagem que
# estava no ar fica guardada como planejamento:vps-anterior. Não há volta automática: subir a imagem
# antiga é decisão de quem opera (pode haver mudança de banco que a versão antiga não entende).
#
# Instalação (uma vez, como root na VPS). A cópia fica fora do clone para um git pull não trocar o
# script no meio de um deploy; quando este arquivo mudar no repositório, repita o cp:
#   cp /opt/planejamento/app/docker/deploy-vps.sh /opt/planejamento/deploy-vps.sh
#   chmod 700 /opt/planejamento/deploy-vps.sh
#   echo 'restrict,command="/opt/planejamento/deploy-vps.sh" CHAVE_PUBLICA' >> /root/.ssh/authorized_keys
set -u

BASE="${BASE:-/opt/planejamento}"
APP="$BASE/app"
IMAGEM="${IMAGEM:-planejamento:vps}"
SERVICO="${SERVICO:-app}"
LOG="$BASE/deploy.log"
TRAVA="$BASE/deploy.lock"
ESTADO="$BASE/deploy.estado"

agora() { date -u +%FT%TZ; }

saude() {
  docker compose -f "$BASE/docker-compose.yml" exec -T "$SERVICO" node -e \
    "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1
}

status() {
  echo "commit no clone: $(git -C "$APP" log --oneline -1 2>/dev/null || echo '?')"
  echo "branch:          $(git -C "$APP" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  echo "imagem:          $(docker image inspect "$IMAGEM" --format '{{.Created}}' 2>/dev/null || echo 'não existe')"
  echo "contêiner:       $(docker inspect planejamento --format '{{.State.Status}} desde {{.State.StartedAt}}' 2>/dev/null || echo 'não existe')"
  if saude; then echo "saúde:           ok"; else echo "saúde:           FALHOU"; fi
  echo "último deploy:   $(cat "$ESTADO" 2>/dev/null || echo 'nenhum registrado')"
}

# Roda em segundo plano, com o log em $LOG. A trava impede dois deploys ao mesmo tempo.
executar_deploy() {
  exec 9>"$TRAVA"
  if ! flock -n 9; then
    echo "$(agora) deploy recusado: já há um em andamento" >>"$LOG"
    return 1
  fi
  falhar() {
    echo "$(agora) FALHOU: $1" >>"$LOG"
    echo "FALHOU em $(agora): $1" >"$ESTADO"
    exit 1
  }
  echo "em andamento desde $(agora)" >"$ESTADO"
  {
    echo "=== deploy $(agora) ==="
    cd "$APP" || exit 1
    git fetch --quiet origin main && git checkout --quiet main && git merge --ff-only --quiet origin/main
  } >>"$LOG" 2>&1 || falhar "git (a main da VPS não avança direto para a do GitHub)"
  commit="$(git -C "$APP" log --oneline -1)"
  echo "$(agora) código em $commit; build começou" >>"$LOG"

  docker build -t "$IMAGEM-novo" "$APP" >>"$LOG" 2>&1 || falhar "build de $commit (o app no ar não foi tocado)"

  docker image inspect "$IMAGEM" >/dev/null 2>&1 && docker tag "$IMAGEM" "$IMAGEM-anterior"
  docker tag "$IMAGEM-novo" "$IMAGEM" && docker rmi "$IMAGEM-novo" >/dev/null 2>&1
  echo "$(agora) build ok; trocando o contêiner (espera um turno em andamento terminar, até 6 min)" >>"$LOG"
  docker compose -f "$BASE/docker-compose.yml" up -d "$SERVICO" >>"$LOG" 2>&1 || falhar "docker compose up"

  tentativas=0
  until saude; do
    tentativas=$((tentativas + 1))
    [ "$tentativas" -ge 30 ] && falhar "o app de $commit não respondeu /api/saude em 90 s (imagem anterior em $IMAGEM-anterior)"
    sleep 3
  done
  echo "$(agora) OK: $commit no ar" >>"$LOG"
  echo "OK em $(agora): $commit no ar" >"$ESTADO"
}

pedido="${SSH_ORIGINAL_COMMAND:-${1:-status}}"
case "$pedido" in
  status) status ;;
  log) tail -n 60 "$LOG" 2>/dev/null || echo "sem log de deploy ainda" ;;
  deploy)
    if ! flock -n "$TRAVA" true 2>/dev/null; then
      echo "já há um deploy em andamento; acompanhe com: status"
      exit 1
    fi
    # setsid + nohup: o deploy continua mesmo quando a conexão SSH fecha.
    # Sem SSH_ORIGINAL_COMMAND: senão o processo filho leria "deploy" de novo e se relançaria.
    setsid nohup env -u SSH_ORIGINAL_COMMAND "$0" __executar </dev/null >/dev/null 2>&1 &
    echo "deploy iniciado em segundo plano; acompanhe com: status (ou log)"
    ;;
  __executar)
    # Só o próprio script chega aqui (pelo setsid acima). Pela chave, SSH_ORIGINAL_COMMAND vem preenchido e é recusado.
    [ -z "${SSH_ORIGINAL_COMMAND:-}" ] || { echo "pedido recusado"; exit 1; }
    executar_deploy
    ;;
  *)
    echo "pedido recusado: use status, deploy ou log"
    exit 1
    ;;
esac
