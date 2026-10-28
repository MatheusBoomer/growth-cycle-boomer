#!/bin/sh
# Subida do contêiner. Começa como root só para preparar o volume /data e depois
# baixa o privilégio com gosu: o app e o agente rodam como o usuário "app".
set -eu

PORT="${PORT:-3000}"
export PORT
# Endereço interno do app (o servidor MCP do agente chama o app por ele); segue a PORT da subida.
export PLANEJAMENTO_URL_INTERNA="${PLANEJAMENTO_URL_INTERNA:-http://127.0.0.1:$PORT}"

# Pastas persistentes: mesa de trabalho dos prospects, memória do agente e HOME do processo.
mkdir -p /data/clientes /data/claude /data/home

# _template e _fixtures vêm sempre do código da imagem: só essas duas pastas são substituídas,
# os prospects que já estão no volume ficam como estão.
for pasta in _template _fixtures; do
  rm -rf "/data/clientes/$pasta"
  cp -R "/app/clientes-base/$pasta" "/data/clientes/$pasta"
done

# Entrega ao usuário do app tudo que ainda não é dele (o volume novo costuma nascer com dono root).
find /data \( ! -user app -o ! -group app \) -exec chown -h app:app {} +

# O app procura os prospects em $PLANEJAMENTO_ROOT/clientes.
ln -sfn /data/clientes /app/clientes

cd /app/src/apps/web
# Sem npm no meio: o SIGTERM do tini chega direto ao processo do Next (desligamento seguro).
exec gosu app node /app/src/node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PORT"
